import type {
  PublicationIntentClaim,
  PublicationIntentRepository
} from '../../repositories/publication-intent.repository.js';
import type { PublicationRepository } from '../../repositories/publication.repository.js';
import type { SheetsModule } from '../sheets/index.js';

const PUBLICATION_LEASE_MS = 5 * 60_000;

export interface PublishResult {
  telegramChatId: string;
  telegramMessageId: string;
}

export interface PreparedChannelPost {
  payload: string;
  telegraphPath?: string;
  telegraphUrl?: string;
}

export interface PublishingTransport {
  prepareChannelPost(text: string): Promise<PreparedChannelPost>;
  sendPreparedChannelPost(post: PreparedChannelPost): Promise<PublishResult>;
  deleteFromChannel(chatId: string, messageId: string): Promise<void>;
}

export interface PublishingModule {
  publishApprovedDraft(draftId: string, revisionId: string): Promise<void>;
  publishNextPendingDraft(): Promise<boolean>;
}

export class PublishingService implements PublishingModule {
  public constructor(
    private readonly publicationRepository: PublicationRepository,
    private readonly publicationIntentRepository: PublicationIntentRepository,
    private readonly sheetsModule: SheetsModule,
    private readonly publishingTransport: PublishingTransport
  ) {}

  public async publishApprovedDraft(draftId: string, revisionId: string): Promise<void> {
    const claim = await this.publicationIntentRepository.claimForDraft(
      draftId,
      revisionId,
      PUBLICATION_LEASE_MS
    );
    if (!claim) {
      return;
    }
    await this.publishClaim(claim);
  }

  public async publishNextPendingDraft(): Promise<boolean> {
    const claim = await this.publicationIntentRepository.claimNext(PUBLICATION_LEASE_MS);
    if (!claim) {
      return false;
    }
    await this.publishClaim(claim);
    return true;
  }

  private async publishClaim(claim: PublicationIntentClaim): Promise<void> {
    const existingPublication = await this.publicationRepository.findPublishedDraftState(
      claim.draftId,
      claim.revisionId
    );
    if (existingPublication) {
      try {
        if (existingPublication.sheetIdentity) {
          await this.sheetsModule.markSheetItemPublished(existingPublication.sheetIdentity);
        }
        await this.publicationIntentRepository.markSucceeded(claim);
        return;
      } catch (error: unknown) {
        await this.publicationIntentRepository.markFailed(
          claim,
          `Published state exists, but Google Sheets reconciliation failed: ${toErrorMessage(error)}`
        );
        throw error;
      }
    }

    let preparedPost: PreparedChannelPost;
    if (claim.preparedPayload) {
      preparedPost = {
        payload: claim.preparedPayload,
        ...(claim.telegraphPath ? { telegraphPath: claim.telegraphPath } : {}),
        ...(claim.telegraphUrl ? { telegraphUrl: claim.telegraphUrl } : {})
      };
    } else {
      try {
        preparedPost = await this.publishingTransport.prepareChannelPost(claim.text);
        await this.publicationIntentRepository.savePreparedArtifact(claim, preparedPost);
      } catch (error: unknown) {
        await this.publicationIntentRepository.markNeedsReconciliation(
          claim,
          `Channel payload preparation is uncertain: ${toErrorMessage(error)}`
        );
        throw new Error(`Failed to prepare a persistent channel payload for draft ${claim.draftId}.`, {
          cause: error
        });
      }
    }

    let publishResult: PublishResult;
    try {
      publishResult = await this.publishingTransport.sendPreparedChannelPost(preparedPost);
    } catch (error: unknown) {
      await this.publicationIntentRepository.markNeedsReconciliation(claim, toErrorMessage(error));
      throw new Error(
        `Channel publish result for draft ${claim.draftId} is uncertain and requires reconciliation.`,
        { cause: error }
      );
    }

    let persistedState: Awaited<ReturnType<PublicationRepository['recordPublishedDraftState']>>;
    try {
      persistedState = await this.publicationRepository.recordPublishedDraftState({
        draftId: claim.draftId,
        revisionId: claim.revisionId,
        telegramChatId: publishResult.telegramChatId,
        telegramMessageId: publishResult.telegramMessageId,
        publishedPayload: preparedPost.payload,
        ...(preparedPost.telegraphPath !== undefined ? { telegraphPath: preparedPost.telegraphPath } : {}),
        ...(preparedPost.telegraphUrl !== undefined ? { telegraphUrl: preparedPost.telegraphUrl } : {})
      });
    } catch (error: unknown) {
      try {
        await this.publishingTransport.deleteFromChannel(
          publishResult.telegramChatId,
          publishResult.telegramMessageId
        );
        await this.publicationIntentRepository.markFailed(claim, toErrorMessage(error));
      } catch (rollbackError: unknown) {
        await this.publicationIntentRepository.markNeedsReconciliation(
          claim,
          `Persistence failed: ${toErrorMessage(error)}; channel rollback failed: ${toErrorMessage(rollbackError)}`
        );
      }
      throw new Error(`Failed to persist publication state for draft ${claim.draftId}.`, { cause: error });
    }

    if (persistedState.sheetIdentity) {
      try {
        await this.sheetsModule.markSheetItemPublished(persistedState.sheetIdentity);
      } catch (error: unknown) {
        await this.publicationIntentRepository.markFailed(
          claim,
          `Telegram and DB are published, but Google Sheets update failed: ${toErrorMessage(error)}`
        );
        throw new Error(
          `Draft ${claim.draftId} was published, but its Google Sheets item will be retried.`,
          { cause: error }
        );
      }
    }

    await this.publicationIntentRepository.markSucceeded(claim);
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
