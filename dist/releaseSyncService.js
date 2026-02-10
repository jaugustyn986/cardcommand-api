"use strict";
// ============================================
// CardCommand Center - Release Sync Service
// Syncs release data from external APIs
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncPokemonReleases = syncPokemonReleases;
exports.syncMTGReleases = syncMTGReleases;
exports.syncAllReleases = syncAllReleases;
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const prisma = new client_1.PrismaClient();
async function syncPokemonReleases() {
    try {
        console.log('🔄 Syncing Pokemon TCG releases...');
        const response = await axios_1.default.get('https://api.pokemontcg.io/v2/sets', {
            headers: {
                'X-Api-Key': process.env.POKEMON_TCG_API_KEY || '',
            },
        });
        const sets = response.data.data;
        let syncedCount = 0;
        for (const set of sets) {
            // Skip if release is too old (older than 1 year)
            const releaseDate = new Date(set.releaseDate);
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            if (releaseDate < oneYearAgo)
                continue;
            // Check if release already exists
            const existingRelease = await prisma.release.findFirst({
                where: {
                    name: set.name,
                    category: 'pokemon',
                },
            });
            if (existingRelease) {
                // Update if needed
                const updatedRelease = await prisma.release.update({
                    where: { id: existingRelease.id },
                    data: {
                        releaseDate: releaseDate,
                        isReleased: releaseDate <= new Date(),
                        updatedAt: new Date(),
                    },
                });
                await ensureDefaultReleaseProduct(updatedRelease);
            }
            else {
                // Create new release
                const newRelease = await prisma.release.create({
                    data: {
                        name: `${set.name} (${set.series})`,
                        releaseDate: releaseDate,
                        category: 'pokemon',
                        manufacturer: 'The Pokémon Company',
                        msrp: estimateMsrp('pokemon', set.name),
                        estimatedResale: null,
                        hypeScore: calculateHypeScore(set),
                        imageUrl: set.images.logo,
                        topChases: [], // Would need card data to populate
                        printRun: `${set.printedTotal} cards`,
                        description: `Pokemon TCG set from the ${set.series} series. Contains ${set.total} cards.`,
                        isReleased: releaseDate <= new Date(),
                    },
                });
                await ensureDefaultReleaseProduct(newRelease);
                syncedCount++;
            }
        }
        console.log(`✅ Synced ${syncedCount} Pokemon releases`);
        return syncedCount;
    }
    catch (error) {
        console.error('❌ Error syncing Pokemon releases:', error);
        return 0;
    }
}
async function syncMTGReleases() {
    try {
        console.log('🔄 Syncing MTG releases...');
        const response = await axios_1.default.get('https://api.scryfall.com/sets');
        const sets = response.data.data;
        let syncedCount = 0;
        for (const set of sets) {
            // Skip digital-only sets
            if (set.digital)
                continue;
            // Skip if no release date
            if (!set.released_at)
                continue;
            const releaseDate = new Date(set.released_at);
            // Skip if release is too old
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            if (releaseDate < oneYearAgo)
                continue;
            // Check if release already exists
            const existingRelease = await prisma.release.findFirst({
                where: {
                    name: set.name,
                    category: 'mtg',
                },
            });
            if (existingRelease) {
                const updatedRelease = await prisma.release.update({
                    where: { id: existingRelease.id },
                    data: {
                        releaseDate: releaseDate,
                        isReleased: releaseDate <= new Date(),
                        updatedAt: new Date(),
                    },
                });
                await ensureDefaultReleaseProduct(updatedRelease);
            }
            else {
                const newRelease = await prisma.release.create({
                    data: {
                        name: set.name,
                        releaseDate: releaseDate,
                        category: 'mtg',
                        manufacturer: 'Wizards of the Coast',
                        msrp: estimateMsrp('mtg', set.name),
                        estimatedResale: null,
                        hypeScore: calculateMTGHypeScore(set),
                        imageUrl: set.icon_svg_uri,
                        topChases: [],
                        printRun: `${set.card_count} cards`,
                        description: `Magic: The Gathering ${set.set_type} set. Contains ${set.card_count} cards.`,
                        isReleased: releaseDate <= new Date(),
                    },
                });
                await ensureDefaultReleaseProduct(newRelease);
                syncedCount++;
            }
        }
        console.log(`✅ Synced ${syncedCount} MTG releases`);
        return syncedCount;
    }
    catch (error) {
        console.error('❌ Error syncing MTG releases:', error);
        return 0;
    }
}
// ============================================
// Helper Functions
// ============================================
function estimateMsrp(category, setName) {
    // Estimate MSRP based on category and set name patterns
    const name = setName.toLowerCase();
    switch (category) {
        case 'pokemon':
            if (name.includes('elite trainer box') || name.includes('etb'))
                return 49.99;
            if (name.includes('booster box'))
                return 143.99;
            if (name.includes('collection box'))
                return 24.99;
            if (name.includes('tin'))
                return 29.99;
            return 4.99; // Single booster pack
        case 'mtg':
            if (name.includes('collector'))
                return 22.99;
            if (name.includes('draft') || name.includes('set'))
                return 5.99;
            if (name.includes('play'))
                return 19.99;
            return 5.99; // Draft booster
        default:
            return 9.99;
    }
}
function calculateHypeScore(set) {
    // Calculate hype score based on various factors
    let score = 5.0; // Base score
    // Newer sets get higher hype
    const releaseDate = new Date(set.releaseDate);
    const daysUntil = Math.ceil((releaseDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil > 0 && daysUntil <= 30) {
        score += 2.0; // High hype for upcoming releases
    }
    else if (daysUntil > 30 && daysUntil <= 90) {
        score += 1.0;
    }
    // Popular series get higher scores
    const popularSeries = ['Scarlet & Violet', 'Sword & Shield', 'Sun & Moon'];
    if (popularSeries.some(s => set.series.includes(s))) {
        score += 1.0;
    }
    return Math.min(score, 10.0);
}
function calculateMTGHypeScore(set) {
    let score = 5.0;
    if (!set.released_at)
        return score;
    const releaseDate = new Date(set.released_at);
    const daysUntil = Math.ceil((releaseDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil > 0 && daysUntil <= 30) {
        score += 2.0;
    }
    else if (daysUntil > 30 && daysUntil <= 90) {
        score += 1.0;
    }
    // Premium sets get higher hype
    const premiumTypes = ['masterpiece', 'masters', 'collector', 'commander'];
    if (premiumTypes.some(t => set.set_type.includes(t))) {
        score += 1.5;
    }
    return Math.min(score, 10.0);
}
// ============================================
// Main Sync Function
// ============================================
async function syncAllReleases() {
    const [pokemon, mtg] = await Promise.all([
        syncPokemonReleases(),
        syncMTGReleases(),
    ]);
    return { pokemon, mtg };
}
// ============================================
// Release Product helpers
// ============================================
async function ensureDefaultReleaseProduct(release) {
    // Ensure every Release has at least one associated product for the UI
    const existing = await prisma.releaseProduct.findFirst({
        where: { releaseId: release.id },
    });
    if (existing)
        return;
    await prisma.releaseProduct.create({
        data: {
            releaseId: release.id,
            name: `${release.name} - Booster Product`,
            productType: 'set_default',
            category: release.category,
            msrp: release.msrp,
            estimatedResale: release.estimatedResale ?? null,
            releaseDate: release.releaseDate,
            preorderDate: null,
            imageUrl: release.imageUrl,
            buyUrl: null,
            contentsSummary: release.description,
        },
    });
}
//# sourceMappingURL=releaseSyncService.js.map