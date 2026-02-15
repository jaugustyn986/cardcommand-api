// ============================================
// CardCommand Center - Admin Controller
// Admin-only endpoints for system management
// ============================================

import { Request, Response } from 'express';
import { runReleaseSyncPipeline } from '../releaseSyncPipeline';
import { runTcgFullSync } from '../jobs/tcgSyncJob';
import { prisma } from '../config/database';
import {
  beginReleaseSyncRun,
  finishReleaseSyncRunFailure,
  finishReleaseSyncRunSuccess,
  getReleaseSyncRunState,
} from '../services/release/releaseSyncRunState';
import {
  beginTcgSyncRun,
  finishTcgSyncRunFailure,
  finishTcgSyncRunSuccess,
  getTcgSyncRunState,
} from '../services/tcg/tcgSyncRunState';

// ============================================
// Trigger Release Sync (Manual)
// ============================================

export async function triggerReleaseSync(req: Request, res: Response) {
  const started = beginReleaseSyncRun('manual');
  if (!started.accepted) {
    return res.status(409).json({
      success: false,
      error: 'A release sync is already running',
      data: {
        runId: started.run.runId,
        startedAt: started.run.startedAt,
      },
    });
  }

  const { runId } = started.run;
  console.log(`🔄 Manual release sync accepted (runId=${runId})`);

  void runReleaseSyncPipeline()
    .then((data) => {
      finishReleaseSyncRunSuccess(runId, data);
      console.log(`✅ Manual release sync completed (runId=${runId})`);
    })
    .catch((error) => {
      finishReleaseSyncRunFailure(runId, error);
      console.error(`❌ Manual release sync failed (runId=${runId}):`, error);
    });

  return res.status(202).json({
    success: true,
    message: 'Release sync started',
    data: {
      runId,
      startedAt: started.run.startedAt,
    },
  });
}

// ============================================
// Get Release Sync Run Status
// ============================================

export async function getReleaseSyncStatus(req: Request, res: Response) {
  try {
    const state = getReleaseSyncRunState();
    res.json({
      success: true,
      data: state,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Failed to get release sync run status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get release sync run status',
    });
  }
}

// ============================================
// Trigger TCG Sync (Manual)
// ============================================

export async function triggerTcgSync(req: Request, res: Response) {
  const started = beginTcgSyncRun('manual');
  if (!started.accepted) {
    return res.status(409).json({
      success: false,
      error: 'A TCG sync is already running',
      data: {
        runId: started.run.runId,
        startedAt: started.run.startedAt,
      },
    });
  }

  const { runId } = started.run;
  console.log(`🔄 Manual TCG sync accepted (runId=${runId})`);

  void runTcgFullSync()
    .then((data) => {
      finishTcgSyncRunSuccess(runId, data);
      console.log(`✅ Manual TCG sync completed (runId=${runId})`);
    })
    .catch((error) => {
      finishTcgSyncRunFailure(runId, error);
      console.error(`❌ Manual TCG sync failed (runId=${runId}):`, error);
    });

  return res.status(202).json({
    success: true,
    message: 'TCG sync started',
    data: {
      runId,
      startedAt: started.run.startedAt,
    },
  });
}

// ============================================
// Get TCG Sync Run Status
// ============================================

export async function getTcgSyncStatus(req: Request, res: Response) {
  try {
    const state = getTcgSyncRunState();
    res.json({
      success: true,
      data: state,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Failed to get TCG sync run status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get TCG sync run status',
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
