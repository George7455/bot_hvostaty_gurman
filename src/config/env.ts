import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

function normalizeMultilineSecret(value: string): string {
  return value.replace(/\\n/g, '\n');
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_CHANNEL_ID: z.string().min(1),
  TELEGRAM_MODERATOR_CHAT_IDS: z.string().min(1),
  GOOGLE_SHEETS_ID: z.string().min(1),
  GOOGLE_SHEETS_WORKSHEET_TITLE: z.string().min(1).optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).optional(),
  AI_PROXY_URL: z.string().url().optional(),
  AI_PROXY_SECRET: z.string().min(1).optional(),
  TELEGRAPH_ACCESS_TOKEN: z.string().min(1).optional(),
  TELEGRAPH_SHORT_NAME: z.string().min(1).optional()
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
