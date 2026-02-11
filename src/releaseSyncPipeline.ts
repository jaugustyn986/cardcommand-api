// ============================================
// CardCommand Center - Release Sync Pipeline
// Full pipeline: Tier A + backfill links + Tier B/C scrape + strategy backfill
// Used by both admin endpoint and scheduled cron
// ============================================

import { syncAllReleases, backfillTierALinks } from './releaseSyncService';
import { scrapeAndUpsertReleaseProducts } from './releaseScrapeService';
import { backfillStrategiesForPokemon } from './releaseStrategyService';

export interface SyncPipelineResult {
  pokemon: number;
  mtg: number;
  tierALinksBackfilled: number;
  scrape?: {
    sources: number;
    productsUpserted: number;
    changesDetected: number;
    strategiesGenerated?: number;
  };
  strategiesBackfilled: number;
}

export async function runReleaseSyncPipeline(): Promise<SyncPipelineResult> {
  const results = await syncAllReleases();

  let tierALinksBackfilled = 0;
  try {
    tierALinksBackfilled = await backfillTierALinks();
  } catch (err) {
    console.error('⚠️ Tier A links backfill failed:', err);
  }

  let scrapeResult: SyncPipelineResult['scrape'];
  try {
    scrapeResult = await scrapeAndUpsertReleaseProducts();
    console.log(
      `✅ Scrape complete: ${scrapeResult.productsUpserted} products upserted, ${scrapeResult.changesDetected} changes from ${scrapeResult.sources} source(s)`,
    );
  } catch (scrapeErr) {
    console.error('⚠️ Scrape step failed (releases still synced):', scrapeErr);
  }

  let strategiesBackfilled = 0;
  try {
    strategiesBackfilled = await backfillStrategiesForPokemon();
  } catch (backfillErr) {
    console.error('⚠️ Strategy backfill failed:', backfillErr);
  }

  return {
    ...results,
    tierALinksBackfilled,
    scrape: scrapeResult,
    strategiesBackfilled,
  };
}
