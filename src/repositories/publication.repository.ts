import type { PrismaClient, Publication } from '@prisma/client';

import type { SheetItemIdentity } from './content-plan.repository.js';

export interface RecordPublishedDraftInput {
  draftId: string;
  revisionId: string;
  telegramChatId: string;
  telegramMessageId: string;
  publishedPayload: string;
  telegraphPath?: string;
  telegraphUrl?: string;
}

export interface PublicationRepository {
  findPublishedDraftState(draftId: string, revisionId: string): Promise<{
    publication: Publication;
    sheetIdentity: SheetItemIdentity | null;
  } | null>;
  recordPublishedDraftState(input: RecordPublishedDraftInput): Promise<{
    publication: Publication;
    sheetIdentity: SheetItemIdentity | null;
  }>;
  rollbackPublishedDraftState(draftId: string, revisionId: string): Promise<void>;
}

export class PrismaPublicationRepository implements PublicationRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async findPublishedDraftState(
    draftId: string,
    revisionId: string
  ): Promise<{ publication: Publication; sheetIdentity: SheetItemIdentity | null } | null> {
    const draft = await this.prisma.draft.findFirst({
      where: { id: draftId, status: 'PUBLISHED', approvedRevisionId: revisionId },
      select: {
        publication: true,
        contentPlanItem: {
          select: {
            spreadsheetId: true,
            worksheetTitle: true,
            sheetItemKey: true,
            sheetRowNumber: true
          }
        }
      }
    });
    if (!draft?.publication || draft.publication.revisionId !== revisionId) {
      return null;
    }
    const item = draft.contentPlanItem;
    if (!item) {
      return { publication: draft.publication, sheetIdentity: null };
    }
    if (!item.spreadsheetId || !item.worksheetTitle || !item.sheetItemKey) {
      throw new Error(`Published ContentPlanItem for draft ${draftId} has no stable Google Sheets identity.`);
    }
    return {
      publication: draft.publication,
      sheetIdentity: {
        spreadsheetId: item.spreadsheetId,
        worksheetTitle: item.worksheetTitle,
        sheetItemKey: item.sheetItemKey,
        sheetRowNumber: item.sheetRowNumber
      }
    };
  }

  public async recordPublishedDraftState(input: RecordPublishedDraftInput): Promise<{
    publication: Publication;
    sheetIdentity: SheetItemIdentity | null;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const approvedDraft = await tx.draft.findFirst({
        where: {
          id: input.draftId,
          status: 'APPROVED',
          approvedRevisionId: input.revisionId,
          currentRevisionId: input.revisionId
        },
        select: {
          sourceType: true,
          approvedByActorId: true,
          approvedRevision: { select: { text: true } },
          contentPlanItem: {
            select: {
              id: true,
              status: true,
              spreadsheetId: true,
              worksheetTitle: true,
              sheetItemKey: true,
              sheetRowNumber: true
            }
          }
        }
      });
      if (!approvedDraft?.approvedRevision || !approvedDraft.approvedByActorId) {
        throw new Error(`Draft ${input.draftId} revision ${input.revisionId} is not the approved publish snapshot.`);
      }

      const publication = await tx.publication.create({
        data: {
          draftId: input.draftId,
          revisionId: input.revisionId,
          textSnapshot: approvedDraft.approvedRevision.text,
          publishedPayload: input.publishedPayload,
          actorId: approvedDraft.approvedByActorId,
          sourceType: approvedDraft.sourceType,
          telegramChatId: input.telegramChatId,
          telegramMessageId: input.telegramMessageId,
          ...(input.telegraphPath !== undefined ? { telegraphPath: input.telegraphPath } : {}),
          ...(input.telegraphUrl !== undefined ? { telegraphUrl: input.telegraphUrl } : {})
        }
      });

      const draftUpdate = await tx.draft.updateMany({
        where: {
          id: input.draftId,
          status: 'APPROVED',
          approvedRevisionId: input.revisionId,
          currentRevisionId: input.revisionId
        },
        data: { status: 'PUBLISHED' }
      });
      if (draftUpdate.count !== 1) {
        throw new Error(`Draft ${input.draftId} changed concurrently during publish finalization.`);
      }

      const contentPlan = approvedDraft.contentPlanItem;
      if (!contentPlan) {
        return { publication, sheetIdentity: null };
      }
      if (!contentPlan.spreadsheetId || !contentPlan.worksheetTitle || !contentPlan.sheetItemKey) {
        throw new Error(`ContentPlanItem ${contentPlan.id} has no stable Google Sheets identity.`);
      }
      const contentPlanUpdate = await tx.contentPlanItem.updateMany({
        where: { id: contentPlan.id, status: 'IN_REVIEW', draftId: input.draftId },
        data: { status: 'PUBLISHED' }
      });
      if (contentPlanUpdate.count !== 1) {
        throw new Error(`ContentPlanItem ${contentPlan.id} changed concurrently during publish finalization.`);
      }
      return {
        publication,
        sheetIdentity: {
          spreadsheetId: contentPlan.spreadsheetId,
          worksheetTitle: contentPlan.worksheetTitle,
          sheetItemKey: contentPlan.sheetItemKey,
          sheetRowNumber: contentPlan.sheetRowNumber
        }
      };
    });
  }

  public async rollbackPublishedDraftState(draftId: string, revisionId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.publication.deleteMany({ where: { draftId, revisionId } });
      const reverted = await tx.draft.updateMany({
        where: { id: draftId, status: 'PUBLISHED', approvedRevisionId: revisionId },
        data: { status: 'APPROVED' }
      });
      if (reverted.count !== 1) {
        throw new Error(`Published draft ${draftId} revision ${revisionId} could not be rolled back.`);
      }
      await tx.contentPlanItem.updateMany({
        where: { draftId, status: 'PUBLISHED' },
        data: { status: 'IN_REVIEW' }
      });
    });
  }
}
