# Implementation Plan

1. Establish runtime scaffold
- Deliverables: Node.js + TypeScript project skeleton, build scripts, config loader, HTTP bootstrap, health endpoint.
- Verification: `tsconfig.json` and `package.json` exist; `src/main.ts` boots app; `/health` route is registered.

2. Define persistent data model in Prisma
- Deliverables: `prisma/schema.prisma` with `ContentPlanItem`, `Draft`, `DraftRevision`, `ModerationAction`, `UserSession`, `Publication`, plus lifecycle/session/action enums.
- Verification: Schema contains required entities and enums; relationships tie moderation/publication/session state to draft IDs.

3. Implement Google Sheets integration module
- Deliverables: sheets repository/service to read first row with empty status and write `IN_REVIEW`/`PUBLISHED` updates.
- Verification: Unit tests for row selection/update mapping; no business logic in Telegram handlers.

4. Implement planner scheduling module
- Deliverables: scheduler for 09:00, 15:00, 21:00 Europe/Moscow; invocation of sheets selection + draft creation orchestration.
- Verification: Scheduler triggers at configured times; execution path marks content plan item as `IN_REVIEW` before moderation send.

5. Implement draft generation module
- Deliverables: AI prompt builder + OpenAI client adapter; initial draft generation from topic/rubric.
- Verification: Service returns draft text and persists draft + first revision.

6. Implement Telegram delivery module for moderation
- Deliverables: message delivery to moderator chats with inline callbacks containing `draftId`.
- Verification: Callback payload format is `approve:draftId`, `rewrite:draftId`, `rewrite_notes:draftId`.

7. Implement moderation callback application service
- Deliverables: action handler service that records moderation action and transitions draft lifecycle.
- Verification: `approve` transitions to `APPROVED` and hands off to publishing; rewrite actions create new revisions.

8. Implement session-state module backed by database
- Deliverables: session read/write service using `UserSession` model for `IDLE`, `WAITING_ARTICLE`, `WAITING_NOTES`.
- Verification: No in-memory session state; session transitions persisted by user ID.

9. Implement `/upload` manual flow
- Deliverables: Telegram command/message handlers delegating to services; article adaptation + moderation enqueue.
- Verification: `/upload` sets `WAITING_ARTICLE`; `cancel` clears state; uploaded article produces draft.

10. Implement publish flow with plan row finalization
- Deliverables: publisher service posts to target channel, creates `Publication`, marks draft `PUBLISHED`, updates content plan row `PUBLISHED`.
- Verification: End-to-end state path `NEW -> IN_REVIEW -> APPROVED -> PUBLISHED` is preserved and auditable.
