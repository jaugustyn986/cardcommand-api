import { Request, Response } from 'express';
import { prisma } from '../config/database';

function parsePage(value: string | undefined, fallback: number): number {
  const num = Number.parseInt(value || '', 10);
  if (Number.isNaN(num) || num < 1) return fallback;
  return num;
}

function parsePerPage(value: string | undefined, fallback: number, max = 100): number {
  const num = Number.parseInt(value || '', 10);
  if (Number.isNaN(num) || num < 1) return fallback;
  return Math.min(max, num);
}

export const getGames = async (_req: Request, res: Response) => {
  try {
    const games = await prisma.game.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        enabled: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      data: games.map((g) => ({
        id: g.id,
        slug: g.slug,
        name: g.name,
        enabled: g.enabled,
        updatedAt: g.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching TCG games:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch games' });
  }
};

export const getSets = async (req: Request, res: Response) => {
  try {
    const gameSlug = req.params.game;
    const sort = (req.query.sort as string | undefined) || 'release_date_desc';
    const page = parsePage(req.query.page as string | undefined, 1);
    const perPage = parsePerPage(req.query.perPage as string | undefined, 50, 200);
    const skip = (page - 1) * perPage;

    const game = await prisma.game.findUnique({
      where: { slug: gameSlug },
      select: { id: true, slug: true, name: true, enabled: true },
    });
    if (!game || !game.enabled) {
      return res.status(404).json({ success: false, error: 'Game not found or disabled' });
    }

    const orderBy = sort === 'release_date_asc'
      ? [{ releaseDate: 'asc' as const }, { name: 'asc' as const }]
      : [{ releaseDate: 'desc' as const }, { name: 'asc' as const }];

    const [sets, totalCount, latestPriceTs] = await Promise.all([
      prisma.tcgSet.findMany({
        where: { gameId: game.id },
        orderBy,
        skip,
        take: perPage,
      }),
      prisma.tcgSet.count({ where: { gameId: game.id } }),
      prisma.priceLatest.aggregate({
        _max: { updatedAt: true },
        where: { card: { gameId: game.id } },
      }),
    ]);

    res.json({
      success: true,
      data: sets.map((set) => ({
        id: set.id,
        provider: set.provider,
        providerSetId: set.providerSetId,
        name: set.name,
        releaseDate: set.releaseDate?.toISOString(),
        series: set.series ?? null,
        total: set.total ?? null,
        images: set.images ?? null,
        updatedAt: set.updatedAt.toISOString(),
      })),
      meta: {
        game: game.slug,
        asOf: latestPriceTs._max.updatedAt?.toISOString() ?? null,
        page,
        perPage,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / perPage)),
      },
    });
  } catch (error) {
    console.error('Error fetching TCG sets:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sets' });
  }
};

export const getSetCards = async (req: Request, res: Response) => {
  try {
    const gameSlug = req.params.game;
    const setId = req.params.setId;
    const query = (req.query.query as string | undefined)?.trim();
    const rarity = (req.query.rarity as string | undefined)?.trim();
    const page = parsePage(req.query.page as string | undefined, 1);
    const perPage = parsePerPage(req.query.perPage as string | undefined, 60, 200);
    const skip = (page - 1) * perPage;

    const game = await prisma.game.findUnique({
      where: { slug: gameSlug },
      select: { id: true, enabled: true },
    });
    if (!game || !game.enabled) {
      return res.status(404).json({ success: false, error: 'Game not found or disabled' });
    }

    const where = {
      gameId: game.id,
      setId,
      ...(query ? { name: { contains: query, mode: 'insensitive' as const } } : {}),
      ...(rarity ? { rarity } : {}),
    };

    const [cards, totalCount] = await Promise.all([
      prisma.tcgCard.findMany({
        where,
        orderBy: [{ number: 'asc' }, { name: 'asc' }],
        skip,
        take: perPage,
        include: {
          latestPrices: {
            orderBy: { updatedAt: 'desc' },
          },
        },
      }),
      prisma.tcgCard.count({ where }),
    ]);

    const asOf = cards
      .flatMap((c) => c.latestPrices.map((p) => p.updatedAt))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    res.json({
      success: true,
      data: cards.map((card) => ({
        id: card.id,
        provider: card.provider,
        providerCardId: card.providerCardId,
        name: card.name,
        number: card.number,
        rarity: card.rarity,
        images: card.images ?? null,
        tcgplayerId: card.tcgplayerId ?? null,
        scryfallId: card.scryfallId ?? null,
        prices: card.latestPrices.map((price) => ({
          source: price.source,
          currency: price.currency,
          market: price.market,
          low: price.low,
          mid: price.mid,
          high: price.high,
          directLow: price.directLow,
          updatedAt: price.updatedAt.toISOString(),
        })),
        updatedAt: card.updatedAt.toISOString(),
      })),
      meta: {
        asOf: asOf?.toISOString() ?? null,
        page,
        perPage,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / perPage)),
      },
    });
  } catch (error) {
    console.error('Error fetching TCG set cards:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch cards' });
  }
};

export const getCard = async (req: Request, res: Response) => {
  try {
    const gameSlug = req.params.game;
    const cardId = req.params.cardId;

    const game = await prisma.game.findUnique({
      where: { slug: gameSlug },
      select: { id: true, slug: true, enabled: true },
    });
    if (!game || !game.enabled) {
      return res.status(404).json({ success: false, error: 'Game not found or disabled' });
    }

    const card = await prisma.tcgCard.findFirst({
      where: { id: cardId, gameId: game.id },
      include: {
        set: true,
        latestPrices: {
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    if (!card) {
      return res.status(404).json({ success: false, error: 'Card not found' });
    }

    const asOf = card.latestPrices.length > 0 ? card.latestPrices[0].updatedAt.toISOString() : null;
    res.json({
      success: true,
      data: {
        id: card.id,
        provider: card.provider,
        providerCardId: card.providerCardId,
        name: card.name,
        number: card.number,
        rarity: card.rarity,
        images: card.images ?? null,
        tcgplayerId: card.tcgplayerId ?? null,
        scryfallId: card.scryfallId ?? null,
        set: {
          id: card.set.id,
          provider: card.set.provider,
          providerSetId: card.set.providerSetId,
          name: card.set.name,
          releaseDate: card.set.releaseDate?.toISOString() ?? null,
          series: card.set.series ?? null,
          total: card.set.total ?? null,
          images: card.set.images ?? null,
        },
        prices: card.latestPrices.map((price) => ({
          source: price.source,
          currency: price.currency,
          market: price.market,
          low: price.low,
          mid: price.mid,
          high: price.high,
          directLow: price.directLow,
          updatedAt: price.updatedAt.toISOString(),
        })),
        updatedAt: card.updatedAt.toISOString(),
      },
      meta: {
        asOf,
      },
    });
  } catch (error) {
    console.error('Error fetching TCG card:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch card' });
  }
};

