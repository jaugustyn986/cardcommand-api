import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { cache, cacheKeys } from '../config/redis';
import { Errors } from '../middleware/errorHandler';

export async function getPortfolio(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw Errors.unauthorized();

    const cacheKey = cacheKeys.portfolio(req.user.id);
    const cached = await cache.get(cacheKey);
    if (cached) {
      res.json({ success: true, data: cached });
      return;
    }

    const portfolio = await prisma.portfolioItem.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    await cache.set(cacheKey, portfolio, 120);
    res.json({ success: true, data: portfolio });
  } catch (error) {
    next(error);
  }
}

export async function getPortfolioStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw Errors.unauthorized();

    const cacheKey = cacheKeys.portfolioStats(req.user.id);
    const cached = await cache.get(cacheKey);
    if (cached) {
      res.json({ success: true, data: cached });
      return;
    }

    const items = await prisma.portfolioItem.findMany({ where: { userId: req.user.id } });

    const totalValue = items.reduce((sum, item) => sum + (item.currentValue.toNumber() * item.quantity), 0);
    const totalCost = items.reduce((sum, item) => sum + (item.purchasePrice.toNumber() * item.quantity), 0);
    const totalProfit = totalValue - totalCost;
    const profitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
    const gradingQueue = items.filter(item => item.inGradingQueue).length;

    const stats = {
      totalValue,
      totalCost,
      totalProfit,
      profitPercent: parseFloat(profitPercent.toFixed(2)),
      change24h: 0,
      change24hPercent: 0,
      change30d: 0,
      change30dPercent: 0,
      gradingQueue,
      totalCards: items.reduce((sum, item) => sum + item.quantity, 0),
    };

    await cache.set(cacheKey, stats, 60);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
}

export async function addPortfolioItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw Errors.unauthorized();

    const item = await prisma.portfolioItem.create({
      data: { ...req.body, userId: req.user.id },
    });

    await cache.delete(cacheKeys.portfolio(req.user.id));
    await cache.delete(cacheKeys.portfolioStats(req.user.id));

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function updatePortfolioItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw Errors.unauthorized();
    const { id } = req.params;

    const existing = await prisma.portfolioItem.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existing) throw Errors.notFound('Portfolio item');

    const item = await prisma.portfolioItem.update({
      where: { id },
      data: req.body,
    });

    await cache.delete(cacheKeys.portfolio(req.user.id));
    await cache.delete(cacheKeys.portfolioStats(req.user.id));

    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function deletePortfolioItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw Errors.unauthorized();
    const { id } = req.params;

    const existing = await prisma.portfolioItem.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existing) throw Errors.notFound('Portfolio item');

    await prisma.portfolioItem.delete({ where: { id } });

    await cache.delete(cacheKeys.portfolio(req.user.id));
    await cache.delete(cacheKeys.portfolioStats(req.user.id));

    res.json({ success: true, data: { message: 'Item deleted' } });
  } catch (error) {
    next(error);
  }
}

export async function getGradingQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw Errors.unauthorized();

    const items = await prisma.portfolioItem.findMany({
      where: { userId: req.user.id, inGradingQueue: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

export async function addToGradingQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw Errors.unauthorized();
    const { id } = req.params;

    const existing = await prisma.portfolioItem.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existing) throw Errors.notFound('Portfolio item');

    await prisma.portfolioItem.update({ where: { id }, data: { inGradingQueue: true } });
    res.json({ success: true, data: { message: 'Added to grading queue' } });
  } catch (error) {
    next(error);
  }
}
