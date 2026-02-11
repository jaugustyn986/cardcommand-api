// ============================================
// CardCommand Center - Admin Controller
// Admin-only endpoints for system management
// ============================================

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { syncAllReleases, backfillTierALinks } from '../releaseSyncService';
import { scrapeAndUpsertReleaseProducts } from '../releaseScrapeService';
import { backfillStrategiesForPokemon } from '../releaseStrategyService';

const prisma = new PrismaClient();

// ============================================
// Trigger Release Sync (Manual)
// ============================================

export async function triggerReleaseSync(req: Request, res: Response) {
  try {
    console.log('🔄 Manual release sync triggered by admin');

    const results = await syncAllReleases();

    // Backfill buyUrl, sourceUrl, estimatedResale for set_default products missing them (catches pre-deploy data)
    let tierALinksBackfilled = 0;
    try {
      tierALinksBackfilled = await backfillTierALinks();
    } catch (err) {
      console.error('⚠️ Tier A links backfill failed:', err);
    }

    // After API sync, run Tier B pipeline (scrape + AI extraction) to enrich release products
    let scrapeResult: { sources: number; productsUpserted: number; changesDetected: number; strategiesGenerated?: number } | undefined;
    try {
      scrapeResult = await scrapeAndUpsertReleaseProducts();
      console.log(`✅ Scrape complete: ${scrapeResult.productsUpserted} products upserted, ${scrapeResult.changesDetected} changes from ${scrapeResult.sources} source(s)`);
    } catch (scrapeErr) {
      console.error('⚠️ Scrape step failed (releases still synced):', scrapeErr);
    }

    // Backfill strategies for Pokémon products that don't have one yet (Tier A set_default products)
    let strategiesBackfilled = 0;
    try {
      strategiesBackfilled = await backfillStrategiesForPokemon();
    } catch (backfillErr) {
      console.error('⚠️ Strategy backfill failed:', backfillErr);
    }

    res.json({
      success: true,
      message: 'Release sync completed',
      data: {
        ...results,
        tierALinksBackfilled,
        scrape: scrapeResult,
        strategiesBackfilled,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Manual release sync failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync releases',
    });
  }
}

// ============================================
// Get Sync Status
// ============================================

export async function getSyncStatus(req: Request, res: Response) {
  try {
    // Get counts by category
    const [pokemonCount, mtgCount, yugiohCount, onePieceCount, basketballCount, footballCount, baseballCount] = await Promise.all([
      prisma.release.count({ where: { category: 'pokemon' } }),
      prisma.release.count({ where: { category: 'mtg' } }),
      prisma.release.count({ where: { category: 'yugioh' } }),
      prisma.release.count({ where: { category: 'one_piece' } }),
      prisma.release.count({ where: { category: 'basketball' } }),
      prisma.release.count({ where: { category: 'football' } }),
      prisma.release.count({ where: { category: 'baseball' } }),
    ]);

    // Get upcoming releases
    const upcomingReleases = await prisma.release.count({
      where: {
        releaseDate: {
          gte: new Date(),
        },
      },
    });

    // Get recently added releases (last 24 hours)
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);
    
    const recentlyAdded = await prisma.release.count({
      where: {
        createdAt: {
          gte: last24Hours,
        },
      },
    });

    res.json({
      success: true,
      data: {
        counts: {
          pokemon: pokemonCount,
          mtg: mtgCount,
          yugioh: yugiohCount,
          one_piece: onePieceCount,
          basketball: basketballCount,
          football: footballCount,
          baseball: baseballCount,
          total: pokemonCount + mtgCount + yugiohCount + onePieceCount + 
                 basketballCount + footballCount + baseballCount,
        },
        upcoming: upcomingReleases,
        recentlyAdded: recentlyAdded,
      },
    });
  } catch (error) {
    console.error('❌ Error getting sync status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync status',
    });
  }
}

// ============================================
// Get API Health Status
// ============================================

export async function getApiHealth(req: Request, res: Response) {
  try {
    const health = {
      database: await checkDatabaseHealth(),
      pokemonApi: await checkPokemonApiHealth(),
      scryfallApi: await checkScryfallApiHealth(),
    };

    const allHealthy = Object.values(health).every(h => h.status === 'healthy');

    res.json({
      success: true,
      data: health,
      overall: allHealthy ? 'healthy' : 'degraded',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check API health',
    });
  }
}

async function checkDatabaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', responseTime: '< 100ms' };
  } catch (error) {
    return { status: 'unhealthy', error: 'Database connection failed' };
  }
}

async function checkPokemonApiHealth() {
  try {
    const axios = (await import('axios')).default;
    const start = Date.now();
    await axios.get('https://api.pokemontcg.io/v2/sets?pageSize=1', {
      timeout: 5000,
    });
    return { status: 'healthy', responseTime: `${Date.now() - start}ms` };
  } catch (error) {
    return { status: 'unhealthy', error: 'Pokemon API unreachable' };
  }
}

async function checkScryfallApiHealth() {
  try {
    const axios = (await import('axios')).default;
    const start = Date.now();
    await axios.get('https://api.scryfall.com/sets', {
      timeout: 5000,
    });
    return { status: 'healthy', responseTime: `${Date.now() - start}ms` };
  } catch (error) {
    return { status: 'unhealthy', error: 'Scryfall API unreachable' };
  }
}
