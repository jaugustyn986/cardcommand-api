// ============================================
// CardCommand Center - Deals Controller
// ============================================

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { Errors } from '../middleware/errorHandler';

// Get deals with filters
export async function getDeals(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const perPage = Math.min(parseInt(req.query.perPage as string) || 20, 100);

    const where: Record<string, unknown> = { isActive: true };

    const total = await prisma.deal.count({ where }).catch(() => 0);

    const deals = await prisma.deal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }).catch(() => []);

    res.json({ 
      success: true, 
      data: deals,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage) || 1,
      }
    });
  } catch (error) {
    console.error('Get deals error:', error);
    res.json({ 
      success: true, 
      data: [],
      meta: { total: 0, page: 1, perPage: 20, totalPages: 1 }
    });
  }
}

// Get single deal
export async function getDeal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const deal = await prisma.deal.findUnique({
      where: { id },
    });

    if (!deal) {
      throw Errors.notFound('Deal');
    }

    res.json({ success: true, data: deal });
  } catch (error) {
    next(error);
  }
}

// Track a deal
export async function trackDeal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw Errors.unauthorized();
    }

    const { id } = req.params;

    const deal = await prisma.deal.findUnique({
      where: { id },
    });

    if (!deal) {
      throw Errors.notFound('Deal');
    }

    await prisma.trackedDeal.create({
      data: {
        userId: req.user.id,
        dealId: id,
      },
    });

    res.json({
      success: true,
      data: { message: 'Deal tracked successfully' },
    });
  } catch (error) {
    next(error);
  }
}

// Untrack a deal
export async function untrackDeal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw Errors.unauthorized();
    }

    const { id } = req.params;

    await prisma.trackedDeal.deleteMany({
      where: {
        userId: req.user.id,
        dealId: id,
      },
    });

    res.json({
      success: true,
      data: { message: 'Deal untracked successfully' },
    });
  } catch (error) {
    next(error);
  }
}

// Get user's tracked deals
export async function getTrackedDeals(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw Errors.unauthorized();
    }

    const trackedDeals = await prisma.trackedDeal.findMany({
      where: { userId: req.user.id },
      include: { deal: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: trackedDeals.map(td => td.deal),
    });
  } catch (error) {
    next(error);
  }
}

// Server-Sent Events for real-time deal updates
export function dealStream(req: Request, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.write('data: {"type": "connected"}\n\n');

  const keepAlive = setInterval(() => {
    res.write('data: {"type": "ping"}\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
}
