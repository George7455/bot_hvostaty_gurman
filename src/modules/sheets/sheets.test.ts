import assert from 'node:assert/strict';
import test from 'node:test';

import type { sheets_v4 } from 'googleapis';

import type {
  ContentPlanRepository,
  UpsertContentPlanItemInput
} from '../../repositories/content-plan.repository.js';
import { SheetsService } from './index.js';

test('Sheets workflow follows a stable item key after rows are reordered', async () => {
  let rows = [
    ['topic', 'rubric', 'content_id', 'status'],
    ['Тема', 'Рубрика', 'item-42', '']
  ];
  const updates: string[] = [];
  const sheets = {
    spreadsheets: {
      values: {
        async get() {
          return { data: { values: rows } };
        },
        async update(request: { range: string; requestBody: { values: string[][] } }) {
          updates.push(`${request.range}:${request.requestBody.values[0]?.[0] ?? ''}`);
          return { data: {} };
        }
      }
    }
  } as unknown as sheets_v4.Sheets;

  const upsertInputs: UpsertContentPlanItemInput[] = [];
  const repository = {
    async upsertFromSheetRow(input: UpsertContentPlanItemInput) {
      upsertInputs.push(input);
      return {
        id: 'plan-1',
        ...input,
        draftId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
  } as unknown as ContentPlanRepository;

  const service = new SheetsService(sheets, 'sheet-1', repository, 'content_id', 'План контента');
  const picked = await service.pickAndPersistNextPendingItem();

  assert.equal(upsertInputs[0]?.sheetItemKey, 'item-42');
  assert.equal(picked?.sheetRowNumber, 2);
  assert.equal(updates.at(-1), "'План контента'!D2:IN_REVIEW");

  rows = [
    ['topic', 'rubric', 'content_id', 'status'],
    ['Другая', 'Рубрика', 'item-99', ''],
    ['Тема', 'Рубрика', 'item-42', 'IN_REVIEW']
  ];
  await service.markSheetItemPublished({
    spreadsheetId: 'sheet-1',
    worksheetTitle: 'План контента',
    sheetItemKey: 'item-42',
    sheetRowNumber: 2
  });
  assert.equal(updates.at(-1), "'План контента'!D3:PUBLISHED");
});
