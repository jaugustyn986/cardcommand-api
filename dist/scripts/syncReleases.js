"use strict";
// ============================================
// CardCommand Center - Manual Release Sync Script
// Run: npx ts-node src/scripts/syncReleases.ts
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const releaseSyncService_1 = require("../releaseSyncService");
async function main() {
    console.log('🚀 Starting manual release sync...\n');
    try {
        const results = await (0, releaseSyncService_1.syncAllReleases)();
        console.log('\n✅ Sync completed successfully!');
        console.log('Results:', results);
        process.exit(0);
    }
    catch (error) {
        console.error('\n❌ Sync failed:', error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=syncReleases.js.map