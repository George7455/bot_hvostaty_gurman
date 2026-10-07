import type { SessionMode } from '@prisma/client';

import type { ClaimedUserSession, UserSessionRepository } from '../../repositories/user-session.repository.js';

const SESSION_PROCESSING_STALE_AFTER_MS = 15 * 60 * 1_000;

export interface SessionState {
  userId: string;
  mode: SessionMode;
  pendingDraftId: string | null;
  pendingRevisionId: string | null;
  isProcessing: boolean;
}

export interface SessionsModule {
  getSession(userId: string): Promise<SessionState>;
  setWaitingArticle(userId: string): Promise<void>;
  setWaitingNotes(userId: string, draftId: string, revisionId: string): Promise<void>;
  claimSession(userId: string, expectedMode: Exclude<SessionMode, 'IDLE'>): Promise<ClaimedUserSession>;
  completeClaim(userId: string, processingToken: string): Promise<void>;
  releaseClaim(userId: string, processingToken: string): Promise<void>;
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
        pendingDraftId: null,
        pendingRevisionId: null,
        isProcessing: false
      };
    }
    return {
      userId: session.userId,
      mode: session.mode,
      pendingDraftId: session.pendingDraftId,
      pendingRevisionId: session.pendingRevisionId,
      isProcessing: session.processingToken !== null
    };
  }

  public async setWaitingArticle(userId: string): Promise<void> {
    await this.userSessionRepository.setMode(userId, 'WAITING_ARTICLE');
  }

  public async setWaitingNotes(userId: string, draftId: string, revisionId: string): Promise<void> {
    await this.userSessionRepository.setWaitingNotesForCurrentRevision(userId, draftId, revisionId);
  }

  public async claimSession(
    userId: string,
    expectedMode: Exclude<SessionMode, 'IDLE'>
  ): Promise<ClaimedUserSession> {
    const claim = await this.userSessionRepository.claimMode(
      userId,
      expectedMode,
      SESSION_PROCESSING_STALE_AFTER_MS
    );
    if (!claim) {
      throw new Error(`User ${userId} has no available ${expectedMode} session to process.`);
    }
    return claim;
  }

  public async completeClaim(userId: string, processingToken: string): Promise<void> {
    await this.userSessionRepository.completeClaim(userId, processingToken);
  }

  public async releaseClaim(userId: string, processingToken: string): Promise<void> {
    await this.userSessionRepository.releaseClaim(userId, processingToken);
  }

  public async clearSession(userId: string): Promise<void> {
    await this.userSessionRepository.clearMode(userId);
  }
}
