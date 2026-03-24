import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { DraftsModule } from '../drafts/index.js';
import type { ModerationModule } from '../moderation/index.js';
import type { SheetsModule } from '../sheets/index.js';

const MOSCOW_TIMEZONE = 'Europe/Moscow';
const PLANNED_HOURS = new Set([9, 15, 21]);
const SCHEDULE_MINUTE_WINDOW = 5;
const PLANNER_STATE_PATH = resolve(process.cwd(), '.planner-state.json');

export interface PlannerModule {
  runScheduledPlanningTick(): Promise<void>;
  start(): void;
  stop(): void;
}

export class PlannerService implements PlannerModule {
  private schedulerInterval: NodeJS.Timeout | null = null;
  private lastRunKey: string | null = null;
  private stateLoaded = false;
  private readonly statePath: string;

  public constructor(
    private readonly sheetsModule: SheetsModule,
    private readonly draftsModule: DraftsModule,
    private readonly moderationModule: ModerationModule,
    statePath: string = PLANNER_STATE_PATH
  ) {
    this.statePath = statePath;
  }

  public start(): void {
    if (this.schedulerInterval) {
      return;
    }

    this.schedulerInterval = setInterval(() => {
      void this.handleScheduleTick().catch((error: unknown) => {
        console.error('Planner schedule tick failed', error);
      });
    }, 30_000);

    void this.handleScheduleTick().catch((error: unknown) => {
      console.error('Planner startup tick failed', error);
    });
  }

  public stop(): void {
    if (!this.schedulerInterval) {
      return;
    }

    clearInterval(this.schedulerInterval);
    this.schedulerInterval = null;
  }

  public async runScheduledPlanningTick(): Promise<void> {
    const pickedItem = await this.sheetsModule.pickAndPersistNextPendingItem();
    if (!pickedItem) {
      return;
    }

    const draftCreation = await this.draftsModule.createInitialDraftFromContentPlanItem(pickedItem.contentPlanItemId);
    if (!draftCreation) {
      throw new Error(
        `Picked ContentPlanItem ${pickedItem.contentPlanItemId} but failed to create draft. ` +
          'Likely stale draft linkage in DB or concurrent processing conflict.'
      );
    }

    await this.moderationModule.enqueueDraftForModeration(draftCreation.draftId);
  }

  private async handleScheduleTick(): Promise<void> {
    await this.ensureStateLoaded();

    const currentTime = getMoscowTimeParts();
    if (currentTime.minute >= SCHEDULE_MINUTE_WINDOW || !PLANNED_HOURS.has(currentTime.hour)) {
      return;
    }

    const runKey = `${currentTime.date}-${currentTime.hour}`;
    if (this.lastRunKey === runKey) {
      return;
    }

    this.lastRunKey = runKey;
    await this.persistLastRunKey();
    await this.runScheduledPlanningTick();
  }

  private async ensureStateLoaded(): Promise<void> {
    if (this.stateLoaded) {
      return;
    }

    try {
      const rawState = await readFile(this.statePath, 'utf8');
      const parsedState = JSON.parse(rawState) as { lastRunKey?: unknown };
      this.lastRunKey = typeof parsedState.lastRunKey === 'string' ? parsedState.lastRunKey : null;
    } catch {
      this.lastRunKey = null;
    }

    this.stateLoaded = true;
  }

  private async persistLastRunKey(): Promise<void> {
    const state = JSON.stringify({ lastRunKey: this.lastRunKey });
    await writeFile(this.statePath, `${state}\n`, 'utf8');
  }
}

function getMoscowTimeParts(): { date: string; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MOSCOW_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(new Date());
  const date = `${readDatePart(parts, 'year')}-${readDatePart(parts, 'month')}-${readDatePart(parts, 'day')}`;
  const hour = Number(readDatePart(parts, 'hour'));
  const minute = Number(readDatePart(parts, 'minute'));

  return { date, hour, minute };
}

function readDatePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const part = parts.find((item) => item.type === type)?.value;
  if (!part) {
    throw new Error(`Failed to read date part: ${type}`);
  }

  return part;
}
