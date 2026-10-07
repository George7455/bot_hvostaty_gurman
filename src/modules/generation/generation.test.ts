import assert from 'node:assert/strict';
import test from 'node:test';

import { GENERATION_LIMITS, GenerationService, type AiGenerationPort } from './index.js';

test('manual adaptation rejects an AI outage instead of fabricating an unrelated fallback', async () => {
  let calls = 0;
  const ai: AiGenerationPort = {
    async complete(): Promise<string> {
      calls += 1;
      throw new Error('simulated upstream outage');
    }
  };
  const service = new GenerationService(ai);
  const source =
    'Введение нового корма занимает 10 минут в день. Менять рацион нужно постепенно, наблюдая за самочувствием собаки и сохраняя рекомендации специалиста.';

  await assert.rejects(
    service.adaptManualArticleText(source),
    /failed before a safe publishable candidate/i
  );
  assert.equal(calls, 1);
  assert.ok(calls <= GENERATION_LIMITS.manualMaxAiCalls);
});

test('manual adaptation rejects oversized source before calling AI', async () => {
  let calls = 0;
  const ai: AiGenerationPort = {
    async complete(): Promise<string> {
      calls += 1;
      return 'unused';
    }
  };
  const service = new GenerationService(ai);
  const source = 'а'.repeat(GENERATION_LIMITS.manualMaxSourceChars + 1);

  await assert.rejects(service.adaptManualArticleText(source), /exceeds the safe/i);
  assert.equal(calls, 0);
});

test('standard generation forwards bounded OpenAI request options', async () => {
  let receivedOptions: Parameters<AiGenerationPort['complete']>[1] | undefined;
  const ai: AiGenerationPort = {
    async complete(_prompt, options): Promise<string> {
      receivedOptions = options;
      return 'Готовый проверочный текст.';
    }
  };
  const service = new GenerationService(ai);

  const text = await service.generateInitialDraftText({ topic: 'Прогулка', rubric: 'Уход' });

  assert.equal(text, 'Готовый проверочный текст.');
  assert.equal(receivedOptions?.maxOutputTokens, 2048);
  assert.equal(receivedOptions?.timeoutMs, GENERATION_LIMITS.aiCallTimeoutMs);
  assert.match(receivedOptions?.instructions ?? '', /недоверенные данные/i);
});
