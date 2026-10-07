import type { ModerationActionType } from '@prisma/client';

import type { GenerationModule } from '../generation/index.js';
import type {
  DraftLifecycleSnapshot,
  DraftRepository,
  InReviewContentPlanCandidate
} from '../../repositories/draft.repository.js';
import type { DraftRevisionRepository } from '../../repositories/draft-revision.repository.js';

export interface DraftCreationResult {
  contentPlanItemId: string;
  draftId: string;
  revisionId: string;
}

export interface DraftVersionResult {
  draftId: string;
  revisionId: string;
  text: string;
}

export interface RewriteDraftInput {
  draftId: string;
  expectedRevisionId: string;
  actorId: string;
  notes?: string;
  actionType: Extract<ModerationActionType, 'REWRITE' | 'REWRITE_NOTES'>;
}

export interface DraftsModule {
  createInitialDraftFromNextInReview(plannerRunKey?: string): Promise<DraftCreationResult | null>;
  createInitialDraftFromContentPlanItem(
    contentPlanItemId: string,
    plannerRunKey?: string
  ): Promise<DraftCreationResult | null>;
  rewriteDraft(input: RewriteDraftInput): Promise<DraftVersionResult>;
  createDraftFromManualArticle(articleText: string): Promise<DraftVersionResult>;
}

export class DraftsService implements DraftsModule {
  public constructor(
    private readonly draftRepository: DraftRepository,
    // Kept in the constructor for wiring compatibility. All writes now live in
    // DraftRepository transactions so a Draft can never exist without revision 1.
    private readonly _draftRevisionRepository: DraftRevisionRepository,
    private readonly generationModule: GenerationModule
  ) {}

  public async createInitialDraftFromNextInReview(plannerRunKey?: string): Promise<DraftCreationResult | null> {
    const contentPlanItem = await this.draftRepository.findNextInReviewContentPlanItem();
    return this.createInitialDraftFromCandidate(contentPlanItem, plannerRunKey);
  }

  public async createInitialDraftFromContentPlanItem(
    contentPlanItemId: string,
    plannerRunKey?: string
  ): Promise<DraftCreationResult | null> {
    const contentPlanItem = await this.draftRepository.findInReviewContentPlanItemById(contentPlanItemId);
    return this.createInitialDraftFromCandidate(contentPlanItem, plannerRunKey);
  }

  private async createInitialDraftFromCandidate(
    contentPlanItem: InReviewContentPlanCandidate | null,
    plannerRunKey?: string
  ): Promise<DraftCreationResult | null> {
    if (!contentPlanItem) {
      return null;
    }

    const generatedText = await this.generateInitialText(contentPlanItem);
    const draft = await this.draftRepository.createLinkedDraftWithInitialRevision({
      contentPlanItemId: contentPlanItem.id,
      currentText: generatedText,
      sourceType: 'SCHEDULED',
      ...(plannerRunKey ? { plannerRunKey } : {})
    });
    return {
      contentPlanItemId: contentPlanItem.id,
      draftId: draft.id,
      revisionId: draft.currentRevisionId
    };
  }

  public async rewriteDraft(input: RewriteDraftInput): Promise<DraftVersionResult> {
    const existingDraft = await this.requireCurrentInReviewRevision(input.draftId, input.expectedRevisionId);
    const mode = existingDraft.sourceType === 'MANUAL_UPLOAD' ? 'MANUAL_UPLOAD' : 'STANDARD';
    const rewrittenText = await this.generationModule.rewriteDraftText(existingDraft.currentText, input.notes, mode);
    const updated = await this.draftRepository.applyRewrite({
      draftId: input.draftId,
      expectedRevisionId: input.expectedRevisionId,
      text: rewrittenText,
      actorId: input.actorId,
      actionType: input.actionType,
      ...(input.notes !== undefined ? { notes: input.notes } : {})
    });
    return {
      draftId: updated.id,
      revisionId: updated.currentRevisionId,
      text: updated.currentText
    };
  }

  public async createDraftFromManualArticle(articleText: string): Promise<DraftVersionResult> {
    const adaptedText = await this.generationModule.adaptManualArticleText(articleText);
    const draft = await this.draftRepository.createStandaloneDraftWithInitialRevision({
      currentText: adaptedText,
      sourceType: 'MANUAL_UPLOAD'
    });
    return {
      draftId: draft.id,
      revisionId: draft.currentRevisionId,
      text: draft.currentText
    };
  }

  private async requireCurrentInReviewRevision(
    draftId: string,
    expectedRevisionId: string
  ): Promise<DraftLifecycleSnapshot> {
    const draft = await this.draftRepository.findSnapshot(draftId);
    if (!draft) {
      throw new Error(`Draft not found for rewrite: ${draftId}`);
    }
    if (draft.status !== 'IN_REVIEW') {
      throw new Error(`Draft ${draftId} cannot be rewritten from status ${draft.status}.`);
    }
    if (draft.currentRevisionId !== expectedRevisionId) {
      throw new Error(
        `Stale moderation action for draft ${draftId}: expected revision ${expectedRevisionId}, current revision is ${draft.currentRevisionId}.`
      );
    }
    return draft;
  }

  private async generateInitialText(contentPlanItem: InReviewContentPlanCandidate): Promise<string> {
    try {
      return await this.generationModule.generateInitialDraftText({
        topic: contentPlanItem.topic,
        rubric: contentPlanItem.rubric
      });
    } catch (error: unknown) {
      throw new Error(
        `Draft generation failed for ContentPlanItem ${contentPlanItem.id}. No draft was persisted.`,
        { cause: error }
      );
    }
  }
}
