import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { cache, cacheKeys } from '../config/redis';
import { Errors } from '../middleware/errorHandler';
import { DealFilters } from '../types';

export async function getDeals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters: DealFilters = req.query as unknown as DealFilters;
    const page = parseInt(req.query.page as string) || 1;
    const perPage = Math.min(parseInt(req.query.perPage as string) || 20, 100);

    const cacheKey = cacheKeys.deals(JSON.stringify({ filters, page, perPage }));
    const cached = await cache.get<{ data: unknown[]; meta: unknown }>(cacheKey);
    
    if (cached) {
      res.json({ success: true, data: cached.data, meta: cached.meta });
      return;
    }

    const where: Record<string, unknown> = { isActive: true };

    if (filters.categories?.length) {
      where.category = { in: filters.categories };
    }
    if (filters.minSavings !== undefined) {
      where.savingsPercent = { gte: filters.minSavings };
    }
    if (filters.maxPrice !== undefined) {
      where.dealPrice = { lte: filters.maxPrice };
    }
    if (filters.grades?.length) {
      where.grade = { in: filters.grades };
    }
    if (filters.search) {
      where.OR = [
        { cardName: { contains: filters.search, mode: 'insensitive' } },
        { cardSet: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const total = await prisma.deal.count({ where });
    const deals = await prisma.deal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    const result = {
      data: deals,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };

    await cache.set(cacheKey, result, 300);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getDeal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const cacheKey = cacheKeys.deal(id);
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      res.json({ success: true, data: cached });
      return;
    }

    const deal = await prisma.deal.findUnique({ where: { id } });
    if (!deal) throw Errors.notFound('Deal');

    await cache.set(cacheKey, deal, 600);
    res.json({ success: true, data: deal });
  } catch (error) {
    next(error);
  }
}

export async function trackDeal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw Errors.unauthorized();
    const { id } = req.params;

    const deal = await prisma.deal.findUnique({ where: { id } });
    if (!deal) throw Errors.notFound('Deal');

    await prisma.trackedDeal.create({
      data: { userId: req.user.id, dealId: id },
    });

    res.json({ success: true, data: { message: 'Deal tracked successfully' } });
  } catch (error) {
    next(error);
  }
}

export async function untrackDeal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw Errors.unauthorized();
    const { id } = req.params;

    await prisma.trackedDeal.deleteMany({
      where: { userId: req.user.id, dealId: id },
    });

    res.json({ success: true, data: { message: 'Deal untracked successfully' } });
  } catch (error) {
    next(error);
  }
}

export async function getTrackedDeals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw Errors.unauthorized();

    const trackedDeals = await prisma.trackedDeal.findMany({
      where: { userId: req.user.id },
      include: { deal: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: trackedDeals.map(td => td.deal) });
  } catch (error) {
    next(error);
  }
}

export function dealStream(req: Request, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write('data: {"type": "connected"}\n\n');

  const keepAlive = setInterval(() => {
    res.write('data: {"type": "ping"}\n\n');
  }, 30000);

  req.on('close', () => clearInterval(keepAlive));
}
