import type { PrismaClient } from '@prisma/client';

import { PrismaContentPlanRepository, type ContentPlanRepository } from './content-plan.repository.js';
import { PrismaDraftRepository, type DraftRepository } from './draft.repository.js';
import { PrismaDraftRevisionRepository, type DraftRevisionRepository } from './draft-revision.repository.js';
import { PrismaModerationActionRepository, type ModerationActionRepository } from './moderation-action.repository.js';
import { PrismaPublicationRepository, type PublicationRepository } from './publication.repository.js';
import { PrismaUserSessionRepository, type UserSessionRepository } from './user-session.repository.js';

export interface Repositories {
  readonly contentPlan: ContentPlanRepository;
  readonly draft: DraftRepository;
  readonly draftRevision: DraftRevisionRepository;
  readonly moderationAction: ModerationActionRepository;
  readonly publication: PublicationRepository;
  readonly userSession: UserSessionRepository;
}

export function createRepositories(prisma: PrismaClient): Repositories {
  return {
    contentPlan: new PrismaContentPlanRepository(prisma),
    draft: new PrismaDraftRepository(prisma),
    draftRevision: new PrismaDraftRevisionRepository(prisma),
    moderationAction: new PrismaModerationActionRepository(prisma),
    publication: new PrismaPublicationRepository(prisma),
    userSession: new PrismaUserSessionRepository(prisma)
  };
}
