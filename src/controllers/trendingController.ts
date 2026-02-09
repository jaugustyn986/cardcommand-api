// ============================================
// CardCommand Center - Trending Controller
// ============================================

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// Get Trending Items
// ============================================

export const getTrending = async (req: Request, res: Response) => {
  try {
    const { category, limit = '10' } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10) || 10, 100);

    const where: Record<string, unknown> = {};
    if (category && typeof category === 'string') {
      where.category = category;
    }

    const trendingItems = await prisma.trendingItem.findMany({
      where,
      orderBy: { calculatedAt: 'desc' },
      take: limitNum,
    });

    const transformedItems = trendingItems.map(item => ({
      id: item.id,
      cardName: item.cardName,
      cardSet: item.cardSet,
      category: item.category,
      currentPrice: Number(item.currentPrice),
      priceChange24h: Number(item.priceChange24h),
      priceChange7d: Number(item.priceChange7d),
      priceChange30d: Number(item.priceChange30d),
      volumeIncrease: item.volumeIncrease,
      searchVolume: item.searchVolume,
      sentiment: item.sentiment,
      calculatedAt: item.calculatedAt.toISOString(),
    }));

    res.json({
      success: true,
      data: transformedItems,
    });
  } catch (error) {
    console.error('Error fetching trending:', error);
    // Return empty data so frontend can still render (e.g. table missing or empty)
    res.status(200).json({
      success: true,
      data: [],
    });
  }
};

// ============================================
// Get Market Heatmap
// ============================================

export const getHeatmap = async (req: Request, res: Response) => {
  const emptyHeatmap = () =>
    res.json({
      success: true,
      data: {
        categories: ['Baseball', 'Basketball', 'Football', 'TCG'],
        priceRanges: ['$0-50', '$50-250', '$250-1K', '$1K+'],
        bubbles: [],
      },
    });

  try {
    const heatmapData = await prisma.$queryRaw<
      Array<{
        category: string;
        price_range: string;
        avg_volume: number | null;
        card_count: bigint;
        avg_change: number | null;
      }>
    >`
      SELECT 
        category,
        CASE 
          WHEN current_price < 50 THEN '$0-50'
          WHEN current_price < 250 THEN '$50-250'
          WHEN current_price < 1000 THEN '$250-1K'
          ELSE '$1K+'
        END as price_range,
        AVG(volume_increase) as avg_volume,
        COUNT(*) as card_count,
        AVG(price_change_24h) as avg_change
      FROM "trending_items"
      WHERE calculated_at > NOW() - INTERVAL '7 days'
      GROUP BY category, price_range
    `;

    const bubbles = heatmapData.map(row => ({
      category: row.category,
      priceRange: row.price_range,
      volume: Math.round(Number(row.avg_volume) || 0),
      count: Number(row.card_count) || 0,
      change: Number(row.avg_change) || 0,
      size: (row.avg_volume ?? 0) > 200 ? 3 : (row.avg_volume ?? 0) > 100 ? 2 : 1,
    }));

    res.json({
      success: true,
      data: {
        categories: ['Baseball', 'Basketball', 'Football', 'TCG'],
        priceRanges: ['$0-50', '$50-250', '$250-1K', '$1K+'],
        bubbles,
      },
    });
  } catch (error) {
    console.error('Error fetching heatmap:', error);
    return emptyHeatmap();
  }
};
