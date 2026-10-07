import type { DraftsModule } from '../drafts/index.js';
import type { ModerationModule } from '../moderation/index.js';
import type { PublishingModule } from '../publishing/index.js';
import type { SheetsModule } from '../sheets/index.js';
import type { PlannerRunRepository } from '../../repositories/planner-run.repository.js';

const MOSCOW_TIMEZONE = 'Europe/Moscow';
export const PLANNED_HOURS = new Set([9, 15, 21]);
const SCHEDULE_MINUTE_WINDOW = 5;
const PLANNER_LEASE_MS = 10 * 60_000;

export interface PlannerModule {
  runScheduledPlanningTick(): Promise<void>;
  start(): void;
  stop(): void;
}

export class PlannerService implements PlannerModule {
  private schedulerInterval: NodeJS.Timeout | null = null;

  public constructor(
    private readonly sheetsModule: SheetsModule,
    private readonly draftsModule: DraftsModule,
    private readonly moderationModule: ModerationModule,
    private readonly publishingModule: PublishingModule,
    private readonly plannerRunRepository: PlannerRunRepository
  ) {}

  public start(): void {
    if (this.schedulerInterval) {
      return;
    }
    this.schedulerInterval = setInterval(() => {
      void this.handleTimerTick().catch((error: unknown) => {
        console.error('Planner timer tick failed', error);
      });
    }, 30_000);
    void this.handleTimerTick().catch((error: unknown) => {
      console.error('Planner startup tick failed', error);
    });
  }

  public stop(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  public async runScheduledPlanningTick(): Promise<void> {
    await this.executePlanningTick();
  }

  private async executePlanningTick(plannerRunKey?: string, existingDraftId?: string | null): Promise<void> {
    if (existingDraftId) {
      await this.moderationModule.enqueueDraftForModeration(existingDraftId);
      return;
    }

    let draftCreation = await this.draftsModule.createInitialDraftFromNextInReview(plannerRunKey);
    if (!draftCreation) {
      const pickedItem = await this.sheetsModule.pickAndPersistNextPendingItem();
      if (!pickedItem) {
        return;
      }
      draftCreation = await this.draftsModule.createInitialDraftFromContentPlanItem(
        pickedItem.contentPlanItemId,
        plannerRunKey
      );
      if (!draftCreation) {
        throw new Error(`Picked ContentPlanItem ${pickedItem.contentPlanItemId} but could not create its draft.`);
      }
    }

    try {
      await this.moderationModule.enqueueDraftForModeration(
        draftCreation.draftId,
        draftCreation.revisionId
      );
    } catch (error: unknown) {
      // The durable delivery is already recorded. A transport ambiguity must not consume
      // another content-plan row during this schedule slot.
      console.error('Draft persisted but moderation delivery requires reconciliation', {
        draftId: draftCreation.draftId,
        error
      });
    }
  }

  private async handleTimerTick(): Promise<void> {
    await this.recoverDurableWork();

    const currentTime = getMoscowTimeParts();
    if (currentTime.minute >= SCHEDULE_MINUTE_WINDOW || !PLANNED_HOURS.has(currentTime.hour)) {
      return;
    }

    const runKey = `${currentTime.date}-${String(currentTime.hour).padStart(2, '0')}`;
    const claim = await this.plannerRunRepository.claimRun(runKey, PLANNER_LEASE_MS);
    if (!claim) {
      return;
    }

    try {
      await this.executePlanningTick(claim.runKey, claim.draftId);
      await this.plannerRunRepository.markSucceeded(claim.runKey, claim.leaseToken);
    } catch (error: unknown) {
      await this.plannerRunRepository.markFailed(claim.runKey, claim.leaseToken, toErrorMessage(error));
      throw error;
    }
  }

  private async recoverDurableWork(): Promise<void> {
    try {
      await this.moderationModule.deliverNextPendingDraft();
    } catch (error: unknown) {
      console.error('Pending moderation delivery recovery failed', error);
    }
    try {
      await this.publishingModule.publishNextPendingDraft();
    } catch (error: unknown) {
      console.error('Pending publication recovery failed', error);
    }
  }
}

export function getMoscowTimeParts(now: Date = new Date()): { date: string; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MOSCOW_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  return {
    date: `${readDatePart(parts, 'year')}-${readDatePart(parts, 'month')}-${readDatePart(parts, 'day')}`,
    hour: Number(readDatePart(parts, 'hour')),
    minute: Number(readDatePart(parts, 'minute'))
  };
}

function readDatePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const part = parts.find((item) => item.type === type)?.value;
  if (!part) {
    throw new Error(`Failed to read date part: ${type}`);
  }
  return part;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
