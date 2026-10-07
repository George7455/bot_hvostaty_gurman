import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

function normalizeMultilineSecret(value: string): string {
  return value.replace(/\\n/g, '\n');
}

function emptyStringToUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim().length === 0 ? undefined : value;
}

function optionalString(schema: z.ZodString): z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown> {
  return z.preprocess(emptyStringToUndefined, schema.optional());
}

function telegramIdListSchema(kind: 'chat' | 'user'): z.ZodType<string> {
  const pattern = kind === 'chat' ? /^-?[1-9]\d*$/ : /^[1-9]\d*$/;
  return z.string().trim().min(1).superRefine((value, ctx) => {
    const entries = value.split(',').map((entry) => entry.trim());
    if (entries.some((entry) => !pattern.test(entry))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Expected a comma-separated list of numeric Telegram ${kind} IDs.`
      });
    }
  });
}

const telegramChatIdListSchema = telegramIdListSchema('chat');
const telegramUserIdListSchema = telegramIdListSchema('user');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.string().trim().min(1),
  TELEGRAM_BOT_TOKEN: z.string().trim().min(1),
  TELEGRAM_CHANNEL_ID: z.string().trim().min(1),
  TELEGRAM_MODERATOR_CHAT_IDS: telegramChatIdListSchema,
  TELEGRAM_MODERATOR_USER_IDS: z.preprocess(emptyStringToUndefined, telegramUserIdListSchema.optional()),
  TELEGRAM_HANDLER_TIMEOUT_MS: z.coerce.number().int().min(60_000).max(15 * 60_000).default(10 * 60_000),
  TELEGRAM_STARTUP_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(30_000),
  GOOGLE_SHEETS_ID: z.string().trim().min(1),
  GOOGLE_SHEETS_WORKSHEET_TITLE: optionalString(z.string().trim().min(1)),
  GOOGLE_SHEETS_ITEM_KEY_HEADER: z.string().trim().min(1).default('content_id'),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().min(1),
  OPENAI_API_KEY: optionalString(z.string().min(1)),
  OPENAI_MODEL: optionalString(z.string().min(1)),
  AI_PROXY_URL: optionalString(z.string().url()),
  AI_PROXY_SECRET: optionalString(z.string().min(1)),
  TELEGRAPH_ACCESS_TOKEN: optionalString(z.string().trim().min(1)),
  TELEGRAPH_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(15_000)
}).superRefine((data, ctx) => {
  if (data.AI_PROXY_URL) {
    if (!data.AI_PROXY_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AI_PROXY_SECRET'],
        message: 'AI_PROXY_SECRET is required when AI_PROXY_URL is set.'
      });
    }
    return;
  }

  if (!data.OPENAI_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['OPENAI_API_KEY'],
      message: 'OPENAI_API_KEY is required when AI_PROXY_URL is not set.'
    });
  }
});

export type AppEnv = z.infer<typeof envSchema>;

export function readEnv(): AppEnv {
  const normalizedEnv = {
    ...process.env,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
      ? normalizeMultilineSecret(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
      : process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  };

  return envSchema.parse(normalizedEnv);
}
