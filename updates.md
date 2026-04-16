## Update 1 — 2026-03-17

File: package.json  
Lines: 1-33

Change:
Created Node.js project manifest with TypeScript build/runtime scripts and declared baseline dependencies for Fastify, Prisma, Telegram API client, Google APIs, OpenAI SDK, config validation, and TypeScript toolchain.

Reason:
Project scaffold required a production-oriented package definition before module implementation.

Impact:
Establishes deterministic runtime/tooling contract for subsequent implementation steps.

## Update 2 — 2026-03-17

File: tsconfig.json  
Lines: 1-20

Change:
Added strict TypeScript compiler configuration (`strict`, `noImplicitOverride`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) with NodeNext module settings and `src` -> `dist` build mapping.

Reason:
Scaffold requires compile-time correctness guarantees and standard output layout.

Impact:
Enforces strict typing and consistent build behavior across all future modules.

## Update 3 — 2026-03-17

File: prisma/schema.prisma  
Lines: 1-102

Change:
Defined Prisma datasource/client and schema models: `ContentPlanItem`, `Draft`, `DraftRevision`, `ModerationAction`, `UserSession`, `Publication`; added enums `DraftStatus`, `SessionMode`, `ModerationActionType`, `DraftSourceType`, `ContentPlanStatus`; wired relational links with draft-centric identifiers.

Reason:
Persistent state model is required to support draft lifecycle, moderation auditability, publication tracking, and DB-backed user session modes.

Impact:
Creates canonical database contract aligned with required entities and non-in-memory session constraint.

## Update 4 — 2026-03-17

File: src/config/env.ts  
Lines: 1-23

Change:
Implemented environment bootstrap via `dotenv` and schema validation via `zod` for runtime variables: database, Telegram, Google Sheets, OpenAI, and server settings.

Reason:
Scaffold requires centralized, validated configuration before any service wiring.

Impact:
Prevents startup with missing/invalid critical configuration.

## Update 5 — 2026-03-17

File: src/config/index.ts  
Lines: 1-2

Change:
Added config module barrel exports for env reader and env type.

Reason:
Provides stable import boundary for app bootstrap and future modules.

Impact:
Keeps config access modular and consistent.

## Update 6 — 2026-03-17

File: src/routes/health.ts  
Lines: 1-11

Change:
Added health route registration function exposing `GET /health` with service status payload.

Reason:
Task requires health endpoint in initial scaffold.

Impact:
Provides lightweight service liveness check for operations and deployment validation.

## Update 7 — 2026-03-17

File: src/app.ts  
Lines: 1-13

Change:
Implemented Fastify app factory with logger enabled and health route registration.

Reason:
Needed `src/app` bootstrap entry to compose HTTP server modules.

Impact:
Defines central application assembly point for future service/module wiring.

## Update 8 — 2026-03-17

File: src/main.ts  
Lines: 1-17

Change:
Implemented process bootstrap: load env, build app, listen on configured host/port, and fail-fast on startup errors.

Reason:
Scaffold requires executable runtime entrypoint.

Impact:
Enables controlled server startup path for production runtime.

## Update 9 — 2026-03-17

File: src/modules/planner/index.ts  
Lines: 1-9

Change:
Created planner module placeholder interface and service class with explicit not-implemented guard.

Reason:
Required module placeholder per task scope without business logic implementation.

Impact:
Reserves module boundary for scheduled planning implementation.

## Update 10 — 2026-03-17

File: src/modules/drafts/index.ts  
Lines: 1-9

Change:
Created drafts module placeholder interface and service class with explicit not-implemented guard.

Reason:
Required module placeholder per task scope without business logic implementation.

Impact:
Reserves module boundary for draft persistence/revision logic.

## Update 11 — 2026-03-17

File: src/modules/generation/index.ts  
Lines: 1-9

Change:
Created generation module placeholder interface and service class with explicit not-implemented guard.

Reason:
Required module placeholder per task scope without business logic implementation.

Impact:
Reserves module boundary for AI draft generation flow.

## Update 12 — 2026-03-17

File: src/modules/moderation/index.ts  
Lines: 1-9

Change:
Created moderation module placeholder interface and service class with explicit not-implemented guard.

Reason:
Required module placeholder per task scope without business logic implementation.

Impact:
Reserves module boundary for moderation action processing.

## Update 13 — 2026-03-17

File: src/modules/publishing/index.ts  
Lines: 1-9

Change:
Created publishing module placeholder interface and service class with explicit not-implemented guard.

Reason:
Required module placeholder per task scope without business logic implementation.

Impact:
Reserves module boundary for channel publish flow.

## Update 14 — 2026-03-17

File: src/modules/sessions/index.ts  
Lines: 1-9

Change:
Created sessions module placeholder interface and service class with explicit not-implemented guard.

Reason:
Required module placeholder per task scope without business logic implementation.

Impact:
Reserves module boundary for DB-backed session state handling.

## Update 15 — 2026-03-17

File: src/modules/telegram/index.ts  
Lines: 1-9

Change:
Created telegram module placeholder interface and service class with explicit not-implemented guard.

Reason:
Required module placeholder per task scope without business logic implementation.

Impact:
Reserves module boundary for Telegram command/callback integration.

## Update 16 — 2026-03-17

File: src/modules/sheets/index.ts  
Lines: 1-9

Change:
Created sheets module placeholder interface and service class with explicit not-implemented guard.

Reason:
Required module placeholder per task scope without business logic implementation.

Impact:
Reserves module boundary for content plan row access and updates.

## Update 17 — 2026-03-17

File: src/modules/ai/index.ts  
Lines: 1-9

Change:
Created ai module placeholder interface and service class with explicit not-implemented guard.

Reason:
Required module placeholder per task scope without business logic implementation.

Impact:
Reserves module boundary for OpenAI adapter usage.

## Update 18 — 2026-03-17

File: plan.md  
Lines: 1-41

Change:
Added concrete 10-step implementation plan aligned to specification flow, including explicit deliverables and verifiable checks per step.

Reason:
Task required creation of structured implementation plan before business logic implementation.

Impact:
Provides execution blueprint for subsequent implementation phases with testable outcomes.

## Update 19 — 2026-03-17

File: progress.md  
Lines: 1-6

Change:
Recorded completed run steps for specification analysis, plan creation, schema/scaffold setup, and placeholder module creation.

Reason:
Execution log must track atomic and verifiable completed steps.

Impact:
Creates traceable progress state for continuation runs.

## Update 20 — 2026-03-17

File: prisma/schema.prisma  
Lines: 1-110

Change:
Refined schema for integration correctness by adding indexes `@@index([status, sheetRowNumber])` on `ContentPlanItem`, `@@index([status, updatedAt])` on `Draft`, and `@@index([mode])` on `UserSession`; added `Draft.pendingInSessions` back-reference and `UserSession.pendingDraft` relation with `onDelete: SetNull`.

Reason:
Future modules require efficient lookups by status/mode and referential integrity for `WAITING_NOTES` / pending draft workflows.

Impact:
Improves queryability for planner/session modules and guarantees session draft linkage is DB-enforced.

## Update 21 — 2026-03-17

File: src/config/env.ts  
Lines: 1-34

Change:
Added `normalizeMultilineSecret` and updated `readEnv()` to normalize `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` escaped newlines (`\\n` -> newline) before zod parsing.

Reason:
Service-account private keys are commonly stored in single-line env form and must be normalized for runtime compatibility.

Impact:
Prevents startup/runtime failures caused by malformed Google private key formatting.

## Update 22 — 2026-03-17

File: src/main.ts  
Lines: 1-24

Change:
Integrated database infrastructure into bootstrap: created database module, connected before server listen, and registered Fastify `onClose` hook to disconnect Prisma cleanly.

Reason:
Database lifecycle must be explicit and safe at startup/shutdown.

Impact:
Provides production-safe DB connection management without introducing business logic.

## Update 23 — 2026-03-17

File: src/database/prisma-client.ts  
Lines: 1-5

Change:
Added Prisma client factory `createPrismaClient()`.

Reason:
Centralized client creation is required for modular database infrastructure.

Impact:
Establishes single construction point for Prisma client instantiation.

## Update 24 — 2026-03-17

File: src/database/database.module.ts  
Lines: 1-29

Change:
Added `DatabaseModule` contract and `PrismaDatabaseModule` implementation with `connect()`/`disconnect()` lifecycle methods and injectable Prisma client.

Reason:
Task requires a dedicated database module with startup-safe lifecycle control.

Impact:
Defines modular DB boundary for app bootstrap and future module composition.

## Update 25 — 2026-03-17

File: src/database/index.ts  
Lines: 1-2

Change:
Added database module barrel exports.

Reason:
Simplifies imports and preserves modular project structure.

Impact:
Stabilizes database module integration path.

## Update 26 — 2026-03-17

File: src/repositories/content-plan.repository.ts  
Lines: 1-24

Change:
Added content plan repository interface and Prisma-backed placeholder class with method contracts for pending selection and state updates.

Reason:
Repository structure is required for future database integration while keeping business logic unimplemented.

Impact:
Creates dedicated persistence boundary for planner/sheets integration.

## Update 27 — 2026-03-17

File: src/repositories/draft.repository.ts  
Lines: 1-19

Change:
Added draft repository interface and Prisma-backed placeholder class with typed draft read/status update contracts.

Reason:
Draft lifecycle module integration needs explicit repository contracts.

Impact:
Prepares persistence layer for moderation/publishing lifecycle transitions.

## Update 28 — 2026-03-17

File: src/repositories/draft-revision.repository.ts  
Lines: 1-14

Change:
Added draft revision repository interface and Prisma-backed placeholder class for revision creation contract.

Reason:
Revision history persistence must be isolated from transport and service layers.

Impact:
Prepares modular storage contract for rewrite/rewrite-notes flows.

## Update 29 — 2026-03-17

File: src/repositories/moderation-action.repository.ts  
Lines: 1-19

Change:
Added moderation action repository interface and Prisma-backed placeholder class for appending moderation events by `draftId`.

Reason:
Moderation auditing requires explicit persistence contract tied to draft identifiers.

Impact:
Prepares audit trail storage boundary for callback action processing.

## Update 30 — 2026-03-17

File: src/repositories/publication.repository.ts  
Lines: 1-18

Change:
Added publication repository interface and Prisma-backed placeholder class for publication record creation contract.

Reason:
Publishing flow requires dedicated persistence abstraction.

Impact:
Prepares DB boundary for post-publication tracking.

## Update 31 — 2026-03-17

File: src/repositories/user-session.repository.ts  
Lines: 1-24

Change:
Added user session repository interface and Prisma-backed placeholder class for get/set/clear session mode contracts.

Reason:
Session state must be persistent and DB-backed, with no in-memory workflow state.

Impact:
Prepares modular session persistence layer aligned with `IDLE`/`WAITING_ARTICLE`/`WAITING_NOTES` flow.

## Update 32 — 2026-03-17

File: src/repositories/index.ts  
Lines: 1-28

Change:
Added repository composition module with typed `Repositories` container and `createRepositories(prisma)` factory.

Reason:
Database infrastructure needs a central repository assembly point for future service wiring.

Impact:
Enables consistent DI-style repository access across modules.

## Update 33 — 2026-03-17

File: .env.example  
Lines: 1-14

Change:
Added environment template covering server, database, Telegram, Google Sheets, and OpenAI variables, including escaped-newline private-key example.

Reason:
Startup-safe configuration requires explicit variable contract for deployment/local setup.

Impact:
Reduces configuration ambiguity and aligns with normalized env handling.

## Update 34 — 2026-03-17

File: progress.md  
Lines: 1-10

Change:
Appended run execution steps for schema refinement, database module setup, repository placeholder creation, and env handling updates.

Reason:
Execution tracking requires atomic, verifiable completion records.

Impact:
Maintains traceable run history for continuation.

## Update 35 — 2026-03-17

File: src/repositories/content-plan.repository.ts  
Lines: 1-73

Change:
Replaced placeholder repository with real Prisma implementation for content-plan persistence: added `upsertFromSheetRow`, `findBySheetRowNumber`, implemented `findFirstPending`, implemented `markInReview` (with optional `draftId`) and `markPublished` updates.

Reason:
Sheets/content-plan flow needs persistent synchronization of selected sheet rows into `ContentPlanItem` records and status transitions.

Impact:
Enables DB persistence and retrieval for content-plan rows required by sheets/planner preparation.

## Update 36 — 2026-03-17

File: src/modules/sheets/google-sheets.client.ts  
Lines: 1-18

Change:
Added Google Sheets API client factory using service-account JWT auth and spreadsheet read/write scope.

Reason:
Sheets module requires explicit and reusable client setup for table read/update operations.

Impact:
Provides production-oriented Google Sheets integration entry point.

## Update 37 — 2026-03-17

File: src/modules/sheets/types.ts  
Lines: 1-12

Change:
Added typed contracts for pending content-plan row data and selected item output shape.

Reason:
Sheets flow requires explicit typed boundaries between row parsing and persistence output.

Impact:
Improves module clarity and type-safety for planner integration.

## Update 38 — 2026-03-17

File: src/modules/sheets/index.ts  
Lines: 1-178

Change:
Replaced placeholder with real `SheetsService` implementation including:
- worksheet resolution (configured worksheet title or first sheet fallback),
- row reading from Google Sheets (`A1:Z`),
- header mapping (`topic`, `rubric`, `status`),
- selection of first row with empty `status`,
- malformed-row handling (rows with empty status but missing topic/rubric),
- mapping selected row to repository upsert input,
- update of selected sheet row status cell to `IN_REVIEW`.

Reason:
Task requires concrete Google Sheets integration and content-plan access flow without scheduler/Telegram/OpenAI logic.

Impact:
Delivers end-to-end sheets read/select/mark/persist path for content-plan preparation.

## Update 39 — 2026-03-17

File: src/config/env.ts  
Lines: 1-35

Change:
Extended env schema with optional `GOOGLE_SHEETS_WORKSHEET_TITLE` to support explicit worksheet configuration while keeping existing startup-safe key normalization.

Reason:
Sheets integration needs deterministic worksheet targeting when spreadsheet contains multiple tabs.

Impact:
Improves configurability of Sheets access without changing business flow scope.

## Update 40 — 2026-03-17

File: .env.example  
Lines: 1-15

Change:
Added `GOOGLE_SHEETS_WORKSHEET_TITLE` to environment template.

Reason:
Environment contract must document worksheet configuration used by sheets module.

Impact:
Reduces setup ambiguity for Google Sheets integration.

## Update 41 — 2026-03-17

File: progress.md  
Lines: 1-16

Change:
Appended run steps for repository implementation, Sheets client integration, pending-row selection logic, malformed-row guards, persistence mapping, and `IN_REVIEW` row update.

Reason:
Execution tracking must reflect completed atomic and verifiable work in this run.

Impact:
Maintains traceable delivery history for subsequent implementation runs.

## Update 42 — 2026-03-17

File: src/repositories/draft.repository.ts  
Lines: 1-93

Change:
Replaced placeholder draft repository with real Prisma logic for this flow:
- added selection of next `ContentPlanItem` in `IN_REVIEW` with no linked draft,
- added transactional draft creation and linkage to `ContentPlanItem`,
- implemented `findById`, `updateCurrentText`, and `updateStatus` methods.

Reason:
Draft creation flow requires DB selection of source content-plan item and persistent draft linkage/state updates.

Impact:
Enables deterministic source-item selection and durable draft persistence for initial generation flow.

## Update 43 — 2026-03-17

File: src/repositories/draft-revision.repository.ts  
Lines: 1-41

Change:
Replaced placeholder revision repository with real Prisma logic:
- implemented `createInitialRevision` (revision `1`),
- implemented `createRevision` with transactionally computed next revision number.

Reason:
Initial generation flow requires persistent revision history creation for each produced draft text.

Impact:
Provides auditable and incrementing draft revision storage.

## Update 44 — 2026-03-17

File: src/modules/generation/index.ts  
Lines: 1-43

Change:
Replaced generation placeholder with real generation service boundary:
- added `AiGenerationPort` interface (`complete(prompt)`),
- added `generateInitialDraftText` method,
- added temporary neutral prompt builder marked `TEMPORARY_PROMPT_V1`,
- added empty-output guard.

Reason:
Flow requires modular generation logic isolated from direct OpenAI invocation and temporary prompt fallback when style rules are missing.

Impact:
Establishes clean AI service boundary and safe initial-text generation contract.

## Update 45 — 2026-03-17

File: src/modules/drafts/index.ts  
Lines: 1-55

Change:
Replaced drafts placeholder with orchestration flow that:
- selects next `IN_REVIEW` content-plan item from DB,
- calls generation module for initial text,
- creates linked draft with persisted `currentText`,
- creates first draft revision,
- returns created IDs.
Also added generation-error wrapping indicating no draft persistence on generation failure.

Reason:
Task requires implementation of draft creation + initial generation persistence flow only, without Telegram/moderation/publish/scheduler logic.

Impact:
Delivers modular core path from content-plan item to first persisted draft/revision.

## Update 46 — 2026-03-17

File: progress.md  
Lines: 1-21

Change:
Appended execution steps for draft repository implementation, generation module service boundary, draft orchestration flow, first revision persistence, and generation-failure handling.

Reason:
Run progress must be tracked in atomic and verifiable completed steps.

Impact:
Maintains traceable execution history for subsequent module implementation runs.

## Update 47 — 2026-03-17

File: src/repositories/content-plan.repository.ts  
Lines: 1-80

Change:
Extended content-plan repository with `findByDraftId(draftId)` and implemented it via Prisma lookup.

Reason:
Publish flow requires mapping published draft back to linked content-plan row for DB + Google Sheets `PUBLISHED` synchronization.

Impact:
Enables downstream publishing module to finalize content-plan state correctly.

## Update 48 — 2026-03-17

File: src/repositories/moderation-action.repository.ts  
Lines: 1-25

Change:
Replaced placeholder `appendAction` with real Prisma create operation including optional notes persistence.

Reason:
Moderation actions (`approve`, `rewrite`, `rewrite_notes`) must be stored and tied to `draftId`.

Impact:
Provides persistent moderation audit trail.

## Update 49 — 2026-03-17

File: src/repositories/publication.repository.ts  
Lines: 1-23

Change:
Replaced placeholder `createPublication` with real Prisma create operation for channel publication records.

Reason:
Publish flow needs durable publication tracking (`chatId`, `messageId`, `draftId`).

Impact:
Enables persisted publication entity required by specification.

## Update 50 — 2026-03-17

File: src/repositories/user-session.repository.ts  
Lines: 1-46

Change:
Replaced placeholders with DB-backed implementations for `getByUserId`, `setMode`, and `clearMode` using Prisma upserts; removed any in-memory session dependence.

Reason:
Session modes must be persistent (`IDLE`, `WAITING_ARTICLE`, `WAITING_NOTES`) and durable across updates.

Impact:
Delivers production-safe session state persistence.

## Update 51 — 2026-03-17

File: src/modules/sessions/index.ts  
Lines: 1-49

Change:
Replaced placeholder sessions module with real service layer over repository: `getSession`, `setWaitingArticle`, `setWaitingNotes`, `clearSession`.

Reason:
Telegram moderation/upload flows require centralized session mode transitions via DB.

Impact:
Adds reusable session orchestration boundary for telegram/moderation modules.

## Update 52 — 2026-03-17

File: src/modules/ai/index.ts  
Lines: 1-35

Change:
Replaced placeholder with OpenAI-backed implementation:
- `AiModule.complete(prompt)` interface,
- `OpenAiService` using OpenAI Responses API,
- `createAiModuleFromEnv` factory with optional model override.

Reason:
Generation flow requires isolated AI call boundary with production-oriented client setup.

Impact:
Enables generation module to call AI through a clean interface.

## Update 53 — 2026-03-17

File: src/config/env.ts  
Lines: 1-36

Change:
Extended environment schema with optional `OPENAI_MODEL` while preserving private-key normalization behavior.

Reason:
AI module factory needs configurable model selection without hard-coding runtime model.

Impact:
Improves deploy-time configurability for generation behavior.

## Update 54 — 2026-03-17

File: .env.example  
Lines: 1-16

Change:
Added `OPENAI_MODEL` example variable (`gpt-4o-mini`).

Reason:
Environment template must reflect current runtime contract.

Impact:
Reduces configuration drift between code and deployment env.

## Update 55 — 2026-03-17

File: src/modules/generation/index.ts  
Lines: 1-91

Change:
Extended generation module with full draft-text operations behind AI port:
- initial generation from topic/rubric,
- rewrite generation with optional notes,
- manual article adaptation,
- non-empty output guard.
Used temporary neutral prompts marked `TEMPORARY_PROMPT_V1`.

Reason:
Style rule corpus is not yet provided, but generation flow must be operational and explicitly marked temporary.

Impact:
Provides modular generation contract for scheduled and manual flows.

## Update 56 — 2026-03-17

File: src/repositories/draft.repository.ts  
Lines: 1-107

Change:
Extended draft repository with:
- `createStandaloneDraft` for manual uploads,
- implemented `findById`, `updateCurrentText`, `updateStatus`,
- transactional linked-draft creation and `IN_REVIEW` content-plan linkage,
- selection of next `IN_REVIEW` content-plan candidate without linked draft.

Reason:
Draft lifecycle requires both scheduled and manual draft persistence paths.

Impact:
Enables complete draft storage and status mutation operations.

## Update 57 — 2026-03-17

File: src/repositories/draft-revision.repository.ts  
Lines: 1-41

Change:
Implemented revision persistence methods:
- initial revision with fixed revision number `1`,
- generic revision insertion with transactional next-number calculation.

Reason:
Draft lifecycle must maintain revision history for initial generation and rewrites.

Impact:
Adds persistent, ordered draft revision tracking.

## Update 58 — 2026-03-17

File: src/modules/drafts/index.ts  
Lines: 1-81

Change:
Extended drafts module with full creation/edit operations:
- scheduled draft creation from next `IN_REVIEW` content-plan item,
- draft rewrite flow with revision append,
- manual article adaptation into draft + initial revision.

Reason:
Required to implement initial generation and rewrite/manual draft creation flows.

Impact:
Provides core draft domain orchestration independent of transport layer.

## Update 59 — 2026-03-17

File: src/modules/sheets/index.ts  
Lines: 1-211

Change:
Extended sheets module with `markSheetRowPublished(sheetRowNumber)` and status-column resolution for publish finalization.

Reason:
Specification requires content-plan row marking as `PUBLISHED` during publish flow.

Impact:
Completes Sheets integration for both `IN_REVIEW` and `PUBLISHED` transitions.

## Update 60 — 2026-03-17

File: src/modules/publishing/index.ts  
Lines: 1-55

Change:
Replaced placeholder with publishing service that:
- validates draft exists and is `APPROVED`,
- publishes text to Telegram channel via transport port,
- persists `Publication`,
- marks draft as `PUBLISHED`,
- marks linked content-plan item as `PUBLISHED` in DB and Google Sheets.

Reason:
Publish flow must close lifecycle and synchronize DB + Sheets state.

Impact:
Implements end-state transition `APPROVED -> PUBLISHED` with persistence.

## Update 61 — 2026-03-17

File: src/modules/moderation/index.ts  
Lines: 1-85

Change:
Replaced placeholder with moderation service implementing:
- enqueue draft to moderator chats,
- `approve`, `rewrite`, `rewrite_notes` actions,
- rewrite-notes submission flow via session state,
- manual upload article processing and moderation enqueue,
- moderation action persistence tied to `draftId`.

Reason:
Moderation flow is required core business path before publication.

Impact:
Delivers actionable moderation orchestration and audit logging.

## Update 62 — 2026-03-17

File: src/modules/planner/index.ts  
Lines: 1-99

Change:
Replaced placeholder with planner orchestration and scheduler:
- orchestrates sheets pick -> draft creation -> moderation enqueue,
- scheduler triggers at 09:00, 15:00, 21:00 Europe/Moscow,
- deduplicates same scheduled run key.

Reason:
Scheduled generation flow is required by project specification.

Impact:
Enables autonomous planned content processing ticks.

## Update 63 — 2026-03-17

File: src/modules/telegram/index.ts  
Lines: 1-193

Change:
Replaced placeholder with Telegram integration service:
- bot startup/shutdown,
- outbound moderation delivery with inline callbacks,
- outbound channel publish method,
- callback handling for `approve`, `rewrite`, `rewrite_notes`,
- `/upload` and text handling for `WAITING_ARTICLE` and `WAITING_NOTES`,
- `cancel` session clearing,
- handler routing delegated to session/moderation services.

Reason:
Telegram is required transport for moderation workflow and manual upload command flow.

Impact:
Implements transport layer bindings for inbound/outbound Telegram interactions.

## Update 64 — 2026-03-17

File: src/main.ts  
Lines: 1-64

Change:
Reworked application bootstrap wiring:
- compose repositories and all functional modules (`ai`, `generation`, `drafts`, `sessions`, `sheets`, `telegram`, `publishing`, `moderation`, `planner`),
- bind moderation module into telegram service,
- start telegram + planner on startup,
- stop planner + telegram + database on app close.

Reason:
Full end-to-end runtime assembly is required to execute specified flows.

Impact:
Provides production-oriented module composition and lifecycle management.

## Update 65 — 2026-03-17

File: progress.md  
Lines: 1-32

Change:
Appended completed and blocked run steps for full-flow implementation and recorded local typecheck limitation (`npm` missing).

Reason:
Execution log must remain atomic, verifiable, and transparent for current environment constraints.

Impact:
Preserves complete traceability of delivered scope and verification gap.

## Update 66 — 2026-03-17

File: src/repositories/draft.repository.ts  
Lines: 1-123

Change:
Added `findInReviewContentPlanItemById(contentPlanItemId)` and implemented filtered lookup (`id`, `status=IN_REVIEW`, `draftId=null`) to support deterministic draft generation for a конкретный выбранный пункт контент-плана.

Reason:
Planner previously selected a row in Sheets, but draft generation could target another `IN_REVIEW` row from DB.

Impact:
Ensures draft creation is bound to the exact item selected by Sheets flow.

## Update 67 — 2026-03-17

File: src/modules/drafts/index.ts  
Lines: 1-93

Change:
Added `createInitialDraftFromContentPlanItem(contentPlanItemId)` and internalized shared candidate handling in `createInitialDraftFromCandidate`.

Reason:
Needed explicit orchestration entrypoint for planner to generate from a specific selected item.

Impact:
Eliminates planner-to-drafts mismatch for scheduled generation flow.

## Update 68 — 2026-03-17

File: src/modules/planner/index.ts  
Lines: 1-102

Change:
Refined planner scheduling and target selection:
- switched draft creation to `createInitialDraftFromContentPlanItem(pickedItem.contentPlanItemId)`,
- added `SCHEDULE_MINUTE_WINDOW=5` (0-4 minute trigger window),
- added immediate `handleScheduleTick()` call on `start()`.

Reason:
Fixes two issues: generating wrong item and missed schedule slots due minute-boundary polling drift.

Impact:
Planner now processes the intended row and is resilient to startup/poll timing offsets around scheduled hours.

## Update 69 — 2026-03-17

File: src/modules/sheets/index.ts  
Lines: 1-219

Change:
Changed `IN_REVIEW` sync order to reduce divergence:
- persist `IN_REVIEW` state in DB first,
- then update Google Sheets,
- on Sheets failure, rollback DB state via `markPending(contentPlanItem.id)` and rethrow explicit error.

Reason:
Previous order updated Sheets before DB, causing mismatch if DB persistence failed.

Impact:
Adds compensation path and reduces inconsistent DB/Sheets states during row pickup.

## Update 70 — 2026-03-17

File: src/modules/publishing/index.ts  
Lines: 1-71

Change:
Reworked publish flow for safer cross-system consistency:
- extended transport contract with `deleteFromChannel(chatId, messageId)`,
- after publish, persist DB state via single transactional repository method,
- on DB persistence failure, delete published Telegram message,
- on Sheets `PUBLISHED` failure, rollback DB publish state and delete Telegram message.

Reason:
Previous flow could leave partial published state across Telegram/DB/Sheets.

Impact:
Introduces compensating rollback behavior and transactional DB finalization to minimize partial publish outcomes.

## Update 71 — 2026-03-17

File: src/repositories/publication.repository.ts  
Lines: 1-99

Change:
Extended repository with:
- `recordPublishedDraftState(...)` transactional finalization (`Publication` create + `Draft` status `PUBLISHED` + linked `ContentPlanItem` status update),
- `rollbackPublishedDraftState(draftId)` transactional rollback (`Publication` delete + `Draft` back to `APPROVED` + linked `ContentPlanItem` back to `IN_REVIEW`).

Reason:
Publish flow needs atomic DB-state transitions and explicit rollback path for external sync failures.

Impact:
Provides robust persistence semantics for publish finalization.

## Update 72 — 2026-03-17

File: src/modules/telegram/index.ts  
Lines: 1-197

Change:
Added `deleteFromChannel(chatId, messageId)` using Telegram `deleteMessage` API to support publish rollback compensation.

Reason:
Publishing service now requires transport-level rollback of already-sent channel posts when persistence/sheets finalization fails.

Impact:
Enables compensating message deletion in failed publish transactions.

## Update 73 — 2026-03-17

File: src/main.ts  
Lines: 1-63

Change:
Adjusted `PublishingService` wiring to updated constructor signature (removed direct `contentPlanRepository` dependency).

Reason:
Publishing finalization/rollback logic moved into `PublicationRepository` transactional methods.

Impact:
Keeps runtime dependency graph aligned with new publish consistency design.

## Update 74 — 2026-03-17

File: progress.md  
Lines: 1-36

Change:
Appended completion steps for planner correctness, schedule-window hardening, Sheets/DB compensation, and publish rollback behavior.

Reason:
Execution log must capture this correction pass as atomic verified actions.

Impact:
Maintains traceable corrective history for quality/stability improvements.

## Update 75 — 2026-03-19

File: .env  
Lines: 1-16

Change:
Created root environment file `.env` with required runtime keys and placeholders for database, Telegram, Google Sheets, and OpenAI configuration.

Reason:
Runtime startup requires local env file placement so secrets can be filled and loaded by `dotenv`.

Impact:
Project is ready for secret injection without further env file setup steps.

## Update 76 — 2026-03-19

File: progress.md  
Lines: 1-37

Change:
Appended completion step for `.env` creation.

Reason:
Execution tracking must reflect each meaningful completed action.

Impact:
Maintains traceable run history.

## Update 77 — 2026-03-19

File: src/modules/telegram/index.ts  
Lines: 1-207

Change:
Refactored callback-query handling to be timeout-safe:
- added immediate callback acknowledgement (`Processing...`) before long moderation operations,
- moved user-visible success notifications to `ctx.reply(...)` after operation completion,
- added `safeAnswerCbQuery(...)` helper that suppresses stale/invalid callback acknowledgement errors,
- prevented callback errors from propagating into process-level failure path.

Reason:
Telegram returned `400: query is too old and response timeout expired or query ID is invalid` when callback acknowledgement happened too late, causing unstable behavior on repeated button presses.

Impact:
Button actions (`Approve`, `Rewrite`, `Rewrite with Notes`) now remain stable for long-running operations and no longer fail due to delayed callback acknowledgements.

## Update 78 — 2026-03-19

File: progress.md  
Lines: 1-39

Change:
Appended completion steps for Telegram callback timeout stabilization and post-fix typecheck verification.

Reason:
Execution tracking protocol requires logging each meaningful implementation and verification step.

Impact:
Keeps progress history complete and auditable.

## Update 79 — 2026-03-19

File: progress.md  
Lines: 1-41

Change:
Appended two execution-log steps for:
- full local integrity verification (`npm run typecheck`, `npm run build`, `npx prisma validate`),
- static audit of end-to-end flow logic with explicit defect finding collection.

Reason:
Current task required verification that the system works as intended and identification of latent errors; progress protocol requires traceable atomic records for each meaningful verification stage.

Impact:
Adds auditable evidence of runtime/tooling checks and architecture-level review pass without changing production logic.

## Update 80 — 2026-03-19

File: src/modules/moderation/index.ts  
Lines: 42-112

Change:
Added explicit draft-status guards for moderation actions:
- `approveDraft` now loads draft and rejects `PUBLISHED`, allows transition from `IN_REVIEW` to `APPROVED`, and allows republish attempt only from `APPROVED`,
- `rewriteDraft` now validates target draft is `IN_REVIEW`,
- `requestRewriteNotes` now validates target draft is `IN_REVIEW`,
- introduced `ensureDraftInReview(...)` helper for shared validation.

Reason:
Static audit выявил некорректные переходы статусов: повторный `approve` мог переводить уже `PUBLISHED` драфт обратно в `APPROVED` и запускать повторную публикацию; `rewrite_notes` мог открываться для невалидного `draftId`.

Impact:
Предотвращены разрушающие повторные approve-пути и ранняя валидация исключает невалидные сессии rewrite-notes.

## Update 81 — 2026-03-19

File: src/modules/planner/index.ts  
Lines: 1-111

Change:
Added persisted scheduler run-key state:
- introduced planner state file path `.planner-state.json`,
- added startup load (`ensureStateLoaded`) and write-back (`persistLastRunKey`) of `lastRunKey`,
- persisted run key before slot execution,
- wrapped startup/interval tick execution with explicit error logging.

Reason:
Static audit выявил риск повторного выполнения одного и того же временного слота после рестарта процесса из-за in-memory-only `lastRunKey`.

Impact:
Планировщик теперь сохраняет последний выполненный слот между рестартами и не запускает повторный тик в том же окне времени.

## Update 82 — 2026-03-19

File: progress.md  
Lines: 1-44

Change:
Appended execution-log steps for moderation-state fix, planner persisted slot-key fix, and post-fix verification (`npm run typecheck`, `npm run build`).

Reason:
Execution protocol requires atomic/testable tracking for each completed correction and verification action.

Impact:
Maintains full audit trail for this bug-fix pass.

## Update 83 — 2026-03-19

File: prisma/schema.prisma  
Lines: 5-9

Change:
Extended datasource configuration with `directUrl = env("DIRECT_URL")` while keeping pooled runtime URL in `url = env("DATABASE_URL")`.

Reason:
Supabase + Prisma setup requires split connection strategy: pooled endpoint for runtime queries and direct endpoint for direct-engine operations.

Impact:
Makes Prisma datasource compatible with standard Supabase pooled/direct topology and reduces connection-mode mismatch risk.

## Update 84 — 2026-03-19

File: .env.example  
Lines: 4-5

Change:
Replaced local-postgres placeholder with Supabase-ready template variables:
- `DATABASE_URL` with pooler host/port and `pgbouncer=true&connection_limit=1&sslmode=require`,
- `DIRECT_URL` with direct host/port `5432` and `sslmode=require`.

Reason:
Current runtime target is Supabase, and prior template did not expose required split URLs for Prisma reliability.

Impact:
New environments can be configured correctly from template without additional manual guesswork.

## Update 85 — 2026-03-19

File: progress.md  
Lines: 1-46

Change:
Appended execution-log steps for Supabase datasource/env correction and post-change validation (`npx prisma validate`, `npm run typecheck`, `npm run build`).

Reason:
Execution protocol requires atomic, testable tracking for configuration remediation and verification.

Impact:
Preserves complete audit trail for this connectivity-fix pass.

## Update 86 — 2026-03-20

File: .env  
Lines: 4

Change:
Corrected malformed database DSN assignment:
- replaced invalid `DATABASE_URL=DIRECT_URL=...` with valid pooled Prisma runtime URL,
- restored Supabase pooler query parameters `pgbouncer=true&connection_limit=1&sslmode=require`.

Reason:
`manual-tick.ts` failed with Prisma `P1012` because `DATABASE_URL` no longer started with a valid `postgresql://` protocol due to accidental concatenation of two env keys.

Impact:
Runtime datasource parsing is restored; Prisma client can initialize against pooled Supabase URL.

## Update 87 — 2026-03-20

File: progress.md  
Lines: 1-48

Change:
Appended execution-log steps for `.env` DSN correction and post-fix env-line verification.

Reason:
Execution protocol requires traceable logging for each meaningful correction and validation action.

Impact:
Maintains complete auditable history for connectivity troubleshooting pass.

## Update 88 — 2026-03-20

File: .env  
Lines: 4-5

Change:
Normalized runtime DB URLs for Supabase pooler:
- ensured `DATABASE_URL` includes `pgbouncer=true&connection_limit=1&sslmode=require`,
- set `DIRECT_URL` to the same reachable pooler endpoint to avoid failing direct-host route in current network.

Reason:
Observed repeated `P1001` on direct host (`db.<project-ref>.supabase.co:5432`) and intermittent prepared statement collisions without explicit pooler flags.

Impact:
Stabilizes Prisma runtime connectivity in the current environment where direct host is unreachable.

## Update 89 — 2026-03-20

File: src/database/prisma-client.ts  
Lines: 1-45

Change:
Added defensive Supabase pooler URL normalization at Prisma client construction:
- if host ends with `.pooler.supabase.com`, automatically enforces `pgbouncer=true`, `connection_limit=1`, `sslmode=require`,
- injects normalized datasource URL into `PrismaClient` options,
- safely falls back for empty/invalid URL parsing.

Reason:
Prevent recurring outages caused by accidental `.env` edits that remove required pooler query params.

Impact:
Reduces configuration fragility and prevents known `prepared statement "s0" already exists` class of failures in pooled mode.

## Update 90 — 2026-03-20

File: progress.md  
Lines: 1-51

Change:
Appended execution-log steps for `.env` re-normalization, Prisma client hardening, and post-fix verification.

Reason:
Execution protocol requires atomic traceability for each corrective action and validation run.

Impact:
Maintains auditable repair history for this incident.

## Update 91 — 2026-03-20

File: src/repositories/content-plan.repository.ts  
Lines: 24-37

Change:
Adjusted `upsertFromSheetRow(...)` to clear stale draft linkage when row is transitioned to `IN_REVIEW`:
- introduced `shouldResetDraftLink = input.status === 'IN_REVIEW'`,
- applied `draftId: null` on both `create` and `update` paths when this condition is true.

Reason:
After manual clearing of Google Sheets `status`, DB row could remain linked to an old `draftId`, causing draft creation path to return `null` and silently skip Telegram moderation delivery.

Impact:
Re-queued rows from Sheets now generate a fresh draft and can be sent to moderator chats again.

## Update 92 — 2026-03-20

File: src/modules/planner/index.ts  
Lines: 66-71

Change:
Replaced silent `return` when `createInitialDraftFromContentPlanItem(...)` returns `null` with explicit thrown error including `contentPlanItemId` context.

Reason:
Previous behavior printed `manual planner tick done` even when no draft was created and no Telegram message was sent, making operational debugging misleading.

Impact:
Planner now surfaces inconsistent state immediately instead of silently finishing.

## Update 93 — 2026-03-20

File: progress.md  
Lines: 1-54

Change:
Appended execution-log steps for stale draft-link fix, planner visibility fix, and post-change verification.

Reason:
Execution protocol requires atomic traceability for each corrective and verification action.

Impact:
Preserves complete incident-level audit history.

## Update 94 — 2026-03-20

File: src/modules/generation/index.ts  
Lines: 44-96

Change:
Replaced the initial scheduled-draft prompt template (`buildTemporaryNeutralPrompt`) with the provided production prompt for dog-focused Telegram copywriting:
- added explicit role and task framing,
- mapped runtime input fields to prompt variables (`Тема поста` <- `topic`, `Тип поста` <- `rubric`),
- encoded required structure (hook/main/involvement/CTA), style constraints, format constraints, depth requirements, and health-advice disclaimer rule,
- preserved final output instruction as ready-to-publish Telegram post.

Reason:
User requested to switch the initial-generation prompt to a specific editorial template.

Impact:
All newly generated scheduled drafts now follow the new channel writing style and structure requirements.

## Update 95 — 2026-03-20

File: progress.md  
Lines: 1-56

Change:
Appended execution-log steps for prompt replacement and post-change verification.

Reason:
Execution protocol requires atomic tracking for each meaningful implementation and validation step.

Impact:
Maintains complete and auditable change history for editorial prompt updates.

## Update 96 — 2026-03-20

File: src/modules/generation/index.ts  
Lines: 64-155

Change:
Extended generation constraints and post-processing for text formatting/content hygiene:
- added explicit prompt constraints prohibiting markdown formatting (`###`, `**`, `*`, `__`, list markers),
- added explicit prohibition of future-post references (e.g. “в следующем посте”) in initial/rewrite/manual prompts,
- introduced `normalizeGeneratedText(...)` and routed all generation output through it,
- normalization removes heading/bold/italic markdown markers and drops lines containing references to “следующий пост”.

Reason:
Generated posts included markdown tokens and speculative CTA about future posts, which are not acceptable for direct Telegram publication in current workflow.

Impact:
Drafts are now cleaned from markdown artifacts and forbidden future-post phrasing before persistence and moderation delivery.

## Update 97 — 2026-03-20

File: progress.md  
Lines: 1-58

Change:
Appended execution-log steps for prompt-constraint update, output normalization hardening, and post-fix verification.

Reason:
Execution protocol requires atomic and verifiable tracking of each behavior correction.

Impact:
Keeps change history complete for this output-quality fix.

## Update 98 — 2026-03-20

File: src/modules/telegram/index.ts  
Lines: 74-231

Change:
Improved Telegram runtime error containment:
- wrapped `/upload` handler in `try/catch` with safe user-facing error reply,
- moved entire text-message processing path (including `getSession`) inside `try/catch`,
- replaced direct `ctx.reply(...)` in catch-path with `safeReply(...)` to prevent secondary reply failures,
- added global `bot.catch(...)` logging for uncaught middleware errors with `updateId` context,
- added `safeReply(...)` helper with internal error logging.

Reason:
Observed `Unhandled error while processing` during `rewrite_notes` flow when upstream calls failed (DB/network), causing missing bot responses and unstable behavior.

Impact:
Telegram handlers now fail gracefully and log structured context instead of surfacing unhandled middleware exceptions.

## Update 99 — 2026-03-20

File: progress.md  
Lines: 1-60

Change:
Appended execution-log steps for Telegram error-handling hardening and post-change verification.

Reason:
Execution protocol requires atomic, testable tracking for each behavioral fix and verification pass.

Impact:
Maintains complete auditability for this runtime stability correction.

## Update 100 — 2026-03-20

File: prisma/schema.prisma  
Lines: 5-9

Change:
Unified datasource routing by setting:
- `url = env("DATABASE_URL")`
- `directUrl = env("DATABASE_URL")`

Reason:
User requested elimination of implicit pooler/direct switching behavior; single DSN path removes mode divergence between runtime and Prisma-direct operations.

Impact:
All Prisma paths now consistently target one configured connection endpoint.

## Update 101 — 2026-03-20

File: .env, .env.example, progress.md  
Lines: `.env` (4), `.env.example` (4), `progress.md` (1-62)

Change:
- removed `DIRECT_URL` from local `.env`,
- removed `DIRECT_URL` template line from `.env.example`,
- logged corresponding execution steps and validation checks.

Reason:
With unified datasource routing, separate direct URL is no longer needed and can reintroduce accidental endpoint drift.

Impact:
Configuration is simplified and less error-prone; validation/build remain green.

## Update 102 — 2026-03-24

File: .gitignore, progress.md  
Lines: `.gitignore` (1-8), `progress.md` (1-64)

Change:
- Added root `.gitignore` with explicit exclusions for secrets/runtime artifacts: `.env`, `.env.local`, `.env.*.local`, `node_modules/`, `dist/`, `.DS_Store`, `.planner-state.json`, `*.log`.
- Logged secret scan and repository-hardening steps in `progress.md`.

Reason:
User requested removal/prevention of secret exposure outside `.env`; repository previously had no `.gitignore`, creating high accidental-commit risk for credentials.

Impact:
Prevents future secret leakage via commits and keeps runtime/generated files out of version control.

## Update 103 — 2026-03-31

File: src/config/env.ts, src/modules/ai/index.ts, .env.example  
Lines: `src/config/env.ts` (10-44), `src/modules/ai/index.ts` (1-84), `.env.example` (15-18)

Change:
- Added AI proxy environment variables (`AI_PROXY_URL`, `AI_PROXY_SECRET`) and validation rules that require proxy secret when proxy URL is set, otherwise enforce direct OpenAI key.
- Implemented `ProxyAiService` that signs requests with HMAC and calls the EU AI proxy endpoint.
- Updated AI module factory to choose proxy when configured and documented proxy envs in `.env.example`.

Reason:
Direct OpenAI calls from the current region are blocked; routing the AI request through an EU microservice is required to restore functionality.

Impact:
AI generation can be served via the EU proxy while keeping the rest of the backend unchanged; configuration remains explicit and validated.

## Update 104 — 2026-03-31

File: src/modules/planner/index.ts, src/modules/telegram/index.ts, src/main.ts  
Lines: `src/modules/planner/index.ts` (76-97), `src/modules/telegram/index.ts` (3-214), `src/main.ts` (21-54)

Change:
- Added planner tick logging to surface scheduler activity in runtime logs.
- Added `/tick` Telegram command to trigger a manual planning tick on demand.
- Bound planner module into Telegram service wiring for the new command.

Reason:
We need a manual trigger and visibility to diagnose schedule execution when no automated tick is observed.

Impact:
Operators can validate scheduling immediately and debug state issues without waiting for the next scheduled window.

## Update 105 — 2026-04-03

File: src/main.ts  
Lines: `src/main.ts` (15-58)

Change:
Added explicit startup logs for app bootstrap, Telegram bot start, planner start, and HTTP server listening.

Reason:
We need clear runtime signals that the main process reaches planner start and that stdout logging is functioning under PM2.

Impact:
Improves observability of startup path and helps diagnose why scheduler logs are missing.

## Update 106 — 2026-04-03

File: src/main.ts  
Lines: `src/main.ts` (15-58)

Change:
Added granular startup logs around env load, database connect, and Telegram bot launch.

Reason:
We need to identify whether startup is hanging before the planner starts (DB connect or bot launch).

Impact:
Makes the exact startup stall point visible in PM2 logs.

## Update 107 — 2026-04-03

File: src/main.ts  
Lines: `src/main.ts` (33-73)

Change:
Wrapped Telegram bot startup in a 15s timeout and allowed the planner to start even if Telegram startup hangs.

Reason:
Scheduler never started because the process blocked on Telegram startup; we need scheduling to proceed while troubleshooting Telegram connectivity.

Impact:
Planner now runs on schedule even if Telegram launch stalls; logs explicitly note the timeout.

## Update 108 — 2026-04-10

File: src/modules/generation/index.ts  
Lines: `src/modules/generation/index.ts` (48-197)

Change:
Replaced the initial-draft prompt with the provided Telegram dog-niche prompt template and mapped known inputs (topic, rubric) while leaving other fields as "не указана/нет".

Reason:
User requested a new primary prompt specification for initial draft generation.

Impact:
Generated drafts now follow the updated style and rule set for the channel.

## Update 109 — 2026-04-10

File: src/modules/generation/index.ts  
Lines: `src/modules/generation/index.ts` (62-120)

Change:
Refined the main prompt to align with the latest user-specified rules, including explicit “no blank lines between paragraphs” instruction.

Reason:
User provided an updated prompt specification and requested replacement.

Impact:
Initial draft generation now follows the revised formatting and constraint rules.

## Update 110 — 2026-04-11

File: src/modules/generation/index.ts  
Lines: `src/modules/generation/index.ts` (48-246)

Change:
Replaced the main prompt with the latest “strong Telegram copywriter” specification and appended the provided example outputs to the prompt.

Reason:
User requested another replacement of the primary prompt and asked to embed example texts as output references.

Impact:
Initial draft generation now follows the newest style rubric and has explicit exemplar guidance.

## Update 111 — 2026-04-11

File: src/modules/generation/index.ts  
Lines: `src/modules/generation/index.ts` (31-220)

Change:
- Added output normalization to remove empty lines between paragraphs.
- Strengthened prompt constraints to avoid inventing off-topic details and enforced no double line breaks.

Reason:
Generated drafts were not matching the required example style and were introducing unintended details.

Impact:
Outputs now preserve the requested paragraph format and adhere more strictly to input-only details.

## Update 112 — 2026-04-11

File: src/modules/generation/index.ts  
Lines: `src/modules/generation/index.ts` (88-156)

Change:
Explicitly required each paragraph to start on a new line while still forbidding blank lines between paragraphs.

Reason:
Telegram output was collapsing into a single block; the prompt needed an explicit newline-per-paragraph instruction.

Impact:
Model guidance now reinforces single line breaks between paragraphs without empty lines.

## Update 113 — 2026-04-11

File: src/modules/planner/index.ts  
Lines: `src/modules/planner/index.ts` (8-12)

Change:
Adjusted scheduled planner hours to run at 09:00 and 17:00 Moscow time only.

Reason:
User requested two daily runs at 09:00 and 17:00 MSK instead of three.

Impact:
Automatic draft generation now triggers twice per day at the new times.

## Update 114 — 2026-04-11

File: src/modules/telegram/index.ts, package.json, package-lock.json  
Lines: `src/modules/telegram/index.ts` (1-260), `package.json` (dependencies), `package-lock.json` (pdf-parse)

Change:
- Added PDF upload handling for `/upload`, including file download, size limit, and text extraction via `pdf-parse`.
- Added `pdf-parse` runtime dependency and TypeScript types.
- Updated `/upload` prompt to accept PDF files.

Reason:
User requested support for uploading a PDF and rewriting its contents via the existing prompt flow.

Impact:
Manual uploads now accept PDF files and convert them into draft text for moderation.

## Update 115 — 2026-04-11

File: src/modules/generation/index.ts  
Lines: `src/modules/generation/index.ts` (206-330)

Change:
Replaced the /upload (manual adaptation) prompt with the provided editorial system prompt for adapting source texts and PDFs into Telegram posts.

Reason:
User requested a dedicated /upload prompt that preserves all important details from the source text while adapting for Telegram format.

Impact:
Manual uploads now use the specified adaptation rules and structure.

## Update 116 — 2026-04-11

File: src/modules/telegram/index.ts  
Lines: `src/modules/telegram/index.ts` (11-120)

Change:
Raised PDF upload size limit from 5 MB to 25 MB.

Reason:
User requested larger PDFs for /upload.

Impact:
Manual uploads can now accept larger PDF files.

## Update 117 — 2026-04-11

File: src/modules/telegram/index.ts  
Lines: `src/modules/telegram/index.ts` (1-140)

Change:
Adjusted pdf-parse import and invocation to handle CommonJS default export correctly in the compiled runtime.

Reason:
PDF parsing failed at runtime with “default is not a function”.

Impact:
PDF uploads should now parse correctly on the server.

## Update 118 — 2026-04-11

File: src/modules/telegram/index.ts  
Lines: `src/modules/telegram/index.ts` (1-140)

Change:
Switched pdf-parse loading to `createRequire` to reliably access the CommonJS export at runtime.

Reason:
Previous import resolution still returned a non-callable module in production.

Impact:
PDF parsing now uses the correct function export.

## Update 119 — 2026-04-11

File: progress.md  
Lines: 82–83  

Change:
Added steps documenting CODEX authority re-check and repository search for server connection command references.

Reason:
Maintain traceable execution log for the current request per AGENTS.md.

Impact:
Keeps progress tracking auditable and up to date.

## Update 120 — 2026-04-11

File: progress.md  
Lines: 84–85  

Change:
Logged git status check and recorded need for guidance due to unstaged src-module changes.

Reason:
AGENTS.md requires traceable execution steps and explicit pause when unexpected changes are present.

Impact:
Prevents accidental overwrite of existing unreviewed changes before verification runs.

## Update 121 — 2026-04-11

File: progress.md  
Lines: 86–87  

Change:
Logged diff-scope review for publish and recorded missing GitHub CLI blocker.

Reason:
AGENTS.md requires execution steps and explicit blockers to be traceable.

Impact:
Publication flow is paused until gh is installed and authenticated.

## Update 122 — 2026-04-11

File: src/modules/telegram/index.ts  
Lines: `src/modules/telegram/index.ts` (1-380)

Change:
Removed `createRequire(import.meta.url)` usage and introduced cached PDF parser loader:
- added `pdfParserPromise` cache on `TelegramService`,
- added `getPdfParser()` method,
- added `loadPdfParser()` with dynamic import,
- added `unwrapDefaultExport()` to normalize CommonJS/ESM default nesting before invocation.

Reason:
Build/runtime mismatch: `import.meta` is rejected in CommonJS output and prior module shape caused `parser is not a function`.

Impact:
`/upload` PDF parsing now resolves parser function robustly across interop modes and no longer depends on `import.meta`.

## Update 123 — 2026-04-11

File: progress.md  
Lines: 88–90  

Change:
Logged issue isolation, Telegram module parser-loader fix, and post-fix verification results.

Reason:
Maintain mandatory traceability for each meaningful execution step.

Impact:
Execution log reflects the current fix and successful local validation.

## Update 124 — 2026-04-11

File: src/modules/telegram/index.ts  
Lines: `src/modules/telegram/index.ts` (1-420)

Change:
Migrated PDF parsing from function-style invocation to `pdf-parse` v2 class API:
- replaced cached parser-function loader with cached `PDFParse` class loader,
- resolved class export via interop-safe `PDFParse` lookup across nested default wrappers,
- switched PDF extraction path to `new PDFParse({ data: buffer })` + `getText()` + `destroy()`,
- corrected upload size-limit message from `5 МБ` to `25 МБ` to match runtime limit constant.

Reason:
Runtime still failed with “Failed to initialize PDF parser” because installed `pdf-parse` package exposes `PDFParse` class (v2 API), not callable parser function.

Impact:
`/upload` PDF path now matches the installed dependency API and should parse text without function-shape errors.

## Update 125 — 2026-04-11

File: progress.md  
Lines: 91–93  

Change:
Logged `pdf-parse` API verification, v2 parser migration, and post-migration build/typecheck success.

Reason:
Maintain mandatory technical traceability for each meaningful fix iteration.

Impact:
Execution log now reflects current parser API compatibility fix and validation.

## Update 126 — 2026-04-11

File: src/modules/generation/index.ts  
Lines: `src/modules/generation/index.ts` (478-760)

Change:
Refined manual article adaptation prompt to prevent aggressive summarization:
- added dynamic source-length-based output range (`minLength`/`maxLength`),
- added explicit prohibition against collapsing long enumerations into generic short phrases,
- added mandatory self-check requiring output size to stay within computed range,
- added explicit instruction to return a detailed long post for large source texts.

Reason:
`/upload` output remained too short and lost expert-level detail compared to source article.

Impact:
Manual adaptation flow now steers the model toward preserving breadth and depth of long PDFs instead of producing compact summaries.

## Update 127 — 2026-04-11

File: progress.md  
Lines: 94–96  

Change:
Logged prompt-quality diagnosis, implemented anti-summary prompt constraints, and post-change build/typecheck validation.

Reason:
Maintain required technical traceability for the current iteration.

Impact:
Execution log now captures the quality-fix cycle and successful local verification.

## Update 128 — 2026-04-13

File: src/modules/generation/index.ts  
Lines: `src/modules/generation/index.ts` (20-70, 490-820)

Change:
Implemented two-pass manual adaptation generation for `/upload`:
- `adaptManualArticleText()` now computes target range and validates first-generation length,
- added fallback expansion prompt when first output is shorter than required minimum,
- extracted reusable length-range resolver (`resolveManualAdaptationLengthRange`),
- refactored manual-adaptation prompt builder to accept explicit target range.

Reason:
Single-pass adaptation still produced compressed summaries instead of detailed practical posts.

Impact:
When model under-compresses output, the second pass forces expansion and improves practical coverage.

## Update 129 — 2026-04-13

File: progress.md  
Lines: 97–99  

Change:
Logged depth-gap diagnosis, two-pass adaptation implementation, and post-change build/typecheck verification.

Reason:
Maintain required traceability for current `/upload` quality-fix iteration.

Impact:
Execution log now reflects the additional robustness layer for long-form adaptation quality.

## Update 130 — 2026-04-13

File: src/modules/generation/index.ts  
Lines: `src/modules/generation/index.ts` (31-47, 620-706)

Change:
Added refusal-recovery handling for `/upload` adaptation:
- introduced `looksLikeModelRefusal()` matcher for common refusal phrases,
- updated manual adaptation success condition to require both minimum length and non-refusal output,
- enhanced second-pass expansion prompt with explicit refusal-case note and forced re-adaptation.

Reason:
Runtime produced refusal text (“Извините, но я не могу помочь с этой просьбой.”) as draft content.

Impact:
Manual adaptation now retries automatically when first generation is refusal-like, reducing refusal text leakage into moderation drafts.

## Update 131 — 2026-04-13

File: progress.md  
Lines: 100–102  

Change:
Logged refusal diagnosis, recovery implementation, and post-change build/typecheck verification.

Reason:
Maintain mandatory change traceability for the `/upload` quality-fix iteration.

Impact:
Execution tracking now includes refusal-handling safeguards for manual adaptation flow.

## Update 132 — 2026-04-13

File: src/modules/telegram/index.ts  
Lines: `src/modules/telegram/index.ts` (276-307, 364-386)

Change:
Introduced explicit PDF-to-TXT normalization before AI adaptation:
- replaced direct `parsed.text?.trim()` usage with `normalizePdfTextForAi(parsed.text ?? '')`,
- added `normalizePdfTextForAi()` helper that:
  - normalizes line endings,
  - removes control characters,
  - joins hyphen-split words across PDF line wraps,
  - flattens hard wraps inside paragraphs while preserving paragraph boundaries.

Reason:
Raw PDF extraction can contain wrapped lines, split words, and control characters that degrade AI adaptation quality.

Impact:
OpenAI now receives cleaner plain-text content, improving readability and reducing formatting noise in `/upload` outputs.

## Update 133 — 2026-04-13

File: progress.md  
Lines: 103–105  

Change:
Logged PDF normalization implementation and post-change build/typecheck verification.

Reason:
Maintain required execution traceability for the `/upload` quality-improvement iteration.

Impact:
Execution log now includes the PDF-to-TXT preprocessing step and validation status.

## Update 134 — 2026-04-13

File: src/modules/generation/index.ts  
Lines: `src/modules/generation/index.ts` (31-60, 640-760)

Change:
Hardened `/upload` manual adaptation against refusal leakage:
- added `isAcceptableManualAdaptation()` gate used after each generation pass,
- extended refusal phrase matcher to cover "I can't assist with that" variants,
- added third-pass rescue prompt (`buildManualAdaptationRescuePrompt`) for forced safe educational adaptation,
- added final explicit error when all passes still fail acceptance criteria.

Reason:
Bot returned refusal text ("I'm sorry, I can't assist with that.") as draft body in moderation flow.

Impact:
Refusal-like outputs are now blocked and retried through stricter prompts instead of being passed through as valid drafts.

## Update 135 — 2026-04-13

File: progress.md  
Lines: 106–108  

Change:
Logged refusal reproduction, hardening implementation, and post-change build/typecheck verification.

Reason:
Maintain required traceability for the latest `/upload` reliability fix.

Impact:
Execution history now captures refusal-hardening safeguards in manual adaptation flow.

## Update 136 — 2026-04-13

File: src/modules/generation/index.ts  
Lines: `src/modules/generation/index.ts` (45-58, 768-792)

Change:
Replaced terminal `/upload` adaptation hard-fail with deterministic fallback output:
- when all AI passes remain refusal-like or under-detailed, service now returns cleaned source-based text,
- added `buildDeterministicManualFallback()` with normalized line formatting and stable "Советы от экспертов:" heading,
- fallback trims only to computed upper bound to keep output publishable and non-empty.

Reason:
User-facing flow regressed when model produced repeated refusals; hard-fail path risked blocking moderation delivery.

Impact:
`/upload` no longer outputs refusal phrases or empty failures in worst-case generation scenarios; it always returns useful source-derived content.

## Update 137 — 2026-04-13

File: progress.md  
Lines: 109–111  

Change:
Logged fallback-safeguard implementation and post-change build/typecheck verification.

Reason:
Maintain required traceability for the refusal-regression mitigation cycle.

Impact:
Execution log now records deterministic fallback protection for manual adaptation reliability.

## Update 138 — 2026-04-13

File: src/modules/telegram/index.ts  
Lines: `src/modules/telegram/index.ts` (10-13, 54-66, 388-404)

Change:
Added Telegram moderation message size protection:
- introduced message size constants (`TELEGRAM_MAX_MESSAGE_CHARS`, `MODERATION_TEXT_HARD_LIMIT`),
- replaced direct moderation message concat with `buildModerationMessage()` helper,
- helper now clips oversized draft text to safe preview length and appends explicit truncation note.

Reason:
`/upload` flow failed with Telegram API error `400: Bad Request: message is too long` when adapted drafts exceeded Telegram per-message limits.

Impact:
Moderation delivery no longer crashes on long drafts; full text remains stored in system while Telegram receives safe preview.

## Update 139 — 2026-04-13

File: progress.md  
Lines: 112–114  

Change:
Logged Telegram length-limit diagnosis, safeguard implementation, and post-change build/typecheck verification.

Reason:
Maintain mandatory traceability for latest `/upload` runtime failure fix.

Impact:
Execution history now includes mitigation for oversized moderation messages.

## Update 140 — 2026-04-13

File: src/main.ts  
Lines: `src/main.ts` (80-101)

Change:
Updated startup timeout wrapper to handle Telegram launch exceptions as non-fatal:
- wrapped startup promise in guarded `.catch(...)` branch,
- on launch error now logs warning and resolves `false` instead of rejecting bootstrap.

Reason:
Local runtime crashed on transient Telegram API network error (`ECONNRESET`) before timeout fallback could apply.

Impact:
Application now continues boot in degraded mode when Telegram startup fails immediately, matching existing timeout-based resilience behavior.

## Update 141 — 2026-04-13

File: progress.md  
Lines: 115–117  

Change:
Logged Telegram-start crash diagnosis, non-fatal launch handling implementation, and post-change build/typecheck verification.

Reason:
Maintain required traceability for startup-resilience fix iteration.

Impact:
Execution log now captures mitigation for startup failures caused by transient Telegram network errors.

## Update 142 — 2026-04-13

File: src/modules/telegram/index.ts  
Lines: `src/modules/telegram/index.ts` (11-16, 23-38, 84-95, 473-594)

Change:
Added Telegraph-backed long-form channel publishing flow:
- when publish text exceeds direct Telegram threshold, service creates Telegraph page via API,
- channel post now sends announcement with generated title, benefit statement, CTA, and Telegraph URL,
- added Telegraph helper functions for account creation, page creation, title/benefit extraction, and announcement rendering.

Reason:
Telegram single-message length limit prevented full long-form article publication in one readable unit.

Impact:
Approved long posts can now be published as full external article pages with a click-driving Telegram announcement.

## Update 143 — 2026-04-13

File: src/config/env.ts  
Lines: `src/config/env.ts` (22-25)

Change:
Extended environment schema with optional Telegraph config:
- `TELEGRAPH_ACCESS_TOKEN`
- `TELEGRAPH_SHORT_NAME`

Reason:
Telegraph publishing flow requires optional runtime credentials/identity.

Impact:
Runtime can use fixed Telegraph account token when provided and fallback to dynamic account creation otherwise.

## Update 144 — 2026-04-13

File: .env.example  
Lines: `.env.example` (18-23)

Change:
Added sample Telegraph env variables to template:
- `TELEGRAPH_ACCESS_TOKEN`
- `TELEGRAPH_SHORT_NAME`

Reason:
Expose new optional publishing configuration in environment template.

Impact:
Deployment/local setup docs now cover Telegraph integration knobs.

## Update 145 — 2026-04-13

File: progress.md  
Lines: 118–120  

Change:
Logged Telegraph integration implementation and post-change build/typecheck verification.

Reason:
Maintain required traceability for long-form publishing enhancement.

Impact:
Execution log now reflects migration path from truncated Telegram posts to click-through long-form article publishing.

## Update 146 — 2026-04-13

File: src/modules/telegram/index.ts  
Lines: `src/modules/telegram/index.ts` (52-89, 320-334, 412-450)

Change:
Changed moderation delivery to single-message ready-post mode:
- removed multi-part moderation preview/chunk splitting,
- moderation now builds final channel-ready payload first (direct text for short posts, Telegraph announcement for long posts),
- sends exactly one moderation message with inline actions.

Reason:
User requested moderation to receive final publish-ready post with Telegraph and CTA, without intermediate `part N` chunks.

Impact:
Moderators now review one final formatted post per draft, aligned with final publishing format.

## Update 147 — 2026-04-13

File: progress.md  
Lines: 121–123  

Change:
Logged moderation flow redesign, unified payload generation, and post-change build/typecheck verification.

Reason:
Maintain required traceability for moderation UX alignment changes.

Impact:
Execution history now records the shift to single-message final-post moderation format.

## Update 148 — 2026-04-13

File: src/modules/telegram/index.ts  
Lines: `src/modules/telegram/index.ts` (10-14, 297-320, 470-512)

Change:
Hardened PDF download for `/upload` against transient Telegram network failures:
- added retry + timeout fetch helper (`fetchBufferWithRetry`),
- added dual-source download strategy (primary `getFileLink`, fallback direct `file_path` URL),
- moved download logic into `downloadPdfBuffer(fileId)` and replaced inline single-fetch path.

Reason:
`/upload` intermittently failed with `Failed to process PDF: fetch failed` during file retrieval.

Impact:
PDF upload flow now tolerates transient Telegram CDN/API fetch errors and is less likely to fail on first network hiccup.

## Update 149 — 2026-04-13

File: progress.md  
Lines: 124–126  

Change:
Logged `/upload` fetch-failure diagnosis, resilient download implementation, and post-change build/typecheck verification.

Reason:
Maintain required traceability for latest upload reliability fix.

Impact:
Execution history now includes transport-layer resilience improvements for PDF ingestion.

## Update 150 — 2026-04-13

File: src/modules/telegram/index.ts  
Lines: `src/modules/telegram/index.ts` (530-646)

Change:
Improved content hygiene and teaser quality for long-form Telegraph announcements:
- expanded `isPdfNoiseLine()` with navigation/metadata/footer phrase filters (`время чтения`, `похожие статьи`, `поиск по сайту`, etc.),
- excluded URL/footer/navigation artifacts from teaser extraction,
- rebuilt `buildClickworthyTitle()` to use cleaned non-navigation candidate lines,
- updated `extractBenefitSentence()` to derive value statement from filtered content only.

Reason:
Generated title/preview still contained PDF/site navigation artifacts and irrelevant metadata.

Impact:
Telegraph announcement titles and “что получите” blocks are cleaner, more readable, and closer to publish-ready quality.

## Update 151 — 2026-04-13

File: progress.md  
Lines: 127–129  

Change:
Logged quality diagnosis, noise-filter and teaser-extraction improvements, and post-change build/typecheck verification.

Reason:
Maintain required traceability for Telegraph copy quality iteration.

Impact:
Execution history now reflects the cleanup pass targeting noisy titles and preview snippets.

## Update 152 — 2026-04-13

File: src/modules/generation/index.ts  
Lines: `src/modules/generation/index.ts` (31-57, 793-869)

Change:
Added source-text sanitization before manual adaptation prompting:
- `adaptManualArticleText()` now runs `sanitizeManualSourceText()` before length planning and prompt generation,
- sanitizer removes page counters, site breadcrumbs, reading-time/meta blocks, links, and common footer/navigation noise,
- added line-level noise filter (`isManualNoiseLine`) and whitespace normalization.

Reason:
Raw PDF/site extraction artifacts were still leaking into final adaptation content and Telegraph pages.

Impact:
Manual adaptation now receives cleaner source context, reducing navigation/footer contamination in generated post text.

## Update 153 — 2026-04-13

File: src/modules/telegram/index.ts  
Lines: `src/modules/telegram/index.ts` (575-672)

Change:
Added topic-aware teaser generation for long-form Telegraph announcements:
- introduced `inferTopic()` classifier (`training`/`nutrition`/`behavior`/`general`),
- `buildClickworthyTitle()` and `extractBenefitSentence()` now use stronger predefined hooks for key content domains before fallback heuristics.

Reason:
Generic teaser text ("Практическая статья...") was not sufficiently clickable and often lacked concrete promised value.

Impact:
Channel announcements now produce more specific, action-oriented hooks and clearer promised outcomes for readers.

## Update 154 — 2026-04-13

File: progress.md  
Lines: 130–132  

Change:
Logged renewed content-quality diagnosis, sanitization/teaser improvements, and post-change build/typecheck verification.

Reason:
Maintain required traceability for current copy-quality refinement cycle.

Impact:
Execution history now includes the latest anti-noise and teaser-quality upgrades for `/upload` long-form flow.

## Update 155 — 2026-04-13

File: src/modules/generation/index.ts  
Lines: `src/modules/generation/index.ts` (1-3, 31-95, 686-875)

Change:
Added iterative quality-control loop for `/upload` adaptation:
- introduced target score `9/10` and bounded rewrite iterations,
- added AI-based quality evaluation prompt returning structured JSON (`score`, `issues`, `rewrite_plan`),
- added automatic improvement prompt loop until target score or max attempts,
- added parser + heuristic fallback for malformed evaluator responses.

Reason:
Manual adaptation still produced noisy or weak outputs; user requested repeated evaluate/rewrite cycle before moderation.

Impact:
Manual uploads now pass through explicit quality gating and iterative rewriting prior to moderator delivery.

## Update 156 — 2026-04-13

File: src/modules/telegram/index.ts  
Lines: `src/modules/telegram/index.ts` (282-290)

Change:
Added immediate progress feedback after PDF upload acceptance:
- bot now replies that processing is in progress before downloading/parsing/generating.

Reason:
User experience issue: long `/upload` processing looked like Telegram froze.

Impact:
Users now get explicit “processing” acknowledgment during heavy PDF adaptation runs.

## Update 157 — 2026-04-13

File: progress.md  
Lines: 133–135  

Change:
Logged quality-loop implementation, PDF-progress UX message, and post-change build/typecheck verification.

Reason:
Maintain required traceability for quality-gating and UX-response improvements.

Impact:
Execution history now captures both the 9/10 rewrite loop and visible upload progress signaling.

## Update 158 — 2026-04-13

File: src/modules/generation/index.ts  
Lines: `src/modules/generation/index.ts` (130-149, 748-808, 842-853, 879-1137)

Change:
Hardened `/upload` manual-adaptation quality controls to block noisy/non-finished outputs:
- added duplicate-fragment collapse in post-normalization (`collapseRepeatedIntroChunk`) to remove repeated intros like `советы и рекомендации советы и рекомендации`,
- expanded quality-evaluation prompt with explicit checks for repeated fragments, tail date noise, and incomplete endings,
- expanded rewrite-improvement prompt with explicit cleanup constraints for duplicate fragments and related-articles/date tails,
- tightened acceptance gate (`isAcceptableManualAdaptation`) to reject candidates containing garbage markers, month-year tail noise, duplicate adjacent fragments, or unfinished endings,
- added tail pre-trimming in source sanitization (`trimManualTailNoise`) for related-article blocks,
- added deterministic heuristic scoring penalties (`applyManualQualityHeuristics`) for residual garbage/date tails/duplicate fragments/unfinished endings,
- added month-year line filter in source cleanup to drop lines like `дек 2024`, `фев 2025`.

Reason:
Real `/upload` output still leaked footer/related-content artifacts and repeated fragments, while quality loop occasionally passed text with broken endings.

Impact:
Manual adaptation loop now fails and rewrites these defect classes before moderation, increasing likelihood of publish-ready text continuity and cleaner endings.

## Update 159 — 2026-04-13

File: progress.md  
Lines: 136-139  

Change:
Logged new execution steps for:
- defect reproduction from real `/upload` sample,
- quality-gate hardening in generation module,
- post-change typecheck/build verification,
- attempted live local PDF `/upload` runtime check with documented external network/runtime limitation.

Reason:
Maintain mandatory atomic traceability for current text-quality stabilization cycle.

Impact:
Execution log now captures both implemented safeguards and the remaining runtime verification constraint in current environment.

## Update 160 — 2026-04-13

File: src/modules/telegram/index.ts  
Lines: `src/modules/telegram/index.ts` (289, 383-460 removed, 534+ helper retained for Telegraph title/benefit filtering)

Change:
Rolled back `/upload` PDF-to-text preprocessing in Telegram document flow:
- replaced normalized extraction path with direct parser output pass-through (`const articleText = parsed.text?.trim() ?? ''`),
- removed PDF text normalization function chain that previously transformed extracted text before adaptation,
- kept lightweight noise-line helper only for Telegraph title/benefit candidate filtering (not for core article extraction).

Reason:
User requested to temporarily disable PDF preprocessing and compare output quality with baseline extraction behavior.

Impact:
`/upload` now forwards raw `pdf-parse` text to manual adaptation as before, isolating preprocessing impact from generation-quality diagnostics.

## Update 161 — 2026-04-13

File: progress.md  
Lines: 140-142  

Change:
Logged rollback execution steps for PDF preprocessing disablement and post-change verification (`npm run typecheck`, `npm run build`).

Reason:
Maintain mandatory atomic traceability for user-requested rollback experiment.

Impact:
Execution history now includes explicit rollback state to support controlled A/B behavior comparison of `/upload` output.

## Update 162 — 2026-04-14

File: src/modules/ai/index.ts, .env.example  
Lines: `src/modules/ai/index.ts` (6), `.env.example` (16)

Change:
Updated OpenAI model defaults to `gpt-5.4`:
- changed runtime fallback constant `DEFAULT_MODEL` from `gpt-4o-mini` to `gpt-5.4`,
- changed env template default `OPENAI_MODEL` to `gpt-5.4`.

Reason:
User requested migration to ChatGPT-5.4 across project defaults.

Impact:
New deployments and env bootstraps now default to `gpt-5.4` unless explicitly overridden.

## Update 163 — 2026-04-14

File: src/modules/telegram/index.ts  
Lines: `src/modules/telegram/index.ts` (289, 560-643)

Change:
Restored and strengthened PDF preprocessing before manual adaptation:
- upload flow now passes `normalizePdfTextForAi(parsed.text ?? '')` into moderation pipeline,
- added PDF cleanup/flattening stage:
  - control-character cleanup,
  - hyphen-wrap joining (`дресси-\nровка` => `дрессировка`),
  - removal of navigation/footer/date lines and page counters,
  - adjacent-duplicate line suppression,
  - hard-wrap flattening to sentence-friendly text.

Reason:
Raw parser output produced article text with line-wrap artifacts, duplicated headings, and service blocks leaking into final `/upload` result.

Impact:
Manual adaptation receives cleaner source text and is less likely to emit raw PDF-layout fragments.

## Update 164 — 2026-04-14

File: src/modules/generation/index.ts, progress.md  
Lines: `src/modules/generation/index.ts` (606-611, 765-775, 802-811, 855-863, 1092-1174), `progress.md` (143-146)

Change:
Hardened `/upload` adaptation prompt and quality gate for raw PDF-layout rejection:
- prompt now explicitly requires removing PDF artifacts, duplicate headings, and broken in-sentence line wraps,
- quality evaluation prompt now includes raw-layout criterion,
- improvement prompt now explicitly demands conversion from scan-like fragments to coherent narrative flow,
- acceptance gate now rejects texts with `hasRawPdfLayoutArtifacts(...)`,
- heuristic quality scoring now applies explicit penalty when raw-layout signature is detected.
Also logged execution steps and verification in `progress.md`.

Reason:
User-provided output still contained low-quality PDF extraction structure (fragmented short lines, heading cascades, duplicated title sections).

Impact:
Quality loop now blocks and rewrites this defect class before moderation handoff; compile integrity re-validated (`npm run typecheck`, `npm run build`).

## Update 165 — 2026-04-14

File: src/modules/ai/index.ts, .env.example, .env, progress.md  
Lines: `src/modules/ai/index.ts` (6), `.env.example` (16), `.env` (`OPENAI_MODEL` line), `progress.md` (147-148)

Change:
Replaced model identifiers with `gpt-5.4-mini` across default/runtime configuration:
- updated AI runtime fallback constant `DEFAULT_MODEL` to `gpt-5.4-mini`,
- updated environment template default `OPENAI_MODEL=gpt-5.4-mini`,
- updated active local environment model value to `OPENAI_MODEL=gpt-5.4-mini`,
- logged execution/verification steps in `progress.md`.

Reason:
User requested switching model everywhere to ChatGPT 5.4 mini.

Impact:
All default and active local model configuration paths now resolve to `gpt-5.4-mini`; compile integrity confirmed via `npm run typecheck` and `npm run build`.

## Update 166 — 2026-04-15

File: src/modules/generation/index.ts, progress.md  
Lines: `src/modules/generation/index.ts` (1-7, 36-87, 98-158, 792-886, 919-935, 968-995, 997-1022, 1058-1074, 1145-1200, 1202-1367), `progress.md` (149-150)

Change:
Strengthened `/upload` manual adaptation pipeline to block raw PDF-like output before moderation:
- added strict publish-ready acceptance gate in manual flow with new checks for:
  - residual metadata markers (`Авторы`, `Введение`, reading-time/email/tag-cloud artifacts),
  - excessive lexical overlap with source text (8-token shingle containment + reused-sentence ratio),
  - existing garbage/date-tail/duplicate/incomplete-ending/raw-layout checks,
- added final editorial pass (`runFinalEditorialPass`) with dedicated cleanup prompt before final return,
- switched manual candidate handling to normalization-first (`normalizeManualCandidateText`) on every generation pass,
- removed deterministic terminal fallback return of source-like text and replaced with explicit hard-fail when quality gate is not reached,
- extended quality evaluation + rewrite prompts with anti-copy and anti-metadata requirements,
- extended heuristic scoring penalties for metadata leakage and near-copy output.
Also recorded execution and verification steps in `progress.md`.

Reason:
User-reported `/upload` output still contained copied source structure, repeated blocks, metadata fragments, and unfinished editorial quality despite rewrite loop.

Impact:
Manual adaptation now cannot silently pass near-raw PDF dumps into moderation; non-publish-ready text is forced through final rewrite gate and rejected if quality criteria remain unmet. Compile integrity re-validated (`npm run typecheck`, `npm run build` passed).

## Update 167 — 2026-04-15

File: src/modules/generation/index.ts, src/modules/telegram/index.ts, progress.md  
Lines: `src/modules/generation/index.ts` (7, 37-190, 636-1094, 1127-1144, 1207-1233, 1356-1416, 1525-1597, 1640-1673), `src/modules/telegram/index.ts` (14), `progress.md` (151-153)

Change:
Implemented full-content preservation controls for `/upload` adaptation and earlier Telegraph routing:
- added two-stage manual adaptation flow in generation service:
  - stage A: model builds structured JSON coverage plan (`title`, `mandatory_items`, `key_restrictions`),
  - stage B: all generation prompts (base/expand/rescue/improve/final) are constrained by mandatory coverage items;
- added deterministic source-entity extraction for dog-training taxonomy and merged it with model-extracted coverage plan;
- added strict coverage gate:
  - new minimum mandatory-item coverage ratio (`MANUAL_MIN_COVERAGE_RATIO = 0.78`),
  - acceptance now fails if required content coverage is insufficient,
  - quality heuristics now penalize under-coverage explicitly;
- extended quality evaluation and rewrite prompts with explicit coverage compliance criterion;
- reduced direct Telegram publish threshold from `3500` to `2200` chars to route long drafts to Telegraph earlier.
Also logged execution and verification in `progress.md`.

Reason:
User-reported regression: adapted `/upload` draft became too short and incomplete (cleaner text but loss of major sections from source article).

Impact:
`/upload` adaptation now prioritizes both cleanliness and factual completeness; key source blocks are enforced by coverage plan and rejected when omitted. Longer adapted drafts now more consistently publish via Telegraph rather than plain in-chat wall-of-text. Compile integrity re-validated (`npm run typecheck`, `npm run build` passed).

## Update 168 — 2026-04-16

File: src/modules/generation/index.ts, progress.md  
Lines: `src/modules/generation/index.ts` (7, 96-112, 185-188, 1005-1032, 1108-1110, 1578-1610), `progress.md` (154-156)

Change:
Removed strict `/upload` hard-stop behavior that surfaced user-facing adaptation failure and replaced it with fail-safe delivery logic:
- lowered base coverage threshold constant from `0.78` to `0.65`,
- reduced merged mandatory coverage list cap from `24` to `16` items to avoid infeasible coverage targets on large heterogeneous PDFs,
- added emergency fallback rewrite stage (`buildManualEmergencyFallbackPrompt` + `runEmergencyFallbackPass`) for final attempt before failure,
- added safe fallback acceptance check (`isSafeManualAdaptationForFallback`) that allows delivery of best cleaned candidate when strict gate misses but core safety/readability constraints are met,
- updated final failure message path from strict publish-ready miss to minimal-safe miss.
Also logged execution and verification in `progress.md`.

Reason:
User-reported runtime error after `/upload`: `Manual article adaptation did not reach publish-ready quality.` The strict completeness gate caused false-negative rejects and blocked delivery entirely.

Impact:
`/upload` now degrades gracefully: when strict quality target is not met, system still returns a sanitized, coherent draft instead of aborting. This preserves user flow while keeping hard filters for refusal/garbage/raw-PDF artifacts. Compile integrity re-validated (`npm run typecheck`, `npm run build` passed).

## Update 169 — 2026-04-16

File: src/modules/telegram/index.ts, progress.md  
Lines: `src/modules/telegram/index.ts` (560-753, 600-653), `progress.md` (157-158)

Change:
Strengthened PDF→TXT preprocessing before OpenAI handoff in Telegram upload flow:
- expanded inline cleanup (`cleanInlinePdfArtifacts`) to remove embedded emails, month-year/date stamps, and reading-time fragments,
- added metadata-only line filtering (`isPdfLikelyMetadataLine`) for author/contents/page/table markers and heading-cascade patterns,
- added tag-cloud detector (`isLikelyTagCloudLine`) to drop SEO-like keyword tails,
- replaced adjacent-only dedupe with global line deduplication keyed by normalized content (`normalizePdfLineKey`),
- added repeated-phrase collapse in single lines (`collapseLineRepetition`) to remove artifacts like duplicated phrase chunks,
- extended normalization noise phrase list (contact-related markers, extra metadata tokens),
- kept final flattening but with punctuation-space normalization before AI prompt handoff.
Also logged execution and verification steps in `progress.md`.

Reason:
User requested to remove PDF garbage and metadata at TXT stage so OpenAI receives cleaner source text directly, reducing downstream hallucinations and contamination.

Impact:
`/upload` now sends cleaner, less repetitive, metadata-stripped text to generation module, improving adaptation stability before AI processing. Compile integrity re-validated (`npm run typecheck`, `npm run build` passed).

## Update 170 — 2026-04-16

File: src/modules/generation/index.ts, src/modules/telegram/index.ts, progress.md  
Lines: `src/modules/generation/index.ts` (888-970, 1207-1233, 1363-1366, 1476-1492, 1577-1626), `src/modules/telegram/index.ts` (560-745), `progress.md` (159-163)

Change:
Performed targeted `/upload` quality hardening after local real-PDF diagnostics:
- removed stale hardcoded coverage text (`78%`) in quality prompts and bound coverage wording to real runtime threshold via shared resolver:
  - added `resolveCoverageThreshold(...)`,
  - added `formatCoverageThresholdPercent(...)`,
  - reused resolver inside `hasInsufficientCoverage(...)` and prompt text generation;
- replaced Cyrillic-fragile boundary cleanup patterns (`\\b`-based date/time matches) with whitespace-bound patterns in both generation and Telegram preprocessing:
  - added `stripRuDateAndReadTimeMarkers(...)` in both modules,
  - routed source/candidate normalization through this helper;
- strengthened Telegram PDF metadata filtering:
  - added `looksLikePdfStatLine(...)` to drop compact stat lines (`мин + views + month/year`),
  - integrated stat-line detection into both noise and metadata filters,
  - added early tail cutoff (`trimPdfTailNoise(...)`) for related-article blocks before AI handoff;
- normalized internal whitespace with `\\s+` before phrase-based filtering to neutralize tab-delimited PDF artifacts.
Also logged atomic execution steps in `progress.md` and re-validated compile integrity.

Reason:
Real local PDF extraction still showed metadata leakage and prompt/gate mismatch:
- parser output contained tab-separated navigation fragments and compact stat markers,
- quality prompts still demanded `78%` while runtime acceptance had lower dynamic threshold, creating inconsistency in rewrite/evaluation behavior.

Impact:
`/upload` preprocessing and quality-loop instructions are now internally consistent and more robust to real PDF artifacts (Cyrillic date/time markers, compact stat lines, tabbed navigation blocks, related-content tails). Typecheck and build remain green (`npm run typecheck`, `npm run build`).

## Update 171 — 2026-04-16

File: src/modules/generation/index.ts, src/modules/telegram/index.ts, progress.md  
Lines: `src/modules/generation/index.ts` (37-117, 1620-1637), `src/modules/telegram/index.ts` (17, 279-301, 388-395), `progress.md` (165-167)

Change:
Implemented anti-freeze and anti-failure safeguards for `/upload`:
- in manual adaptation flow (`adaptManualArticleText`):
  - wrapped AI-heavy coverage/quality pipeline in guarded block,
  - removed terminal throw-path on minimal-safe miss,
  - added deterministic final return via `buildManualDeterministicFallback(...)` so pipeline always yields draft text even if quality gates or upstream AI calls fail;
- in Telegram PDF handler:
  - updated initial progress copy to realistic ETA (`до 5-7 минут`),
  - added periodic user-visible status heartbeat (`startPdfProgressUpdates`) every 90 seconds during long processing,
  - ensured timer cleanup in `finally` to prevent orphan progress messages after completion/failure.
Also logged atomic execution steps and reran compile checks.

Reason:
User-reported runtime behavior:
- repeated error after long `/upload` processing window,
- no intermediate status messages for ~7 minutes, creating perceived hang.

Impact:
`/upload` now degrades gracefully without surfacing terminal adaptation failure to the user and provides periodic in-chat progress feedback during long PDF handling. Compile integrity remains valid (`npm run typecheck`, `npm run build` passed).
