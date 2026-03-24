import type { ModerationAction, ModerationActionType, PrismaClient } from '@prisma/client';

export interface ModerationActionRepository {
  appendAction(draftId: string, actorId: string, actionType: ModerationActionType, notes?: string): Promise<ModerationAction>;
}

export class PrismaModerationActionRepository implements ModerationActionRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async appendAction(
    draftId: string,
    actorId: string,
    actionType: ModerationActionType,
    notes?: string
  ): Promise<ModerationAction> {
    return this.prisma.moderationAction.create({
      data: {
        draftId,
        actorId,
        actionType,
        ...(notes ? { notes } : {})
      }
    });
  }
}
