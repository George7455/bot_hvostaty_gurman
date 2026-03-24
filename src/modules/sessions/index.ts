import type { SessionMode } from '@prisma/client';

import type { UserSessionRepository } from '../../repositories/user-session.repository.js';

export interface SessionState {
  userId: string;
  mode: SessionMode;
  pendingDraftId: string | null;
}

export interface SessionsModule {
  getSession(userId: string): Promise<SessionState>;
  setWaitingArticle(userId: string): Promise<void>;
  setWaitingNotes(userId: string, draftId: string): Promise<void>;
  clearSession(userId: string): Promise<void>;
}

export class SessionsService implements SessionsModule {
  public constructor(private readonly userSessionRepository: UserSessionRepository) {}

  public async getSession(userId: string): Promise<SessionState> {
    const session = await this.userSessionRepository.getByUserId(userId);
    if (!session) {
      return {
        userId,
        mode: 'IDLE',
        pendingDraftId: null
      };
    }

    return {
      userId: session.userId,
      mode: session.mode,
      pendingDraftId: session.pendingDraftId
    };
  }

  public async setWaitingArticle(userId: string): Promise<void> {
    await this.userSessionRepository.setMode(userId, 'WAITING_ARTICLE');
  }

  public async setWaitingNotes(userId: string, draftId: string): Promise<void> {
    await this.userSessionRepository.setMode(userId, 'WAITING_NOTES', draftId);
  }

  public async clearSession(userId: string): Promise<void> {
    await this.userSessionRepository.clearMode(userId);
  }
}
