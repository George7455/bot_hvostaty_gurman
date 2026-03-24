import { readEnv } from './src/config/index.js';
import { createDatabaseModule } from './src/database/index.js';
import { createRepositories } from './src/repositories/index.js';
import { createAiModuleFromEnv } from './src/modules/ai/index.js';
import { GenerationService } from './src/modules/generation/index.js';
import { DraftsService } from './src/modules/drafts/index.js';
import { SessionsService } from './src/modules/sessions/index.js';
import { SheetsService } from './src/modules/sheets/index.js';
import { TelegramService } from './src/modules/telegram/index.js';
import { PublishingService } from './src/modules/publishing/index.js';
import { ModerationService } from './src/modules/moderation/index.js';
import { PlannerService } from './src/modules/planner/index.js';

async function run(): Promise<void> {
  const env = readEnv();
  const db = createDatabaseModule();
  await db.connect();

  try {
    const repos = createRepositories(db.client);
    const ai = createAiModuleFromEnv(env);
    const generation = new GenerationService(ai);
    const drafts = new DraftsService(repos.draft, repos.draftRevision, generation);
    const sessions = new SessionsService(repos.userSession);
    const sheets = SheetsService.fromEnv(env, repos.contentPlan);
    const telegram = new TelegramService(env, sessions);
    const publishing = new PublishingService(repos.draft, repos.publication, sheets, telegram);
    const moderation = new ModerationService(repos.draft, repos.moderationAction, drafts, sessions, publishing, telegram);
    telegram.bindModerationModule(moderation);

    const planner = new PlannerService(sheets, drafts, moderation);
    await planner.runScheduledPlanningTick();

    console.log('manual planner tick done');
  } finally {
    await db.disconnect();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
