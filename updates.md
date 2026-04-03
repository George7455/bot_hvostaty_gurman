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
