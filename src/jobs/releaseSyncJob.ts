// ============================================
// CardCommand Center - Release Sync Job
// Scheduled cron: full pipeline at 6:00, 12:00, 18:00 UTC
// ============================================

import cron from 'node-cron';
import { runReleaseSyncPipeline } from '../releaseSyncPipeline';

let isRunning = false;

export async function runReleaseSync(): Promise<void> {
  if (isRunning) {
    console.log('⚠️ Release sync already in progress, skipping...');
    return;
  }

  isRunning = true;
  console.log('🚀 Starting scheduled release sync...');
  console.log(`⏰ ${new Date().toISOString()}`);

  try {
    const results = await runReleaseSyncPipeline();
    console.log('✅ Release sync completed:', results);
  } catch (error) {
    console.error('❌ Release sync failed:', error);
  } finally {
    isRunning = false;
  }
}

/** Start cron: 6:00, 12:00, 18:00 UTC */
export function startReleaseSyncCron(): void {
  // Cron: minute hour day month weekday
  // 0 6,12,18 * * * = at 0 min, 6/12/18 hours
  cron.schedule('0 6,12,18 * * *', () => {
    runReleaseSync().catch(console.error);
  }, { timezone: 'UTC' });
  console.log('⏰ Release sync cron scheduled (6:00, 12:00, 18:00 UTC)');
}

// Run sync immediately on startup in development
if (process.env.NODE_ENV === 'development') {
  console.log('🔄 Running initial release sync in development mode...');
  runReleaseSync().catch(console.error);
}
