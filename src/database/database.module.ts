import type { PrismaClient } from '@prisma/client';

import { createPrismaClient } from './prisma-client.js';

export interface DatabaseModule {
  readonly client: PrismaClient;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

class PrismaDatabaseModule implements DatabaseModule {
  public readonly client: PrismaClient;

  public constructor(client?: PrismaClient) {
    this.client = client ?? createPrismaClient();
  }

  public async connect(): Promise<void> {
    await this.client.$connect();
  }

  public async disconnect(): Promise<void> {
    await this.client.$disconnect();
  }
}

export function createDatabaseModule(): DatabaseModule {
  return new PrismaDatabaseModule();
}
