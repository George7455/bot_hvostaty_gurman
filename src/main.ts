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
  const telegramStarted = await withTimeout(telegramModule.start(), 15_000);
  if (telegramStarted) {
    console.log('Telegram bot started');
  } else {
    console.warn('Telegram bot start timed out; continuing without confirmed startup.');
  }
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<boolean> {
  let timeoutHandle: NodeJS.Timeout | null = null;
  try {
    const guardedPromise = promise
      .then(() => true)
      .catch((error: unknown) => {
        console.warn('Telegram bot start failed; continuing without confirmed startup.', error);
        return false;
      });

    const result = await Promise.race([
      guardedPromise,
      new Promise<boolean>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(false), timeoutMs);
      })
    ]);
    return result === true;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
