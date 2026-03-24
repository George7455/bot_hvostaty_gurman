import type { GenerationModule } from '../generation/index.js';
import type { DraftRepository, InReviewContentPlanCandidate } from '../../repositories/draft.repository.js';
import type { DraftRevisionRepository } from '../../repositories/draft-revision.repository.js';

export interface DraftCreationResult {
  contentPlanItemId: string;
  draftId: string;
}

export interface DraftsModule {
  createInitialDraftFromNextInReview(): Promise<DraftCreationResult | null>;
  createInitialDraftFromContentPlanItem(contentPlanItemId: string): Promise<DraftCreationResult | null>;
  rewriteDraft(draftId: string, notes?: string): Promise<string>;
  createDraftFromManualArticle(articleText: string): Promise<string>;
}

export class DraftsService implements DraftsModule {
  public constructor(
    private readonly draftRepository: DraftRepository,
    private readonly draftRevisionRepository: DraftRevisionRepository,
    private readonly generationModule: GenerationModule
  ) {}

  public async createInitialDraftFromNextInReview(): Promise<DraftCreationResult | null> {
    const contentPlanItem = await this.draftRepository.findNextInReviewContentPlanItem();
    return this.createInitialDraftFromCandidate(contentPlanItem);
  }

  public async createInitialDraftFromContentPlanItem(contentPlanItemId: string): Promise<DraftCreationResult | null> {
    const contentPlanItem = await this.draftRepository.findInReviewContentPlanItemById(contentPlanItemId);
    return this.createInitialDraftFromCandidate(contentPlanItem);
  }

  private async createInitialDraftFromCandidate(
    contentPlanItem: InReviewContentPlanCandidate | null
  ): Promise<DraftCreationResult | null> {
    if (!contentPlanItem) {
      return null;
    }

    const generatedText = await this.generateInitialText(contentPlanItem);
    const draft = await this.draftRepository.createLinkedDraft({
      contentPlanItemId: contentPlanItem.id,
      currentText: generatedText,
      sourceType: 'SCHEDULED'
    });

    await this.draftRevisionRepository.createInitialRevision(draft.id, generatedText);

    return {
      contentPlanItemId: contentPlanItem.id,
      draftId: draft.id
    };
  }

  public async rewriteDraft(draftId: string, notes?: string): Promise<string> {
    const existingDraft = await this.draftRepository.findById(draftId);
    if (!existingDraft) {
      throw new Error(`Draft not found for rewrite: ${draftId}`);
    }

    const rewrittenText = await this.generationModule.rewriteDraftText(existingDraft.currentText, notes);
    await this.draftRepository.updateCurrentText(draftId, rewrittenText);
    await this.draftRevisionRepository.createRevision(draftId, rewrittenText, notes);

    return rewrittenText;
  }

  public async createDraftFromManualArticle(articleText: string): Promise<string> {
    const adaptedText = await this.generationModule.adaptManualArticleText(articleText);
    const draft = await this.draftRepository.createStandaloneDraft({
      currentText: adaptedText,
      sourceType: 'MANUAL_UPLOAD'
    });

    await this.draftRevisionRepository.createInitialRevision(draft.id, adaptedText);
    return draft.id;
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
