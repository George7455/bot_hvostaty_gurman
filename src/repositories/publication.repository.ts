import type { PrismaClient, Publication } from '@prisma/client';

export interface PublicationRepository {
  createPublication(draftId: string, telegramChatId: string, telegramMessageId: string): Promise<Publication>;
  recordPublishedDraftState(
    draftId: string,
    telegramChatId: string,
    telegramMessageId: string
  ): Promise<{ sheetRowNumber: number | null }>;
  rollbackPublishedDraftState(draftId: string): Promise<void>;
}

export class PrismaPublicationRepository implements PublicationRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async createPublication(
    draftId: string,
    telegramChatId: string,
    telegramMessageId: string
  ): Promise<Publication> {
    return this.prisma.publication.create({
      data: {
        draftId,
        telegramChatId,
        telegramMessageId
      }
    });
  }

  public async recordPublishedDraftState(
    draftId: string,
    telegramChatId: string,
    telegramMessageId: string
  ): Promise<{ sheetRowNumber: number | null }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.publication.create({
        data: {
          draftId,
          telegramChatId,
          telegramMessageId
        }
      });

      const draftUpdate = await tx.draft.updateMany({
        where: {
          id: draftId,
          status: 'APPROVED'
        },
        data: {
          status: 'PUBLISHED'
        }
      });

      if (draftUpdate.count !== 1) {
        throw new Error(`Draft ${draftId} was not in APPROVED status for publish finalization.`);
      }

      const linkedContentPlanItem = await tx.contentPlanItem.findFirst({
        where: { draftId },
        select: { id: true, sheetRowNumber: true }
      });

      if (!linkedContentPlanItem) {
        return { sheetRowNumber: null };
      }

      await tx.contentPlanItem.update({
        where: { id: linkedContentPlanItem.id },
        data: {
          status: 'PUBLISHED'
        }
      });

      return { sheetRowNumber: linkedContentPlanItem.sheetRowNumber };
    });
  }

  public async rollbackPublishedDraftState(draftId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.publication.deleteMany({
        where: { draftId }
      });

      await tx.draft.update({
        where: { id: draftId },
        data: {
          status: 'APPROVED'
        }
      });

      await tx.contentPlanItem.updateMany({
        where: { draftId },
        data: {
          status: 'IN_REVIEW'
        }
      });
    });
  }
}
