"use strict";
// ============================================
// CardCommand Center - Admin Controller
// Admin-only endpoints for system management
// ============================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerReleaseSync = triggerReleaseSync;
exports.getSyncStatus = getSyncStatus;
exports.getApiHealth = getApiHealth;
const client_1 = require("@prisma/client");
const releaseSyncService_1 = require("../releaseSyncService");
const releaseScrapeService_1 = require("../releaseScrapeService");
const prisma = new client_1.PrismaClient();
// ============================================
// Trigger Release Sync (Manual)
// ============================================
async function triggerReleaseSync(req, res) {
    try {
        console.log('🔄 Manual release sync triggered by admin');
        const results = await (0, releaseSyncService_1.syncAllReleases)();
        // After API sync, run Tier B pipeline (scrape + AI extraction) to enrich release products
        let scrapeResult;
        try {
            scrapeResult = await (0, releaseScrapeService_1.scrapeAndUpsertReleaseProducts)();
            console.log(`✅ Scrape complete: ${scrapeResult.productsUpserted} products upserted, ${scrapeResult.changesDetected} changes from ${scrapeResult.sources} source(s)`);
        }
        catch (scrapeErr) {
            console.error('⚠️ Scrape step failed (releases still synced):', scrapeErr);
        }
        res.json({
            success: true,
            message: 'Release sync completed',
            data: {
                ...results,
                scrape: scrapeResult,
            },
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
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
async function getSyncStatus(req, res) {
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
    }
    catch (error) {
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
async function getApiHealth(req, res) {
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to check API health',
        });
    }
}
async function checkDatabaseHealth() {
    try {
        await prisma.$queryRaw `SELECT 1`;
        return { status: 'healthy', responseTime: '< 100ms' };
    }
    catch (error) {
        return { status: 'unhealthy', error: 'Database connection failed' };
    }
}
async function checkPokemonApiHealth() {
    try {
        const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
        const start = Date.now();
        await axios.get('https://api.pokemontcg.io/v2/sets?pageSize=1', {
            timeout: 5000,
        });
        return { status: 'healthy', responseTime: `${Date.now() - start}ms` };
    }
    catch (error) {
        return { status: 'unhealthy', error: 'Pokemon API unreachable' };
    }
}
async function checkScryfallApiHealth() {
    try {
        const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
        const start = Date.now();
        await axios.get('https://api.scryfall.com/sets', {
            timeout: 5000,
        });
        return { status: 'healthy', responseTime: `${Date.now() - start}ms` };
    }
    catch (error) {
        return { status: 'unhealthy', error: 'Scryfall API unreachable' };
    }
}
//# sourceMappingURL=adminController.js.map