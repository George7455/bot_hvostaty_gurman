import type { DraftRevision, PrismaClient } from '@prisma/client';

export interface DraftRevisionRepository {
  createInitialRevision(draftId: string, text: string): Promise<DraftRevision>;
  createRevision(draftId: string, text: string, notes?: string): Promise<DraftRevision>;
}

export class PrismaDraftRevisionRepository implements DraftRevisionRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async createInitialRevision(draftId: string, text: string): Promise<DraftRevision> {
    return this.prisma.draftRevision.create({
      data: {
        draftId,
        revisionNo: 1,
        text
      }
    });
  }

  public async createRevision(draftId: string, text: string, notes?: string): Promise<DraftRevision> {
    return this.prisma.$transaction(async (tx) => {
      const latestRevision = await tx.draftRevision.findFirst({
        where: { draftId },
        select: { revisionNo: true },
        orderBy: { revisionNo: 'desc' }
      });

      const revisionNo = (latestRevision?.revisionNo ?? 0) + 1;

      return tx.draftRevision.create({
        data: {
          draftId,
          revisionNo,
          text,
          ...(notes ? { notes } : {})
        }
      });
    });
  }
}
