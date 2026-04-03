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
  console.log('App bootstrap starting');
  const env = readEnv();
  console.log('Environment loaded');
  const database = createDatabaseModule();
  console.log('Connecting to database');
  await database.connect();
  console.log('Database connected');
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

  console.log('Starting Telegram bot');
  await telegramModule.start();
  console.log('Telegram bot started');
  plannerModule.start();
  console.log('Planner started');

  await app.listen({
    host: '0.0.0.0',
    port: env.PORT
  });
  console.log(`HTTP server listening on port ${env.PORT}`);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start application', error);
  process.exit(1);
});
