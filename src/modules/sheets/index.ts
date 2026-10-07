import type { sheets_v4 } from 'googleapis';

import type { AppEnv } from '../../config/index.js';
import type {
  ContentPlanRepository,
  SheetItemIdentity
} from '../../repositories/content-plan.repository.js';
import { createGoogleSheetsClient } from './google-sheets.client.js';
import type { PendingContentPlanRow, PickedContentPlanItem } from './types.js';

const TOPIC_HEADER = 'topic';
const RUBRIC_HEADER = 'rubric';
const STATUS_HEADER = 'status';
const MAX_COLUMNS_RANGE = 'A1:Z';

interface ParsedPendingRow extends PendingContentPlanRow {
  statusColumnNumber: number;
}

interface LocatedSheetItem {
  sheetRowNumber: number;
  statusColumnNumber: number;
  status: string;
}

export interface SheetsModule {
  pickAndPersistNextPendingItem(): Promise<PickedContentPlanItem | null>;
  markSheetItemPublished(identity: SheetItemIdentity): Promise<void>;
}

export class SheetsService implements SheetsModule {
  public constructor(
    private readonly sheets: sheets_v4.Sheets,
    private readonly spreadsheetId: string,
    private readonly contentPlanRepository: ContentPlanRepository,
    private readonly itemKeyHeader: string,
    private readonly worksheetTitle?: string
  ) {}

  public static fromEnv(env: AppEnv, contentPlanRepository: ContentPlanRepository): SheetsService {
    return new SheetsService(
      createGoogleSheetsClient(env),
      env.GOOGLE_SHEETS_ID,
      contentPlanRepository,
      env.GOOGLE_SHEETS_ITEM_KEY_HEADER,
      env.GOOGLE_SHEETS_WORKSHEET_TITLE
    );
  }

  public async pickAndPersistNextPendingItem(): Promise<PickedContentPlanItem | null> {
    const activeWorksheetTitle = await this.resolveWorksheetTitle();
    const pendingRow = await this.findFirstPendingRow(activeWorksheetTitle);
    if (!pendingRow) {
      return null;
    }

    const contentPlanItem = await this.contentPlanRepository.upsertFromSheetRow({
      spreadsheetId: this.spreadsheetId,
      worksheetTitle: activeWorksheetTitle,
      sheetItemKey: pendingRow.sheetItemKey,
      sheetRowNumber: pendingRow.sheetRowNumber,
      topic: pendingRow.topic,
      rubric: pendingRow.rubric,
      status: 'IN_REVIEW'
    });
    if (contentPlanItem.status === 'PUBLISHED') {
      const located = await this.locateSheetItem(activeWorksheetTitle, pendingRow.sheetItemKey);
      if (located.sheetRowNumber !== pendingRow.sheetRowNumber || located.status.length > 0) {
        throw new Error(`Google Sheets item ${pendingRow.sheetItemKey} moved while it was being reconciled.`);
      }
      await this.writeStatusCell(
        activeWorksheetTitle,
        pendingRow.statusColumnNumber,
        pendingRow.sheetRowNumber,
        'PUBLISHED'
      );
      return null;
    }
    if (contentPlanItem.status === 'IN_REVIEW' && contentPlanItem.draftId !== null) {
      await this.markRowInReview(
        activeWorksheetTitle,
        pendingRow.statusColumnNumber,
        pendingRow.sheetRowNumber,
        pendingRow.sheetItemKey
      );
      return null;
    }
    if (contentPlanItem.status !== 'IN_REVIEW') {
      throw new Error(
        `Google Sheets item ${pendingRow.sheetItemKey} is already linked to a completed or active workflow.`
      );
    }

    try {
      await this.markRowInReview(
        activeWorksheetTitle,
        pendingRow.statusColumnNumber,
        pendingRow.sheetRowNumber,
        pendingRow.sheetItemKey
      );
    } catch (error: unknown) {
      await this.contentPlanRepository.markPending(contentPlanItem.id);
      throw new Error(
        `Failed to mark Google Sheets row ${pendingRow.sheetRowNumber} as IN_REVIEW; DB status rollback applied.`,
        { cause: error }
      );
    }

    return {
      contentPlanItemId: contentPlanItem.id,
      spreadsheetId: this.spreadsheetId,
      worksheetTitle: activeWorksheetTitle,
      sheetItemKey: pendingRow.sheetItemKey,
      sheetRowNumber: contentPlanItem.sheetRowNumber,
      topic: contentPlanItem.topic,
      rubric: contentPlanItem.rubric
    };
  }

  public async markSheetItemPublished(identity: SheetItemIdentity): Promise<void> {
    if (identity.spreadsheetId !== this.spreadsheetId) {
      throw new Error('Refusing to publish a Google Sheets item from a different spreadsheet.');
    }

    const located = await this.locateSheetItem(identity.worksheetTitle, identity.sheetItemKey);
    if (located.status === 'PUBLISHED') {
      return;
    }
    if (located.status !== 'IN_REVIEW') {
      throw new Error(
        `Google Sheets item ${identity.sheetItemKey} must be IN_REVIEW before PUBLISHED; found "${located.status}".`
      );
    }

    const statusCellRange = buildA1Range(
      identity.worksheetTitle,
      `${toColumnName(located.statusColumnNumber)}${located.sheetRowNumber}`
    );

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: statusCellRange,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['PUBLISHED']]
      }
    });
  }

  private async resolveWorksheetTitle(): Promise<string> {
    if (this.worksheetTitle && this.worksheetTitle.trim().length > 0) {
      return this.worksheetTitle.trim();
    }

    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      includeGridData: false
    });

    const firstSheetTitle = spreadsheet.data.sheets?.[0]?.properties?.title;
    if (!firstSheetTitle) {
      throw new Error('Google Sheets metadata is missing sheet title.');
    }

    return firstSheetTitle;
  }

  private async findFirstPendingRow(worksheetTitle: string): Promise<ParsedPendingRow | null> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: buildA1Range(worksheetTitle, MAX_COLUMNS_RANGE),
      majorDimension: 'ROWS'
    });

    const rows = response.data.values ?? [];
    if (rows.length < 2) {
      return null;
    }

    const header = rows[0] ?? [];
    const topicIndex = this.findHeaderIndex(header, TOPIC_HEADER);
    const rubricIndex = this.findHeaderIndex(header, RUBRIC_HEADER);
    const statusIndex = this.findHeaderIndex(header, STATUS_HEADER);
    const itemKeyIndex = this.findHeaderIndex(header, this.itemKeyHeader);

    if (topicIndex < 0 || rubricIndex < 0 || statusIndex < 0 || itemKeyIndex < 0) {
      throw new Error(
        `Google Sheets row mapping failed: required headers are topic, rubric, status, ${this.itemKeyHeader}.`
      );
    }

    const malformedRows: number[] = [];

    for (let rowOffset = 1; rowOffset < rows.length; rowOffset += 1) {
      const row = rows[rowOffset] ?? [];
      const status = this.readCell(row, statusIndex);
      if (status.length > 0) {
        continue;
      }

      const topic = this.readCell(row, topicIndex);
      const rubric = this.readCell(row, rubricIndex);
      const sheetItemKey = this.readCell(row, itemKeyIndex);
      if (topic.length === 0 || rubric.length === 0 || sheetItemKey.length === 0) {
        malformedRows.push(rowOffset + 1);
        continue;
      }

      return {
        sheetRowNumber: rowOffset + 1,
        sheetItemKey,
        topic,
        rubric,
        statusColumnNumber: statusIndex + 1
      };
    }

    if (malformedRows.length > 0) {
      throw new Error(`Malformed pending rows in Google Sheets: ${malformedRows.join(', ')}.`);
    }

    return null;
  }

  private async locateSheetItem(worksheetTitle: string, sheetItemKey: string): Promise<LocatedSheetItem> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: buildA1Range(worksheetTitle, MAX_COLUMNS_RANGE),
      majorDimension: 'ROWS'
    });

    const rows = response.data.values ?? [];
    const header = rows[0] ?? [];
    const statusIndex = this.findHeaderIndex(header, STATUS_HEADER);
    const itemKeyIndex = this.findHeaderIndex(header, this.itemKeyHeader);
    if (statusIndex < 0 || itemKeyIndex < 0) {
      throw new Error(`Google Sheets row mapping failed: required headers are status, ${this.itemKeyHeader}.`);
    }

    const matches: LocatedSheetItem[] = [];
    for (let rowOffset = 1; rowOffset < rows.length; rowOffset += 1) {
      const row = rows[rowOffset] ?? [];
      if (this.readCell(row, itemKeyIndex) !== sheetItemKey) {
        continue;
      }
      matches.push({
        sheetRowNumber: rowOffset + 1,
        statusColumnNumber: statusIndex + 1,
        status: this.readCell(row, statusIndex)
      });
    }

    if (matches.length === 0) {
      throw new Error(`Google Sheets item key ${sheetItemKey} was not found.`);
    }
    if (matches.length > 1) {
      throw new Error(`Google Sheets item key ${sheetItemKey} is duplicated.`);
    }
    return matches[0] as LocatedSheetItem;
  }

  private async markRowInReview(
    worksheetTitle: string,
    statusColumnNumber: number,
    sheetRowNumber: number,
    sheetItemKey: string
  ): Promise<void> {
    const located = await this.locateSheetItem(worksheetTitle, sheetItemKey);
    if (located.sheetRowNumber !== sheetRowNumber || located.statusColumnNumber !== statusColumnNumber) {
      throw new Error(`Google Sheets item ${sheetItemKey} moved while it was being claimed.`);
    }
    if (located.status.length > 0) {
      throw new Error(`Google Sheets item ${sheetItemKey} is no longer pending.`);
    }
    await this.writeStatusCell(worksheetTitle, statusColumnNumber, sheetRowNumber, 'IN_REVIEW');
  }

  private async writeStatusCell(
    worksheetTitle: string,
    statusColumnNumber: number,
    sheetRowNumber: number,
    status: 'IN_REVIEW' | 'PUBLISHED'
  ): Promise<void> {
    const statusCellRange = buildA1Range(worksheetTitle, `${toColumnName(statusColumnNumber)}${sheetRowNumber}`);
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: statusCellRange,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[status]]
      }
    });
  }

  private findHeaderIndex(headerRow: string[], expectedHeader: string): number {
    const normalizedExpected = normalizeHeader(expectedHeader);
    return headerRow.findIndex((headerCell) => normalizeHeader(headerCell) === normalizedExpected);
  }

  private readCell(row: string[], cellIndex: number): string {
    const rawValue = row[cellIndex];
    if (typeof rawValue !== 'string') {
      return '';
    }

    return rawValue.trim();
  }
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function toColumnName(columnNumber: number): string {
  let dividend = columnNumber;
  let columnName = '';

  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    columnName = String.fromCharCode(65 + modulo) + columnName;
    dividend = Math.floor((dividend - modulo) / 26);
  }

  return columnName;
}

function buildA1Range(worksheetTitle: string, range: string): string {
  const escapedTitle = worksheetTitle.replace(/'/g, "''");
  return `'${escapedTitle}'!${range}`;
}
