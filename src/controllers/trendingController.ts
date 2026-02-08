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
    const limitNum = parseInt(limit as string, 10);

    // Build where clause
    const where: any = {};
    if (category) {
      where.category = category;
    }

    // Get trending items from database
    const trendingItems = await prisma.trendingItem.findMany({
      where,
      orderBy: { calculatedAt: 'desc' },
      take: limitNum,
    });

    // Transform for response
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
      data: transformedItems
    });
  } catch (error) {
    console.error('Error fetching trending:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trending items'
    });
  }
};

// ============================================
// Get Market Heatmap
// ============================================

export const getHeatmap = async (req: Request, res: Response) => {
  try {
    // Get aggregated data for heatmap bubbles
    const heatmapData = await prisma.$queryRaw`
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

    // Transform to bubble format
    const bubbles = (heatmapData as any[]).map(row => ({
      category: row.category,
      priceRange: row.price_range,
      volume: Math.round(row.avg_volume),
      count: parseInt(row.card_count),
      change: Number(row.avg_change),
      // Size: 1=small (low), 2=medium, 3=large (high)
      size: row.avg_volume > 200 ? 3 : row.avg_volume > 100 ? 2 : 1
    }));

    res.json({
      success: true,
      data: {
        categories: ['Baseball', 'Basketball', 'Football', 'TCG'],
        priceRanges: ['$0-50', '$50-250', '$250-1K', '$1K+'],
        bubbles
      }
    });
  } catch (error) {
    console.error('Error fetching heatmap:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch heatmap data'
    });
  }
};
