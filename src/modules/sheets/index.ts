import type { sheets_v4 } from 'googleapis';

import type { AppEnv } from '../../config/index.js';
import type { ContentPlanRepository } from '../../repositories/content-plan.repository.js';
import { createGoogleSheetsClient } from './google-sheets.client.js';
import type { PendingContentPlanRow, PickedContentPlanItem } from './types.js';

const TOPIC_HEADER = 'topic';
const RUBRIC_HEADER = 'rubric';
const STATUS_HEADER = 'status';
const MAX_COLUMNS_RANGE = 'A1:Z';

interface ParsedPendingRow extends PendingContentPlanRow {
  statusColumnNumber: number;
}

export interface SheetsModule {
  pickAndPersistNextPendingItem(): Promise<PickedContentPlanItem | null>;
  markSheetRowPublished(sheetRowNumber: number): Promise<void>;
}

export class SheetsService implements SheetsModule {
  public constructor(
    private readonly sheets: sheets_v4.Sheets,
    private readonly spreadsheetId: string,
    private readonly contentPlanRepository: ContentPlanRepository,
    private readonly worksheetTitle?: string
  ) {}

  public static fromEnv(env: AppEnv, contentPlanRepository: ContentPlanRepository): SheetsService {
    return new SheetsService(
      createGoogleSheetsClient(env),
      env.GOOGLE_SHEETS_ID,
      contentPlanRepository,
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
      sheetRowNumber: pendingRow.sheetRowNumber,
      topic: pendingRow.topic,
      rubric: pendingRow.rubric,
      status: 'IN_REVIEW'
    });

    try {
      await this.markRowInReview(activeWorksheetTitle, pendingRow.statusColumnNumber, pendingRow.sheetRowNumber);
    } catch (error: unknown) {
      await this.contentPlanRepository.markPending(contentPlanItem.id);
      throw new Error(
        `Failed to mark Google Sheets row ${pendingRow.sheetRowNumber} as IN_REVIEW; DB status rollback applied.`,
        { cause: error }
      );
    }

    return {
      contentPlanItemId: contentPlanItem.id,
      sheetRowNumber: contentPlanItem.sheetRowNumber,
      topic: contentPlanItem.topic,
      rubric: contentPlanItem.rubric
    };
  }

  public async markSheetRowPublished(sheetRowNumber: number): Promise<void> {
    const activeWorksheetTitle = await this.resolveWorksheetTitle();
    const statusColumnNumber = await this.resolveStatusColumnNumber(activeWorksheetTitle);
    const statusCellRange = `${activeWorksheetTitle}!${toColumnName(statusColumnNumber)}${sheetRowNumber}`;

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
      range: `${worksheetTitle}!${MAX_COLUMNS_RANGE}`,
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

    if (topicIndex < 0 || rubricIndex < 0 || statusIndex < 0) {
      throw new Error('Google Sheets row mapping failed: required headers are topic, rubric, status.');
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
      if (topic.length === 0 || rubric.length === 0) {
        malformedRows.push(rowOffset + 1);
        continue;
      }

      return {
        sheetRowNumber: rowOffset + 1,
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

  private async resolveStatusColumnNumber(worksheetTitle: string): Promise<number> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${worksheetTitle}!${MAX_COLUMNS_RANGE}`,
      majorDimension: 'ROWS'
    });

    const rows = response.data.values ?? [];
    const header = rows[0] ?? [];
    const statusIndex = this.findHeaderIndex(header, STATUS_HEADER);
    if (statusIndex < 0) {
      throw new Error('Google Sheets row mapping failed: required headers are topic, rubric, status.');
    }

    return statusIndex + 1;
  }

  private async markRowInReview(
    worksheetTitle: string,
    statusColumnNumber: number,
    sheetRowNumber: number
  ): Promise<void> {
    const statusCellRange = `${worksheetTitle}!${toColumnName(statusColumnNumber)}${sheetRowNumber}`;
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: statusCellRange,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['IN_REVIEW']]
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
