import type { DraftRevision, PrismaClient } from '@prisma/client';

export interface DraftRevisionRepository {
  findById(revisionId: string): Promise<DraftRevision | null>;
  findCurrentByDraftId(draftId: string): Promise<DraftRevision | null>;
}

export class PrismaDraftRevisionRepository implements DraftRevisionRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async findById(revisionId: string): Promise<DraftRevision | null> {
    return this.prisma.draftRevision.findUnique({ where: { id: revisionId } });
  }

  public async findCurrentByDraftId(draftId: string): Promise<DraftRevision | null> {
    const draft = await this.prisma.draft.findUnique({
      where: { id: draftId },
      select: { currentRevision: true }
    });
    return draft?.currentRevision ?? null;
  }
}
