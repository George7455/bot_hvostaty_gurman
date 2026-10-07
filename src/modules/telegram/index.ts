import { Context, Telegraf } from 'telegraf';

import type { AppEnv } from '../../config/index.js';
import type { ModerationModule } from '../moderation/index.js';
import { ModerationTransportError, type ModerationDeliveryPort } from '../moderation/index.js';
import type { PlannerModule } from '../planner/index.js';
import type { PublishingTransport } from '../publishing/index.js';
import type { SessionsModule } from '../sessions/index.js';

const UPLOAD_COMMAND = 'upload';
const CANCEL_TEXT = 'cancel';
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const TELEGRAM_MAX_MESSAGE_CHARS = 4096;
const TELEGRAM_DIRECT_PUBLISH_LIMIT = 2200;
const TELEGRAM_FILE_FETCH_TIMEOUT_MS = 20_000;
const TELEGRAM_FILE_FETCH_RETRIES = 3;
const PDF_PROGRESS_UPDATE_INTERVAL_MS = 60_000;
const ACTOR_RATE_LIMIT_MS = 1_500;
const MAX_PDF_TEXT_CHARS = 60_000;
const MAX_PDF_PAGES = 100;

export interface TelegramModeratorAllowlist {
  readonly chatIds: ReadonlySet<string>;
  readonly userIds: ReadonlySet<string>;
}

interface ActorOperationLease {
  release(): void;
}

type ActorOperationAcquireResult =
  | { ok: true; lease: ActorOperationLease }
  | { ok: false; reason: 'busy' | 'rate_limited' };

export interface TelegramModule extends ModerationDeliveryPort, PublishingTransport {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class TelegramService implements TelegramModule {
  private readonly bot: Telegraf;
  private readonly botToken: string;
  private readonly moderatorChatIds: string[];
  private readonly moderatorAllowlist: TelegramModeratorAllowlist;
  private readonly channelId: string;
  private readonly telegraphAccessToken: string | null;
  private readonly telegraphRequestTimeoutMs: number;
  private readonly activeActorOperations = new Set<string>();
  private readonly lastActorOperationAt = new Map<string, number>();
  private botRunning = false;
  private moderationModule: ModerationModule | null = null;
  private plannerModule: PlannerModule | null = null;
  private pdfParseClassPromise: Promise<PdfParseConstructor> | null = null;

  public constructor(
    env: AppEnv,
    private readonly sessionsModule: SessionsModule
  ) {
    this.bot = new Telegraf(env.TELEGRAM_BOT_TOKEN, {
      handlerTimeout: env.TELEGRAM_HANDLER_TIMEOUT_MS
    });
    this.botToken = env.TELEGRAM_BOT_TOKEN;
    this.moderatorChatIds = parseTelegramIdList(env.TELEGRAM_MODERATOR_CHAT_IDS);
    const configuredModeratorUserIds = env.TELEGRAM_MODERATOR_USER_IDS
      ? parseTelegramIdList(env.TELEGRAM_MODERATOR_USER_IDS)
      : this.moderatorChatIds.filter((chatId) => !chatId.startsWith('-'));
    this.moderatorAllowlist = {
      chatIds: new Set(this.moderatorChatIds),
      userIds: new Set(configuredModeratorUserIds)
    };
    this.channelId = env.TELEGRAM_CHANNEL_ID;
    this.telegraphAccessToken = env.TELEGRAPH_ACCESS_TOKEN ?? null;
    this.telegraphRequestTimeoutMs = env.TELEGRAPH_REQUEST_TIMEOUT_MS;

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
    this.botRunning = true;
  }

  public async stop(): Promise<void> {
    if (!this.botRunning) {
      return;
    }

    this.bot.stop('application shutdown');
    this.botRunning = false;
  }

  public async sendDraftToModerators(
    draftId: string,
    text: string
  ): Promise<readonly { telegramChatId: string; telegramMessageId: string }[]> {
    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: 'Approve', callback_data: `approve:${draftId}` }],
        [{ text: 'Rewrite', callback_data: `rewrite:${draftId}` }],
        [{ text: 'Rewrite with Notes', callback_data: `rewrite_notes:${draftId}` }]
      ]
    };

    const chunks = splitTelegramText(`Draft ID: ${draftId}\n\n${text.trim()}`, TELEGRAM_MAX_MESSAGE_CHARS);
    const receipts: Array<{ telegramChatId: string; telegramMessageId: string }> = [];
    try {
      for (const chatId of this.moderatorChatIds) {
        for (let index = 0; index < chunks.length; index += 1) {
          const chunk = chunks[index];
          if (!chunk) {
            continue;
          }
          const isLastChunk = index === chunks.length - 1;
          const sent = await this.bot.telegram.sendMessage(
            chatId,
            chunk,
            isLastChunk ? { reply_markup: inlineKeyboard } : undefined
          );
          if (isLastChunk) {
            receipts.push({
              telegramChatId: String(sent.chat.id),
              telegramMessageId: String(sent.message_id)
            });
          }
        }
      }
    } catch (error: unknown) {
      throw new ModerationTransportError(
        `Telegram moderation delivery failed after ${receipts.length} completed chat deliveries.`,
        receipts,
        { cause: error }
      );
    }
    return receipts;
  }

  public async prepareChannelPost(text: string): Promise<{
    payload: string;
    telegraphPath?: string;
    telegraphUrl?: string;
  }> {
    return this.buildReadyChannelPost(text);
  }

  public async sendPreparedChannelPost(post: { payload: string }): Promise<{
    telegramChatId: string;
    telegramMessageId: string;
  }> {
    const result = await this.bot.telegram.sendMessage(this.channelId, post.payload);
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
      const actor = this.readAuthorizedActor(ctx);
      if (!actor) {
        await safeReply(ctx, 'Недостаточно прав для использования этой команды.');
        return;
      }

      const acquired = this.acquireActorOperation(actor.userId);
      if (!acquired.ok) {
        await safeReply(ctx, actorGuardMessage(acquired.reason));
        return;
      }

      try {
        await this.sessionsModule.setWaitingArticle(actor.userId);
        await ctx.reply('Send the article text in one message or upload a PDF file. Send "cancel" to abort.');
      } catch (error: unknown) {
        console.error('Failed to handle authorized /upload command', error);
        await safeReply(ctx, 'Не удалось начать загрузку. Подробности записаны в лог.');
      } finally {
        acquired.lease.release();
      }
    });

    this.bot.command('tick', async (ctx) => {
      const actor = this.readAuthorizedActor(ctx);
      if (!actor) {
        await safeReply(ctx, 'Недостаточно прав для запуска планировщика.');
        return;
      }

      const acquired = this.acquireActorOperation(actor.userId);
      if (!acquired.ok) {
        await safeReply(ctx, actorGuardMessage(acquired.reason));
        return;
      }

      try {
        if (!this.plannerModule) {
          await ctx.reply('Планировщик не инициализирован.');
          return;
        }

        await ctx.reply('Запускаю ручной тик...');
        await this.plannerModule.runScheduledPlanningTick();
        await ctx.reply('Ручной тик выполнен.');
      } catch (error: unknown) {
        console.error('Authorized manual planner tick failed', error);
        await safeReply(ctx, 'Ручной тик завершился с ошибкой. Подробности записаны в лог.');
      } finally {
        acquired.lease.release();
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
    const actor = this.readAuthorizedActor(ctx);
    if (!actor) {
      await safeAnswerCbQuery(ctx, 'Недостаточно прав.');
      return;
    }
    if (typeof callbackData !== 'string' || callbackData.length === 0) {
      await ctx.answerCbQuery('Invalid callback payload.');
      return;
    }

    const callbackParts = callbackData.split(':');
    const [action, draftId] = callbackParts;
    if (callbackParts.length !== 2 || !action || !draftId) {
      await ctx.answerCbQuery('Invalid callback format.');
      return;
    }

    const messageContext = readCallbackMessageContext(ctx);
    if (!messageContext) {
      await safeAnswerCbQuery(ctx, 'Moderation message context is unavailable.');
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

    const acquired = this.acquireActorOperation(actor.userId);
    if (!acquired.ok) {
      await safeAnswerCbQuery(ctx, actorGuardMessage(acquired.reason));
      return;
    }

    await safeAnswerCbQuery(ctx, 'Processing...');

    try {
      if (action === 'approve') {
        await this.moderationModule.approveDraft(actor.userId, draftId, messageContext);
        await ctx.reply(`Draft ${draftId} approved and published.`);
        return;
      }

      if (action === 'rewrite') {
        await this.moderationModule.rewriteDraft(actor.userId, draftId, messageContext);
        await ctx.reply(`Draft ${draftId} rewritten and re-sent for moderation.`);
        return;
      }

      await this.moderationModule.requestRewriteNotes(actor.userId, draftId, messageContext);
      await ctx.reply('Send rewrite notes in your next message.');
    } catch (error: unknown) {
      console.error('Authorized moderation callback failed', {
        action,
        draftId,
        actorId: actor.userId,
        error
      });
      await safeReply(ctx, 'Moderation action failed. Details were written to the application log.');
    } finally {
      acquired.lease.release();
    }
  }

  private async handleTextMessage(ctx: Context): Promise<void> {
    const actor = this.readAuthorizedActor(ctx);
    if (!actor) {
      return;
    }

    let lease: ActorOperationLease | null = null;
    try {
      const message = (ctx.message ?? {}) as { text?: unknown };
      const text = typeof message.text === 'string' ? message.text.trim() : '';
      if (text.length === 0) {
        return;
      }

      if (text.toLowerCase() === CANCEL_TEXT) {
        const acquired = this.acquireActorOperation(actor.userId);
        if (!acquired.ok) {
          await safeReply(ctx, actorGuardMessage(acquired.reason));
          return;
        }
        lease = acquired.lease;
        await this.sessionsModule.clearSession(actor.userId);
        await ctx.reply('Canceled.');
        return;
      }

      const session = await this.sessionsModule.getSession(actor.userId);
      if (session.mode === 'IDLE') {
        return;
      }

      const acquired = this.acquireActorOperation(actor.userId);
      if (!acquired.ok) {
        await safeReply(ctx, actorGuardMessage(acquired.reason));
        return;
      }
      lease = acquired.lease;

      if (!this.moderationModule) {
        throw new Error('Moderation module is not bound.');
      }

      if (session.mode === 'WAITING_ARTICLE') {
        const draftId = await this.moderationModule.processManualUploadArticle(actor.userId, text);
        await ctx.reply(`Article accepted. Draft ${draftId} sent to moderation.`);
        return;
      }

      if (session.mode === 'WAITING_NOTES') {
        await this.moderationModule.submitRewriteNotes(actor.userId, text);
        await ctx.reply('Notes accepted. Draft rewritten and re-sent for moderation.');
      }
    } catch (error: unknown) {
      console.error('Authorized Telegram text processing failed', {
        actorId: actor.userId,
        error
      });
      await safeReply(ctx, 'Failed to process message. Details were written to the application log.');
    } finally {
      lease?.release();
    }
  }

  private async handleDocumentMessage(ctx: Context): Promise<void> {
    const actor = this.readAuthorizedActor(ctx);
    if (!actor) {
      return;
    }

    let lease: ActorOperationLease | null = null;
    try {
      const session = await this.sessionsModule.getSession(actor.userId);
      if (session.mode !== 'WAITING_ARTICLE') {
        return;
      }

      const acquired = this.acquireActorOperation(actor.userId);
      if (!acquired.ok) {
        await safeReply(ctx, actorGuardMessage(acquired.reason));
        return;
      }
      lease = acquired.lease;

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

      await ctx.reply('PDF получен. Обрабатываю текст и формирую публикацию, это может занять до 5-7 минут.');
      const progressTimer = startPdfProgressUpdates(ctx);
      try {
        const buffer = await this.downloadPdfBuffer(fileId);
        if (buffer.byteLength > MAX_PDF_BYTES) {
          throw new UserFacingTelegramError('Фактический размер PDF превышает 25 МБ.');
        }
        const PdfParse = await this.getPdfParseClass();
        const parser = new PdfParse({ data: buffer });
        let parsed: { text?: string };
        try {
          const info = await parser.getInfo();
          if (info.total > MAX_PDF_PAGES) {
            throw new UserFacingTelegramError(`PDF содержит больше ${MAX_PDF_PAGES} страниц.`);
          }
          parsed = await parser.getText();
        } finally {
          await parser.destroy();
        }
        const articleText = normalizePdfTextForAi(parsed.text ?? '');
        if (articleText.length === 0) {
          await ctx.reply('PDF не содержит читаемого текста.');
          return;
        }
        if (articleText.length > MAX_PDF_TEXT_CHARS) {
          throw new UserFacingTelegramError(
            `Извлечённый текст превышает лимит ${MAX_PDF_TEXT_CHARS.toLocaleString('ru-RU')} символов.`
          );
        }

        const draftId = await this.moderationModule.processManualUploadArticle(actor.userId, articleText);
        await ctx.reply(`PDF принят. Черновик ${draftId} отправлен на модерацию.`);
      } finally {
        clearInterval(progressTimer);
      }
    } catch (error: unknown) {
      if (error instanceof UserFacingTelegramError) {
        await safeReply(ctx, error.message);
      } else {
        console.error('Authorized Telegram PDF processing failed', {
          actorId: actor.userId,
          error
        });
        await safeReply(ctx, 'Failed to process PDF. Details were written to the application log.');
      }
    } finally {
      lease?.release();
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
        return await fetchBufferWithRetry(
          source,
          TELEGRAM_FILE_FETCH_RETRIES,
          TELEGRAM_FILE_FETCH_TIMEOUT_MS,
          MAX_PDF_BYTES
        );
      } catch (error: unknown) {
        lastError = error;
      }
    }

    throw new Error(`Failed to download PDF after retries: ${toErrorMessage(lastError)}`);
  }

  private readAuthorizedActor(ctx: Context): { userId: string; chatId: string } | null {
    const userId = String(ctx.from?.id ?? '');
    const chatId = String(ctx.chat?.id ?? '');
    if (!userId || !chatId) {
      return null;
    }

    if (!isAuthorizedTelegramModerator(this.moderatorAllowlist, userId, chatId)) {
      return null;
    }

    return { userId, chatId };
  }

  private acquireActorOperation(actorId: string): ActorOperationAcquireResult {
    if (this.activeActorOperations.has(actorId)) {
      return { ok: false, reason: 'busy' };
    }

    const now = Date.now();
    const lastStartedAt = this.lastActorOperationAt.get(actorId) ?? 0;
    if (now - lastStartedAt < ACTOR_RATE_LIMIT_MS) {
      return { ok: false, reason: 'rate_limited' };
    }

    this.activeActorOperations.add(actorId);
    this.lastActorOperationAt.set(actorId, now);
    let released = false;
    return {
      ok: true,
      lease: {
        release: () => {
          if (released) {
            return;
          }
          released = true;
          this.activeActorOperations.delete(actorId);
        }
      }
    };
  }

  private async buildReadyChannelPost(text: string): Promise<{
    payload: string;
    telegraphPath?: string;
    telegraphUrl?: string;
  }> {
    const normalized = text.trim();
    if (normalized.length <= TELEGRAM_DIRECT_PUBLISH_LIMIT) {
      return { payload: normalized };
    }

    if (!this.telegraphAccessToken) {
      throw new Error('TELEGRAPH_ACCESS_TOKEN is required to publish drafts longer than 2200 characters.');
    }

    const page = await createTelegraphPage(
      normalized,
      this.telegraphAccessToken,
      this.telegraphRequestTimeoutMs
    );
    return {
      payload: buildTelegraphAnnouncement(normalized, page.url),
      telegraphPath: page.path,
      telegraphUrl: page.url
    };
  }
}

function readCallbackMessageContext(
  ctx: Context
): { telegramChatId: string; telegramMessageId: string } | null {
  const callback = ctx.callbackQuery as
    | { message?: { chat?: { id?: unknown }; message_id?: unknown } }
    | undefined;
  const chatId = callback?.message?.chat?.id;
  const messageId = callback?.message?.message_id;
  if ((typeof chatId !== 'string' && typeof chatId !== 'number') || typeof messageId !== 'number') {
    return null;
  }
  return {
    telegramChatId: String(chatId),
    telegramMessageId: String(messageId)
  };
}

export function parseTelegramIdList(rawValue: string): string[] {
  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function isAuthorizedTelegramModerator(
  allowlist: TelegramModeratorAllowlist,
  userId: string,
  chatId: string
): boolean {
  if (!allowlist.userIds.has(userId)) {
    return false;
  }

  return allowlist.chatIds.has(chatId) || chatId === userId;
}

export function splitTelegramText(text: string, maxChars: number = TELEGRAM_MAX_MESSAGE_CHARS): string[] {
  const normalized = text.trim();
  if (normalized.length <= maxChars) {
    return normalized.length > 0 ? [normalized] : [];
  }

  const chunks: string[] = [];
  let remaining = normalized;
  while (remaining.length > maxChars) {
    const candidate = remaining.slice(0, maxChars);
    const paragraphBreak = candidate.lastIndexOf('\n\n');
    const lineBreak = candidate.lastIndexOf('\n');
    const whitespaceBreak = candidate.lastIndexOf(' ');
    const splitAt = Math.max(
      paragraphBreak >= Math.floor(maxChars * 0.5) ? paragraphBreak + 2 : 0,
      lineBreak >= Math.floor(maxChars * 0.65) ? lineBreak + 1 : 0,
      whitespaceBreak >= Math.floor(maxChars * 0.8) ? whitespaceBreak + 1 : 0
    );
    const boundary = splitAt > 0 ? splitAt : maxChars;
    chunks.push(remaining.slice(0, boundary).trim());
    remaining = remaining.slice(boundary).trimStart();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }
  return chunks;
}

function actorGuardMessage(reason: 'busy' | 'rate_limited'): string {
  return reason === 'busy'
    ? 'Уже выполняется другая операция. Дождитесь её завершения.'
    : 'Слишком частые запросы. Повторите через несколько секунд.';
}

class UserFacingTelegramError extends Error {}

class PayloadTooLargeError extends UserFacingTelegramError {
  public constructor(maxBytes: number) {
    super(`Фактический размер PDF превышает ${Math.floor(maxBytes / 1024 / 1024)} МБ.`);
  }
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

function startPdfProgressUpdates(ctx: Context): NodeJS.Timeout {
  return setInterval(() => {
    void safeReply(
      ctx,
      'Все еще обрабатываю PDF и собираю черновик. Для больших файлов это нормально и может занять несколько минут.'
    );
  }, PDF_PROGRESS_UPDATE_INTERVAL_MS);
}

async function fetchBufferWithRetry(
  url: string,
  attempts: number,
  timeoutMs: number,
  maxBytes: number
): Promise<Buffer> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const declaredLength = Number(response.headers.get('content-length') ?? '0');
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw new PayloadTooLargeError(maxBytes);
      }

      if (!response.body) {
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > maxBytes) {
          throw new PayloadTooLargeError(maxBytes);
        }
        return Buffer.from(arrayBuffer);
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) {
          break;
        }
        receivedBytes += chunk.value.byteLength;
        if (receivedBytes > maxBytes) {
          await reader.cancel();
          throw new PayloadTooLargeError(maxBytes);
        }
        chunks.push(chunk.value);
      }

      return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), receivedBytes);
    } catch (error: unknown) {
      lastError = error;
      if (error instanceof PayloadTooLargeError) {
        throw error;
      }
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
  getInfo(): Promise<{ total: number }>;
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
  accessToken: string,
  timeoutMs: number
): Promise<TelegraphPageResult> {
  const title = buildClickworthyTitle(text);
  const content = JSON.stringify([
    {
      tag: 'p',
      children: [buildTelegraphIntro(text)]
    },
    ...toTelegraphParagraphNodes(text)
  ]);

  const response = await fetchWithTimeout(
    'https://api.telegra.ph/createPage',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        access_token: accessToken,
        title,
        content
      })
    },
    timeoutMs
  );

  const data = (await response.json()) as TelegraphResponse<TelegraphPageResult>;
  if (!response.ok || !data.ok || !data.result) {
    throw new Error(`Failed to create Telegraph page: ${data.error ?? response.statusText}`);
  }

  return data.result;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function toTelegraphParagraphNodes(text: string): Array<{ tag: 'p'; children: string[] }> {
  return text
    .split(/\n+/)
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

export function normalizePdfTextForAi(rawText: string): string {
  let text = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

  // Join hyphenated wraps: "дресси-\nровка" => "дрессировка"
  text = text.replace(/([A-Za-zА-Яа-яЁё])-\n([A-Za-zА-Яа-яЁё])/g, '$1$2');
  text = trimPdfTailNoise(text);

  const lines = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .map((line) => cleanInlinePdfArtifacts(collapseLineRepetition(line)))
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .filter((line) => !isPdfNormalizationNoiseLine(line))
    .filter((line) => !isPdfLikelyMetadataLine(line));

  // Drop duplicates globally (not only adjacent) to suppress repeated headers/cards.
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const normalized = normalizePdfLineKey(line);
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(line);
  }

  const paragraphs = rebuildPdfParagraphs(deduped);
  return paragraphs.join('\n\n').trim();
}

function trimPdfTailNoise(text: string): string {
  const structuralMarker = /(?:^|\n)\s*(?:похожие статьи|related articles)\s*(?=\n|$)/im;
  const markerMatch = structuralMarker.exec(text);
  return markerMatch?.index === undefined ? text : text.slice(0, markerMatch.index);
}

function isPdfNormalizationNoiseLine(line: string): boolean {
  const normalized = line.toLowerCase().trim();
  if (normalized.length === 0) {
    return true;
  }

  if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line)) {
    return true;
  }

  if (/^(оглавление|contents|авторы)$/i.test(normalized)) {
    return true;
  }

  if (/^\d+\s*$/.test(normalized)) {
    return true;
  }

  if (/^(янв|фев|мар|апр|май|июн|июл|авг|сен|окт|ноя|дек)\s+\d{4}$/i.test(normalized)) {
    return true;
  }

  if (looksLikePdfStatLine(normalized)) {
    return true;
  }

  if (/^[\/|\\•\-\s\d]+$/.test(line) && line.length < 40) {
    return true;
  }

  const noisePhrases = [
    'время чтения',
    'похожие статьи',
    'поиск по сайту',
    'используемая литература',
    'бесплатная горячая линия',
    'ежедневно с',
    'написать нам',
    'главная заводчикам',
    'обучение заводчиков',
    'статьи /',
    'дрессировка и спорт ркф',
    'contact',
    '@royalcanin'
  ];

  if (noisePhrases.some((phrase) => normalized.includes(phrase))) {
    return true;
  }

  return /^https?:\/\//i.test(normalized);
}

function isPdfLikelyMetadataLine(line: string): boolean {
  const normalized = line.toLowerCase().trim();

  if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) {
    return true;
  }

  if (/^(авторы?|author|оглавление|contents|содержание|введение)$/i.test(normalized)) {
    return true;
  }

  if (/^(стр|page)\.?\s*\d+$/i.test(normalized)) {
    return true;
  }

  if (/^(рис|табл)\.?\s*\d+$/i.test(normalized)) {
    return true;
  }

  if (looksLikePdfStatLine(normalized)) {
    return true;
  }

  if (
    !/[.!?;:]/.test(line) &&
    (line.match(/\([^)]+\)/g)?.length ?? 0) >= 4 &&
    line.length > 70
  ) {
    return true;
  }

  return isLikelyTagCloudLine(line);
}

function isLikelyTagCloudLine(line: string): boolean {
  if (/[.!?;:]/.test(line)) {
    return false;
  }

  const tokens = line
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);
  if (tokens.length < 6) {
    return false;
  }

  const keywordMatches = tokens.filter((token) =>
    /(собак|щенок|здоров|уход|развит|адаптац|дрессиров|тест)/i.test(token)
  ).length;
  const mostlyShort = tokens.filter((token) => token.length <= 14).length / tokens.length > 0.9;
  return keywordMatches >= 3 && mostlyShort;
}

function cleanInlinePdfArtifacts(line: string): string {
  return stripRuDateAndReadTimeMarkers(
    line
      .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikePdfStatLine(line: string): boolean {
  const normalized = line.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0 || normalized.length > 80) {
    return false;
  }

  const hasReadTime = /(^|\s)\d+\s*мин(?:ут[аы]?)?(?=\s|$)/i.test(normalized);
  const hasMonthYear = /(^|\s)(?:янв|фев|мар|апр|май|июн|июл|авг|сен|окт|ноя|дек)\s+\d{4}(?=\s|$)/i.test(normalized);
  const hasCounter = /(^|\s)\d{3,6}(?=\s|$)/.test(normalized);
  const tokenCount = normalized.split(' ').filter((token) => token.length > 0).length;

  if (hasReadTime && (hasMonthYear || hasCounter)) {
    return true;
  }

  if (hasMonthYear && hasCounter && tokenCount <= 9) {
    return true;
  }

  return false;
}

function stripRuDateAndReadTimeMarkers(text: string): string {
  return text
    .replace(/(?:время\s+чтения|reading\s+time)\s*:?\s*\d+\s*(?:мин(?:ут[аы]?)?|min(?:utes?)?)/gi, ' ')
    .replace(
      /(?:опубликовано|обновлено)\s*:?\s*\d{1,2}\s*(?:янв|фев|мар|апр|май|июн|июл|авг|сен|окт|ноя|дек)(?:\s+\d{4})?/gi,
      ' '
    );
}

function rebuildPdfParagraphs(lines: string[]): string[] {
  const paragraphs: string[] = [];
  let current = '';

  for (const line of lines) {
    const cleaned = line.replace(/\s+/g, ' ').trim();
    if (cleaned.length === 0) {
      continue;
    }

    if (current.length === 0) {
      current = cleaned;
      continue;
    }

    if (shouldStartNewPdfParagraph(current, cleaned)) {
      paragraphs.push(current.trim());
      current = cleaned;
      continue;
    }

    current = `${current} ${cleaned}`.replace(/\s+/g, ' ').trim();
  }

  if (current.length > 0) {
    paragraphs.push(current.trim());
  }

  return paragraphs
    .map((paragraph) => paragraph.replace(/\s+([,.;:!?])/g, '$1').trim())
    .filter((paragraph) => paragraph.length > 0);
}

function shouldStartNewPdfParagraph(previous: string, next: string): boolean {
  if (isLikelyPdfHeadingLine(next)) {
    return true;
  }

  if (previous.length >= 420) {
    return true;
  }

  if (/[.!?…]$/.test(previous) && next.length >= 48) {
    return true;
  }

  if (/^[0-9]+[.)]\s+/.test(next)) {
    return true;
  }

  return false;
}

function isLikelyPdfHeadingLine(line: string): boolean {
  if (!line.endsWith(':') || line.length > 90) {
    return false;
  }

  if (/[.!?]/.test(line.slice(0, -1))) {
    return false;
  }

  const lettersOnly = line.replace(/[^A-Za-zА-Яа-яЁё\s]/g, '').trim();
  return lettersOnly.length >= 6;
}

function normalizePdfLineKey(line: string): string {
  return line
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collapseLineRepetition(line: string): string {
  const words = line.split(/\s+/).filter((word) => word.length > 0);
  if (words.length < 6) {
    return line;
  }

  for (let chunkSize = 2; chunkSize <= Math.min(8, Math.floor(words.length / 2)); chunkSize += 1) {
    for (let index = 0; index + chunkSize * 2 <= words.length; index += 1) {
      let equal = true;
      for (let offset = 0; offset < chunkSize; offset += 1) {
        const left = words[index + offset];
        const right = words[index + chunkSize + offset];
        if (!left || !right || left.toLowerCase() !== right.toLowerCase()) {
          equal = false;
          break;
        }
      }
      if (equal) {
        const collapsed = [
          ...words.slice(0, index + chunkSize),
          ...words.slice(index + chunkSize * 2)
        ];
        return collapsed.join(' ');
      }
    }
  }

  return line;
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
