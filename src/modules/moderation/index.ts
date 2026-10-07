import type { DraftsModule } from '../drafts/index.js';
import type { PublishingModule } from '../publishing/index.js';
import type { SessionsModule } from '../sessions/index.js';
import type {
  ModerationDeliveryClaim,
  ModerationDeliveryRepository,
  ModerationMessageContext,
  ModerationMessageReceipt
} from '../../repositories/moderation-delivery.repository.js';
import type { DraftRepository } from '../../repositories/draft.repository.js';

const DELIVERY_LEASE_MS = 5 * 60_000;

export interface ModerationDeliveryPort {
  sendDraftToModerators(draftId: string, text: string): Promise<readonly ModerationMessageReceipt[]>;
}

export class ModerationTransportError extends Error {
  public constructor(
    message: string,
    public readonly receipts: readonly ModerationMessageReceipt[],
    options?: ErrorOptions
  ) {
    super(message, options);
  }
}

export interface ModerationModule {
  enqueueDraftForModeration(draftId: string, expectedRevisionId?: string): Promise<void>;
  approveDraft(actorId: string, draftId: string, context: ModerationMessageContext): Promise<void>;
  rewriteDraft(actorId: string, draftId: string, context: ModerationMessageContext): Promise<void>;
  requestRewriteNotes(actorId: string, draftId: string, context: ModerationMessageContext): Promise<void>;
  submitRewriteNotes(actorId: string, notes: string): Promise<void>;
  processManualUploadArticle(actorId: string, articleText: string): Promise<string>;
  deliverNextPendingDraft(): Promise<boolean>;
}

export class ModerationService implements ModerationModule {
  public constructor(
    private readonly draftRepository: DraftRepository,
    private readonly moderationDeliveryRepository: ModerationDeliveryRepository,
    private readonly draftsModule: DraftsModule,
    private readonly sessionsModule: SessionsModule,
    private readonly publishingModule: PublishingModule,
    private readonly moderationDelivery: ModerationDeliveryPort
  ) {}

  public async enqueueDraftForModeration(draftId: string, expectedRevisionId?: string): Promise<void> {
    const draft = await this.draftRepository.prepareModerationDelivery(draftId, expectedRevisionId);
    const claim = await this.moderationDeliveryRepository.claimForRevision(
      draft.id,
      draft.currentRevisionId,
      DELIVERY_LEASE_MS
    );
    if (!claim) {
      return;
    }
    await this.deliverClaim(claim);
  }

  public async approveDraft(
    actorId: string,
    draftId: string,
    context: ModerationMessageContext
  ): Promise<void> {
    const revisionId = await this.requireDeliveredRevision(draftId, context);
    await this.draftRepository.approveCurrentRevision({
      draftId,
      expectedRevisionId: revisionId,
      actorId
    });
    await this.publishingModule.publishApprovedDraft(draftId, revisionId);
  }

  public async rewriteDraft(
    actorId: string,
    draftId: string,
    context: ModerationMessageContext
  ): Promise<void> {
    const revisionId = await this.requireDeliveredRevision(draftId, context);
    const rewritten = await this.draftsModule.rewriteDraft({
      draftId,
      expectedRevisionId: revisionId,
      actorId,
      actionType: 'REWRITE'
    });
    await this.enqueueDraftForModeration(rewritten.draftId, rewritten.revisionId);
  }

  public async requestRewriteNotes(
    actorId: string,
    draftId: string,
    context: ModerationMessageContext
  ): Promise<void> {
    const revisionId = await this.requireDeliveredRevision(draftId, context);
    await this.sessionsModule.setWaitingNotes(actorId, draftId, revisionId);
  }

  public async submitRewriteNotes(actorId: string, notes: string): Promise<void> {
    const claim = await this.sessionsModule.claimSession(actorId, 'WAITING_NOTES');
    try {
      if (!claim.pendingDraftId || !claim.pendingRevisionId) {
        throw new Error(`WAITING_NOTES session for user ${actorId} has no draft revision.`);
      }
      const rewritten = await this.draftsModule.rewriteDraft({
        draftId: claim.pendingDraftId,
        expectedRevisionId: claim.pendingRevisionId,
        actorId,
        notes,
        actionType: 'REWRITE_NOTES'
      });
      await this.sessionsModule.completeClaim(actorId, claim.processingToken);
      await this.enqueueDraftForModeration(rewritten.draftId, rewritten.revisionId);
    } catch (error: unknown) {
      await this.releaseClaimIfOwned(actorId, claim.processingToken);
      throw error;
    }
  }

  public async processManualUploadArticle(actorId: string, articleText: string): Promise<string> {
    const claim = await this.sessionsModule.claimSession(actorId, 'WAITING_ARTICLE');
    try {
      const draft = await this.draftsModule.createDraftFromManualArticle(articleText);
      await this.sessionsModule.completeClaim(actorId, claim.processingToken);
      await this.enqueueDraftForModeration(draft.draftId, draft.revisionId);
      return draft.draftId;
    } catch (error: unknown) {
      await this.releaseClaimIfOwned(actorId, claim.processingToken);
      throw error;
    }
  }

  public async deliverNextPendingDraft(): Promise<boolean> {
    const claim = await this.moderationDeliveryRepository.claimNext(DELIVERY_LEASE_MS);
    if (!claim) {
      return false;
    }
    await this.deliverClaim(claim);
    return true;
  }

  private async requireDeliveredRevision(
    draftId: string,
    context: ModerationMessageContext
  ): Promise<string> {
    const revisionId = await this.moderationDeliveryRepository.resolveRevisionId(draftId, context);
    if (!revisionId) {
      throw new Error(`Moderation message is not registered for draft ${draftId}.`);
    }
    return revisionId;
  }

  private async deliverClaim(claim: ModerationDeliveryClaim): Promise<void> {
    try {
      const receipts = await this.moderationDelivery.sendDraftToModerators(claim.draftId, claim.text);
      await this.moderationDeliveryRepository.markSent(claim, receipts);
    } catch (error: unknown) {
      const receipts = error instanceof ModerationTransportError ? error.receipts : [];
      await this.moderationDeliveryRepository.markNeedsReconciliation(claim, toErrorMessage(error), receipts);
      throw error;
    }
  }

  private async releaseClaimIfOwned(actorId: string, processingToken: string): Promise<void> {
    try {
      await this.sessionsModule.releaseClaim(actorId, processingToken);
    } catch {
      // Successful work may have already completed the claim. Never overwrite a newer session.
    }
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
