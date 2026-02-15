// ============================================
// CardCommand Center - Release Sync Pipeline
// Full pipeline: Tier A + backfill links + Tier B/C scrape + strategy backfill
// Used by both admin endpoint and scheduled cron
// ============================================

import {
  syncAllReleases,
  backfillTierALinks,
  backfillPokemonSetDefaultPricing,
  backfillSealedProductMarketPricing,
  backfillPokemonSealedSkuRows,
  backfillReleaseTopChasesFromTcg,
} from './releaseSyncService';
import { scrapeAndUpsertReleaseProducts } from './releaseScrapeService';
import { backfillStrategiesForPokemon } from './releaseStrategyService';

export interface SyncPipelineResult {
  pokemon: number;
  mtg: number;
  tierALinksBackfilled: number;
  pokemonSetPricingCleaned: number;
  sealedSkuRowsCreated: number;
  sealedMarketPricingBackfilled: number;
  topChasesBackfilled: number;
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

  let pokemonSetPricingCleaned = 0;
  try {
    pokemonSetPricingCleaned = await backfillPokemonSetDefaultPricing();
  } catch (err) {
    console.error('⚠️ Pokémon set_default pricing cleanup failed:', err);
  }

  let sealedSkuRowsCreated = 0;
  try {
    sealedSkuRowsCreated = await backfillPokemonSealedSkuRows();
  } catch (err) {
    console.error('⚠️ Pokémon sealed SKU row backfill failed:', err);
  }

  let sealedMarketPricingBackfilled = 0;
  try {
    sealedMarketPricingBackfilled = await backfillSealedProductMarketPricing();
  } catch (err) {
    console.error('⚠️ Sealed market pricing backfill failed:', err);
  }

  let topChasesBackfilled = 0;
  try {
    topChasesBackfilled = await backfillReleaseTopChasesFromTcg(5);
  } catch (err) {
    console.error('⚠️ Top chases backfill failed:', err);
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
    pokemonSetPricingCleaned,
    sealedSkuRowsCreated,
    sealedMarketPricingBackfilled,
    topChasesBackfilled,
    scrape: scrapeResult,
    strategiesBackfilled,
  };
}
