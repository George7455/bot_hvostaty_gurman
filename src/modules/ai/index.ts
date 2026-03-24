import OpenAI from 'openai';

import type { AppEnv } from '../../config/index.js';

const DEFAULT_MODEL = 'gpt-4o-mini';

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

export function createAiModuleFromEnv(env: AppEnv): AiModule {
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return new OpenAiService(client, env.OPENAI_MODEL ?? DEFAULT_MODEL);
}
