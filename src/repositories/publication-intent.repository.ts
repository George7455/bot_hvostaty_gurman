import { randomUUID } from 'node:crypto';

import type { DraftSourceType, PrismaClient } from '@prisma/client';

export interface PublicationIntentClaim {
  id: string;
  draftId: string;
  revisionId: string;
  text: string;
  sourceType: DraftSourceType;
  actorId: string;
  preparedPayload: string | null;
  telegraphPath: string | null;
  telegraphUrl: string | null;
  leaseToken: string;
  attempts: number;
}

export interface PublicationIntentRepository {
  claimForDraft(draftId: string, revisionId: string, leaseDurationMs: number): Promise<PublicationIntentClaim | null>;
  claimNext(leaseDurationMs: number): Promise<PublicationIntentClaim | null>;
  savePreparedArtifact(
    claim: PublicationIntentClaim,
    artifact: { payload: string; telegraphPath?: string; telegraphUrl?: string }
  ): Promise<void>;
  markSucceeded(claim: PublicationIntentClaim): Promise<void>;
  markFailed(claim: PublicationIntentClaim, error: string): Promise<void>;
  markNeedsReconciliation(claim: PublicationIntentClaim, error: string): Promise<void>;
}

export class PrismaPublicationIntentRepository implements PublicationIntentRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async claimForDraft(
    draftId: string,
    revisionId: string,
    leaseDurationMs: number
  ): Promise<PublicationIntentClaim | null> {
    await this.quarantineExpiredProcessing();
    const intent = await this.prisma.publicationIntent.findUnique({
      where: { draftId_revisionId: { draftId, revisionId } },
      select: { id: true }
    });
    return intent ? this.claimById(intent.id, leaseDurationMs) : null;
  }

  public async claimNext(leaseDurationMs: number): Promise<PublicationIntentClaim | null> {
    await this.quarantineExpiredProcessing();
    const candidate = await this.prisma.publicationIntent.findFirst({
      where: {
        status: { in: ['PENDING', 'FAILED'] },
        draft: {
          OR: [
            { status: 'APPROVED' },
            { status: 'PUBLISHED', publication: { isNot: null } }
          ]
        }
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true }
    });
    return candidate ? this.claimById(candidate.id, leaseDurationMs) : null;
  }

  public async markSucceeded(claim: PublicationIntentClaim): Promise<void> {
    await this.finish(claim, 'SUCCEEDED');
  }

  public async savePreparedArtifact(
    claim: PublicationIntentClaim,
    artifact: { payload: string; telegraphPath?: string; telegraphUrl?: string }
  ): Promise<void> {
    const updated = await this.prisma.publicationIntent.updateMany({
      where: { id: claim.id, status: 'PROCESSING', leaseToken: claim.leaseToken },
      data: {
        preparedPayload: artifact.payload,
        telegraphPath: artifact.telegraphPath ?? null,
        telegraphUrl: artifact.telegraphUrl ?? null
      }
    });
    if (updated.count !== 1) {
      throw new Error(`Publication intent lease ${claim.id} is no longer owned.`);
    }
  }

  public async markFailed(claim: PublicationIntentClaim, error: string): Promise<void> {
    await this.finish(claim, 'FAILED', error);
  }

  public async markNeedsReconciliation(claim: PublicationIntentClaim, error: string): Promise<void> {
    await this.finish(claim, 'NEEDS_RECONCILIATION', error);
  }

  private async claimById(id: string, leaseDurationMs: number): Promise<PublicationIntentClaim | null> {
    if (leaseDurationMs <= 0) {
      throw new Error('Publication intent lease duration must be positive.');
    }
    const now = new Date();
    const leaseToken = randomUUID();
    const acquired = await this.prisma.publicationIntent.updateMany({
      where: {
        id,
        status: { in: ['PENDING', 'FAILED'] },
        draft: {
          OR: [
            { status: 'APPROVED' },
            { status: 'PUBLISHED', publication: { isNot: null } }
          ]
        }
      },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        leaseToken,
        leaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
        lastError: null
      }
    });
    if (acquired.count !== 1) {
      return null;
    }
    const intent = await this.prisma.publicationIntent.findUnique({
      where: { id },
      select: {
        id: true,
        draftId: true,
        revisionId: true,
        leaseToken: true,
        attempts: true,
        preparedPayload: true,
        telegraphPath: true,
        telegraphUrl: true,
        revision: { select: { text: true } },
        draft: {
          select: {
            sourceType: true,
            approvedByActorId: true,
            approvedRevisionId: true,
            status: true
          }
        }
      }
    });
    if (
      !intent ||
      intent.leaseToken !== leaseToken ||
      intent.draft.approvedRevisionId !== intent.revisionId ||
      !intent.draft.approvedByActorId
    ) {
      throw new Error(`Publication intent ${id} was claimed but is not a valid approved revision.`);
    }
    return {
      id: intent.id,
      draftId: intent.draftId,
      revisionId: intent.revisionId,
      text: intent.revision.text,
      sourceType: intent.draft.sourceType,
      actorId: intent.draft.approvedByActorId,
      preparedPayload: intent.preparedPayload,
      telegraphPath: intent.telegraphPath,
      telegraphUrl: intent.telegraphUrl,
      leaseToken,
      attempts: intent.attempts
    };
  }

  private async quarantineExpiredProcessing(): Promise<void> {
    await this.prisma.publicationIntent.updateMany({
      where: { status: 'PROCESSING', leaseExpiresAt: { lte: new Date() } },
      data: {
        status: 'NEEDS_RECONCILIATION',
        leaseToken: null,
        leaseExpiresAt: null,
        lastError: 'Worker lease expired during publication; verify channel and database state before retrying.'
      }
    });
  }

  private async finish(
    claim: PublicationIntentClaim,
    status: 'SUCCEEDED' | 'FAILED' | 'NEEDS_RECONCILIATION',
    error?: string
  ): Promise<void> {
    const completed = await this.prisma.publicationIntent.updateMany({
      where: { id: claim.id, status: 'PROCESSING', leaseToken: claim.leaseToken },
      data: {
        status,
        leaseToken: null,
        leaseExpiresAt: null,
        ...(status === 'SUCCEEDED' ? { completedAt: new Date() } : {}),
        ...(error !== undefined ? { lastError: error.slice(0, 4_000) } : { lastError: null })
      }
    });
    if (completed.count !== 1) {
      throw new Error(`Publication intent lease ${claim.id} is no longer owned.`);
    }
  }
}
