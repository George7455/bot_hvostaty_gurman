import crypto from 'crypto';
import OpenAI from 'openai';

import type { AppEnv } from '../../config/index.js';

const DEFAULT_MODEL = 'gpt-5.4-mini';

export interface AiModule {
  complete(prompt: string): Promise<string>;
}

export class OpenAiService implements AiModule {
  public constructor(
    private readonly client: OpenAI,
    private readonly model: string = DEFAULT_MODEL
  ) {}

  public async complete(prompt: string): Promise<string> {
    const response = await this.client.responses.create({
      model: this.model,
      input: prompt
    });

    const text = response.output_text?.trim();
    if (!text || text.length === 0) {
      throw new Error('OpenAI returned empty response text.');
    }

    return text;
  }
}

export class ProxyAiService implements AiModule {
  public constructor(
    private readonly url: string,
    private readonly secret: string,
    private readonly model: string = DEFAULT_MODEL
  ) {}

  public async complete(prompt: string): Promise<string> {
    const body = JSON.stringify({ prompt, model: this.model });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp,
        'X-Signature': signature
      },
      body
    });

    if (!response.ok) {
      const text = await response.text();
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
