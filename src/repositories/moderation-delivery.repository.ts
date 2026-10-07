import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

export interface ModerationMessageReceipt {
  telegramChatId: string;
  telegramMessageId: string;
}

export interface ModerationDeliveryClaim {
  id: string;
  draftId: string;
  revisionId: string;
  text: string;
  leaseToken: string;
  attempts: number;
}

export interface ModerationMessageContext {
  telegramChatId: string;
  telegramMessageId: string;
}

export interface ModerationDeliveryRepository {
  claimForRevision(draftId: string, revisionId: string, leaseDurationMs: number): Promise<ModerationDeliveryClaim | null>;
  claimNext(leaseDurationMs: number): Promise<ModerationDeliveryClaim | null>;
  markSent(claim: ModerationDeliveryClaim, receipts: readonly ModerationMessageReceipt[]): Promise<void>;
  markFailed(claim: ModerationDeliveryClaim, error: string): Promise<void>;
  markNeedsReconciliation(
    claim: ModerationDeliveryClaim,
    error: string,
    receipts?: readonly ModerationMessageReceipt[]
  ): Promise<void>;
  resolveRevisionId(draftId: string, context: ModerationMessageContext): Promise<string | null>;
}

export class PrismaModerationDeliveryRepository implements ModerationDeliveryRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async claimForRevision(
    draftId: string,
    revisionId: string,
    leaseDurationMs: number
  ): Promise<ModerationDeliveryClaim | null> {
    await this.quarantineExpiredProcessing();
    const delivery = await this.prisma.moderationDelivery.findUnique({
      where: { draftId_revisionId: { draftId, revisionId } },
      select: { id: true }
    });
    return delivery ? this.claimById(delivery.id, leaseDurationMs) : null;
  }

  public async claimNext(leaseDurationMs: number): Promise<ModerationDeliveryClaim | null> {
    await this.quarantineExpiredProcessing();
    const candidate = await this.prisma.moderationDelivery.findFirst({
      where: {
        status: { in: ['PENDING', 'FAILED'] }
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true }
    });
    return candidate ? this.claimById(candidate.id, leaseDurationMs) : null;
  }

  public async markSent(
    claim: ModerationDeliveryClaim,
    receipts: readonly ModerationMessageReceipt[]
  ): Promise<void> {
    if (receipts.length === 0) {
      throw new Error(`Moderation delivery ${claim.id} produced no Telegram message receipts.`);
    }
    await this.prisma.$transaction(async (tx) => {
      const owned = await tx.moderationDelivery.updateMany({
        where: { id: claim.id, status: 'PROCESSING', leaseToken: claim.leaseToken },
        data: {
          status: 'SUCCEEDED',
          sentAt: new Date(),
          leaseToken: null,
          leaseExpiresAt: null,
          lastError: null
        }
      });
      if (owned.count !== 1) {
        throw new Error(`Moderation delivery lease ${claim.id} is no longer owned.`);
      }
      await tx.moderationMessage.createMany({
        data: receipts.map((receipt) => ({
          deliveryId: claim.id,
          draftId: claim.draftId,
          revisionId: claim.revisionId,
          telegramChatId: receipt.telegramChatId,
          telegramMessageId: receipt.telegramMessageId
        })),
        skipDuplicates: true
      });
    });
  }

  public async markFailed(claim: ModerationDeliveryClaim, error: string): Promise<void> {
    await this.finishWithStatus(claim, 'FAILED', error);
  }

  public async markNeedsReconciliation(
    claim: ModerationDeliveryClaim,
    error: string,
    receipts: readonly ModerationMessageReceipt[] = []
  ): Promise<void> {
    await this.finishWithStatus(claim, 'NEEDS_RECONCILIATION', error, receipts);
  }

  public async resolveRevisionId(
    draftId: string,
    context: ModerationMessageContext
  ): Promise<string | null> {
    const message = await this.prisma.moderationMessage.findFirst({
      where: {
        draftId,
        telegramChatId: context.telegramChatId,
        telegramMessageId: context.telegramMessageId
      },
      select: { revisionId: true }
    });
    return message?.revisionId ?? null;
  }

  private async claimById(id: string, leaseDurationMs: number): Promise<ModerationDeliveryClaim | null> {
    const now = new Date();
    const leaseToken = randomUUID();
    const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
    const acquired = await this.prisma.moderationDelivery.updateMany({
      where: {
        id,
        status: { in: ['PENDING', 'FAILED'] }
      },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        leaseToken,
        leaseExpiresAt,
        lastError: null
      }
    });
    if (acquired.count !== 1) {
      return null;
    }
    const delivery = await this.prisma.moderationDelivery.findUnique({
      where: { id },
      select: {
        id: true,
        draftId: true,
        revisionId: true,
        leaseToken: true,
        attempts: true,
        revision: { select: { text: true } }
      }
    });
    if (!delivery || delivery.leaseToken !== leaseToken) {
      throw new Error(`Moderation delivery ${id} was claimed but could not be reloaded.`);
    }
    return {
      id: delivery.id,
      draftId: delivery.draftId,
      revisionId: delivery.revisionId,
      text: delivery.revision.text,
      leaseToken,
      attempts: delivery.attempts
    };
  }

  private async quarantineExpiredProcessing(): Promise<void> {
    await this.prisma.moderationDelivery.updateMany({
      where: { status: 'PROCESSING', leaseExpiresAt: { lte: new Date() } },
      data: {
        status: 'NEEDS_RECONCILIATION',
        leaseToken: null,
        leaseExpiresAt: null,
        lastError: 'Worker lease expired during Telegram delivery; verify moderator chats before retrying.'
      }
    });
  }

  private async finishWithStatus(
    claim: ModerationDeliveryClaim,
    status: 'FAILED' | 'NEEDS_RECONCILIATION',
    error: string,
    receipts: readonly ModerationMessageReceipt[] = []
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.moderationDelivery.updateMany({
        where: { id: claim.id, status: 'PROCESSING', leaseToken: claim.leaseToken },
        data: {
          status,
          lastError: error.slice(0, 4_000),
          leaseToken: null,
          leaseExpiresAt: null
        }
      });
      if (updated.count !== 1) {
        throw new Error(`Moderation delivery lease ${claim.id} is no longer owned.`);
      }
      if (receipts.length > 0) {
        await tx.moderationMessage.createMany({
          data: receipts.map((receipt) => ({
            deliveryId: claim.id,
            draftId: claim.draftId,
            revisionId: claim.revisionId,
            telegramChatId: receipt.telegramChatId,
            telegramMessageId: receipt.telegramMessageId
          })),
          skipDuplicates: true
        });
      }
    });
  }
}
