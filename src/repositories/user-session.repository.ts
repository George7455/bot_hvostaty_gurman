import type { PrismaClient, SessionMode, UserSession } from '@prisma/client';

export interface UserSessionRepository {
  getByUserId(userId: string): Promise<UserSession | null>;
  setMode(userId: string, mode: SessionMode, pendingDraftId?: string): Promise<void>;
  clearMode(userId: string): Promise<void>;
}

export class PrismaUserSessionRepository implements UserSessionRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async getByUserId(userId: string): Promise<UserSession | null> {
    return this.prisma.userSession.findUnique({
      where: { userId }
    });
  }

  public async setMode(userId: string, mode: SessionMode, pendingDraftId?: string): Promise<void> {
    await this.prisma.userSession.upsert({
      where: { userId },
      update: {
        mode,
        pendingDraftId: pendingDraftId ?? null
      },
      create: {
        userId,
        mode,
        ...(pendingDraftId ? { pendingDraftId } : {})
      }
    });
  }

  public async clearMode(userId: string): Promise<void> {
    await this.prisma.userSession.upsert({
      where: { userId },
      update: {
        mode: 'IDLE',
        pendingDraftId: null
      },
      create: {
        userId,
        mode: 'IDLE'
      }
    });
  }
}
