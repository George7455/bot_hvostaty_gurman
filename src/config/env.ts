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
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).optional()
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
