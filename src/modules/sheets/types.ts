import type { SheetItemIdentity } from '../../repositories/content-plan.repository.js';

export interface PendingContentPlanRow {
  sheetRowNumber: number;
  sheetItemKey: string;
  topic: string;
  rubric: string;
}

export interface PickedContentPlanItem extends SheetItemIdentity {
  contentPlanItemId: string;
  topic: string;
  rubric: string;
}
