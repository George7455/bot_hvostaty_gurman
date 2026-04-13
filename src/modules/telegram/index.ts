import { Context, Telegraf } from 'telegraf';

import type { AppEnv } from '../../config/index.js';
import type { ModerationModule } from '../moderation/index.js';
import type { ModerationDeliveryPort } from '../moderation/index.js';
import type { PlannerModule } from '../planner/index.js';
import type { PublishingTransport } from '../publishing/index.js';
import type { SessionsModule } from '../sessions/index.js';

const UPLOAD_COMMAND = 'upload';
const CANCEL_TEXT = 'cancel';
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const TELEGRAM_MAX_MESSAGE_CHARS = 4096;
const TELEGRAM_DIRECT_PUBLISH_LIMIT = 3500;
const TELEGRAM_FILE_FETCH_TIMEOUT_MS = 20_000;
const TELEGRAM_FILE_FETCH_RETRIES = 3;

export interface TelegramModule extends ModerationDeliveryPort, PublishingTransport {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class TelegramService implements TelegramModule {
  private readonly bot: Telegraf;
  private readonly botToken: string;
  private readonly moderatorChatIds: string[];
  private readonly channelId: string;
  private readonly telegraphAccessToken: string | null;
  private readonly telegraphShortName: string;
  private moderationModule: ModerationModule | null = null;
  private plannerModule: PlannerModule | null = null;
  private pdfParseClassPromise: Promise<PdfParseConstructor> | null = null;

  public constructor(
    env: AppEnv,
    private readonly sessionsModule: SessionsModule
  ) {
    this.bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);
    this.botToken = env.TELEGRAM_BOT_TOKEN;
    this.moderatorChatIds = parseModeratorChats(env.TELEGRAM_MODERATOR_CHAT_IDS);
    this.channelId = env.TELEGRAM_CHANNEL_ID;
    this.telegraphAccessToken = env.TELEGRAPH_ACCESS_TOKEN ?? null;
    this.telegraphShortName = env.TELEGRAPH_SHORT_NAME ?? 'hvostaty_gurman';

    this.registerHandlers();
  }

  public bindModerationModule(moderationModule: ModerationModule): void {
    this.moderationModule = moderationModule;
  }

  public bindPlannerModule(plannerModule: PlannerModule): void {
    this.plannerModule = plannerModule;
  }

  public async start(): Promise<void> {
    await this.bot.launch();
  }

  public async stop(): Promise<void> {
    await this.bot.stop();
  }

  public async sendDraftToModerators(draftId: string, text: string): Promise<void> {
    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: 'Approve', callback_data: `approve:${draftId}` }],
        [{ text: 'Rewrite', callback_data: `rewrite:${draftId}` }],
        [{ text: 'Rewrite with Notes', callback_data: `rewrite_notes:${draftId}` }]
      ]
    };

    const readyPost = await this.buildReadyChannelPost(text);
    const message = `Draft ID: ${draftId}\n\n${readyPost}`.slice(0, TELEGRAM_MAX_MESSAGE_CHARS);
    for (const chatId of this.moderatorChatIds) {
      await this.bot.telegram.sendMessage(chatId, message, { reply_markup: inlineKeyboard });
    }
  }

  public async publishToChannel(text: string): Promise<{ telegramChatId: string; telegramMessageId: string }> {
    const payload = await this.buildReadyChannelPost(text);

    const result = await this.bot.telegram.sendMessage(this.channelId, payload);
    return {
      telegramChatId: String(result.chat.id),
      telegramMessageId: String(result.message_id)
    };
  }

  public async deleteFromChannel(chatId: string, messageId: string): Promise<void> {
    await this.bot.telegram.deleteMessage(chatId, Number(messageId));
  }

  private registerHandlers(): void {
    this.bot.command(UPLOAD_COMMAND, async (ctx) => {
      try {
        const userId = String(ctx.from?.id ?? '');
        if (!userId) {
          await ctx.reply('Failed to identify user.');
          return;
        }

        await this.sessionsModule.setWaitingArticle(userId);
        await ctx.reply('Send the article text in one message or upload a PDF file. Send "cancel" to abort.');
      } catch (error: unknown) {
        await safeReply(ctx, `Failed to handle /upload: ${toErrorMessage(error)}`);
      }
    });

    this.bot.command('tick', async (ctx) => {
      try {
        if (!this.plannerModule) {
          await ctx.reply('Планировщик не инициализирован.');
          return;
        }

        await ctx.reply('Запускаю ручной тик...');
        await this.plannerModule.runScheduledPlanningTick();
        await ctx.reply('Ручной тик выполнен.');
      } catch (error: unknown) {
        await safeReply(ctx, `Ручной тик завершился с ошибкой: ${toErrorMessage(error)}`);
      }
    });

    this.bot.on('callback_query', async (ctx) => {
      await this.handleCallbackQuery(ctx);
    });

    this.bot.on('document', async (ctx) => {
      await this.handleDocumentMessage(ctx);
    });

    this.bot.on('text', async (ctx) => {
      await this.handleTextMessage(ctx);
    });

    this.bot.catch((error, ctx) => {
      console.error('Unhandled telegram update error', {
        updateId: ctx.update.update_id,
        error
      });
    });
  }

  private async handleCallbackQuery(ctx: Context): Promise<void> {
    const callbackQuery = (ctx.callbackQuery ?? {}) as { data?: unknown };
    const callbackData = typeof callbackQuery.data === 'string' ? callbackQuery.data : '';
    const actorId = String(ctx.from?.id ?? '');
    if (!actorId) {
      await ctx.answerCbQuery('Failed to identify user.');
      return;
    }
    if (typeof callbackData !== 'string' || callbackData.length === 0) {
      await ctx.answerCbQuery('Invalid callback payload.');
      return;
    }

    const [action, draftId] = callbackData.split(':');
    if (!action || !draftId) {
      await ctx.answerCbQuery('Invalid callback format.');
      return;
    }

    if (!this.moderationModule) {
      await safeAnswerCbQuery(ctx, 'Moderation service is unavailable.');
      return;
    }

    if (!['approve', 'rewrite', 'rewrite_notes'].includes(action)) {
      await safeAnswerCbQuery(ctx, 'Unknown action.');
      return;
    }

    await safeAnswerCbQuery(ctx, 'Processing...');

    try {
      if (action === 'approve') {
        await this.moderationModule.approveDraft(actorId, draftId);
        await ctx.reply(`Draft ${draftId} approved and published.`);
        return;
      }

      if (action === 'rewrite') {
        await this.moderationModule.rewriteDraft(actorId, draftId);
        await ctx.reply(`Draft ${draftId} rewritten and re-sent for moderation.`);
        return;
      }

      await this.moderationModule.requestRewriteNotes(actorId, draftId);
      await ctx.reply('Send rewrite notes in your next message.');
    } catch (error: unknown) {
      await ctx.reply(`Moderation action failed: ${toErrorMessage(error)}`);
    }
  }

  private async handleTextMessage(ctx: Context): Promise<void> {
    try {
      const userId = String(ctx.from?.id ?? '');
      if (!userId) {
        return;
      }

      const message = (ctx.message ?? {}) as { text?: unknown };
      const text = typeof message.text === 'string' ? message.text.trim() : '';
      if (text.length === 0) {
        return;
      }

      if (text.toLowerCase() === CANCEL_TEXT) {
        await this.sessionsModule.clearSession(userId);
        await ctx.reply('Canceled.');
        return;
      }

      const session = await this.sessionsModule.getSession(userId);
      if (!this.moderationModule) {
        throw new Error('Moderation module is not bound.');
      }

      if (session.mode === 'WAITING_ARTICLE') {
        const draftId = await this.moderationModule.processManualUploadArticle(userId, text);
        await ctx.reply(`Article accepted. Draft ${draftId} sent to moderation.`);
        return;
      }

      if (session.mode === 'WAITING_NOTES') {
        await this.moderationModule.submitRewriteNotes(userId, text);
        await ctx.reply('Notes accepted. Draft rewritten and re-sent for moderation.');
      }
    } catch (error: unknown) {
      await safeReply(ctx, `Failed to process message: ${toErrorMessage(error)}`);
    }
  }

  private async handleDocumentMessage(ctx: Context): Promise<void> {
    try {
      const userId = String(ctx.from?.id ?? '');
      if (!userId) {
        return;
      }

      const session = await this.sessionsModule.getSession(userId);
      if (session.mode !== 'WAITING_ARTICLE') {
        return;
      }

      if (!this.moderationModule) {
        throw new Error('Moderation module is not bound.');
      }

      const message = (ctx.message ?? {}) as { document?: unknown };
      const document = (message.document ?? {}) as {
        file_id?: unknown;
        file_name?: unknown;
        mime_type?: unknown;
        file_size?: unknown;
      };

      const fileId = typeof document.file_id === 'string' ? document.file_id : '';
      if (!fileId) {
        await ctx.reply('Failed to read uploaded file.');
        return;
      }

      const mimeType = typeof document.mime_type === 'string' ? document.mime_type : '';
      const fileName = typeof document.file_name === 'string' ? document.file_name : '';
      if (!isPdfDocument(mimeType, fileName)) {
        await ctx.reply('Please upload a PDF file.');
        return;
      }

      const fileSize = typeof document.file_size === 'number' ? document.file_size : null;
      if (fileSize !== null && fileSize > MAX_PDF_BYTES) {
        await ctx.reply('PDF file is слишком большой. Максимум 25 МБ.');
        return;
      }

      await ctx.reply('PDF получен. Обрабатываю текст и формирую публикацию, это может занять до 1-2 минут.');

      const buffer = await this.downloadPdfBuffer(fileId);
      const PdfParse = await this.getPdfParseClass();
      const parser = new PdfParse({ data: buffer });
      let parsed: { text?: string };
      try {
        parsed = await parser.getText();
      } finally {
        await parser.destroy();
      }
      const articleText = parsed.text?.trim() ?? '';
      if (articleText.length === 0) {
        await ctx.reply('PDF не содержит читаемого текста.');
        return;
      }

      const draftId = await this.moderationModule.processManualUploadArticle(userId, articleText);
      await ctx.reply(`PDF принят. Черновик ${draftId} отправлен на модерацию.`);
    } catch (error: unknown) {
      await safeReply(ctx, `Failed to process PDF: ${toErrorMessage(error)}`);
    }
  }

  private async getPdfParseClass(): Promise<PdfParseConstructor> {
    if (!this.pdfParseClassPromise) {
      this.pdfParseClassPromise = loadPdfParseClass();
    }

    return this.pdfParseClassPromise;
  }

  private async downloadPdfBuffer(fileId: string): Promise<Buffer> {
    const fileLink = await this.bot.telegram.getFileLink(fileId);
    const fileInfo = await this.bot.telegram.getFile(fileId);
    const fallbackUrl = fileInfo.file_path
      ? `https://api.telegram.org/file/bot${this.botToken}/${fileInfo.file_path}`
      : null;
    const sources = [fileLink.toString(), fallbackUrl].filter((url): url is string => Boolean(url));

    let lastError: unknown = null;
    for (const source of sources) {
      try {
        return await fetchBufferWithRetry(source, TELEGRAM_FILE_FETCH_RETRIES, TELEGRAM_FILE_FETCH_TIMEOUT_MS);
      } catch (error: unknown) {
        lastError = error;
      }
    }

    throw new Error(`Failed to download PDF after retries: ${toErrorMessage(lastError)}`);
  }

  private async buildReadyChannelPost(text: string): Promise<string> {
    const normalized = text.trim();
    if (normalized.length <= TELEGRAM_DIRECT_PUBLISH_LIMIT) {
      return normalized;
    }

    const page = await createTelegraphPage(normalized, this.telegraphShortName, this.telegraphAccessToken);
    return buildTelegraphAnnouncement(normalized, page.url);
  }
}

function parseModeratorChats(rawValue: string): string[] {
  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isPdfDocument(mimeType: string, fileName: string): boolean {
  if (mimeType.toLowerCase() === 'application/pdf') {
    return true;
  }

  return fileName.toLowerCase().endsWith('.pdf');
}

async function safeAnswerCbQuery(ctx: Context, text: string): Promise<void> {
  try {
    await ctx.answerCbQuery(text);
  } catch {
    // Ignore stale/invalid callback-query acknowledgement errors.
  }
}

async function safeReply(ctx: Context, text: string): Promise<void> {
  try {
    await ctx.reply(text);
  } catch (error: unknown) {
    console.error('Failed to send Telegram reply', {
      updateId: ctx.update.update_id,
      error
    });
  }
}

async function fetchBufferWithRetry(url: string, attempts: number, timeoutMs: number): Promise<Buffer> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error: unknown) {
      lastError = error;
      if (attempt < attempts) {
        await wait(300 * attempt);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface PdfParseInstance {
  getText(): Promise<{ text?: string }>;
  destroy(): Promise<void>;
}

interface TelegraphResponse<T> {
  ok: boolean;
  result?: T;
  error?: string;
}

interface TelegraphPageResult {
  path: string;
  url: string;
}

interface PdfParseConstructor {
  new (options: { data: Buffer }): PdfParseInstance;
}

async function loadPdfParseClass(): Promise<PdfParseConstructor> {
  const moduleValue = await import('pdf-parse');
  const classCandidate = unwrapPdfParseClass(moduleValue);

  if (typeof classCandidate === 'function') {
    return classCandidate as PdfParseConstructor;
  }

  throw new Error('Failed to initialize PDF parser.');
}

function unwrapPdfParseClass(value: unknown): unknown {
  let current = value;

  // CommonJS interop can wrap exports more than once.
  for (let i = 0; i < 3; i += 1) {
    if (current && typeof current === 'object' && 'PDFParse' in current) {
      const candidate = (current as { PDFParse: unknown }).PDFParse;
      if (typeof candidate === 'function') {
        return candidate;
      }
    }

    if (!current || typeof current !== 'object' || !('default' in current)) {
      break;
    }

    const next = (current as { default: unknown }).default;
    if (next === undefined) {
      break;
    }

    current = next;
  }

  if (current && typeof current === 'object' && 'PDFParse' in current) {
    return (current as { PDFParse: unknown }).PDFParse;
  }

  return null;
}

async function createTelegraphPage(
  text: string,
  shortName: string,
  presetAccessToken: string | null
): Promise<TelegraphPageResult> {
  const accessToken = presetAccessToken ?? await createTelegraphAccount(shortName);
  const title = buildClickworthyTitle(text);
  const content = JSON.stringify([
    {
      tag: 'p',
      children: [buildTelegraphIntro(text)]
    },
    ...toTelegraphParagraphNodes(text)
  ]);

  const response = await fetch('https://api.telegra.ph/createPage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      access_token: accessToken,
      title,
      content
    })
  });

  const data = (await response.json()) as TelegraphResponse<TelegraphPageResult>;
  if (!response.ok || !data.ok || !data.result) {
    throw new Error(`Failed to create Telegraph page: ${data.error ?? response.statusText}`);
  }

  return data.result;
}

async function createTelegraphAccount(shortName: string): Promise<string> {
  const response = await fetch('https://api.telegra.ph/createAccount', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      short_name: shortName,
      author_name: 'Хвостатый гурман'
    })
  });

  const data = (await response.json()) as TelegraphResponse<{ access_token: string }>;
  if (!response.ok || !data.ok || !data.result?.access_token) {
    throw new Error(`Failed to create Telegraph account: ${data.error ?? response.statusText}`);
  }

  return data.result.access_token;
}

function toTelegraphParagraphNodes(text: string): Array<{ tag: 'p'; children: string[] }> {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => ({ tag: 'p' as const, children: [paragraph] }));
}

function isPdfNoiseLine(line: string): boolean {
  const normalized = line.toLowerCase().trim();
  if (normalized.length === 0) {
    return true;
  }

  const noisyPhrases = [
    'время чтения',
    'похожие статьи',
    'поиск по сайту',
    'используемая литература',
    'бесплатная горячая линия',
    'написать нам',
    'оглавление',
    'главная заводчикам',
    'обучение заводчиков',
    'статьи /'
  ];

  if (noisyPhrases.some((phrase) => normalized.includes(phrase))) {
    return true;
  }

  return /^https?:\/\//i.test(normalized);
}

function buildClickworthyTitle(text: string): string {
  const topic = inferTopic(text);
  if (topic === 'training') {
    return 'Как выбрать дрессировку собаке и не ошибиться: полный практический разбор';
  }
  if (topic === 'nutrition') {
    return 'Как выстроить питание собаки без ошибок: практический разбор для владельцев';
  }
  if (topic === 'behavior') {
    return 'Как понять поведение собаки и скорректировать его без стресса';
  }

  const candidates = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !isPdfNoiseLine(line))
    .filter((line) => !/^\d+\s+of\s+\d+$/i.test(line))
    .filter((line) => !/^(советы от экспертов:|от экспертов:)$/i.test(line))
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 18)
    .filter((line) => !line.includes('/'))
    .filter((line) => !line.includes('|'));

  const firstSentence = candidates[0];
  if (!firstSentence) {
    return 'Практическая статья для владельцев собак';
  }

  const noPrefix = firstSentence
    .replace(/^советы от экспертов:\s*/i, '')
    .replace(/^виды дрессировок собак:\s*/i, 'Виды дрессировок собак: ')
    .trim();
  const titleBase = noPrefix.length > 0 ? noPrefix : firstSentence;
  const cleanedTitle = titleBase.replace(/\s{2,}/g, ' ').trim();
  return cleanedTitle.length > 100 ? `${cleanedTitle.slice(0, 97).trimEnd()}...` : cleanedTitle;
}

function buildTelegraphIntro(text: string): string {
  const benefit = extractBenefitSentence(text);
  return `Что вы получите после чтения: ${benefit}`;
}

function extractBenefitSentence(text: string): string {
  const topic = inferTopic(text);
  if (topic === 'training') {
    return 'вы поймете, какой формат дрессировки подходит именно вашей собаке, с чего безопасно начинать и каких ошибок избегать на каждом этапе.';
  }
  if (topic === 'nutrition') {
    return 'вы получите практичную схему питания, критерии выбора рациона и признаки, по которым вовремя заметить ошибки.';
  }
  if (topic === 'behavior') {
    return 'вы получите рабочие ориентиры по причинам проблемного поведения и понятный план корректировки без перегруза.';
  }

  const normalized = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !isPdfNoiseLine(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = normalized
    .split(/[.!?]/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 40);
  const preferred = sentences.find((line) => /подходит|выбрать|ошиб|поможет|как|когда/i.test(line));

  if (preferred) {
    return preferred.length > 180 ? `${preferred.slice(0, 177).trimEnd()}...` : preferred;
  }

  return 'понятные рекомендации, практические критерии выбора и разбор типичных ошибок без воды.';
}

function inferTopic(text: string): 'training' | 'nutrition' | 'behavior' | 'general' {
  const normalized = text.toLowerCase();
  if (/(дрессиров|окд|угс|зкс|кинолог|обидиенс|мондьоринг)/i.test(normalized)) {
    return 'training';
  }

  if (/(корм|питан|рацион|жкт|аллерг|лакомств)/i.test(normalized)) {
    return 'nutrition';
  }

  if (/(поведен|тревож|страх|агресс|реактив|социал)/i.test(normalized)) {
    return 'behavior';
  }

  return 'general';
}

function buildTelegraphAnnouncement(text: string, url: string): string {
  const title = buildClickworthyTitle(text);
  const benefit = extractBenefitSentence(text);
  return [
    `Заголовок: ${title}`,
    `Что получите: ${benefit}`,
    'Откройте полную статью, чтобы применить рекомендации на практике без проб и ошибок.',
    `Читать полностью: ${url}`
  ].join('\n\n');
}
