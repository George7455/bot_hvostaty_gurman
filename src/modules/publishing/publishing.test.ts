import assert from 'node:assert/strict';
import test from 'node:test';

import type { PublicationRepository } from '../../repositories/publication.repository.js';
import type {
  PublicationIntentClaim,
  PublicationIntentRepository
} from '../../repositories/publication-intent.repository.js';
import type { SheetsModule } from '../sheets/index.js';
import { PublishingService, type PublishingTransport } from './index.js';

function createClaim(): PublicationIntentClaim {
  return {
    id: 'intent-1',
    draftId: 'draft-1',
    revisionId: 'revision-1',
    text: 'Одобренный снимок текста',
    sourceType: 'SCHEDULED',
    actorId: '101',
    preparedPayload: null,
    telegraphPath: null,
    telegraphUrl: null,
    leaseToken: 'lease-1',
    attempts: 1
  };
}

test('publishing persists prepared Telegraph payload before channel send and updates the stable sheet item', async () => {
  const events: string[] = [];
  const claim = createClaim();
  const identity = {
    spreadsheetId: 'sheet-1',
    worksheetTitle: 'План',
    sheetItemKey: 'content-42',
    sheetRowNumber: 7
  };

  const intentRepository = {
    async claimForDraft() {
      return claim;
    },
    async savePreparedArtifact(_claim: PublicationIntentClaim, artifact: { payload: string }) {
      events.push(`saved:${artifact.payload}`);
    },
    async markSucceeded() {
      events.push('intent:succeeded');
    }
  } as unknown as PublicationIntentRepository;

  const publicationRepository = {
    async findPublishedDraftState() {
      return null;
    },
    async recordPublishedDraftState(input: { revisionId: string; publishedPayload: string }) {
      events.push(`db:${input.revisionId}:${input.publishedPayload}`);
      return { publication: {} as never, sheetIdentity: identity };
    }
  } as unknown as PublicationRepository;

  const sheets = {
    async markSheetItemPublished(received: typeof identity) {
      assert.deepEqual(received, identity);
      events.push('sheet:published');
    }
  } as unknown as SheetsModule;

  const transport = {
    async prepareChannelPost() {
      events.push('prepared');
      return {
        payload: 'Анонс https://telegra.ph/article',
        telegraphPath: 'article',
        telegraphUrl: 'https://telegra.ph/article'
      };
    },
    async sendPreparedChannelPost() {
      assert.equal(events.at(-1), 'saved:Анонс https://telegra.ph/article');
      events.push('channel:sent');
      return { telegramChatId: '-100', telegramMessageId: '55' };
    },
    async deleteFromChannel() {
      events.push('channel:deleted');
    }
  } satisfies PublishingTransport;

  const service = new PublishingService(publicationRepository, intentRepository, sheets, transport);
  await service.publishApprovedDraft('draft-1', 'revision-1');

  assert.deepEqual(events, [
    'prepared',
    'saved:Анонс https://telegra.ph/article',
    'channel:sent',
    'db:revision-1:Анонс https://telegra.ph/article',
    'sheet:published',
    'intent:succeeded'
  ]);
});

test('ambiguous channel send is quarantined and never finalized as published', async () => {
  const claim = { ...createClaim(), preparedPayload: 'Готовый пост' };
  let reconciliationError = '';
  let publicationWrites = 0;

  const intentRepository = {
    async claimForDraft() {
      return claim;
    },
    async markNeedsReconciliation(_claim: PublicationIntentClaim, error: string) {
      reconciliationError = error;
    }
  } as unknown as PublicationIntentRepository;
  const publicationRepository = {
    async findPublishedDraftState() {
      return null;
    },
    async recordPublishedDraftState() {
      publicationWrites += 1;
      throw new Error('must not run');
    }
  } as unknown as PublicationRepository;
  const transport = {
    async prepareChannelPost() {
      throw new Error('must not run');
    },
    async sendPreparedChannelPost() {
      throw new Error('socket closed after request');
    },
    async deleteFromChannel() {}
  } satisfies PublishingTransport;

  const service = new PublishingService(
    publicationRepository,
    intentRepository,
    {} as SheetsModule,
    transport
  );

  await assert.rejects(service.publishApprovedDraft('draft-1', 'revision-1'), /requires reconciliation/);
  assert.match(reconciliationError, /socket closed after request/);
  assert.equal(publicationWrites, 0);
});

test('a known persisted publication resumes at Sheets without sending a second channel message', async () => {
  const claim = createClaim();
  let sheetWrites = 0;
  let channelWrites = 0;
  let succeeded = false;
  const identity = {
    spreadsheetId: 'sheet-1',
    worksheetTitle: 'План',
    sheetItemKey: 'item-42',
    sheetRowNumber: 8
  };
  const publicationRepository = {
    async findPublishedDraftState() {
      return { publication: {} as never, sheetIdentity: identity };
    }
  } as unknown as PublicationRepository;
  const intentRepository = {
    async claimForDraft() {
      return claim;
    },
    async markSucceeded() {
      succeeded = true;
    }
  } as unknown as PublicationIntentRepository;
  const sheets = {
    async markSheetItemPublished() {
      sheetWrites += 1;
    }
  } as unknown as SheetsModule;
  const transport = {
    async prepareChannelPost() {
      channelWrites += 1;
      return { payload: 'unexpected' };
    },
    async sendPreparedChannelPost() {
      channelWrites += 1;
      return { telegramChatId: '-100', telegramMessageId: '1' };
    },
    async deleteFromChannel() {}
  } satisfies PublishingTransport;

  const service = new PublishingService(publicationRepository, intentRepository, sheets, transport);
  await service.publishApprovedDraft('draft-1', 'revision-1');

  assert.equal(sheetWrites, 1);
  assert.equal(channelWrites, 0);
  assert.equal(succeeded, true);
});
