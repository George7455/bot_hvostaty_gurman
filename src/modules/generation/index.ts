const TEMPORARY_PROMPT_NOTE = 'TEMPORARY_PROMPT_V1';

export interface InitialDraftGenerationInput {
  topic: string;
  rubric: string;
}

export interface AiGenerationPort {
  complete(prompt: string): Promise<string>;
}

export interface GenerationModule {
  generateInitialDraftText(input: InitialDraftGenerationInput): Promise<string>;
  rewriteDraftText(previousDraftText: string, notes?: string): Promise<string>;
  adaptManualArticleText(articleText: string): Promise<string>;
}

export class GenerationService implements GenerationModule {
  public constructor(private readonly ai: AiGenerationPort) {}

  public async generateInitialDraftText(input: InitialDraftGenerationInput): Promise<string> {
    const prompt = buildTemporaryNeutralPrompt(input);
    return this.generateNonEmpty(prompt);
  }

  public async rewriteDraftText(previousDraftText: string, notes?: string): Promise<string> {
    const prompt = buildTemporaryRewritePrompt(previousDraftText, notes);
    return this.generateNonEmpty(prompt);
  }

  public async adaptManualArticleText(articleText: string): Promise<string> {
    const prompt = buildTemporaryManualAdaptationPrompt(articleText);
    return this.generateNonEmpty(prompt);
  }

  private async generateNonEmpty(prompt: string): Promise<string> {
    const generatedText = normalizeGeneratedText((await this.ai.complete(prompt)).trim());
    if (generatedText.length === 0) {
      throw new Error('AI generation returned empty draft text.');
    }

    return generatedText;
  }
}

function normalizeGeneratedText(text: string): string {
  let normalized = text;

  normalized = normalized.replace(/^#{1,6}\s+/gm, '');
  normalized = normalized.replace(/\*\*(.*?)\*\*/g, '$1');
  normalized = normalized.replace(/\*(.*?)\*/g, '$1');
  normalized = normalized.replace(/__(.*?)__/g, '$1');

  normalized = normalized
    .split('\n')
    .filter((line) => !/следующ(ем|ий|ая|ие)\s+пост/i.test(line))
    .join('\n');

  return normalized.trim();
}

function buildTemporaryNeutralPrompt(input: InitialDraftGenerationInput): string {
  return [
    'Ты — профессиональный копирайтер Telegram-каналов в нише собак (уход, поведение, кормление, повседневная жизнь с питомцем).',
    '',
    'Твоя задача — создать небольшую, но максимально вовлекающую, живую и практичную статью для Telegram-канала.',
    '',
    '---',
    '',
    '## ВХОДНЫЕ ДАННЫЕ:',
    `Тема поста: ${input.topic}`,
    `Тип поста (если указан): ${input.rubric}`,
    '',
    '---',
    '',
    '## ТРЕБОВАНИЯ К ТЕКСТУ:',
    '',
    '1. Стиль:',
    '- дружелюбный, живой, как от человека',
    '- ощущение общения с владельцем собаки',
    '- без сухости и заумности',
    '- допускается легкий юмор и узнаваемые бытовые ситуации',
    '',
    '2. Структура (обязательно):',
    '- HOOK (первые 1-2 строки): цепляет внимание, вызывает узнавание или эмоцию',
    '- Основная часть: реальные бытовые наблюдения, конкретика, мини-выводы',
    '- Вовлечение: задай вопрос или предложи поделиться опытом',
    '- CTA (если уместно): мягкий и нативный, особенно для тем про корм/товары',
    '',
    '3. Формат:',
    '- короткие абзацы (1-3 строки)',
    '- легкая читаемость',
    '- 1-3 эмодзи максимум, только по делу',
    '- не используй markdown-разметку: запрещены символы и конструкции ###, ##, #, **, *, __, списки с маркерами',
    '',
    '4. Глубина:',
    '- не поверхностно',
    '- добавь детали, которые обычно не проговаривают',
    '- эффект: о, у меня так же',
    '',
    '5. Важно:',
    '- если есть советы по здоровью/питанию/состоянию собаки, добавь в конце точную фразу:',
    '"Информация носит общий характер, при необходимости проконсультируйтесь со специалистом."',
    '',
    '6. Запрещено:',
    '- сухой энциклопедический стиль',
    '- слишком длинные объяснения',
    '- клише и банальности',
    '- перегруз эмодзи',
    '- обещания и ссылки на будущие/следующие посты (не пиши "в следующем посте" и аналогичные формулировки)',
    '',
    '---',
    '',
    'Результат: выдай готовый пост для Telegram, который можно публиковать без доработки.'
  ].join('\n');
}

function buildTemporaryRewritePrompt(previousDraftText: string, notes?: string): string {
  const notesPart = notes?.trim().length
    ? `Rewrite notes: ${notes.trim()}`
    : 'Rewrite notes: not provided';

  return [
    `${TEMPORARY_PROMPT_NOTE}: editorial style rules are not provided yet.`,
    'Rewrite the Telegram post draft in Russian while preserving the core meaning.',
    notesPart,
    'Previous draft:',
    previousDraftText,
    'Constraints:',
    '- 800 to 1200 characters',
    '- clear structure and practical tone',
    '- no markdown formatting: do not use ###, ##, #, **, *, __, bullet lists',
    '- avoid promises/references to future posts ("in the next post", etc.)'
  ].join('\n');
}

function buildTemporaryManualAdaptationPrompt(articleText: string): string {
  return [
    `${TEMPORARY_PROMPT_NOTE}: editorial style rules are not provided yet.`,
    'Adapt the provided article into a neutral Telegram post draft in Russian.',
    'Source article:',
    articleText,
    'Constraints:',
    '- 800 to 1200 characters',
    '- clear structure and practical tone',
    '- no markdown formatting: do not use ###, ##, #, **, *, __, bullet lists',
    '- avoid promises/references to future posts ("in the next post", etc.)'
  ].join('\n');
}
