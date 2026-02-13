import { prisma } from '../../config/database';
import { PokemonTcgProvider } from './adapters/pokemonTcgProvider';
import { tcgConfig } from './config';
import { getProviderForGame, initializeProviderRegistry, isGameEnabled } from './providerRegistry';
import { upsertCards, upsertLatestPrices, upsertSets } from './tcgUpsertService';
import { SupportedGameSlug } from './types';
import { runWithConcurrency } from './utils';

const DEFAULT_CARD_PAGE_SIZE = 250;

export interface TcgSyncResult {
  game: SupportedGameSlug;
  setsSynced: number;
  setsProcessedForCards: number;
  setCardFailures: Array<{ providerSetId: string; error: string }>;
  cardsSynced: number;
  pricesSynced: number;
}

let initialized = false;

function ensureRegistryInitialized(): void {
  if (initialized) return;
  initializeProviderRegistry(new PokemonTcgProvider());
  initialized = true;
}

export async function syncSets(game: SupportedGameSlug): Promise<number> {
  ensureRegistryInitialized();
  if (!isGameEnabled(game)) return 0;
  const provider = getProviderForGame(game);
  const sets = await provider.listSets(game);
  await upsertSets(game, sets);
  return sets.length;
}

export async function syncCardsForNewOrRecentSets(game: SupportedGameSlug): Promise<number> {
  ensureRegistryInitialized();
  if (!isGameEnabled(game)) return 0;
  const provider = getProviderForGame(game);

  const now = new Date();
  const recentCutoff = new Date(now);
  recentCutoff.setDate(recentCutoff.getDate() - tcgConfig.recentSetWindowDays);

  const dbSets = await prisma.tcgSet.findMany({
    where: {
      game: { slug: game },
      OR: [{ releaseDate: { gte: recentCutoff } }, { releaseDate: null }],
    },
    orderBy: { releaseDate: 'desc' },
    select: {
      id: true,
      providerSetId: true,
      provider: true,
    },
  });

  const setIdMap = new Map(dbSets.map((s) => [s.providerSetId, s.id]));

  const bySetCards = await runWithConcurrency(
    dbSets,
    tcgConfig.cardSyncConcurrency,
    async (set) => {
      if (set.provider !== provider.providerKey) {
        return { providerSetId: set.providerSetId, cards: [], error: null as string | null };
      }
      const cards: Awaited<ReturnType<typeof provider.listCards>> = [];
      try {
        let page = 1;
        while (true) {
          const pageCards = await provider.listCards(game, set.providerSetId, {
            page,
            pageSize: DEFAULT_CARD_PAGE_SIZE,
          });
          cards.push(...pageCards);
          if (pageCards.length < DEFAULT_CARD_PAGE_SIZE) break;
          page++;
        }
        return { providerSetId: set.providerSetId, cards, error: null as string | null };
      } catch (error: any) {
        const msg = error?.message || 'Unknown set card fetch failure';
        console.error(`⚠️ TCG cards fetch failed for set ${set.providerSetId}:`, msg);
        return { providerSetId: set.providerSetId, cards: [], error: msg };
      }
    },
  );

  const cards = bySetCards.flatMap((entry) => entry.cards);
  await upsertCards(game, cards, setIdMap);
  return cards.length;
}

export async function syncPricesRecent(game: SupportedGameSlug, recentOnly = true): Promise<number> {
  ensureRegistryInitialized();
  if (!isGameEnabled(game)) return 0;
  const provider = getProviderForGame(game);

  const now = new Date();
  const recentCutoff = new Date(now);
  recentCutoff.setDate(recentCutoff.getDate() - tcgConfig.recentSetWindowDays);

  const cards = await prisma.tcgCard.findMany({
    where: {
      game: { slug: game },
      ...(recentOnly
        ? {
            set: {
              OR: [{ releaseDate: { gte: recentCutoff } }, { releaseDate: null }],
            },
          }
        : {}),
      provider: provider.providerKey,
    },
    select: {
      id: true,
      providerCardId: true,
    },
    take: recentOnly ? 1500 : 4000,
  });

  if (cards.length === 0) return 0;
  const idMap = new Map(cards.map((c) => [c.providerCardId, c.id]));

  const chunkSize = tcgConfig.priceChunkSize;
  let synced = 0;
  for (let i = 0; i < cards.length; i += chunkSize) {
    const chunk = cards.slice(i, i + chunkSize);
    const prices = await provider.getPrices(
      game,
      chunk.map((c) => c.providerCardId),
    );
    synced += await upsertLatestPrices(prices, idMap);
  }
  return synced;
}

export async function runTcgSyncPipeline(game: SupportedGameSlug): Promise<TcgSyncResult> {
  ensureRegistryInitialized();
  if (!isGameEnabled(game)) {
    return {
      game,
      setsSynced: 0,
      setsProcessedForCards: 0,
      setCardFailures: [],
      cardsSynced: 0,
      pricesSynced: 0,
    };
  }

  const setsSynced = await syncSets(game);
  const provider = getProviderForGame(game);
  const now = new Date();
  const recentCutoff = new Date(now);
  recentCutoff.setDate(recentCutoff.getDate() - tcgConfig.recentSetWindowDays);
  const candidateSets = await prisma.tcgSet.findMany({
    where: {
      game: { slug: game },
      provider: provider.providerKey,
      OR: [{ releaseDate: { gte: recentCutoff } }, { releaseDate: null }],
    },
    select: { providerSetId: true },
  });

  const setCardFailures: Array<{ providerSetId: string; error: string }> = [];
  const cardsSynced = await (async () => {
    const dbSets = await prisma.tcgSet.findMany({
      where: {
        game: { slug: game },
        provider: provider.providerKey,
        OR: [{ releaseDate: { gte: recentCutoff } }, { releaseDate: null }],
      },
      orderBy: { releaseDate: 'desc' },
      select: { id: true, providerSetId: true, provider: true },
    });
    const setIdMap = new Map(dbSets.map((s) => [s.providerSetId, s.id]));
    const results = await runWithConcurrency(
      dbSets,
      tcgConfig.cardSyncConcurrency,
      async (set) => {
        const cards: Awaited<ReturnType<typeof provider.listCards>> = [];
        try {
          let page = 1;
          while (true) {
            const pageCards = await provider.listCards(game, set.providerSetId, {
              page,
              pageSize: DEFAULT_CARD_PAGE_SIZE,
            });
            cards.push(...pageCards);
            if (pageCards.length < DEFAULT_CARD_PAGE_SIZE) break;
            page++;
          }
          return { providerSetId: set.providerSetId, cards, error: null as string | null };
        } catch (error: any) {
          const msg = error?.message || 'Unknown set card fetch failure';
          return { providerSetId: set.providerSetId, cards: [], error: msg };
        }
      },
    );

    for (const entry of results) {
      if (entry.error) {
        setCardFailures.push({ providerSetId: entry.providerSetId, error: entry.error });
      }
    }
    const cards = results.flatMap((r) => r.cards);
    await upsertCards(game, cards, setIdMap);
    return cards.length;
  })();
  const pricesSynced = await syncPricesRecent(game, true);
  return {
    game,
    setsSynced,
    setsProcessedForCards: candidateSets.length,
    setCardFailures,
    cardsSynced,
    pricesSynced,
  };
}

