"use strict";
// ============================================
// CardCommand Center - Release Sync Job
// Scheduled job to sync releases from APIs
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.runReleaseSync = runReleaseSync;
const releaseSyncService_1 = require("../releaseSyncService");
let isRunning = false;
async function runReleaseSync() {
    // Prevent concurrent runs
    if (isRunning) {
        console.log('⚠️ Release sync already in progress, skipping...');
        return;
    }
    isRunning = true;
    console.log('🚀 Starting scheduled release sync...');
    console.log(`⏰ ${new Date().toISOString()}`);
    try {
        const results = await (0, releaseSyncService_1.syncAllReleases)();
        console.log('✅ Release sync completed:', results);
    }
    catch (error) {
        console.error('❌ Release sync failed:', error);
    }
    finally {
        isRunning = false;
    }
}
// Run sync immediately on startup (in development)
if (process.env.NODE_ENV === 'development') {
    console.log('🔄 Running initial release sync in development mode...');
    runReleaseSync().catch(console.error);
}
//# sourceMappingURL=releaseSyncJob.js.map