Build a production-ready backend in Node.js + TypeScript for a Telegram editorial AI pipeline.

Project goal:
Create a system for a Telegram channel that:
1. reads the next topic from a Google Sheets content plan on schedule,
2. generates a Telegram post draft using OpenAI,
3. sends the draft to an editor in Telegram for moderation,
4. supports actions:
   - approve
   - rewrite
   - rewrite with notes
5. publishes approved drafts to a Telegram channel,
6. also supports manual article upload via Telegram command /upload.

Core flows:

Flow 1: Scheduled content generation
- Trigger at 09:00, 15:00, and 21:00 Europe/Moscow time
- Read rows from Google Sheets
- Select the first row where status is empty
- Mark it as IN_REVIEW
- Generate a post draft from the topic and rubric
- Send the draft to moderator chats with inline buttons

Flow 2: Moderation via Telegram
- Handle callback queries:
  - approve:draftId
  - rewrite:draftId
  - rewrite_notes:draftId
- approve publishes the current draft to a Telegram channel
- rewrite regenerates the draft using the previous version as input
- rewrite_notes puts the user into WAITING_NOTES state, then uses the next user message as rewrite notes

Flow 3: Manual article upload
- User sends /upload
- System sets WAITING_ARTICLE state
- User sends article text in one message
- System adapts the article into channel style
- Creates a draft and sends it to moderation
- If user sends cancel, state is cleared

Entities:
- ContentPlanItem
- Draft
- DraftRevision
- ModerationAction
- UserSession
- Publication

Technical requirements:
- Node.js + TypeScript
- Fastify or Express
- PostgreSQL + Prisma
- Telegram bot via grammY or Telegraf
- Google Sheets API integration
- OpenAI SDK integration
- Clean modular architecture
- No business logic inside Telegram handlers
- No in-memory or workflow static data for session state
- All moderation actions must be tied to draft IDs, not raw message text

Draft lifecycle:
NEW -> IN_REVIEW -> APPROVED -> PUBLISHED

Session modes:
IDLE
WAITING_ARTICLE
WAITING_NOTES

Required modules:
- planner
- drafts
- generation
- moderation
- publishing
- sessions
- telegram
- sheets
- ai

Implementation steps:
1. create project structure
2. define Prisma schema
3. implement Google Sheets reader/updater
4. implement scheduled job for next topic selection
5. implement draft generation service
6. implement Telegram moderation delivery
7. implement callback handlers
8. implement /upload flow
9. implement draft revision history
10. implement publish flow and mark content plan row as PUBLISHED