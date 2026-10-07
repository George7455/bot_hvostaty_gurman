import type { ContentPlanItem, ContentPlanStatus, PrismaClient } from '@prisma/client';

export interface SheetItemIdentity {
  spreadsheetId: string;
  worksheetTitle: string;
  sheetItemKey: string;
  sheetRowNumber: number;
}

export interface UpsertContentPlanItemInput extends SheetItemIdentity {
  topic: string;
  rubric: string;
  status?: ContentPlanStatus | null;
}

export interface ContentPlanRepository {
  upsertFromSheetRow(input: UpsertContentPlanItemInput): Promise<ContentPlanItem>;
  findBySheetIdentity(identity: Omit<SheetItemIdentity, 'sheetRowNumber'>): Promise<ContentPlanItem | null>;
  findByDraftId(draftId: string): Promise<ContentPlanItem | null>;
  findFirstPending(): Promise<ContentPlanItem | null>;
  markInReview(contentPlanItemId: string, draftId?: string): Promise<void>;
  markPending(contentPlanItemId: string): Promise<void>;
  markPublished(contentPlanItemId: string): Promise<void>;
}

export class PrismaContentPlanRepository implements ContentPlanRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async upsertFromSheetRow(input: UpsertContentPlanItemInput): Promise<ContentPlanItem> {
    const item = await this.prisma.contentPlanItem.upsert({
      where: {
        spreadsheetId_worksheetTitle_sheetItemKey: {
          spreadsheetId: input.spreadsheetId,
          worksheetTitle: input.worksheetTitle,
          sheetItemKey: input.sheetItemKey
        }
      },
      create: {
        spreadsheetId: input.spreadsheetId,
        worksheetTitle: input.worksheetTitle,
        sheetItemKey: input.sheetItemKey,
        sheetRowNumber: input.sheetRowNumber,
        topic: input.topic,
        rubric: input.rubric,
        ...(input.status !== undefined ? { status: input.status } : {})
      },
      update: {
        sheetRowNumber: input.sheetRowNumber,
        topic: input.topic,
        rubric: input.rubric
      }
    });
    if (input.status === undefined || input.status === null || item.status !== null || item.draftId !== null) {
      return item;
    }

    await this.prisma.contentPlanItem.updateMany({
      where: { id: item.id, status: null, draftId: null },
      data: { status: input.status }
    });
    return this.prisma.contentPlanItem.findUniqueOrThrow({ where: { id: item.id } });
  }

  public async findBySheetIdentity(
    identity: Omit<SheetItemIdentity, 'sheetRowNumber'>
  ): Promise<ContentPlanItem | null> {
    return this.prisma.contentPlanItem.findUnique({
      where: {
        spreadsheetId_worksheetTitle_sheetItemKey: identity
      }
    });
  }

  public async findByDraftId(draftId: string): Promise<ContentPlanItem | null> {
    return this.prisma.contentPlanItem.findFirst({ where: { draftId } });
  }

  public async findFirstPending(): Promise<ContentPlanItem | null> {
    return this.prisma.contentPlanItem.findFirst({
      where: { status: null },
      orderBy: { sheetRowNumber: 'asc' }
    });
  }

  public async markInReview(contentPlanItemId: string, draftId?: string): Promise<void> {
    const updated = await this.prisma.contentPlanItem.updateMany({
      where: { id: contentPlanItemId, status: null },
      data: {
        status: 'IN_REVIEW',
        ...(draftId !== undefined ? { draftId } : {})
      }
    });
    if (updated.count !== 1) {
      throw new Error(`ContentPlanItem ${contentPlanItemId} is no longer pending.`);
    }
  }

  public async markPending(contentPlanItemId: string): Promise<void> {
    const updated = await this.prisma.contentPlanItem.updateMany({
      where: { id: contentPlanItemId, status: 'IN_REVIEW', draftId: null },
      data: { status: null }
    });
    if (updated.count !== 1) {
      throw new Error(`ContentPlanItem ${contentPlanItemId} cannot return to pending state.`);
    }
  }

  public async markPublished(contentPlanItemId: string): Promise<void> {
    const updated = await this.prisma.contentPlanItem.updateMany({
      where: { id: contentPlanItemId, status: 'IN_REVIEW', draftId: { not: null } },
      data: { status: 'PUBLISHED' }
    });
    if (updated.count !== 1) {
      throw new Error(`ContentPlanItem ${contentPlanItemId} cannot be marked published.`);
    }
  }
}
