import assert from 'node:assert/strict';
import test from 'node:test';

import { DraftsService } from '../drafts/index.js';
import { GenerationService } from '../generation/index.js';
import { ModerationService } from '../moderation/index.js';
import { PlannerService } from '../planner/index.js';
import { PublishingService } from '../publishing/index.js';
import type { SessionsModule } from '../sessions/index.js';
import type { SheetsModule } from '../sheets/index.js';
import type { DraftRepository, ApproveDraftInput } from '../../repositories/draft.repository.js';
import type { DraftRevisionRepository } from '../../repositories/draft-revision.repository.js';
import type {
  ModerationDeliveryClaim,
  ModerationDeliveryRepository
} from '../../repositories/moderation-delivery.repository.js';
import type { PlannerRunRepository } from '../../repositories/planner-run.repository.js';
import type { PublicationIntentRepository } from '../../repositories/publication-intent.repository.js';
import type { PublicationRepository } from '../../repositories/publication.repository.js';

test('offline workflow runs from a sheet topic through moderation to PUBLISHED', async () => {
  let status: 'NEW' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' = 'NEW';
  let currentText = '';
  const draftId = 'draft-e2e';
  const revisionId = 'revision-e2e';
  let deliveredRevision: string | null = null;
  let sheetPublished = false;

  const draftRepository = {
    async findNextInReviewContentPlanItem() {
      return null;
    },
    async findInReviewContentPlanItemById(contentPlanItemId: string) {
      assert.equal(contentPlanItemId, 'plan-e2e');
      return { id: contentPlanItemId, topic: 'Спокойная прогулка', rubric: 'Поведение' };
    },
    async createLinkedDraftWithInitialRevision(input: { currentText: string }) {
      currentText = input.currentText;
      status = 'NEW';
      return snapshot();
    },
    async prepareModerationDelivery() {
      status = 'IN_REVIEW';
      return snapshot();
    },
    async approveCurrentRevision(input: ApproveDraftInput) {
      assert.equal(input.expectedRevisionId, revisionId);
      status = 'APPROVED';
      return { ...snapshot(), approvedRevisionId: revisionId };
    }
  } as unknown as DraftRepository;

  function snapshot() {
    return {
      id: draftId,
      sourceType: 'SCHEDULED' as const,
      status,
      currentText,
      currentRevisionId: revisionId,
      currentRevisionNo: 1,
      approvedRevisionId: status === 'APPROVED' || status === 'PUBLISHED' ? revisionId : null
    };
  }

  const deliveryRepository = {
    async claimForRevision(): Promise<ModerationDeliveryClaim> {
      return {
        id: 'delivery-e2e',
        draftId,
        revisionId,
        text: currentText,
        leaseToken: 'delivery-lease',
        attempts: 1
      };
    },
    async markSent(claim: ModerationDeliveryClaim) {
      deliveredRevision = claim.revisionId;
    },
    async resolveRevisionId() {
      return deliveredRevision;
    }
  } as unknown as ModerationDeliveryRepository;

  const publicationIntentRepository = {
    async claimForDraft() {
      return {
        id: 'intent-e2e',
        draftId,
        revisionId,
        text: currentText,
        sourceType: 'SCHEDULED' as const,
        actorId: '101',
        preparedPayload: null,
        telegraphPath: null,
        telegraphUrl: null,
        leaseToken: 'publication-lease',
        attempts: 1
      };
    },
    async savePreparedArtifact() {},
    async markSucceeded() {},
    async markFailed() {},
    async markNeedsReconciliation() {}
  } as unknown as PublicationIntentRepository;

  const publicationRepository = {
    async findPublishedDraftState() {
      return null;
    },
    async recordPublishedDraftState(input: { revisionId: string; publishedPayload: string }) {
      assert.equal(input.revisionId, revisionId);
      assert.equal(input.publishedPayload, currentText);
      status = 'PUBLISHED';
      return {
        publication: {} as never,
        sheetIdentity: {
          spreadsheetId: 'sheet-e2e',
          worksheetTitle: 'План',
          sheetItemKey: 'item-e2e',
          sheetRowNumber: 2
        }
      };
    }
  } as unknown as PublicationRepository;

  const sheets = {
    async pickAndPersistNextPendingItem() {
      return {
        contentPlanItemId: 'plan-e2e',
        spreadsheetId: 'sheet-e2e',
        worksheetTitle: 'План',
        sheetItemKey: 'item-e2e',
        sheetRowNumber: 2,
        topic: 'Спокойная прогулка',
        rubric: 'Поведение'
      };
    },
    async markSheetItemPublished() {
      sheetPublished = true;
    }
  } satisfies SheetsModule;

  const generation = new GenerationService({
    async complete() {
      return 'Проверочный пост о спокойной прогулке.';
    }
  });
  const drafts = new DraftsService(
    draftRepository,
    {} as DraftRevisionRepository,
    generation
  );
  const publishing = new PublishingService(
    publicationRepository,
    publicationIntentRepository,
    sheets,
    {
      async prepareChannelPost(text) {
        return { payload: text };
      },
      async sendPreparedChannelPost() {
        return { telegramChatId: '-100', telegramMessageId: '77' };
      },
      async deleteFromChannel() {}
    }
  );
  const moderation = new ModerationService(
    draftRepository,
    deliveryRepository,
    drafts,
    {} as SessionsModule,
    publishing,
    {
      async sendDraftToModerators() {
        return [{ telegramChatId: '101', telegramMessageId: '10' }];
      }
    }
  );
  const planner = new PlannerService(
    sheets,
    drafts,
    moderation,
    publishing,
    {} as PlannerRunRepository
  );

  await planner.runScheduledPlanningTick();
  assert.equal(status, 'IN_REVIEW');
  assert.equal(deliveredRevision, revisionId);

  await moderation.approveDraft('101', draftId, {
    telegramChatId: '101',
    telegramMessageId: '10'
  });
  assert.equal(status, 'PUBLISHED');
  assert.equal(sheetPublished, true);
});
