import type { Draft, DraftSourceType, DraftStatus, PrismaClient } from '@prisma/client';

export interface InReviewContentPlanCandidate {
  id: string;
  topic: string;
  rubric: string;
}

export interface DraftRepository {
  findNextInReviewContentPlanItem(): Promise<InReviewContentPlanCandidate | null>;
  findInReviewContentPlanItemById(contentPlanItemId: string): Promise<InReviewContentPlanCandidate | null>;
  createLinkedDraft(params: { contentPlanItemId: string; currentText: string; sourceType: DraftSourceType }): Promise<Draft>;
  createStandaloneDraft(params: { currentText: string; sourceType: DraftSourceType }): Promise<Draft>;
  findById(draftId: string): Promise<Draft | null>;
  updateCurrentText(draftId: string, text: string): Promise<void>;
  updateStatus(draftId: string, status: DraftStatus): Promise<void>;
}

export class PrismaDraftRepository implements DraftRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async findNextInReviewContentPlanItem(): Promise<InReviewContentPlanCandidate | null> {
    return this.prisma.contentPlanItem.findFirst({
      where: {
        status: 'IN_REVIEW',
        draftId: null
      },
      orderBy: {
        sheetRowNumber: 'asc'
      },
      select: {
        id: true,
        topic: true,
        rubric: true
      }
    });
  }

  public async findInReviewContentPlanItemById(contentPlanItemId: string): Promise<InReviewContentPlanCandidate | null> {
    return this.prisma.contentPlanItem.findFirst({
      where: {
        id: contentPlanItemId,
        status: 'IN_REVIEW',
        draftId: null
      },
      select: {
        id: true,
        topic: true,
        rubric: true
      }
    });
  }

  public async createLinkedDraft(params: {
    contentPlanItemId: string;
    currentText: string;
    sourceType: DraftSourceType;
  }): Promise<Draft> {
    return this.prisma.$transaction(async (tx) => {
      const draft = await tx.draft.create({
        data: {
          sourceType: params.sourceType,
          currentText: params.currentText,
          status: 'NEW'
        }
      });

      const updatedContentPlan = await tx.contentPlanItem.updateMany({
        where: {
          id: params.contentPlanItemId,
          status: 'IN_REVIEW',
          draftId: null
        },
        data: {
          draftId: draft.id
        }
      });

      if (updatedContentPlan.count !== 1) {
        throw new Error('Failed to link Draft to ContentPlanItem in IN_REVIEW state.');
      }

      return draft;
    });
  }

  public async findById(draftId: string): Promise<Draft | null> {
    return this.prisma.draft.findUnique({
      where: { id: draftId }
    });
  }

  public async createStandaloneDraft(params: {
    currentText: string;
    sourceType: DraftSourceType;
  }): Promise<Draft> {
    return this.prisma.draft.create({
      data: {
        sourceType: params.sourceType,
        currentText: params.currentText,
        status: 'NEW'
      }
    });
  }

  public async updateCurrentText(draftId: string, text: string): Promise<void> {
    await this.prisma.draft.update({
      where: { id: draftId },
      data: {
        currentText: text
      }
    });
  }

  public async updateStatus(draftId: string, status: DraftStatus): Promise<void> {
    await this.prisma.draft.update({
      where: { id: draftId },
      data: {
        status
      }
    });
  }
}
