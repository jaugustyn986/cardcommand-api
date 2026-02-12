import { prisma } from '../../config/database';
import { ProviderCardRecord, ProviderPriceRecord, ProviderSetRecord, SupportedGameSlug } from './types';

export async function ensureGame(slug: SupportedGameSlug, enabled = false): Promise<{ id: string }> {
  const label = slug === 'pokemon' ? 'Pokemon TCG' : slug === 'mtg' ? 'Magic: The Gathering' : 'Yu-Gi-Oh!';
  const game = await prisma.game.upsert({
    where: { slug },
    update: { name: label, enabled },
    create: { slug, name: label, enabled },
    select: { id: true },
  });
  return game;
}

export async function upsertSets(gameSlug: SupportedGameSlug, sets: ProviderSetRecord[]): Promise<Map<string, string>> {
  const game = await ensureGame(gameSlug, gameSlug === 'pokemon');
  const byProviderSetId = new Map<string, string>();

  for (const set of sets) {
    const row = await prisma.tcgSet.upsert({
      where: {
        gameId_provider_providerSetId: {
          gameId: game.id,
          provider: set.provider,
          providerSetId: set.providerSetId,
        },
      },
      update: {
        name: set.name,
        releaseDate: set.releaseDate,
        series: set.series,
        total: set.total,
        images: set.images as object | undefined,
      },
      create: {
        gameId: game.id,
        provider: set.provider,
        providerSetId: set.providerSetId,
        name: set.name,
        releaseDate: set.releaseDate,
        series: set.series,
        total: set.total,
        images: set.images as object | undefined,
      },
      select: { id: true, providerSetId: true },
    });
    byProviderSetId.set(row.providerSetId, row.id);
  }

  return byProviderSetId;
}

export async function upsertCards(
  gameSlug: SupportedGameSlug,
  cards: ProviderCardRecord[],
  setIdByProviderSetId: Map<string, string>,
): Promise<Map<string, string>> {
  const game = await ensureGame(gameSlug, gameSlug === 'pokemon');
  const byProviderCardId = new Map<string, string>();

  for (const card of cards) {
    const setId = setIdByProviderSetId.get(card.providerSetId);
    if (!setId) continue;
    const row = await prisma.tcgCard.upsert({
      where: {
        gameId_provider_providerCardId: {
          gameId: game.id,
          provider: card.provider,
          providerCardId: card.providerCardId,
        },
      },
      update: {
        setId,
        name: card.name,
        number: card.number,
        rarity: card.rarity,
        images: card.images as object | undefined,
        tcgplayerId: card.tcgplayerId,
        scryfallId: card.scryfallId,
      },
      create: {
        gameId: game.id,
        setId,
        provider: card.provider,
        providerCardId: card.providerCardId,
        name: card.name,
        number: card.number,
        rarity: card.rarity,
        images: card.images as object | undefined,
        tcgplayerId: card.tcgplayerId,
        scryfallId: card.scryfallId,
      },
      select: { id: true, providerCardId: true },
    });
    byProviderCardId.set(row.providerCardId, row.id);
  }

  return byProviderCardId;
}

export async function upsertLatestPrices(
  prices: ProviderPriceRecord[],
  cardIdByProviderCardId: Map<string, string>,
): Promise<number> {
  let updated = 0;
  for (const price of prices) {
    const cardId = cardIdByProviderCardId.get(price.providerCardId);
    if (!cardId) continue;

    await prisma.priceLatest.upsert({
      where: {
        cardId_source_currency: {
          cardId,
          source: price.source,
          currency: price.currency,
        },
      },
      update: {
        market: price.market,
        low: price.low,
        mid: price.mid,
        high: price.high,
        directLow: price.directLow,
        updatedAt: price.updatedAt ?? new Date(),
      },
      create: {
        cardId,
        source: price.source,
        currency: price.currency,
        market: price.market,
        low: price.low,
        mid: price.mid,
        high: price.high,
        directLow: price.directLow,
        updatedAt: price.updatedAt ?? new Date(),
      },
    });

    // Maintain optional daily history snapshot.
    await prisma.priceHistoryDaily.upsert({
      where: {
        cardId_source_currency_date: {
          cardId,
          source: price.source,
          currency: price.currency,
          date: new Date(new Date().toISOString().slice(0, 10)),
        },
      },
      update: {
        market: price.market,
        low: price.low,
        mid: price.mid,
        high: price.high,
        directLow: price.directLow,
      },
      create: {
        cardId,
        source: price.source,
        currency: price.currency,
        date: new Date(new Date().toISOString().slice(0, 10)),
        market: price.market,
        low: price.low,
        mid: price.mid,
        high: price.high,
        directLow: price.directLow,
      },
    });
    updated++;
  }
  return updated;
}

