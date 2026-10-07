import crypto from 'crypto';
import OpenAI from 'openai';

import type { AppEnv } from '../../config/index.js';

const DEFAULT_MODEL = 'gpt-5.4-mini';
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
const MAX_OUTPUT_TOKENS = 8192;
const MAX_PROMPT_CHARS = 120_000;
const MAX_ERROR_BODY_CHARS = 2000;

export interface AiCompletionOptions {
  instructions?: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

export interface AiModule {
  complete(prompt: string, options?: AiCompletionOptions): Promise<string>;
}

export class OpenAiService implements AiModule {
  public constructor(
    private readonly client: OpenAI,
    private readonly model: string = DEFAULT_MODEL
  ) {}

  public async complete(prompt: string, options?: AiCompletionOptions): Promise<string> {
    const request = normalizeCompletionRequest(prompt, options);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs);
    try {
      const response = await this.client.responses.create(
        {
          model: this.model,
          input: request.prompt,
          instructions: request.instructions,
          max_output_tokens: request.maxOutputTokens,
          store: false
        },
        {
          timeout: request.timeoutMs,
          signal: controller.signal
        }
      );

      const text = response.output_text?.trim();
      if (!text || text.length === 0) {
        throw new Error('OpenAI returned empty response text.');
      }

      return text;
    } finally {
      clearTimeout(timer);
    }
  }
}

export class ProxyAiService implements AiModule {
  public constructor(
    private readonly url: string,
    private readonly secret: string,
    private readonly model: string = DEFAULT_MODEL
  ) {}

  public async complete(prompt: string, options?: AiCompletionOptions): Promise<string> {
    const request = normalizeCompletionRequest(prompt, options);
    const body = JSON.stringify({
      prompt: request.prompt,
      instructions: request.instructions,
      maxOutputTokens: request.maxOutputTokens,
      store: false,
      model: this.model
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs);
    let response: Response;
    try {
      response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Timestamp': timestamp,
          'X-Signature': signature
        },
        body,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const text = (await response.text()).slice(0, MAX_ERROR_BODY_CHARS);
      throw new Error(`AI proxy error (${response.status}): ${text}`);
    }

    const data = (await response.json()) as { text?: string };
    const text = data.text?.trim();
    if (!text || text.length === 0) {
      throw new Error('AI proxy returned empty response text.');
    }

    return text;
  }
}

interface NormalizedCompletionRequest {
  prompt: string;
  instructions: string | null;
  maxOutputTokens: number;
  timeoutMs: number;
}

function normalizeCompletionRequest(
  prompt: string,
  options?: AiCompletionOptions
): NormalizedCompletionRequest {
  const normalizedPrompt = prompt.trim();
  if (normalizedPrompt.length === 0) {
    throw new Error('AI prompt must not be empty.');
  }
  if (normalizedPrompt.length > MAX_PROMPT_CHARS) {
    throw new Error(`AI prompt exceeds ${MAX_PROMPT_CHARS} characters.`);
  }

  const requestedOutputTokens = options?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const maxOutputTokens = Math.max(256, Math.min(MAX_OUTPUT_TOKENS, Math.floor(requestedOutputTokens)));
  const requestedTimeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutMs = Math.max(1000, Math.min(DEFAULT_TIMEOUT_MS, Math.floor(requestedTimeoutMs)));

  return {
    prompt: normalizedPrompt,
    instructions: options?.instructions?.trim() || null,
    maxOutputTokens,
    timeoutMs
  };
}

export function createAiModuleFromEnv(env: AppEnv): AiModule {
  if (env.AI_PROXY_URL) {
    return new ProxyAiService(
      env.AI_PROXY_URL,
      env.AI_PROXY_SECRET!,
      env.OPENAI_MODEL ?? DEFAULT_MODEL
    );
  }

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return new OpenAiService(client, env.OPENAI_MODEL ?? DEFAULT_MODEL);
}
