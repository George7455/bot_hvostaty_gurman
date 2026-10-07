CREATE TYPE "DraftStatus" AS ENUM ('NEW', 'IN_REVIEW', 'APPROVED', 'PUBLISHED');
CREATE TYPE "SessionMode" AS ENUM ('IDLE', 'WAITING_ARTICLE', 'WAITING_NOTES');
CREATE TYPE "ModerationActionType" AS ENUM ('APPROVE', 'REWRITE', 'REWRITE_NOTES');
CREATE TYPE "DraftSourceType" AS ENUM ('SCHEDULED', 'MANUAL_UPLOAD');
CREATE TYPE "ContentPlanStatus" AS ENUM ('IN_REVIEW', 'PUBLISHED');

CREATE TABLE "Draft" (
  "id" TEXT NOT NULL,
  "sourceType" "DraftSourceType" NOT NULL,
  "status" "DraftStatus" NOT NULL DEFAULT 'NEW',
  "currentText" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentPlanItem" (
  "id" TEXT NOT NULL,
  "sheetRowNumber" INTEGER NOT NULL,
  "topic" TEXT NOT NULL,
  "rubric" TEXT NOT NULL,
  "status" "ContentPlanStatus",
  "draftId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DraftRevision" (
  "id" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "revisionNo" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DraftRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModerationAction" (
  "id" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "actionType" "ModerationActionType" NOT NULL,
  "actorId" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mode" "SessionMode" NOT NULL DEFAULT 'IDLE',
  "pendingDraftId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Publication" (
  "id" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "telegramChatId" TEXT NOT NULL,
  "telegramMessageId" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentPlanItem_sheetRowNumber_key" ON "ContentPlanItem"("sheetRowNumber");
CREATE UNIQUE INDEX "ContentPlanItem_draftId_key" ON "ContentPlanItem"("draftId");
CREATE INDEX "ContentPlanItem_status_sheetRowNumber_idx" ON "ContentPlanItem"("status", "sheetRowNumber");
CREATE INDEX "Draft_status_updatedAt_idx" ON "Draft"("status", "updatedAt");
CREATE UNIQUE INDEX "DraftRevision_draftId_revisionNo_key" ON "DraftRevision"("draftId", "revisionNo");
CREATE UNIQUE INDEX "UserSession_userId_key" ON "UserSession"("userId");
CREATE INDEX "UserSession_mode_idx" ON "UserSession"("mode");
CREATE UNIQUE INDEX "Publication_draftId_key" ON "Publication"("draftId");

ALTER TABLE "ContentPlanItem" ADD CONSTRAINT "ContentPlanItem_draftId_fkey"
  FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DraftRevision" ADD CONSTRAINT "DraftRevision_draftId_fkey"
  FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_draftId_fkey"
  FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_pendingDraftId_fkey"
  FOREIGN KEY ("pendingDraftId") REFERENCES "Draft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_draftId_fkey"
  FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
