import assert from 'node:assert/strict';
import test from 'node:test';

import type { DraftsModule, RewriteDraftInput } from '../drafts/index.js';
import type { PublishingModule } from '../publishing/index.js';
import type { SessionsModule } from '../sessions/index.js';
import type { DraftRepository, ApproveDraftInput } from '../../repositories/draft.repository.js';
import type {
  ModerationDeliveryClaim,
  ModerationDeliveryRepository,
  ModerationMessageReceipt
} from '../../repositories/moderation-delivery.repository.js';
import { ModerationService, type ModerationDeliveryPort } from './index.js';

test('moderation binds exact callback messages to revisions and rejects stale approval', async () => {
  let currentRevisionId = 'revision-1';
  let currentText = 'Первая версия';
  let currentRevisionNo = 1;
  let nextTelegramMessageId = 10;
  const messageRevisions = new Map<string, string>();
  const published: Array<{ draftId: string; revisionId: string }> = [];

  const draftRepository = {
    async prepareModerationDelivery(draftId: string, expectedRevisionId?: string) {
      assert.equal(draftId, 'draft-1');
      if (expectedRevisionId && expectedRevisionId !== currentRevisionId) {
        throw new Error('stale revision');
      }
      return {
        id: draftId,
        sourceType: 'SCHEDULED' as const,
        status: 'IN_REVIEW' as const,
        currentText,
        currentRevisionId,
        currentRevisionNo,
        approvedRevisionId: null
      };
    },
    async approveCurrentRevision(input: ApproveDraftInput) {
      if (input.expectedRevisionId !== currentRevisionId) {
        throw new Error('stale moderation action');
      }
      return {
        id: input.draftId,
        sourceType: 'SCHEDULED' as const,
        status: 'APPROVED' as const,
        currentText,
        currentRevisionId,
        currentRevisionNo,
        approvedRevisionId: currentRevisionId
      };
    }
  } as unknown as DraftRepository;

  const deliveryRepository = {
    async claimForRevision(draftId: string, revisionId: string): Promise<ModerationDeliveryClaim> {
      return {
        id: `delivery-${revisionId}`,
        draftId,
        revisionId,
        text: currentText,
        leaseToken: `lease-${revisionId}`,
        attempts: 1
      };
    },
    async markSent(claim: ModerationDeliveryClaim, receipts: readonly ModerationMessageReceipt[]) {
      for (const receipt of receipts) {
        messageRevisions.set(
          `${receipt.telegramChatId}:${receipt.telegramMessageId}:${claim.draftId}`,
          claim.revisionId
        );
      }
    },
    async resolveRevisionId(
      draftId: string,
      context: { telegramChatId: string; telegramMessageId: string }
    ) {
      return messageRevisions.get(`${context.telegramChatId}:${context.telegramMessageId}:${draftId}`) ?? null;
    }
  } as unknown as ModerationDeliveryRepository;

  const draftsModule = {
    async rewriteDraft(input: RewriteDraftInput) {
      if (input.expectedRevisionId !== currentRevisionId) {
        throw new Error('stale moderation action');
      }
      assert.equal(input.actionType, 'REWRITE');
      currentRevisionId = 'revision-2';
      currentRevisionNo = 2;
      currentText = 'Вторая версия';
      return { draftId: input.draftId, revisionId: currentRevisionId, text: currentText };
    }
  } as unknown as DraftsModule;

  const publishingModule = {
    async publishApprovedDraft(draftId: string, revisionId: string) {
      published.push({ draftId, revisionId });
    }
  } as unknown as PublishingModule;

  const transport = {
    async sendDraftToModerators(): Promise<readonly ModerationMessageReceipt[]> {
      return [{ telegramChatId: '-500', telegramMessageId: String(nextTelegramMessageId++) }];
    }
  } satisfies ModerationDeliveryPort;

  const service = new ModerationService(
    draftRepository,
    deliveryRepository,
    draftsModule,
    {} as SessionsModule,
    publishingModule,
    transport
  );

  await service.enqueueDraftForModeration('draft-1', 'revision-1');
  await service.rewriteDraft('101', 'draft-1', {
    telegramChatId: '-500',
    telegramMessageId: '10'
  });

  await assert.rejects(
    service.approveDraft('101', 'draft-1', {
      telegramChatId: '-500',
      telegramMessageId: '10'
    }),
    /stale moderation action/
  );

  await service.approveDraft('101', 'draft-1', {
    telegramChatId: '-500',
    telegramMessageId: '11'
  });
  assert.deepEqual(published, [{ draftId: 'draft-1', revisionId: 'revision-2' }]);
});
