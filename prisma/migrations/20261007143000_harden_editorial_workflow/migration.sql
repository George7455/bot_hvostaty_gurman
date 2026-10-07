-- Durable workflow state and revision-safe moderation.
CREATE TYPE "PlannerRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "WorkflowJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'NEEDS_RECONCILIATION');

DROP INDEX IF EXISTS "ContentPlanItem_sheetRowNumber_key";
ALTER TABLE "ContentPlanItem"
  ADD COLUMN "spreadsheetId" TEXT,
  ADD COLUMN "worksheetTitle" TEXT,
  ADD COLUMN "sheetItemKey" TEXT;

ALTER TABLE "Draft"
  ADD COLUMN "currentRevisionNo" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "currentRevisionId" TEXT,
  ADD COLUMN "approvedRevisionId" TEXT,
  ADD COLUMN "approvedByActorId" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3);

-- Repair any legacy Draft that was stored without revision 1.
INSERT INTO "DraftRevision" ("id", "draftId", "revisionNo", "text", "createdAt")
SELECT md5(d."id" || ':revision:1'), d."id", 1, d."currentText", d."createdAt"
FROM "Draft" d
WHERE NOT EXISTS (
  SELECT 1 FROM "DraftRevision" r WHERE r."draftId" = d."id"
);

UPDATE "Draft" d
SET
  "currentRevisionId" = (
    SELECT r."id" FROM "DraftRevision" r
    WHERE r."draftId" = d."id" ORDER BY r."revisionNo" DESC LIMIT 1
  ),
  "currentRevisionNo" = (
    SELECT r."revisionNo" FROM "DraftRevision" r
    WHERE r."draftId" = d."id" ORDER BY r."revisionNo" DESC LIMIT 1
  );

UPDATE "Draft"
SET
  "approvedRevisionId" = "currentRevisionId",
  "approvedAt" = "updatedAt"
WHERE "status" IN ('APPROVED', 'PUBLISHED');

ALTER TABLE "ModerationAction" ADD COLUMN "revisionId" TEXT;

ALTER TABLE "UserSession"
  ADD COLUMN "pendingRevisionId" TEXT,
  ADD COLUMN "processingToken" TEXT,
  ADD COLUMN "processingStartedAt" TIMESTAMP(3);

ALTER TABLE "Publication"
  ADD COLUMN "revisionId" TEXT,
  ADD COLUMN "textSnapshot" TEXT,
  ADD COLUMN "publishedPayload" TEXT,
  ADD COLUMN "actorId" TEXT,
  ADD COLUMN "sourceType" "DraftSourceType",
  ADD COLUMN "telegraphPath" TEXT,
  ADD COLUMN "telegraphUrl" TEXT;

UPDATE "Publication" p
SET
  "revisionId" = d."approvedRevisionId",
  "textSnapshot" = d."currentText",
  "sourceType" = d."sourceType"
FROM "Draft" d
WHERE d."id" = p."draftId";

CREATE TABLE "PlannerRun" (
  "id" TEXT NOT NULL,
  "runKey" TEXT NOT NULL,
  "status" "PlannerRunStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "leaseToken" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "lastError" TEXT,
  "contentPlanItemId" TEXT,
  "draftId" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlannerRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModerationDelivery" (
  "id" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "status" "WorkflowJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "leaseToken" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModerationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModerationMessage" (
  "id" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "telegramChatId" TEXT NOT NULL,
  "telegramMessageId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModerationMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicationIntent" (
  "id" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "status" "WorkflowJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "leaseToken" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "lastError" TEXT,
  "preparedPayload" TEXT,
  "telegraphPath" TEXT,
  "telegraphUrl" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicationIntent_pkey" PRIMARY KEY ("id")
);

-- Legacy external deliveries cannot be proven from database history. Quarantine
-- them for operator reconciliation instead of risking duplicate Telegram posts.
INSERT INTO "ModerationDelivery" (
  "id", "draftId", "revisionId", "status", "attempts", "lastError", "createdAt", "updatedAt"
)
SELECT
  md5(d."id" || ':moderation-delivery'),
  d."id",
  d."currentRevisionId",
  'NEEDS_RECONCILIATION',
  0,
  'Legacy IN_REVIEW draft: verify existing moderator messages before redelivery.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Draft" d
WHERE d."status" = 'IN_REVIEW' AND d."currentRevisionId" IS NOT NULL;

INSERT INTO "PublicationIntent" (
  "id", "draftId", "revisionId", "status", "attempts", "lastError", "createdAt", "updatedAt"
)
SELECT
  md5(d."id" || ':publication-intent'),
  d."id",
  d."approvedRevisionId",
  'NEEDS_RECONCILIATION',
  0,
  'Legacy APPROVED draft: verify channel state before publishing.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Draft" d
WHERE d."status" = 'APPROVED' AND d."approvedRevisionId" IS NOT NULL;

CREATE UNIQUE INDEX "ContentPlanItem_spreadsheetId_worksheetTitle_sheetItemKey_key"
  ON "ContentPlanItem"("spreadsheetId", "worksheetTitle", "sheetItemKey");
CREATE INDEX "ContentPlanItem_spreadsheetId_worksheetTitle_sheetRowNumber_idx"
  ON "ContentPlanItem"("spreadsheetId", "worksheetTitle", "sheetRowNumber");
CREATE UNIQUE INDEX "Draft_currentRevisionId_key" ON "Draft"("currentRevisionId");
CREATE UNIQUE INDEX "Draft_approvedRevisionId_key" ON "Draft"("approvedRevisionId");
CREATE UNIQUE INDEX "UserSession_processingToken_key" ON "UserSession"("processingToken");
CREATE UNIQUE INDEX "Publication_revisionId_key" ON "Publication"("revisionId");
CREATE UNIQUE INDEX "PlannerRun_runKey_key" ON "PlannerRun"("runKey");
CREATE INDEX "PlannerRun_status_leaseExpiresAt_idx" ON "PlannerRun"("status", "leaseExpiresAt");
CREATE UNIQUE INDEX "ModerationDelivery_draftId_revisionId_key" ON "ModerationDelivery"("draftId", "revisionId");
CREATE INDEX "ModerationDelivery_status_leaseExpiresAt_createdAt_idx"
  ON "ModerationDelivery"("status", "leaseExpiresAt", "createdAt");
CREATE UNIQUE INDEX "ModerationMessage_telegramChatId_telegramMessageId_key"
  ON "ModerationMessage"("telegramChatId", "telegramMessageId");
CREATE UNIQUE INDEX "ModerationMessage_deliveryId_telegramChatId_key"
  ON "ModerationMessage"("deliveryId", "telegramChatId");
CREATE INDEX "ModerationMessage_draftId_revisionId_idx" ON "ModerationMessage"("draftId", "revisionId");
CREATE UNIQUE INDEX "PublicationIntent_draftId_revisionId_key" ON "PublicationIntent"("draftId", "revisionId");
CREATE INDEX "PublicationIntent_status_leaseExpiresAt_createdAt_idx"
  ON "PublicationIntent"("status", "leaseExpiresAt", "createdAt");

ALTER TABLE "Draft" ADD CONSTRAINT "Draft_currentRevisionId_fkey"
  FOREIGN KEY ("currentRevisionId") REFERENCES "DraftRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_approvedRevisionId_fkey"
  FOREIGN KEY ("approvedRevisionId") REFERENCES "DraftRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "DraftRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_pendingRevisionId_fkey"
  FOREIGN KEY ("pendingRevisionId") REFERENCES "DraftRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "DraftRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModerationDelivery" ADD CONSTRAINT "ModerationDelivery_draftId_fkey"
  FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationDelivery" ADD CONSTRAINT "ModerationDelivery_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "DraftRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationMessage" ADD CONSTRAINT "ModerationMessage_deliveryId_fkey"
  FOREIGN KEY ("deliveryId") REFERENCES "ModerationDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationMessage" ADD CONSTRAINT "ModerationMessage_draftId_fkey"
  FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationMessage" ADD CONSTRAINT "ModerationMessage_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "DraftRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationIntent" ADD CONSTRAINT "PublicationIntent_draftId_fkey"
  FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationIntent" ADD CONSTRAINT "PublicationIntent_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "DraftRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
