import type { DraftRepository } from '../../repositories/draft.repository.js';
import type { PublicationRepository } from '../../repositories/publication.repository.js';
import type { SheetsModule } from '../sheets/index.js';

export interface PublishResult {
  telegramChatId: string;
  telegramMessageId: string;
}

export interface PublishingTransport {
  publishToChannel(text: string): Promise<PublishResult>;
  deleteFromChannel(chatId: string, messageId: string): Promise<void>;
}

export interface PublishingModule {
  publishApprovedDraft(draftId: string): Promise<void>;
}

export class PublishingService implements PublishingModule {
  public constructor(
    private readonly draftRepository: DraftRepository,
    private readonly publicationRepository: PublicationRepository,
    private readonly sheetsModule: SheetsModule,
    private readonly publishingTransport: PublishingTransport
  ) {}

  public async publishApprovedDraft(draftId: string): Promise<void> {
    const draft = await this.draftRepository.findById(draftId);
    if (!draft) {
      throw new Error(`Draft not found for publish: ${draftId}`);
    }

    if (draft.status !== 'APPROVED') {
      throw new Error(`Draft ${draftId} must be APPROVED before publishing.`);
    }

    const publishResult = await this.publishingTransport.publishToChannel(draft.currentText);
    let persistedState:
      | {
          sheetRowNumber: number | null;
        }
      | null = null;

    try {
      persistedState = await this.publicationRepository.recordPublishedDraftState(
        draft.id,
        publishResult.telegramChatId,
        publishResult.telegramMessageId
      );
    } catch (error: unknown) {
      await this.publishingTransport.deleteFromChannel(publishResult.telegramChatId, publishResult.telegramMessageId);
      throw new Error(`Failed to persist publish state for draft ${draft.id}; channel message was rolled back.`, {
        cause: error
      });
    }

    if (!persistedState.sheetRowNumber) {
      return;
    }

    try {
      await this.sheetsModule.markSheetRowPublished(persistedState.sheetRowNumber);
    } catch (error: unknown) {
      await this.publicationRepository.rollbackPublishedDraftState(draft.id);
      await this.publishingTransport.deleteFromChannel(publishResult.telegramChatId, publishResult.telegramMessageId);
      throw new Error(`Failed to mark sheet row as PUBLISHED for draft ${draft.id}; publish state was rolled back.`, {
        cause: error
      });
    }
  }
}
