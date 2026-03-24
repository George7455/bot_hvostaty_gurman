import { PrismaClient } from '@prisma/client';

export function createPrismaClient(): PrismaClient {
  const normalizedUrl = normalizeSupabasePoolerUrl(process.env.DATABASE_URL);
  if (!normalizedUrl) {
    return new PrismaClient();
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: normalizedUrl
      }
    }
  });
}

function normalizeSupabasePoolerUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl || rawUrl.trim().length === 0) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  if (!url.hostname.endsWith('.pooler.supabase.com')) {
    return rawUrl;
  }

  if (url.searchParams.has('pgbouncer') === false) {
    url.searchParams.set('pgbouncer', 'true');
  }

  if (url.searchParams.has('connection_limit') === false) {
    url.searchParams.set('connection_limit', '1');
  }

  if (url.searchParams.has('sslmode') === false) {
    url.searchParams.set('sslmode', 'require');
  }

  return url.toString();
}
