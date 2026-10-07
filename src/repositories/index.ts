import type { PrismaClient } from '@prisma/client';

import { PrismaContentPlanRepository, type ContentPlanRepository } from './content-plan.repository.js';
import { PrismaDraftRepository, type DraftRepository } from './draft.repository.js';
import { PrismaDraftRevisionRepository, type DraftRevisionRepository } from './draft-revision.repository.js';
import { PrismaModerationActionRepository, type ModerationActionRepository } from './moderation-action.repository.js';
import { PrismaModerationDeliveryRepository, type ModerationDeliveryRepository } from './moderation-delivery.repository.js';
import { PrismaPlannerRunRepository, type PlannerRunRepository } from './planner-run.repository.js';
import { PrismaPublicationIntentRepository, type PublicationIntentRepository } from './publication-intent.repository.js';
import { PrismaPublicationRepository, type PublicationRepository } from './publication.repository.js';
import { PrismaUserSessionRepository, type UserSessionRepository } from './user-session.repository.js';

export interface Repositories {
  readonly contentPlan: ContentPlanRepository;
  readonly draft: DraftRepository;
  readonly draftRevision: DraftRevisionRepository;
  readonly moderationAction: ModerationActionRepository;
  readonly moderationDelivery: ModerationDeliveryRepository;
  readonly plannerRun: PlannerRunRepository;
  readonly publication: PublicationRepository;
  readonly publicationIntent: PublicationIntentRepository;
  readonly userSession: UserSessionRepository;
}

export function createRepositories(prisma: PrismaClient): Repositories {
  return {
    contentPlan: new PrismaContentPlanRepository(prisma),
    draft: new PrismaDraftRepository(prisma),
    draftRevision: new PrismaDraftRevisionRepository(prisma),
    moderationAction: new PrismaModerationActionRepository(prisma),
    moderationDelivery: new PrismaModerationDeliveryRepository(prisma),
    plannerRun: new PrismaPlannerRunRepository(prisma),
    publication: new PrismaPublicationRepository(prisma),
    publicationIntent: new PrismaPublicationIntentRepository(prisma),
    userSession: new PrismaUserSessionRepository(prisma)
  };
}
