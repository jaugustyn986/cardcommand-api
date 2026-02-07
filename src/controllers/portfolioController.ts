// ============================================
// CardCommand Center - Portfolio Controller
// ============================================

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { Errors } from '../middleware/errorHandler';

// Get user's portfolio
export async function getPortfolio(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw Errors.unauthorized();
    }

    const portfolio = await prisma.portfolioItem.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate portfolio stats
    const stats = portfolio.reduce((acc, item) => {
      const currentValue = Number(item.currentValue);
      const purchasePrice = Number(item.purchasePrice);
      const quantity = item.quantity;
      
      acc.totalValue += currentValue * quantity;
      acc.totalCost += purchasePrice * quantity;
      acc.totalCards += quantity;
      if (item.inGradingQueue) {
        acc.gradingQueue += quantity;
      }
      return acc;
    }, {
      totalValue: 0,
      totalCost: 0,
      totalCards: 0,
      gradingQueue: 0,
    });

    const totalProfit = stats.totalValue - stats.totalCost;
    const profitPercent = stats.totalCost > 0 
      ? (totalProfit / stats.totalCost) * 100 
      : 0;

    res.json({
      success: true,
      data: {
        items: portfolio,
        stats: {
          ...stats,
          totalProfit,
          profitPercent: Number(profitPercent.toFixed(2)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

// Get grading queue
export async function getGradingQueue(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw Errors.unauthorized();
    }

    const queue = await prisma.portfolioItem.findMany({
      where: { 
        userId: req.user.id,
        inGradingQueue: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: queue,
    });
  } catch (error) {
    next(error);
  }
}

// Add item to grading queue
export async function addToGradingQueue(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw Errors.unauthorized();
    }

    const { id } = req.params;

    const item = await prisma.portfolioItem.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!item) {
      throw Errors.notFound('Portfolio item');
    }

    const updated = await prisma.portfolioItem.update({
      where: { id },
      data: { inGradingQueue: true },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

// Add item to portfolio
export async function addPortfolioItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw Errors.unauthorized();
    }

    const {
      cardName,
      cardSet,
      year,
      grade,
      grader,
      currentValue,
      purchasePrice,
      quantity,
      imageUrl,
      notes,
    } = req.body;

    const item = await prisma.portfolioItem.create({
      data: {
        userId: req.user.id,
        cardName,
        cardSet,
        year,
        grade,
        grader,
        currentValue,
        purchasePrice,
        quantity: quantity || 1,
        imageUrl,
        notes,
      },
    });

    res.json({
      success: true,
      data: item,
    });
  } catch (error) {
    next(error);
  }
}

// Update portfolio item
export async function updatePortfolioItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw Errors.unauthorized();
    }

    const { id } = req.params;
    const { currentValue, quantity, notes, inGradingQueue } = req.body;

    const item = await prisma.portfolioItem.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!item) {
      throw Errors.notFound('Portfolio item');
    }

    const updated = await prisma.portfolioItem.update({
      where: { id },
      data: {
        currentValue,
        quantity,
        notes,
        inGradingQueue,
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

// Delete portfolio item
export async function deletePortfolioItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw Errors.unauthorized();
    }

    const { id } = req.params;

    const item = await prisma.portfolioItem.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!item) {
      throw Errors.notFound('Portfolio item');
    }

    await prisma.portfolioItem.delete({
      where: { id },
    });

    res.json({
      success: true,
      data: { message: 'Item deleted' },
    });
  } catch (error) {
    next(error);
  }
}

// Get portfolio stats
export async function getPortfolioStats(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw Errors.unauthorized();
    }

    const items = await prisma.portfolioItem.findMany({
      where: { userId: req.user.id },
    });

    const stats = items.reduce((acc, item) => {
      const currentValue = Number(item.currentValue);
      const purchasePrice = Number(item.purchasePrice);
      
      acc.totalValue += currentValue * item.quantity;
      acc.totalCost += purchasePrice * item.quantity;
      acc.totalProfit += (currentValue - purchasePrice) * item.quantity;
      return acc;
    }, {
      totalValue: 0,
      totalCost: 0,
      totalProfit: 0,
    });

    const profitPercent = stats.totalCost > 0
      ? (stats.totalProfit / stats.totalCost) * 100
      : 0;

    res.json({
      success: true,
      data: {
        ...stats,
        profitPercent: Number(profitPercent.toFixed(2)),
      },
    });
  } catch (error) {
    next(error);
  }
}
