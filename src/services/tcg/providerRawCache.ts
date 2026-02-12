import { prisma } from '../../config/database';

export interface RawCacheWriteInput {
  provider: string;
  gameSlug: string;
  resourceType: string;
  resourceKey: string;
  payload: unknown;
  ttlSeconds?: number;
}

export async function readRawCache(
  provider: string,
  gameSlug: string,
  resourceType: string,
  resourceKey: string,
): Promise<unknown | null> {
  const row = await prisma.providerRawCache.findUnique({
    where: {
      provider_gameSlug_resourceType_resourceKey: {
        provider,
        gameSlug,
        resourceType,
        resourceKey,
      },
    },
  });

  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;
  return row.payload;
}

export async function writeRawCache(input: RawCacheWriteInput): Promise<void> {
  const expiresAt = input.ttlSeconds != null
    ? new Date(Date.now() + input.ttlSeconds * 1000)
    : null;

  await prisma.providerRawCache.upsert({
    where: {
      provider_gameSlug_resourceType_resourceKey: {
        provider: input.provider,
        gameSlug: input.gameSlug,
        resourceType: input.resourceType,
        resourceKey: input.resourceKey,
      },
    },
    update: {
      payload: input.payload as object,
      fetchedAt: new Date(),
      expiresAt,
    },
    create: {
      provider: input.provider,
      gameSlug: input.gameSlug,
      resourceType: input.resourceType,
      resourceKey: input.resourceKey,
      payload: input.payload as object,
      expiresAt,
    },
  });
}

