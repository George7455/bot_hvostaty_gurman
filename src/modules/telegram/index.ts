import { Context, Telegraf } from 'telegraf';
import pdfParse from 'pdf-parse';

import type { AppEnv } from '../../config/index.js';
import type { ModerationModule } from '../moderation/index.js';
import type { ModerationDeliveryPort } from '../moderation/index.js';
import type { PlannerModule } from '../planner/index.js';
import type { PublishingTransport } from '../publishing/index.js';
import type { SessionsModule } from '../sessions/index.js';

const UPLOAD_COMMAND = 'upload';
const CANCEL_TEXT = 'cancel';
const MAX_PDF_BYTES = 25 * 1024 * 1024;

export interface TelegramModule extends ModerationDeliveryPort, PublishingTransport {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class TelegramService implements TelegramModule {
  private readonly bot: Telegraf;
  private readonly moderatorChatIds: string[];
  private readonly channelId: string;
  private moderationModule: ModerationModule | null = null;
  private plannerModule: PlannerModule | null = null;

  public constructor(
    env: AppEnv,
    private readonly sessionsModule: SessionsModule
  ) {
    this.bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);
    this.moderatorChatIds = parseModeratorChats(env.TELEGRAM_MODERATOR_CHAT_IDS);
    this.channelId = env.TELEGRAM_CHANNEL_ID;

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

    const message = `Draft ID: ${draftId}\n\n${text}`;
    for (const chatId of this.moderatorChatIds) {
      await this.bot.telegram.sendMessage(chatId, message, { reply_markup: inlineKeyboard });
    }
  }

  public async publishToChannel(text: string): Promise<{ telegramChatId: string; telegramMessageId: string }> {
    const result = await this.bot.telegram.sendMessage(this.channelId, text);
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
        await ctx.reply('PDF file is слишком большой. Максимум 5 МБ.');
        return;
      }

      const fileUrl = await this.bot.telegram.getFileLink(fileId);
      const response = await fetch(fileUrl.toString());
      if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const parsed = await pdfParse(buffer);
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
