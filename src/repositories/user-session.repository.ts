import { randomUUID } from 'node:crypto';

import type { PrismaClient, SessionMode, UserSession } from '@prisma/client';

export interface ClaimedUserSession {
  userId: string;
  mode: Exclude<SessionMode, 'IDLE'>;
  pendingDraftId: string | null;
  pendingRevisionId: string | null;
  processingToken: string;
}

export interface UserSessionRepository {
  getByUserId(userId: string): Promise<UserSession | null>;
  setMode(userId: string, mode: SessionMode, pendingDraftId?: string, pendingRevisionId?: string): Promise<void>;
  setWaitingNotesForCurrentRevision(userId: string, draftId: string, revisionId: string): Promise<void>;
  claimMode(userId: string, expectedMode: Exclude<SessionMode, 'IDLE'>, staleAfterMs: number): Promise<ClaimedUserSession | null>;
  completeClaim(userId: string, processingToken: string): Promise<void>;
  releaseClaim(userId: string, processingToken: string): Promise<void>;
  clearMode(userId: string): Promise<void>;
}

export class PrismaUserSessionRepository implements UserSessionRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async getByUserId(userId: string): Promise<UserSession | null> {
    return this.prisma.userSession.findUnique({ where: { userId } });
  }

  public async setMode(
    userId: string,
    mode: SessionMode,
    pendingDraftId?: string,
    pendingRevisionId?: string
  ): Promise<void> {
    await this.prisma.userSession.upsert({
      where: { userId },
      update: {
        mode,
        pendingDraftId: pendingDraftId ?? null,
        pendingRevisionId: pendingRevisionId ?? null,
        processingToken: null,
        processingStartedAt: null
      },
      create: {
        userId,
        mode,
        ...(pendingDraftId !== undefined ? { pendingDraftId } : {}),
        ...(pendingRevisionId !== undefined ? { pendingRevisionId } : {})
      }
    });
  }

  public async setWaitingNotesForCurrentRevision(userId: string, draftId: string, revisionId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const draft = await tx.draft.findFirst({
        where: {
          id: draftId,
          status: 'IN_REVIEW',
          currentRevisionId: revisionId
        },
        select: { id: true }
      });
      if (!draft) {
        throw new Error(`Draft ${draftId} revision ${revisionId} is no longer available for rewrite notes.`);
      }
      await tx.userSession.upsert({
        where: { userId },
        update: {
          mode: 'WAITING_NOTES',
          pendingDraftId: draftId,
          pendingRevisionId: revisionId,
          processingToken: null,
          processingStartedAt: null
        },
        create: {
          userId,
          mode: 'WAITING_NOTES',
          pendingDraftId: draftId,
          pendingRevisionId: revisionId
        }
      });
    });
  }

  public async claimMode(
    userId: string,
    expectedMode: Exclude<SessionMode, 'IDLE'>,
    staleAfterMs: number
  ): Promise<ClaimedUserSession | null> {
    const processingToken = randomUUID();
    const now = new Date();
    const staleBefore = new Date(now.getTime() - staleAfterMs);
    const claimed = await this.prisma.userSession.updateMany({
      where: {
        userId,
        mode: expectedMode,
        OR: [
          { processingToken: null },
          { processingStartedAt: { lt: staleBefore } }
        ]
      },
      data: {
        processingToken,
        processingStartedAt: now
      }
    });
    if (claimed.count !== 1) {
      return null;
    }
    const session = await this.prisma.userSession.findUnique({ where: { processingToken } });
    if (!session || session.mode === 'IDLE') {
      throw new Error(`Claimed session ${userId} could not be reloaded.`);
    }
    return {
      userId: session.userId,
      mode: session.mode,
      pendingDraftId: session.pendingDraftId,
      pendingRevisionId: session.pendingRevisionId,
      processingToken
    };
  }

  public async completeClaim(userId: string, processingToken: string): Promise<void> {
    const completed = await this.prisma.userSession.updateMany({
      where: { userId, processingToken },
      data: {
        mode: 'IDLE',
        pendingDraftId: null,
        pendingRevisionId: null,
        processingToken: null,
        processingStartedAt: null
      }
    });
    if (completed.count !== 1) {
      throw new Error(`Session claim for user ${userId} is no longer owned by token ${processingToken}.`);
    }
  }

  public async releaseClaim(userId: string, processingToken: string): Promise<void> {
    const released = await this.prisma.userSession.updateMany({
      where: { userId, processingToken },
      data: {
        processingToken: null,
        processingStartedAt: null
      }
    });
    if (released.count !== 1) {
      throw new Error(`Session claim for user ${userId} is no longer owned by token ${processingToken}.`);
    }
  }

  public async clearMode(userId: string): Promise<void> {
    const existing = await this.prisma.userSession.findUnique({
      where: { userId },
      select: { id: true, processingToken: true }
    });
    if (!existing) {
      await this.prisma.userSession.create({ data: { userId, mode: 'IDLE' } });
      return;
    }
    if (existing.processingToken) {
      throw new Error(`Session for user ${userId} is currently processing and cannot be cleared.`);
    }
    await this.prisma.userSession.update({
      where: { id: existing.id },
      data: {
        mode: 'IDLE',
        pendingDraftId: null,
        pendingRevisionId: null
      }
    });
  }
}
