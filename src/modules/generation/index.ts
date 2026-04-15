const TEMPORARY_PROMPT_NOTE = 'TEMPORARY_PROMPT_V1';
const MANUAL_QUALITY_TARGET_SCORE = 9;
const MANUAL_QUALITY_MAX_REWRITES = 3;

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
    const sourceText = sanitizeManualSourceText(articleText);
    const lengthRange = resolveManualAdaptationLengthRange(sourceText);
    let candidate = await this.generateBaseManualCandidate(sourceText, lengthRange);
    let bestCandidate = candidate;
    let bestScore = 0;

    for (let attempt = 0; attempt <= MANUAL_QUALITY_MAX_REWRITES; attempt += 1) {
      const quality = await this.evaluateManualQuality(sourceText, candidate, lengthRange);
      if (quality.score > bestScore) {
        bestScore = quality.score;
        bestCandidate = candidate;
      }

      if (quality.score >= MANUAL_QUALITY_TARGET_SCORE) {
        return candidate;
      }

      if (attempt === MANUAL_QUALITY_MAX_REWRITES) {
        break;
      }

      const improvePrompt = buildManualQualityImprovementPrompt(
        sourceText,
        candidate,
        quality,
        lengthRange
      );
      candidate = await this.generateNonEmpty(improvePrompt);
      if (!isAcceptableManualAdaptation(candidate, lengthRange)) {
        candidate = await this.generateBaseManualCandidate(sourceText, lengthRange);
      }
    }

    if (bestScore >= 7) {
      return bestCandidate;
    }

    return buildDeterministicManualFallback(sourceText, lengthRange);
  }

  private async generateNonEmpty(prompt: string): Promise<string> {
    const generatedText = normalizeGeneratedText((await this.ai.complete(prompt)).trim());
    if (generatedText.length === 0) {
      throw new Error('AI generation returned empty draft text.');
    }

    return generatedText;
  }

  private async generateBaseManualCandidate(
    sourceText: string,
    lengthRange: { minLength: number; maxLength: number }
  ): Promise<string> {
    const prompt = buildTemporaryManualAdaptationPrompt(sourceText, lengthRange);
    const firstAttempt = await this.generateNonEmpty(prompt);

    if (isAcceptableManualAdaptation(firstAttempt, lengthRange)) {
      return firstAttempt;
    }

    const expansionPrompt = buildManualAdaptationExpansionPrompt(
      sourceText,
      firstAttempt,
      lengthRange
    );
    const secondAttempt = await this.generateNonEmpty(expansionPrompt);
    if (isAcceptableManualAdaptation(secondAttempt, lengthRange)) {
      return secondAttempt;
    }

    const rescuePrompt = buildManualAdaptationRescuePrompt(sourceText, secondAttempt, lengthRange);
    const thirdAttempt = await this.generateNonEmpty(rescuePrompt);
    if (isAcceptableManualAdaptation(thirdAttempt, lengthRange)) {
      return thirdAttempt;
    }

    return buildDeterministicManualFallback(sourceText, lengthRange);
  }

  private async evaluateManualQuality(
    sourceText: string,
    candidateText: string,
    lengthRange: { minLength: number; maxLength: number }
  ): Promise<ManualQualityAssessment> {
    const prompt = buildManualQualityEvaluationPrompt(sourceText, candidateText, lengthRange);
    const raw = await this.ai.complete(prompt);
    return parseManualQualityAssessment(raw, candidateText, lengthRange);
  }
}

interface ManualQualityAssessment {
  score: number;
  issues: string[];
  rewritePlan: string;
}

function normalizeGeneratedText(text: string): string {
  let normalized = text;

  normalized = normalized.replace(/^#{1,6}\s+/gm, '');
  normalized = normalized.replace(/\*\*(.*?)\*\*/g, '$1');
  normalized = normalized.replace(/\*(.*?)\*/g, '$1');
  normalized = normalized.replace(/__(.*?)__/g, '$1');
  normalized = normalized
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .join('\n');

  normalized = normalized
    .split('\n')
    .map((line) => collapseRepeatedIntroChunk(line))
    .filter((line) => !/следующ(ем|ий|ая|ие)\s+пост/i.test(line))
    .join('\n');

  return normalized.trim();
}

function buildTemporaryNeutralPrompt(input: InitialDraftGenerationInput): string {
  return [
    'Ты — сильный Telegram-копирайтер в нише собак с очень точным чувством живой бытовой речи.',
    '',
    'Ты пишешь не просто “контент”, а посты, в которых владелец собаки узнаёт себя с первых строк.',
    '',
    'Твоя специализация:',
    'уход за собакой, кормление, поведение, привычки, бытовые ситуации, отношения человека и собаки, повседневная жизнь с питомцем.',
    '',
    'Твоя задача — сразу выдавать готовые посты для Telegram-канала, которые можно публиковать без редактуры.',
    '',
    '────────────────',
    'ВХОДНЫЕ ДАННЫЕ',
    `Тема поста: ${input.topic}`,
    `Тип поста: ${input.rubric}`,
    'Цель поста: не указана',
    'Продукт/услуга для упоминания: нет',
    'Факты, которые обязательно нужно учесть: не указаны',
    'Что нельзя упоминать: не указано',
    '',
    '────────────────',
    'ГЛАВНАЯ ЗАДАЧА',
    '',
    'Создай живой, сильный, цепляющий пост для Telegram-канала про собак.',
    '',
    'Пост должен:',
    '— звучать по-человечески, а не как статья, памятка или реклама;',
    '— вызывать мгновенное узнавание у владельцев собак;',
    '— быть плотным, естественным и легко читаемым с телефона;',
    '— содержать конкретную бытовую правду, а не общие слова;',
    '— быть написан без пустых строк между абзацами.',
    '— каждый абзац должен начинаться с новой строки.',
    '',
    'Главный ориентир:',
    'читатель должен подумать не “это полезный текст”, а “вот да, у нас это выглядит именно так”.',
    '',
    '────────────────',
    'КАКИМ ДОЛЖЕН БЫТЬ РЕЗУЛЬТАТ',
    '',
    'Идеальный пост:',
    '— быстро захватывает внимание с первой строки;',
    '— показывает знакомую сцену из жизни с собакой;',
    '— даёт точное наблюдение, а не банальный совет;',
    '— объясняет коротко и по делу, без занудства;',
    '— заканчивается естественным вопросом или вовлечением;',
    '— оставляет ощущение: “это написал человек, который реально понимает повседневную жизнь с собакой”.',
    '',
    '────────────────',
    'ЖЕСТКИЕ ПРАВИЛА',
    '',
    '1. Никаких выдумок',
    '',
    'Запрещено выдумывать:',
    '   — товары;',
    '   — бренды;',
    '   — услуги;',
    '   — личные истории;',
    '   — клички собак;',
    '   — ситуации, которых нет во входных данных;',
    '   — опыт от первого лица, если он не был явно дан.',
    '',
    'Если продукт или услуга не указаны, не упоминай никакие корма, игрушки, лакомства, аксессуары, магазины, консультации, сервисы и любые другие сущности.',
    '',
    'Если входных данных мало, делай текст сильным за счёт наблюдательности, ритма, бытовой точности и интонации, а не за счёт фантазии.',
    'Не добавляй детали, которые не следуют из темы: время суток, конкретные предметы, упаковки, “сценарии”, которых нет во входных данных.',
    '',
    '2. Никакой фальшивой личной истории',
    '',
    'Нельзя:',
    '— “у меня была собака…”;',
    '— “мой пёс всегда…”;',
    '— “как-то у нас было…”;',
    '— любые псевдоличные примеры.',
    '',
    'Можно:',
    '— нейтральные наблюдения;',
    '— обобщённые бытовые сцены;',
    '— формулировки вроде:',
    '“многие владельцы знают этот момент”,',
    '“часто дома это выглядит так”,',
    '“знакомая ситуация, когда…”,',
    '“у многих всё начинается одинаково…”.',
    '',
    '3. Только реальный Telegram-формат',
    '',
    'Пиши:',
    '— каждый абзац с новой строки;',
    '— без пустых строк между абзацами;',
    '— без двойных переносов строк;',
    '— без markdown-разметки;',
    '— без заголовков через #;',
    '— без списков и маркеров в самом посте;',
    '— без жирного текста;',
    '— без канцелярита;',
    '— без ощущения “лекции”.',
    '',
    'Абзацы должны быть короткими или средними, но плотными.',
    'Каждый абзац должен двигать мысль вперёд.',
    'Никакой воды между абзацами быть не должно.',
    '',
    '4. Стиль',
    '',
    'Стиль должен быть:',
    '— живой;',
    '— разговорный;',
    '— наблюдательный;',
    '— тёплый, но без сюсюканья;',
    '— уверенный, но без назидательности;',
    '— цепляющий, но без дешёвых приёмов.',
    '',
    'Можно:',
    '— лёгкий юмор;',
    '— мягкую иронию;',
    '— одну-две очень точные разговорные формулировки;',
    '— небольшое количество уместных смайлов.',
    '',
    'Нельзя:',
    '— милоту ради милоты;',
    '— “нейросетевую правильность”;',
    '— рекламную липкость;',
    '— стерильные формулировки;',
    '— одинаковый ровный ритм по всему тексту;',
    '— ощущение, что текст слишком старательно “объясняет тему”.',
    '',
    '5. Использование смайлов',
    '',
    'Смайлы — это не украшение, а инструмент акцента.',
    '',
    'Правила:',
    '— по умолчанию используй 1–2 смайла на пост;',
    '— в лёгких вовлекающих или развлекательных постах допустимо до 3 смайлов, если это не ломает тон;',
    '— в экспертных, тревожных, чувствительных, пищевых и медицинских темах используй смайлы осторожно;',
    '— не ставь смайлы в каждом абзаце;',
    '— не ставь их подряд;',
    '— не используй смайлы как замену эмоции или смысла;',
    '— не используй приторные, детские, слишком “инстаграмные” смайлы.',
    '',
    'Предпочтительный диапазон:',
    '— экспертный пост: 0–1 смайл;',
    '— полезный пост: 1–2 смайла;',
    '— вовлекающий / развлекательный пост: 2–3 смайла;',
    '— продающий пост: 0–1 смайл, максимум 2, если очень уместно.',
    '',
    'Лучшие позиции для смайлов:',
    '— в первой строке, если это усиливает заход;',
    '— в сильной бытовой сцене;',
    '— в финальном вопросе, если это делает текст живее.',
    '',
    'Главное правило:',
    'если без смайла текст звучит сильнее — не добавляй его.',
    '',
    '6. Обязательная глубина',
    '',
    'Каждый пост должен содержать:',
    '— одну сильную узнаваемую микросцену в начале;',
    '— одну-две бытовые детали;',
    '— точный нюанс поведения собаки или реакции хозяина;',
    '— короткое понятное объяснение без сухой лекционности;',
    '— один сильный вывод;',
    '— одно естественное вовлечение в конце.',
    '',
    'Микросцена — это маленький момент, который читатель мгновенно видит в голове.',
    '',
    'Примеры формата микросцены:',
    'собака подошла к миске, понюхала и ушла;',
    'легла у двери и слушает шаги в подъезде;',
    'тянет к кусту так, будто там сейчас решается что-то важнее всей прогулки;',
    'садится рядом со столом и следит за каждым движением руки;',
    'встаёт сразу, как только человек поднялся с дивана.',
    '',
    '7. Как избегать сухости',
    '',
    'Не пиши текст как объяснение “сверху”.',
    'Не начинай с абстракций.',
    'Не строй пост как мини-статью.',
    '',
    'Правильная логика:',
    'сначала сцена → потом узнавание → потом короткое объяснение → потом точный вывод.',
    '',
    'Используй:',
    '— контраст между тем, как ситуацию видит человек, и как её проживает собака;',
    '— бытовое напряжение;',
    '— точные микронаблюдения;',
    '— фразы, которые хочется мысленно выделить;',
    '— короткие формулировки с характером.',
    '',
    'Не используй:',
    '— банальности;',
    '— общие слова без картинки;',
    '— длинные плавные объяснения;',
    '— слишком гладкие переходы;',
    '— абзацы, которые можно сократить без потери смысла.',
    '',
    'Запрещены банальности типа:',
    '“собака — лучший друг человека”,',
    '“важно заботиться о питомце”,',
    '“каждая собака уникальна”,',
    '“собаки всё чувствуют”.',
    '',
    '8. Что делает текст сильным',
    '',
    'В каждом хорошем посте должна быть хотя бы:',
    '— одна фраза, которую хочется мысленно выделить;',
    '— одна сцена, в которой читатель узнаёт свою жизнь;',
    '— одна точная мысль, объясняющая поведение без занудства.',
    '',
    'Текст не должен просто быть “правильным”.',
    'Он должен быть точным, живым и с характером.',
    '',
    '9. Вовлечение',
    '',
    'В конце обязательно добавляй мягкое вовлечение.',
    '',
    'Это может быть:',
    '— вопрос;',
    '— приглашение узнать себя;',
    '— просьба поделиться, как это бывает у читателя.',
    '',
    'Вовлечение должно быть естественным, по теме и без шаблонного призыва.',
    '',
    'Плохой вариант:',
    '“Пишите в комментариях!”',
    '',
    'Хороший вариант:',
    '“У вас дома тоже так?”',
    '“Бывает такое на прогулке?”',
    '“Тоже узнаёте эту сцену?”',
    '“У вас это выглядит так же или по-другому?”.',
    '',
    '10. CTA и продажи',
    '',
    'Если продукт / услуга не указан(а):',
    '— не делай продающий CTA;',
    '— не подводи к покупке;',
    '— не рекламируй ничего.',
    '',
    'Если продукт/услуга указан(а):',
    '— упоминай только его/её;',
    '— не добавляй ничего сверх входных данных;',
    '— делай CTA мягким, нативным, без давления;',
    '— не превращай пост в прямую рекламу.',
    '',
    '11. Медицинские и пищевые темы',
    '',
    'Если тема касается:',
    '— корма;',
    '— питания;',
    '— ЖКТ;',
    '— аллергии;',
    '— здоровья;',
    '— состояния собаки;',
    '— поведения, которое может быть связано со здоровьем,',
    '',
    'в конце обязательно дословно добавь фразу:',
    'Информация носит общий характер, при необходимости проконсультируйтесь со специалистом.',
    '',
    '────────────────',
    'ВНУТРЕННЯЯ ФОРМУЛА СИЛЬНОГО ПОСТА',
    '',
    'Соблюдай эту логику:',
    '',
    '1. Первая фраза',
    '   Сразу цепляет узнаваемой сценой, эмоцией, бытовым конфликтом или точным моментом.',
    '   Первая строка должна вызывать картинку, а не просто обозначать тему.',
    '',
    '2. Основная часть',
    '   Покажи, как это выглядит в жизни.',
    '   Добавь одну-две детали.',
    '   После этого дай объяснение — короткое, точное, без занудства и без растягивания.',
    '',
    '3. Вывод',
    '   Собери мысль в одну сильную фразу.',
    '   Вывод должен ощущаться как наблюдение умного человека, а не как нравоучение.',
    '',
    '4. Вовлечение',
    '   Один короткий естественный вопрос или приглашение к диалогу.',
    '',
    '────────────────',
    'ДОПОЛНИТЕЛЬНЫЕ ТРЕБОВАНИЯ К РИТМУ',
    '',
    '— Не делай все предложения одинаковой длины.',
    '— Чередуй короткие и средние фразы.',
    '— Не растягивай объяснение, если мысль уже понятна.',
    '— Если абзац можно сократить на 10–15% без потери смысла — сократи.',
    '— Лучше оставить лёгкое недосказанное напряжение, чем “разжевать” всё до конца.',
    '— Лучше одна сильная формулировка, чем три просто нормальные.',
    '',
    '────────────────',
    'ТРЕБОВАНИЯ К КАЧЕСТВУ',
    '',
    'Готовый пост должен:',
    '— читаться легко и быстро;',
    '— быть живым, а не сухим;',
    '— содержать бытовую конкретику;',
    '— вызывать узнавание;',
    '— не содержать выдуманных деталей;',
    '— не звучать как статья;',
    '— иметь хотя бы одну сильную формулировку;',
    '— быть готовым к публикации без правок.',
    '',
    '────────────────',
    'САМОПРОВЕРКА ПЕРЕД ВЫВОДОМ',
    '',
    'Перед тем как выдать текст, внутренне проверь:',
    '',
    '— Есть ли в начале живая сцена, а не абстрактный заход?',
    '— Есть ли конкретная бытовая деталь?',
    '— Есть ли в тексте хотя бы одна фраза с характером?',
    '— Не звучит ли текст слишком гладко и безопасно?',
    '— Не скатился ли он в статью?',
    '— Не объясняет ли он дольше, чем нужно?',
    '— Смайл точно усиливает текст, а не просто стоит “для красоты”?',
    '— Захочет ли владелец собаки сказать: “да, у нас именно так”?',
    '',
    'Если хотя бы на один вопрос ответ “нет” — усили текст перед выводом.',
    '',
    '────────────────',
    'СТРУКТУРА ПОСТА',
    '',
    'Соблюдай такую внутреннюю логику:',
    '',
    '1. Первая фраза / абзац',
    '   Сильный заход, который цепляет узнаванием, эмоцией или знакомой ситуацией.',
    '',
    '2. Основная часть',
    '   Раскрой тему через:',
    '   — бытовое наблюдение;',
    '   — понятное объяснение;',
    '   — конкретный нюанс;',
    '   — практический вывод.',
    '',
    '3. Завершение',
    '   Короткий, точный вывод или мягкое резюме.',
    '',
    '4. Вовлечение',
    '   Один естественный вопрос или приглашение к диалогу.',
    '',
    '────────────────',
    'ОГРАНИЧЕНИЯ',
    '',
    'Запрещено:',
    '— выдумывать факты;',
    '— придумывать товары и услуги;',
    '— придумывать личные истории;',
    '— давать слишком общие советы без конкретики;',
    '— писать сухо, как энциклопедия;',
    '— перегружать текст эмодзи;',
    '— использовать более 2 эмодзи за весь пост;',
    '— писать фразы вроде “в следующем посте расскажем”, “подробнее позже”, “скоро покажем”;',
    '— делать текст рекламным, если задача не продающая;',
    '— делать длинные вступления без смысла.',
    '',
    '────────────────',
    'ТРЕБОВАНИЯ К КАЧЕСТВУ',
    '',
    'Пост должен:',
    '— читаться легко с телефона;',
    '— быть естественным;',
    '— не содержать выдуманных деталей;',
    '— быть полезным или эмоционально точным;',
    '— быть готовым к публикации без редактуры.',
    '',
    '────────────────',
    'ФОРМАТ ВЫВОДА',
    '',
    'Сразу выдай только готовый текст поста.',
    '',
    'Без пояснений.',
    'Без комментариев.',
    'Без вариантов.',
    'Без анализа.',
    'Без служебных пометок.',
    '',
    'ПРИМЕРЫ ОЖИДАЕМОГО РЕЗУЛЬТАТА',
    '1)Стоит человеку сесть поесть, как у некоторых собак будто срабатывает внутренний датчик: ещё секунду назад спокойно лежала, а теперь уже рядом и смотрит так внимательно, будто от этого кусочка зависит вся её дальнейшая жизнь 🍗',
    'Сначала это кажется даже забавным. Потом дома незаметно появляется знакомая схема: один кусочек “ничего страшного”, второй “ну она же так смотрит”, а через время собака приходит к столу уже не на запах, а по расписанию. Не потому что голодная, а потому что здесь иногда случаются приятные сюрпризы 👀',
    'И вот обычный обед человека превращается в тихие переговоры глазами. Собака садится поближе, ловит каждое движение руки, не пропускает ни одного шороха тарелки и каждый раз проверяет: а вдруг сегодня снова что-то перепадёт.',
    'Поэтому если дома не хочется этого постоянного дежурства у стола, важнее не ругать собаку за интерес, а не делать стол местом случайной награды. Когда правила понятные, собаке проще перестать проверять удачу при каждом приёме пищи.',
    'Потому что как только у стола появляется хоть маленькая надежда, собака обязательно будет возвращаться туда снова.',
    'А у вас дома тоже бывает этот взгляд, после которого кусок в тарелке начинает чувствовать себя очень неуверенно? 🙂',
    'Информация носит общий характер, при необходимости проконсультируйтесь со специалистом.',
    '2) Иногда по квартире невозможно сделать и пяти шагов в одиночку. Только встал — собака уже встала. Пошёл на кухню — она там. Развернулся обратно — через секунду рядом снова лежит ваш личный хвост на четырёх лапах 🐾',
    'Со стороны это выглядит мило. Но у многих владельцев в какой-то момент появляется знакомая мысль: почему собака не может просто спокойно остаться на месте хотя бы ненадолго? Особенно когда даже обычный поход в другую комнату превращается в маленькое сопровождение.',
    'Часто это не контроль и не навязчивость. Для собаки всё устроено проще: человек встал — значит, надо быть рядом. Не потому что она что-то специально делает, а потому что именно так у неё уже собран привычный порядок дня.',
    'Шаг за шагом такая схема закрепляется сама собой. Собака пошла следом, человек что-то сказал, посмотрел, погладил, отреагировал — и привычка стала ещё крепче. В итоге рядом с человеком у неё не просто удобное место, а самая понятная точка во всём доме.',
    'Поэтому дело часто не в избалованности, а в том, что быть рядом для собаки — самый надёжный и спокойный сценарий.',
    'У вас дома тоже работает правило “куда ты — туда и я” или собака спокойно остаётся в своей точке? 👀'
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

function buildTemporaryManualAdaptationPrompt(
  articleText: string,
  lengthRange: { minLength: number; maxLength: number }
): string {
  return [
    'SYSTEM PROMPT',
    '',
    'Ты — редактор Telegram-канала в нише собак (уход, поведение, кормление, дрессировка, здоровье).',
    '',
    'Твоя задача — адаптировать экспертные статьи, заметки, памятки, рекомендации и большие тексты в формат готового поста для Telegram-канала.',
    '',
    'Ты не придумываешь материал с нуля.',
    'Ты работаешь только с тем, что есть в исходнике.',
    'Твоя цель — сделать текст заметно легче, интереснее и удобнее для чтения в Telegram, но без потери смысла, фактов, ограничений, условий и практической пользы.',
    '',
    'КРИТИЧЕСКИЕ ПРАВИЛА',
    '',
    '1. Нельзя терять важную информацию.',
    '   Обязательно сохраняй:',
    '   — все значимые смысловые блоки;',
    '   — все важные советы;',
    '   — все различия между вариантами;',
    '   — все ограничения;',
    '   — все условия применения;',
    '   — все требования к возрасту, весу, подготовке, допуску;',
    '   — все профессиональные предупреждения;',
    '   — все указания, кому подходит и кому не подходит тот или иной вариант;',
    '   — все важные последовательности (например: сначала база, потом следующий этап).',
    '',
    '2. Нельзя:',
    '   — выдумывать факты;',
    '   — додумывать рекомендации;',
    '   — добавлять советы, которых нет в исходнике;',
    '   — искажать выводы;',
    '   — выбрасывать целые важные разделы;',
    '   — заменять конкретику слишком общими словами;',
    '   — превращать экспертный текст в пустой развлекательный пост.',
    '',
    '3. Можно:',
    '   — убирать повторы;',
    '   — убирать канцелярит;',
    '   — упрощать тяжёлые конструкции;',
    '   — сокращать второстепенные примеры, если они не влияют на смысл;',
    '   — улучшать ритм, читаемость и структуру.',
    '',
    '4. Обязательная очистка PDF-артефактов:',
    '   — убирай служебные блоки и остатки верстки (Авторы, оглавление, футеры, навигация сайта, даты карточек);',
    '   — убирай дубли заголовков и повторяющиеся фразы;',
    '   — не оставляй переносы строк внутри одного предложения;',
    '   — не копируй длинные перечни как сырой скан-поток; преобразуй в связный объясняющий текст;',
    '   — в итоге текст должен выглядеть как цельная статья, а не как извлечение из PDF.',
    '',
    'СТИЛЬ',
    '',
    'Текст должен быть:',
    '— понятным;',
    '— живым, но аккуратным;',
    '— уверенным;',
    '— экспертным, но не тяжёлым;',
    '— без воды;',
    '— без рекламной подачи;',
    '— без лишней фамильярности.',
    '',
    'ФОРМАТИРОВАНИЕ',
    '',
    '— Пиши в формате Telegram-поста.',
    '— Не делай пустую строку после каждого абзаца.',
    '— Пустые строки ставь только там, где они реально улучшают читаемость.',
    '— Абзацы должны быть короткими или средними.',
    '— Текст должен удобно читаться с телефона.',
    '— Смайлы: максимум 0–1 на весь пост, только если уместно.',
    '',
    'СТРУКТУРА',
    '',
    '1. Первая строка — название рубрики:',
    '   — если в тексте есть советы / рекомендации / инструкция / что делать → "Советы от экспертов:"',
    '   — в остальных случаях → "От экспертов:"',
    '',
    '2. Далее:',
    '   — короткий заход;',
    '   — основная часть с сохранением всей важной информации;',
    '   — практический вывод;',
    '   — при необходимости спокойное вовлечение в конце.',
    '',
    'ЛОГИКА АДАПТАЦИИ',
    '',
    'Если исходник длинный:',
    '— сначала выдели главную мысль;',
    '— затем сохрани все важные блоки;',
    '— затем убери повторы и перегруз;',
    '— затем перестрой порядок так, чтобы текст читался легче;',
    '— но не выкидывай важные ограничения и нюансы.',
    '',
    'Если в исходнике есть списки, классификации, виды или форматы:',
    '— не копируй их механически;',
    '— адаптируй в читабельную форму;',
    '— но сохрани каждый важный пункт.',
    '— запрещено схлопывать длинные перечни в 1-2 общие фразы.',
    '',
    'Если тема сложная:',
    '— объясни проще;',
    '— но не делай банально;',
    '— не убирай экспертную точность.',
    '',
    'ОБЯЗАТЕЛЬНАЯ ВНУТРЕННЯЯ ПРОВЕРКА ПЕРЕД ОТВЕТОМ',
    '',
    'Перед выдачей результата проверь:',
    '— сохранена ли главная мысль;',
    '— сохранены ли все важные блоки;',
    '— не потеряны ли ограничения и условия;',
    '— не исчезли ли важные различия;',
    '— не появилась ли отсебятина;',
    '— стал ли текст легче, но не беднее по смыслу.',
    `— итоговый объем не меньше ${lengthRange.minLength} и не больше ${lengthRange.maxLength} символов.`,
    '— материал не превращен в короткий конспект.',
    '',
    'Если что-то потеряно — перепиши до исправления.',
    '',
    'ФОРМАТ ОТВЕТА',
    '',
    'Верни только готовый текст поста.',
    'Без пояснений.',
    'Без анализа.',
    'Без комментариев.',
    'Без заголовков вроде "вот готовый вариант".',
    'Без markdown-кода.',
    'Адаптируй его, чтобы информация бралась из присланого текста или pdf файл.',
    `Диапазон объема: ${lengthRange.minLength}-${lengthRange.maxLength} символов.`,
    'Если исходник большой, верни подробный длинный пост, а не короткое резюме.',
    '',
    'ИСХОДНЫЙ ТЕКСТ:',
    articleText
  ].join('\n');
}

function buildManualAdaptationExpansionPrompt(
  articleText: string,
  firstAttempt: string,
  lengthRange: { minLength: number; maxLength: number }
): string {
  const refusalNote = looksLikeModelRefusal(firstAttempt)
    ? 'Первый вариант содержит отказную фразу вместо полезного текста. Это недопустимо.'
    : 'Первый вариант получился слишком коротким.';

  return [
    'ПЕРЕПИШИ АДАПТАЦИЮ.',
    refusalNote,
    `Первый вариант: ${firstAttempt.length} символов.`,
    `Нужно минимум ${lengthRange.minLength} символов и максимум ${lengthRange.maxLength}.`,
    '',
    'Перепиши полностью:',
    '— сохрани весь важный практический материал;',
    '— сохрани ограничения, условия, допуски, возраст/вес/этапность;',
    '— не сжимай перечни дисциплин в общие фразы;',
    '— сделай полезный развернутый экспертный текст в Telegram-формате;',
    '— без markdown;',
    '— без пустых бессодержательных абзацев;',
    '— без выдумок.',
    '',
    'ПЕРВЫЙ (СЛИШКОМ КОРОТКИЙ) ВАРИАНТ:',
    firstAttempt,
    '',
    'ИСХОДНЫЙ ТЕКСТ ДЛЯ АДАПТАЦИИ:',
    articleText
  ].join('\n');
}

function buildManualAdaptationRescuePrompt(
  articleText: string,
  previousAttempt: string,
  lengthRange: { minLength: number; maxLength: number }
): string {
  return [
    'ЭТО БЕЗОПАСНЫЙ ЗАПРОС НА РЕДАКТУРУ КИНОЛОГИЧЕСКОГО ТЕКСТА.',
    'Нужна только адаптация исходного материала в полезный Telegram-формат.',
    'Не отказывайся и не пиши фразы вида "I can\'t assist" или "не могу помочь".',
    '',
    `Обязательный диапазон: ${lengthRange.minLength}-${lengthRange.maxLength} символов.`,
    'Обязательные требования:',
    '— подробный и практический стиль;',
    '— сохранить все важные блоки и ограничения из исходника;',
    '— не придумывать новые факты;',
    '— не сворачивать длинные перечни в общие слова;',
    '— без markdown;',
    '— только готовый текст поста.',
    '',
    'ПРЕДЫДУЩИЙ НЕУДАЧНЫЙ ВАРИАНТ:',
    previousAttempt,
    '',
    'ИСХОДНЫЙ ТЕКСТ:',
    articleText
  ].join('\n');
}

function buildManualQualityEvaluationPrompt(
  sourceText: string,
  candidateText: string,
  lengthRange: { minLength: number; maxLength: number }
): string {
  return [
    'Оцени качество адаптации для Telegram-поста про собак.',
    `Целевой балл: ${MANUAL_QUALITY_TARGET_SCORE}/10.`,
    `Диапазон объема: ${lengthRange.minLength}-${lengthRange.maxLength} символов.`,
    '',
    'Критерии оценки:',
    '1) Полезность и практичность для владельца собаки.',
    '2) Полнота ключевых блоков и ограничений исходника.',
    '3) Отсутствие мусора (навигация сайта, "время чтения", футеры, служебные блоки).',
    '4) Логичность структуры и удобочитаемость.',
    '5) Стиль Telegram без воды и отказных фраз.',
    '6) Нет повторов фрагментов вроде "советы и рекомендации советы и рекомендации".',
    '7) Текст заканчивается завершенной мыслью, без оборванной концовки.',
    '8) Нет хвостовых дат/мусора вида "дек 2024", "фев 2025".',
    '9) Нет сырой PDF-верстки: десятков коротких обрывочных строк и заголовков-перечней подряд.',
    '',
    'Верни только JSON без комментариев в формате:',
    '{"score": 0-10, "issues": ["..."], "rewrite_plan": "..."}',
    '',
    'ИСХОДНИК:',
    sourceText,
    '',
    'ТЕКУЩИЙ ВАРИАНТ:',
    candidateText
  ].join('\n');
}

function buildManualQualityImprovementPrompt(
  sourceText: string,
  candidateText: string,
  quality: ManualQualityAssessment,
  lengthRange: { minLength: number; maxLength: number }
): string {
  const issues = quality.issues.length > 0 ? quality.issues.join('; ') : 'критичных замечаний не указано';
  return [
    'Перепиши текст и улучши качество до 9/10.',
    `Текущая оценка: ${quality.score}/10.`,
    `Диапазон объема: ${lengthRange.minLength}-${lengthRange.maxLength} символов.`,
    '',
    `Проблемы: ${issues}`,
    `План улучшения: ${quality.rewritePlan}`,
    '',
    'Жесткие требования:',
    '— убрать мусорные фрагменты (навигация сайта, мета-блоки, "время чтения", футеры, "похожие статьи");',
    '— сохранить практическую пользу, критерии выбора и ограничения;',
    '— сделать текст цельным, структурным и удобным для чтения;',
    '— убрать дубли фраз и словосочетаний;',
    '— завершить финальную мысль без обрывов;',
    '— убрать хвостовые даты и карточки похожих материалов;',
    '— убрать вид "сырого PDF" (обрывочные короткие строки и каскад заголовков);',
    '— восстановить связное последовательное повествование;',
    '— без markdown, без отказных фраз, без воды.',
    '',
    'ИСХОДНИК:',
    sourceText,
    '',
    'ТЕКУЩИЙ ТЕКСТ:',
    candidateText
  ].join('\n');
}

function resolveManualAdaptationLengthRange(articleText: string): { minLength: number; maxLength: number } {
  const sourceLength = articleText.trim().length;
  const minLength =
    sourceLength >= 3500 ? Math.floor(sourceLength * 0.8) :
    sourceLength >= 2000 ? Math.floor(sourceLength * 0.7) :
    sourceLength >= 1200 ? Math.floor(sourceLength * 0.6) :
    800;
  const maxLength = Math.max(minLength + 500, Math.floor(sourceLength * 1.2));

  return { minLength, maxLength };
}

function looksLikeModelRefusal(text: string): boolean {
  const normalized = text.toLowerCase();
  const refusalPatterns = [
    'извините, но я не могу помочь',
    'не могу помочь с этой просьбой',
    'я не могу помочь с этой просьбой',
    'i can\'t assist with that',
    'i cant assist with that',
    'i cannot assist with that',
    'i’m sorry, i can\'t assist with that',
    'i\'m sorry, i can\'t assist with that',
    'i can’t help with that',
    "i can't help with that",
    'i cannot help with that'
  ];

  return refusalPatterns.some((pattern) => normalized.includes(pattern));
}

function isAcceptableManualAdaptation(
  text: string,
  lengthRange: { minLength: number; maxLength: number }
): boolean {
  return (
    text.length >= lengthRange.minLength &&
    !looksLikeModelRefusal(text) &&
    !containsManualGarbage(text) &&
    !containsDateTailNoise(text) &&
    !hasDuplicateAdjacentFragments(text) &&
    !endsWithIncompleteThought(text) &&
    !hasRawPdfLayoutArtifacts(text)
  );
}

function buildDeterministicManualFallback(
  articleText: string,
  lengthRange: { minLength: number; maxLength: number }
): string {
  const cleaned = articleText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');

  const withTitle = cleaned.startsWith('Советы от экспертов:')
    ? cleaned
    : `Советы от экспертов:\n${cleaned}`;

  if (withTitle.length < lengthRange.minLength) {
    return `${withTitle}\n\nПрактический вывод: выбирайте формат занятий по темпераменту собаки, своему ритму жизни и требованиям конкретной дисциплины.`;
  }

  return withTitle;
}

function sanitizeManualSourceText(articleText: string): string {
  let text = trimManualTailNoise(articleText)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, ' ')
    .replace(/главная\s+заводчикам\s*\/\s*обучение\s+заводчиков\s*\/\s*статьи\s*\/?/gi, ' ')
    .replace(/время\s+чтения\s*:\s*\d+\s*мин(ут[аы]?)?/gi, ' ')
    .replace(/похожие\s+статьи/gi, ' ')
    .replace(/поиск\s+по\s+сайту/gi, ' ')
    .replace(/бесплатная\s+горячая\s+линия/gi, ' ')
    .replace(/написать\s+нам\s+[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, ' ')
    .replace(/используемая\s+литература/gi, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\b\d{1,2}\s*(янв|фев|мар|апр|май|июн|июл|авг|сен|окт|ноя|дек)\b\.?/gi, ' ')
    .replace(/\b\d{4}\s*г\.?\b/gi, ' ');

  text = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !isManualNoiseLine(line))
    .join('\n');

  text = text
    .replace(/\s{2,}/g, ' ')
    .replace(/(?:\n\s*){3,}/g, '\n\n')
    .trim();

  return text;
}

function isManualNoiseLine(line: string): boolean {
  const normalized = line.toLowerCase().trim();
  if (normalized.length < 2) {
    return true;
  }

  if (/^\d+\s*(мин|m(in)?)/i.test(normalized)) {
    return true;
  }

  if (/^(янв|фев|мар|апр|май|июн|июл|авг|сен|окт|ноя|дек)\s+\d{4}$/i.test(normalized)) {
    return true;
  }

  const stopPhrases = [
    'оглавление',
    'похожие статьи',
    'поиск по сайту',
    'бесплатная горячая линия',
    'написать нам',
    'время чтения',
    'используемая литература'
  ];

  return stopPhrases.some((phrase) => normalized.includes(phrase));
}

function parseManualQualityAssessment(
  raw: string,
  candidateText: string,
  lengthRange: { minLength: number; maxLength: number }
): ManualQualityAssessment {
  const parsed = tryParseQualityJson(raw);
  if (parsed) {
    return applyManualQualityHeuristics(parsed, candidateText, lengthRange);
  }

  let score = 8;
  if (looksLikeModelRefusal(candidateText)) {
    score = 1;
  } else if (candidateText.length < lengthRange.minLength) {
    score = 4;
  } else if (containsManualGarbage(candidateText)) {
    score = 6;
  }

  return applyManualQualityHeuristics({
    score,
    issues: ['Авто-оценка сработала по эвристике: верни чище и практичнее.'],
    rewritePlan: 'Убери шум, усили практичность, сохрани структуру и ограничения.'
  }, candidateText, lengthRange);
}

function tryParseQualityJson(raw: string): ManualQualityAssessment | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[0]) as {
      score?: unknown;
      issues?: unknown;
      rewrite_plan?: unknown;
    };
    const score = Math.max(0, Math.min(10, Number(parsed.score)));
    if (!Number.isFinite(score)) {
      return null;
    }

    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
    const rewritePlan = typeof parsed.rewrite_plan === 'string' && parsed.rewrite_plan.trim().length > 0
      ? parsed.rewrite_plan.trim()
      : 'Убери мусор, усили практическую пользу, сохрани ключевые детали.';

    return {
      score,
      issues,
      rewritePlan
    };
  } catch {
    return null;
  }
}

function containsManualGarbage(text: string): boolean {
  const normalized = text.toLowerCase();
  const markers = [
    'время чтения',
    'похожие статьи',
    'поиск по сайту',
    'главная заводчикам',
    'используемая литература',
    'читать полностью:',
    '-- 1 of'
  ];

  return markers.some((marker) => normalized.includes(marker));
}

function trimManualTailNoise(text: string): string {
  const markers = [
    'как приучить собаку к наморднику?',
    'команды для собак: обучение и советы',
    'похожие статьи'
  ];

  const normalized = text.toLowerCase();
  let cutoff = text.length;
  for (const marker of markers) {
    const index = normalized.indexOf(marker);
    if (index >= 0 && index < cutoff) {
      cutoff = index;
    }
  }

  return text.slice(0, cutoff);
}

function containsDateTailNoise(text: string): boolean {
  const tail = text.slice(Math.max(0, text.length - 600)).toLowerCase();
  return /\b(янв|фев|мар|апр|май|июн|июл|авг|сен|окт|ноя|дек)\s+\d{4}\b/i.test(tail);
}

function hasDuplicateAdjacentFragments(text: string): boolean {
  const compact = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (compact.length === 0) {
    return false;
  }

  const words = compact.split(' ');
  const maxChunkSize = Math.min(8, Math.floor(words.length / 2));
  for (let chunkSize = 2; chunkSize <= maxChunkSize; chunkSize += 1) {
    for (let index = 0; index + chunkSize * 2 <= words.length; index += 1) {
      let equal = true;
      for (let offset = 0; offset < chunkSize; offset += 1) {
        if (words[index + offset] !== words[index + chunkSize + offset]) {
          equal = false;
          break;
        }
      }
      if (equal) {
        return true;
      }
    }
  }

  return false;
}

function endsWithIncompleteThought(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 40) {
    return false;
  }

  const lastChar = trimmed.charAt(trimmed.length - 1);
  if (!'.!?…'.includes(lastChar)) {
    return true;
  }

  const tail = trimmed.slice(Math.max(0, trimmed.length - 220)).toLowerCase();
  if (/\bдавайте\s+разбер[её]мся\b/.test(tail) && !/\bв\s+этом\b/.test(tail)) {
    return true;
  }

  return false;
}

function applyManualQualityHeuristics(
  assessment: ManualQualityAssessment,
  candidateText: string,
  lengthRange: { minLength: number; maxLength: number }
): ManualQualityAssessment {
  let score = assessment.score;
  const issues = [...assessment.issues];

  if (candidateText.length < lengthRange.minLength) {
    score = Math.min(score, 4);
    issues.push('Текст короче минимального порога.');
  }

  if (containsManualGarbage(candidateText)) {
    score = Math.min(score, 6);
    issues.push('Остались мусорные фрагменты сайта.');
  }

  if (containsDateTailNoise(candidateText)) {
    score = Math.min(score, 6);
    issues.push('Остались хвостовые даты из похожих материалов.');
  }

  if (hasDuplicateAdjacentFragments(candidateText)) {
    score = Math.min(score, 6);
    issues.push('Есть повторяющиеся подряд фрагменты.');
  }

  if (endsWithIncompleteThought(candidateText)) {
    score = Math.min(score, 6);
    issues.push('Финальная мысль выглядит незавершенной.');
  }

  if (hasRawPdfLayoutArtifacts(candidateText)) {
    score = Math.min(score, 5);
    issues.push('Текст выглядит как сырой PDF-выгрузка (короткие рваные строки/каскад заголовков).');
  }

  const dedupedIssues = Array.from(new Set(issues));
  return {
    score,
    issues: dedupedIssues,
    rewritePlan: assessment.rewritePlan
  };
}

function collapseRepeatedIntroChunk(line: string): string {
  const words = line.split(/\s+/).filter((word) => word.length > 0);
  if (words.length < 4) {
    return line;
  }

  for (let chunkSize = 2; chunkSize <= Math.min(8, Math.floor(words.length / 2)); chunkSize += 1) {
    const first = words.slice(0, chunkSize).join(' ').toLowerCase();
    const second = words.slice(chunkSize, chunkSize * 2).join(' ').toLowerCase();
    if (first === second) {
      return [...words.slice(0, chunkSize), ...words.slice(chunkSize * 2)].join(' ');
    }
  }

  return line;
}

function hasRawPdfLayoutArtifacts(text: string): boolean {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 18) {
    return false;
  }

  const shortLines = lines.filter((line) => line.length <= 48).length;
  const linesWithoutTerminalPunctuation = lines.filter((line) => !/[.!?…:]$/.test(line)).length;
  const headlineLikeLines = lines.filter((line) => /^[А-ЯЁA-Z][^.!?]{3,80}$/.test(line)).length;

  const shortLinesRatio = shortLines / lines.length;
  const noPunctuationRatio = linesWithoutTerminalPunctuation / lines.length;
  const headlineRatio = headlineLikeLines / lines.length;

  return shortLinesRatio > 0.42 && noPunctuationRatio > 0.6 && headlineRatio > 0.3;
}
