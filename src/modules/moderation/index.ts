import type { ModerationActionType } from '@prisma/client';

import type { DraftsModule } from '../drafts/index.js';
import type { PublishingModule } from '../publishing/index.js';
import type { SessionsModule } from '../sessions/index.js';
import type { DraftRepository } from '../../repositories/draft.repository.js';
import type { ModerationActionRepository } from '../../repositories/moderation-action.repository.js';

export interface ModerationDeliveryPort {
  sendDraftToModerators(draftId: string, text: string): Promise<void>;
}

export interface ModerationModule {
  enqueueDraftForModeration(draftId: string): Promise<void>;
  approveDraft(actorId: string, draftId: string): Promise<void>;
  rewriteDraft(actorId: string, draftId: string): Promise<void>;
  requestRewriteNotes(actorId: string, draftId: string): Promise<void>;
  submitRewriteNotes(actorId: string, notes: string): Promise<void>;
  processManualUploadArticle(actorId: string, articleText: string): Promise<string>;
}

export class ModerationService implements ModerationModule {
  public constructor(
    private readonly draftRepository: DraftRepository,
    private readonly moderationActionRepository: ModerationActionRepository,
    private readonly draftsModule: DraftsModule,
    private readonly sessionsModule: SessionsModule,
    private readonly publishingModule: PublishingModule,
    private readonly moderationDelivery: ModerationDeliveryPort
  ) {}

  public async enqueueDraftForModeration(draftId: string): Promise<void> {
    const draft = await this.draftRepository.findById(draftId);
    if (!draft) {
      throw new Error(`Draft not found for moderation enqueue: ${draftId}`);
    }

    await this.draftRepository.updateStatus(draft.id, 'IN_REVIEW');
    await this.moderationDelivery.sendDraftToModerators(draft.id, draft.currentText);
  }

  public async approveDraft(actorId: string, draftId: string): Promise<void> {
    const draft = await this.draftRepository.findById(draftId);
    if (!draft) {
      throw new Error(`Draft not found for approve: ${draftId}`);
    }

    if (draft.status === 'PUBLISHED') {
      throw new Error(`Draft ${draftId} is already published.`);
    }

    if (draft.status === 'IN_REVIEW') {
      await this.appendAction(draftId, actorId, 'APPROVE');
      await this.draftRepository.updateStatus(draftId, 'APPROVED');
    } else if (draft.status !== 'APPROVED') {
      throw new Error(`Draft ${draftId} cannot be approved from status ${draft.status}.`);
    }

    await this.publishingModule.publishApprovedDraft(draftId);
  }

  public async rewriteDraft(actorId: string, draftId: string): Promise<void> {
    await this.ensureDraftInReview(draftId, 'rewrite');
    await this.appendAction(draftId, actorId, 'REWRITE');
    await this.draftsModule.rewriteDraft(draftId);
    await this.enqueueDraftForModeration(draftId);
  }

  public async requestRewriteNotes(actorId: string, draftId: string): Promise<void> {
    await this.ensureDraftInReview(draftId, 'rewrite_notes');
    await this.sessionsModule.setWaitingNotes(actorId, draftId);
  }

  public async submitRewriteNotes(actorId: string, notes: string): Promise<void> {
    const session = await this.sessionsModule.getSession(actorId);
    if (session.mode !== 'WAITING_NOTES' || !session.pendingDraftId) {
      throw new Error(`User ${actorId} is not in WAITING_NOTES mode.`);
    }

    await this.appendAction(session.pendingDraftId, actorId, 'REWRITE_NOTES', notes);
    await this.draftsModule.rewriteDraft(session.pendingDraftId, notes);
    await this.enqueueDraftForModeration(session.pendingDraftId);
    await this.sessionsModule.clearSession(actorId);
  }

  public async processManualUploadArticle(actorId: string, articleText: string): Promise<string> {
    const draftId = await this.draftsModule.createDraftFromManualArticle(articleText);
    await this.enqueueDraftForModeration(draftId);
    await this.sessionsModule.clearSession(actorId);
    return draftId;
  }

  private async appendAction(
    draftId: string,
    actorId: string,
    actionType: ModerationActionType,
    notes?: string
  ): Promise<void> {
    await this.moderationActionRepository.appendAction(draftId, actorId, actionType, notes);
  }

  private async ensureDraftInReview(draftId: string, action: 'rewrite' | 'rewrite_notes'): Promise<void> {
    const draft = await this.draftRepository.findById(draftId);
    if (!draft) {
      throw new Error(`Draft not found for ${action}: ${draftId}`);
    }

    if (draft.status !== 'IN_REVIEW') {
      throw new Error(`Draft ${draftId} cannot be ${action} from status ${draft.status}.`);
    }
  }
}
