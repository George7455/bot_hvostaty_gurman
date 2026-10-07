import type {
  Draft,
  DraftSourceType,
  DraftStatus,
  ModerationActionType,
  PrismaClient
} from '@prisma/client';

export interface InReviewContentPlanCandidate {
  id: string;
  topic: string;
  rubric: string;
}

export interface DraftLifecycleSnapshot {
  id: string;
  sourceType: DraftSourceType;
  status: DraftStatus;
  currentText: string;
  currentRevisionId: string;
  currentRevisionNo: number;
  approvedRevisionId: string | null;
}

export interface CreateDraftInput {
  currentText: string;
  sourceType: DraftSourceType;
}

export interface ApplyRewriteInput {
  draftId: string;
  expectedRevisionId: string;
  text: string;
  actorId: string;
  actionType: Extract<ModerationActionType, 'REWRITE' | 'REWRITE_NOTES'>;
  notes?: string;
}

export interface ApproveDraftInput {
  draftId: string;
  expectedRevisionId: string;
  actorId: string;
}

export interface DraftRepository {
  findNextInReviewContentPlanItem(): Promise<InReviewContentPlanCandidate | null>;
  findInReviewContentPlanItemById(contentPlanItemId: string): Promise<InReviewContentPlanCandidate | null>;
  createLinkedDraftWithInitialRevision(
    params: CreateDraftInput & { contentPlanItemId: string; plannerRunKey?: string }
  ): Promise<DraftLifecycleSnapshot>;
  createStandaloneDraftWithInitialRevision(params: CreateDraftInput): Promise<DraftLifecycleSnapshot>;
  findById(draftId: string): Promise<Draft | null>;
  findSnapshot(draftId: string): Promise<DraftLifecycleSnapshot | null>;
  prepareModerationDelivery(draftId: string, expectedRevisionId?: string): Promise<DraftLifecycleSnapshot>;
  applyRewrite(params: ApplyRewriteInput): Promise<DraftLifecycleSnapshot>;
  approveCurrentRevision(params: ApproveDraftInput): Promise<DraftLifecycleSnapshot>;
}

const snapshotSelect = {
  id: true,
  sourceType: true,
  status: true,
  currentText: true,
  currentRevisionId: true,
  currentRevisionNo: true,
  approvedRevisionId: true
} as const;

export class PrismaDraftRepository implements DraftRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async findNextInReviewContentPlanItem(): Promise<InReviewContentPlanCandidate | null> {
    return this.prisma.contentPlanItem.findFirst({
      where: { status: 'IN_REVIEW', draftId: null },
      orderBy: { sheetRowNumber: 'asc' },
      select: { id: true, topic: true, rubric: true }
    });
  }

  public async findInReviewContentPlanItemById(
    contentPlanItemId: string
  ): Promise<InReviewContentPlanCandidate | null> {
    return this.prisma.contentPlanItem.findFirst({
      where: { id: contentPlanItemId, status: 'IN_REVIEW', draftId: null },
      select: { id: true, topic: true, rubric: true }
    });
  }

  public async createLinkedDraftWithInitialRevision(
    params: CreateDraftInput & { contentPlanItemId: string; plannerRunKey?: string }
  ): Promise<DraftLifecycleSnapshot> {
    return this.prisma.$transaction(async (tx) => {
      const draft = await tx.draft.create({
        data: {
          sourceType: params.sourceType,
          currentText: params.currentText,
          status: 'NEW',
          currentRevisionNo: 0
        },
        select: { id: true }
      });
      const revision = await tx.draftRevision.create({
        data: { draftId: draft.id, revisionNo: 1, text: params.currentText },
        select: { id: true }
      });
      await tx.moderationDelivery.create({
        data: { draftId: draft.id, revisionId: revision.id }
      });
      const linkedItem = await tx.contentPlanItem.updateMany({
        where: { id: params.contentPlanItemId, status: 'IN_REVIEW', draftId: null },
        data: { draftId: draft.id }
      });
      if (linkedItem.count !== 1) {
        throw new Error('Failed to link Draft to an unclaimed ContentPlanItem in IN_REVIEW state.');
      }
      const initialized = await tx.draft.update({
        where: { id: draft.id },
        data: { currentRevisionId: revision.id, currentRevisionNo: 1 },
        select: snapshotSelect
      });
      if (params.plannerRunKey) {
        const linkedRun = await tx.plannerRun.updateMany({
          where: { runKey: params.plannerRunKey, status: 'RUNNING' },
          data: {
            contentPlanItemId: params.contentPlanItemId,
            draftId: draft.id
          }
        });
        if (linkedRun.count !== 1) {
          throw new Error(`PlannerRun ${params.plannerRunKey} is no longer running.`);
        }
      }
      return requireCompleteSnapshot(initialized);
    });
  }

  public async createStandaloneDraftWithInitialRevision(params: CreateDraftInput): Promise<DraftLifecycleSnapshot> {
    return this.prisma.$transaction(async (tx) => {
      const draft = await tx.draft.create({
        data: {
          sourceType: params.sourceType,
          currentText: params.currentText,
          status: 'NEW',
          currentRevisionNo: 0
        },
        select: { id: true }
      });
      const revision = await tx.draftRevision.create({
        data: { draftId: draft.id, revisionNo: 1, text: params.currentText },
        select: { id: true }
      });
      await tx.moderationDelivery.create({
        data: { draftId: draft.id, revisionId: revision.id }
      });
      const initialized = await tx.draft.update({
        where: { id: draft.id },
        data: { currentRevisionId: revision.id, currentRevisionNo: 1 },
        select: snapshotSelect
      });
      return requireCompleteSnapshot(initialized);
    });
  }

  public async findById(draftId: string): Promise<Draft | null> {
    return this.prisma.draft.findUnique({ where: { id: draftId } });
  }

  public async findSnapshot(draftId: string): Promise<DraftLifecycleSnapshot | null> {
    const draft = await this.prisma.draft.findUnique({ where: { id: draftId }, select: snapshotSelect });
    return draft ? requireCompleteSnapshot(draft) : null;
  }

  public async prepareModerationDelivery(
    draftId: string,
    expectedRevisionId?: string
  ): Promise<DraftLifecycleSnapshot> {
    return this.prisma.$transaction(async (tx) => {
      const draft = await tx.draft.findUnique({ where: { id: draftId }, select: snapshotSelect });
      if (!draft) {
        throw new Error(`Draft not found for moderation enqueue: ${draftId}`);
      }
      const snapshot = requireCompleteSnapshot(draft);
      if (expectedRevisionId && snapshot.currentRevisionId !== expectedRevisionId) {
        throw staleRevisionError(draftId, expectedRevisionId, snapshot.currentRevisionId);
      }
      if (snapshot.status !== 'NEW' && snapshot.status !== 'IN_REVIEW') {
        throw new Error(`Draft ${draftId} cannot enter moderation from status ${snapshot.status}.`);
      }
      if (snapshot.status === 'NEW') {
        const transitioned = await tx.draft.updateMany({
          where: { id: draftId, status: 'NEW', currentRevisionId: snapshot.currentRevisionId },
          data: { status: 'IN_REVIEW' }
        });
        if (transitioned.count !== 1) {
          throw new Error(`Draft ${draftId} changed concurrently while entering moderation.`);
        }
      }
      await tx.moderationDelivery.upsert({
        where: { draftId_revisionId: { draftId, revisionId: snapshot.currentRevisionId } },
        create: { draftId, revisionId: snapshot.currentRevisionId },
        update: {}
      });
      return { ...snapshot, status: 'IN_REVIEW' };
    });
  }

  public async applyRewrite(params: ApplyRewriteInput): Promise<DraftLifecycleSnapshot> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.draft.findUnique({ where: { id: params.draftId }, select: snapshotSelect });
      if (!current) {
        throw new Error(`Draft not found for rewrite: ${params.draftId}`);
      }
      const currentSnapshot = requireCompleteSnapshot(current);
      if (currentSnapshot.status !== 'IN_REVIEW') {
        throw new Error(`Draft ${params.draftId} cannot be rewritten from status ${currentSnapshot.status}.`);
      }
      if (currentSnapshot.currentRevisionId !== params.expectedRevisionId) {
        throw staleRevisionError(params.draftId, params.expectedRevisionId, currentSnapshot.currentRevisionId);
      }

      const nextRevisionNo = currentSnapshot.currentRevisionNo + 1;
      const acquired = await tx.draft.updateMany({
        where: {
          id: params.draftId,
          status: 'IN_REVIEW',
          currentRevisionId: params.expectedRevisionId,
          currentRevisionNo: currentSnapshot.currentRevisionNo
        },
        data: { currentText: params.text, currentRevisionNo: { increment: 1 } }
      });
      if (acquired.count !== 1) {
        throw new Error(`Draft ${params.draftId} changed concurrently while applying rewrite.`);
      }

      const revision = await tx.draftRevision.create({
        data: {
          draftId: params.draftId,
          revisionNo: nextRevisionNo,
          text: params.text,
          ...(params.notes !== undefined ? { notes: params.notes } : {})
        },
        select: { id: true }
      });
      await tx.moderationAction.create({
        data: {
          draftId: params.draftId,
          revisionId: params.expectedRevisionId,
          actorId: params.actorId,
          actionType: params.actionType,
          ...(params.notes !== undefined ? { notes: params.notes } : {})
        }
      });
      const updated = await tx.draft.update({
        where: { id: params.draftId },
        data: { currentRevisionId: revision.id },
        select: snapshotSelect
      });
      await tx.moderationDelivery.create({
        data: { draftId: params.draftId, revisionId: revision.id }
      });
      return requireCompleteSnapshot(updated);
    });
  }

  public async approveCurrentRevision(params: ApproveDraftInput): Promise<DraftLifecycleSnapshot> {
    return this.prisma.$transaction(async (tx) => {
      const transitioned = await tx.draft.updateMany({
        where: {
          id: params.draftId,
          status: 'IN_REVIEW',
          currentRevisionId: params.expectedRevisionId
        },
        data: {
          status: 'APPROVED',
          approvedRevisionId: params.expectedRevisionId,
          approvedByActorId: params.actorId,
          approvedAt: new Date()
        }
      });
      if (transitioned.count !== 1) {
        const current = await tx.draft.findUnique({
          where: { id: params.draftId },
          select: { status: true, currentRevisionId: true }
        });
        if (!current) {
          throw new Error(`Draft not found for approve: ${params.draftId}`);
        }
        if (current.currentRevisionId !== params.expectedRevisionId) {
          throw staleRevisionError(params.draftId, params.expectedRevisionId, current.currentRevisionId);
        }
        throw new Error(`Draft ${params.draftId} cannot be approved from status ${current.status}.`);
      }
      await tx.moderationAction.create({
        data: {
          draftId: params.draftId,
          revisionId: params.expectedRevisionId,
          actorId: params.actorId,
          actionType: 'APPROVE'
        }
      });
      await tx.publicationIntent.upsert({
        where: { draftId_revisionId: { draftId: params.draftId, revisionId: params.expectedRevisionId } },
        create: { draftId: params.draftId, revisionId: params.expectedRevisionId },
        update: {}
      });
      const approved = await tx.draft.findUniqueOrThrow({
        where: { id: params.draftId },
        select: snapshotSelect
      });
      return requireCompleteSnapshot(approved);
    });
  }
}

function requireCompleteSnapshot(snapshot: {
  id: string;
  sourceType: DraftSourceType;
  status: DraftStatus;
  currentText: string;
  currentRevisionId: string | null;
  currentRevisionNo: number;
  approvedRevisionId: string | null;
}): DraftLifecycleSnapshot {
  if (!snapshot.currentRevisionId || snapshot.currentRevisionNo < 1) {
    throw new Error(`Draft ${snapshot.id} has no initialized current revision.`);
  }
  return { ...snapshot, currentRevisionId: snapshot.currentRevisionId };
}

function staleRevisionError(draftId: string, expectedRevisionId: string, actualRevisionId: string | null): Error {
  return new Error(
    `Stale moderation action for draft ${draftId}: expected revision ${expectedRevisionId}, current revision is ${actualRevisionId ?? 'none'}.`
  );
}
