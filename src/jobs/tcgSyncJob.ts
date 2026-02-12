import cron from 'node-cron';
import { runTcgSyncPipeline, syncCardsForNewOrRecentSets, syncPricesRecent, syncSets } from '../services/tcg/tcgSyncPipeline';
import { tcgConfig } from '../services/tcg/config';

let runningSets = false;
let runningCards = false;
let runningPrices = false;
let runningOlderPrices = false;

const ENABLED = tcgConfig.syncEnabled;

export async function runTcgSetsSync(): Promise<void> {
  if (runningSets) return;
  runningSets = true;
  try {
    const count = await syncSets('pokemon');
    console.log(`✅ TCG sets sync complete (pokemon): ${count}`);
  } catch (error) {
    console.error('❌ TCG sets sync failed:', error);
  } finally {
    runningSets = false;
  }
}

export async function runTcgCardsSync(): Promise<void> {
  if (runningCards) return;
  runningCards = true;
  try {
    const count = await syncCardsForNewOrRecentSets('pokemon');
    console.log(`✅ TCG cards sync complete (pokemon): ${count}`);
  } catch (error) {
    console.error('❌ TCG cards sync failed:', error);
  } finally {
    runningCards = false;
  }
}

export async function runTcgPricesRecentSync(): Promise<void> {
  if (runningPrices) return;
  runningPrices = true;
  try {
    const recent = await syncPricesRecent('pokemon', true);
    console.log(`✅ TCG recent price sync complete (pokemon): ${recent}`);
  } catch (error) {
    console.error('❌ TCG price sync failed:', error);
  } finally {
    runningPrices = false;
  }
}

export async function runTcgPricesOlderDailySync(): Promise<void> {
  if (runningOlderPrices) return;
  runningOlderPrices = true;
  try {
    const older = await syncPricesRecent('pokemon', false);
    console.log(`✅ TCG older price daily sync complete (pokemon): ${older}`);
  } catch (error) {
    console.error('❌ TCG older daily price sync failed:', error);
  } finally {
    runningOlderPrices = false;
  }
}

export async function runTcgFullSync(): Promise<void> {
  try {
    const results = await runTcgSyncPipeline('pokemon');
    console.log('✅ TCG full sync completed:', results);
  } catch (error) {
    console.error('❌ TCG full sync failed:', error);
  }
}

export function startTcgSyncCron(): void {
  if (!ENABLED) {
    console.log('⏭️ TCG sync cron disabled (set TCG_SYNC_ENABLED=true to enable)');
    return;
  }

  // sync_sets(game) daily
  cron.schedule('10 3 * * *', () => {
    runTcgSetsSync().catch(console.error);
  }, { timezone: 'UTC' });

  // sync_cards_for_new_or_recent_sets(game) daily
  cron.schedule('40 3 * * *', () => {
    runTcgCardsSync().catch(console.error);
  }, { timezone: 'UTC' });

  // sync_prices_recent(game) every 6 hours
  cron.schedule('0 */6 * * *', () => {
    runTcgPricesRecentSync().catch(console.error);
  }, { timezone: 'UTC' });

  // Older sets pricing refresh: daily
  cron.schedule('20 4 * * *', () => {
    runTcgPricesOlderDailySync().catch(console.error);
  }, { timezone: 'UTC' });

  console.log('⏰ TCG sync cron scheduled (sets/cards daily, recent prices every 6h, older prices daily UTC)');

  if (process.env.NODE_ENV === 'development') {
    runTcgFullSync().catch(console.error);
  }
}

