export interface PendingContentPlanRow {
  sheetRowNumber: number;
  topic: string;
  rubric: string;
}

export interface PickedContentPlanItem {
  contentPlanItemId: string;
  sheetRowNumber: number;
  topic: string;
  rubric: string;
}
