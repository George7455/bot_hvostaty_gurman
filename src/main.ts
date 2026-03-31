import { readEnv } from './config/index.js';
import { createDatabaseModule } from './database/index.js';
import { createAiModuleFromEnv } from './modules/ai/index.js';
import { DraftsService } from './modules/drafts/index.js';
import { GenerationService } from './modules/generation/index.js';
import { ModerationService } from './modules/moderation/index.js';
import { PlannerService } from './modules/planner/index.js';
import { PublishingService } from './modules/publishing/index.js';
import { SessionsService } from './modules/sessions/index.js';
import { SheetsService } from './modules/sheets/index.js';
import { TelegramService } from './modules/telegram/index.js';
import { createRepositories } from './repositories/index.js';
import { buildApp } from './app.js';

async function bootstrap(): Promise<void> {
  const env = readEnv();
  const database = createDatabaseModule();
  await database.connect();
  const repositories = createRepositories(database.client);

  const aiModule = createAiModuleFromEnv(env);
  const generationModule = new GenerationService(aiModule);
  const draftsModule = new DraftsService(repositories.draft, repositories.draftRevision, generationModule);
  const sessionsModule = new SessionsService(repositories.userSession);
  const sheetsModule = SheetsService.fromEnv(env, repositories.contentPlan);
  const telegramModule = new TelegramService(env, sessionsModule);
  const publishingModule = new PublishingService(
    repositories.draft,
    repositories.publication,
    sheetsModule,
    telegramModule
  );
  const moderationModule = new ModerationService(
    repositories.draft,
    repositories.moderationAction,
    draftsModule,
    sessionsModule,
    publishingModule,
    telegramModule
  );
  telegramModule.bindModerationModule(moderationModule);
  const plannerModule = new PlannerService(sheetsModule, draftsModule, moderationModule);
  telegramModule.bindPlannerModule(plannerModule);

  const app = buildApp();
  app.addHook('onClose', async () => {
    plannerModule.stop();
    await telegramModule.stop();
    await database.disconnect();
  });

  await telegramModule.start();
  plannerModule.start();

  await app.listen({
    host: '0.0.0.0',
    port: env.PORT
  });
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start application', error);
  process.exit(1);
});
