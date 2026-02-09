// ============================================
// CardCommand Center - Manual Release Sync Script
// Run: npx ts-node src/scripts/syncReleases.ts
// ============================================

import { syncAllReleases } from '../services/releaseSyncService';

async function main() {
  console.log('🚀 Starting manual release sync...\n');
  
  try {
    const results = await syncAllReleases();
    console.log('\n✅ Sync completed successfully!');
    console.log('Results:', results);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  }
}

main();
