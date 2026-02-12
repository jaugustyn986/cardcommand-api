import { prisma } from '../../config/database';
import { PokemonTcgProvider } from './adapters/pokemonTcgProvider';
import { getProviderForGame, initializeProviderRegistry, isGameEnabled } from './providerRegistry';
import { upsertCards, upsertLatestPrices, upsertSets } from './tcgUpsertService';
import { SupportedGameSlug } from './types';
import { runWithConcurrency } from './utils';

const DEFAULT_CARD_PAGE_SIZE = 250;

export interface TcgSyncResult {
  game: SupportedGameSlug;
  setsSynced: number;
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
  recentCutoff.setDate(recentCutoff.getDate() - 120);

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
    4,
    async (set) => {
      if (set.provider !== provider.providerKey) return [];
      const cards: Awaited<ReturnType<typeof provider.listCards>> = [];
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
      return cards;
    },
  );

  const cards = bySetCards.flat();
  await upsertCards(game, cards, setIdMap);
  return cards.length;
}

export async function syncPricesRecent(game: SupportedGameSlug, recentOnly = true): Promise<number> {
  ensureRegistryInitialized();
  if (!isGameEnabled(game)) return 0;
  const provider = getProviderForGame(game);

  const now = new Date();
  const recentCutoff = new Date(now);
  recentCutoff.setDate(recentCutoff.getDate() - 120);

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

  const chunkSize = 100;
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
  const setsSynced = await syncSets(game);
  const cardsSynced = await syncCardsForNewOrRecentSets(game);
  const pricesSynced = await syncPricesRecent(game, true);
  return { game, setsSynced, cardsSynced, pricesSynced };
}

