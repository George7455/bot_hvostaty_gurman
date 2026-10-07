import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

export interface PlannerRunClaim {
  runKey: string;
  leaseToken: string;
  attempts: number;
  contentPlanItemId: string | null;
  draftId: string | null;
}

export interface PlannerRunRepository {
  claimRun(runKey: string, leaseDurationMs: number): Promise<PlannerRunClaim | null>;
  markSucceeded(runKey: string, leaseToken: string): Promise<void>;
  markFailed(runKey: string, leaseToken: string, error: string): Promise<void>;
}

export class PrismaPlannerRunRepository implements PlannerRunRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async claimRun(runKey: string, leaseDurationMs: number): Promise<PlannerRunClaim | null> {
    if (leaseDurationMs <= 0) {
      throw new Error('Planner run lease duration must be positive.');
    }
    await this.prisma.plannerRun.upsert({
      where: { runKey },
      create: { runKey },
      update: {}
    });

    const now = new Date();
    const leaseToken = randomUUID();
    const claimed = await this.prisma.plannerRun.updateMany({
      where: {
        runKey,
        attempts: { lt: 3 },
        OR: [
          { status: { in: ['PENDING', 'FAILED'] } },
          { status: 'RUNNING', leaseExpiresAt: { lte: now } }
        ]
      },
      data: {
        status: 'RUNNING',
        attempts: { increment: 1 },
        leaseToken,
        leaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
        lastError: null,
        startedAt: now,
        completedAt: null
      }
    });
    if (claimed.count !== 1) {
      return null;
    }
    const run = await this.prisma.plannerRun.findUnique({
      where: { runKey },
      select: { attempts: true, leaseToken: true, contentPlanItemId: true, draftId: true }
    });
    if (!run || run.leaseToken !== leaseToken) {
      throw new Error(`Planner run ${runKey} was claimed but could not be reloaded.`);
    }
    return {
      runKey,
      leaseToken,
      attempts: run.attempts,
      contentPlanItemId: run.contentPlanItemId,
      draftId: run.draftId
    };
  }

  public async markSucceeded(runKey: string, leaseToken: string): Promise<void> {
    await this.finish(runKey, leaseToken, 'SUCCEEDED');
  }

  public async markFailed(runKey: string, leaseToken: string, error: string): Promise<void> {
    await this.finish(runKey, leaseToken, 'FAILED', error);
  }

  private async finish(
    runKey: string,
    leaseToken: string,
    status: 'SUCCEEDED' | 'FAILED',
    error?: string
  ): Promise<void> {
    const completed = await this.prisma.plannerRun.updateMany({
      where: { runKey, status: 'RUNNING', leaseToken },
      data: {
        status,
        leaseToken: null,
        leaseExpiresAt: null,
        completedAt: new Date(),
        ...(error !== undefined ? { lastError: error.slice(0, 4_000) } : { lastError: null })
      }
    });
    if (completed.count !== 1) {
      throw new Error(`Planner run lease ${runKey} is no longer owned.`);
    }
  }
}
