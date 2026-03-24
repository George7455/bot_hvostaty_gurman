import type { ContentPlanItem, ContentPlanStatus, PrismaClient } from '@prisma/client';

export interface UpsertContentPlanItemInput {
  sheetRowNumber: number;
  topic: string;
  rubric: string;
  status?: ContentPlanStatus | null;
}

export interface ContentPlanRepository {
  upsertFromSheetRow(input: UpsertContentPlanItemInput): Promise<ContentPlanItem>;
  findBySheetRowNumber(sheetRowNumber: number): Promise<ContentPlanItem | null>;
  findByDraftId(draftId: string): Promise<ContentPlanItem | null>;
  findFirstPending(): Promise<ContentPlanItem | null>;
  markInReview(contentPlanItemId: string, draftId?: string): Promise<void>;
  markPending(contentPlanItemId: string): Promise<void>;
  markPublished(contentPlanItemId: string): Promise<void>;
}

export class PrismaContentPlanRepository implements ContentPlanRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async upsertFromSheetRow(input: UpsertContentPlanItemInput): Promise<ContentPlanItem> {
    const shouldResetDraftLink = input.status === 'IN_REVIEW';

    return this.prisma.contentPlanItem.upsert({
      where: { sheetRowNumber: input.sheetRowNumber },
      create: {
        sheetRowNumber: input.sheetRowNumber,
        topic: input.topic,
        rubric: input.rubric,
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(shouldResetDraftLink ? { draftId: null } : {})
      },
      update: {
        topic: input.topic,
        rubric: input.rubric,
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(shouldResetDraftLink ? { draftId: null } : {})
      }
    });
  }

  public async findBySheetRowNumber(sheetRowNumber: number): Promise<ContentPlanItem | null> {
    return this.prisma.contentPlanItem.findUnique({
      where: { sheetRowNumber }
    });
  }

  public async findByDraftId(draftId: string): Promise<ContentPlanItem | null> {
    return this.prisma.contentPlanItem.findFirst({
      where: { draftId }
    });
  }

  public async findFirstPending(): Promise<ContentPlanItem | null> {
    return this.prisma.contentPlanItem.findFirst({
      where: {
        status: null
      },
      orderBy: {
        sheetRowNumber: 'asc'
      }
    });
  }

  public async markInReview(contentPlanItemId: string, draftId?: string): Promise<void> {
    await this.prisma.contentPlanItem.update({
      where: { id: contentPlanItemId },
      data: {
        status: 'IN_REVIEW',
        ...(draftId ? { draftId } : {})
      }
    });
  }

  public async markPending(contentPlanItemId: string): Promise<void> {
    await this.prisma.contentPlanItem.update({
      where: { id: contentPlanItemId },
      data: {
        status: null
      }
    });
  }

  public async markPublished(contentPlanItemId: string): Promise<void> {
    await this.prisma.contentPlanItem.update({
      where: { id: contentPlanItemId },
      data: {
        status: 'PUBLISHED'
      }
    });
  }
}
