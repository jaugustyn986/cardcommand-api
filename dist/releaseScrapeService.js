"use strict";
// ============================================
// CardCommand Center - Release Scrape Service
// Tier B pipeline: fetch HTML → extract via AI → validate → upsert + change log
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeAndUpsertReleaseProducts = scrapeAndUpsertReleaseProducts;
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const releaseIntelSources_1 = require("./releaseIntelSources");
const prisma = new client_1.PrismaClient();
// Tier B sources come from releaseIntelSources (getTierBSources())
// ============================================
// Fetch HTML (with a simple user-agent)
// ============================================
async function fetchHtml(url) {
    const { data } = await axios_1.default.get(url, {
        timeout: 15000,
        responseType: 'text',
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; CardCommandBot/1.0; +https://cardcommand.vercel.app)',
            Accept: 'text/html',
        },
        maxRedirects: 3,
    });
    return data;
}
// ============================================
// Extract structured data from HTML via OpenAI
// ============================================
const EXTRACTION_SYSTEM = `You are a data extractor for a trading card release calendar. Given HTML from a webpage about TCG/sports card releases, output a single JSON object with this exact shape (no markdown, no code fence):

{
  "releases": [
    {
      "setName": "Exact set or expansion name as shown (e.g. Ascended Heroes, Perfect Order)",
      "category": "pokemon",
      "products": [
        {
          "name": "Full product name (e.g. Ascended Heroes Elite Trainer Box)",
          "productType": "elite_trainer_box | booster_box | booster_bundle | tin | collection | blister | build_battle | other",
          "msrp": number or null,
          "estimatedResale": number or null,
          "releaseDate": "YYYY-MM-DD or null",
          "preorderDate": "YYYY-MM-DD or null",
          "imageUrl": "url string or null",
          "buyUrl": "url string or null",
          "contentsSummary": "Short description (e.g. 9 boosters, 1 promo) or null"
        }
      ]
    }
  ]
}

Rules:
- Only include releases and products you can clearly identify from the page.
- Use "pokemon" for Pokémon TCG, "mtg" for Magic.
- productType must be one of: elite_trainer_box, booster_box, booster_bundle, tin, collection, blister, build_battle, other.
- Output only valid JSON, no other text.`;
async function extractWithOpenAi(html, sourceLabel) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.warn('⚠️ OPENAI_API_KEY not set; skipping AI extraction');
        return { releases: [] };
    }
    // Truncate HTML to stay under context limits (keep first ~80k chars)
    const truncated = html.length > 80000 ? html.slice(0, 80000) + '\n...[truncated]' : html;
    const OpenAI = (await Promise.resolve().then(() => __importStar(require('openai')))).default;
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_EXTRACTION_MODEL || 'gpt-4o-mini',
        messages: [
            { role: 'system', content: EXTRACTION_SYSTEM },
            {
                role: 'user',
                content: `Source: ${sourceLabel}\n\nExtract release and product data from this HTML:\n\n${truncated}`,
            },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) {
        return { releases: [] };
    }
    try {
        return JSON.parse(content);
    }
    catch {
        console.error('Failed to parse OpenAI extraction JSON:', content?.slice(0, 200));
        return { releases: [] };
    }
}
// ============================================
// Match extracted setName to a Release in DB
// ============================================
function normalizeForMatch(s) {
    return s
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '')
        .trim();
}
async function findReleaseForSet(setName, category) {
    const normalized = normalizeForMatch(setName);
    const releases = await prisma.release.findMany({
        where: { category },
        include: { products: true },
    });
    for (const r of releases) {
        const rNorm = normalizeForMatch(r.name);
        // Match if one contains the other (e.g. "Ascended Heroes" vs "Ascended Heroes (Mega Evolution)")
        if (rNorm.includes(normalized) || normalized.includes(rNorm)) {
            return r;
        }
    }
    return null;
}
// ============================================
// Map productType string to our DB value
// ============================================
function mapProductType(raw) {
    const lower = raw.toLowerCase().replace(/\s+/g, '_');
    const allowed = [
        'elite_trainer_box',
        'booster_box',
        'booster_bundle',
        'tin',
        'collection',
        'blister',
        'build_battle',
        'set_default',
        'other',
    ];
    if (allowed.includes(lower))
        return lower;
    if (lower.includes('etb') || lower.includes('elite'))
        return 'elite_trainer_box';
    if (lower.includes('booster_box') || lower.includes('display'))
        return 'booster_box';
    if (lower.includes('bundle'))
        return 'booster_bundle';
    if (lower.includes('tin'))
        return 'tin';
    if (lower.includes('collection'))
        return 'collection';
    if (lower.includes('blister'))
        return 'blister';
    if (lower.includes('build') && lower.includes('battle'))
        return 'build_battle';
    return 'other';
}
function parseDate(s) {
    if (!s || typeof s !== 'string')
        return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}
// ============================================
// Record a field change for release_product_changes
// ============================================
function formatValue(v) {
    if (v == null)
        return '';
    if (v instanceof Date)
        return v.toISOString().slice(0, 10);
    return String(v);
}
async function recordChange(releaseProductId, field, oldValue, newValue, sourceUrl) {
    if (oldValue === newValue)
        return false;
    await prisma.releaseProductChange.create({
        data: {
            releaseProductId,
            field,
            oldValue: oldValue ?? undefined,
            newValue: newValue ?? undefined,
            sourceUrl: sourceUrl ?? undefined,
        },
    });
    return true;
}
// ============================================
// Upsert products for one extracted set (with change detection)
// ============================================
async function upsertProductsForSet(release, products, sourceConfig) {
    let upserted = 0;
    let changesCount = 0;
    const sourceUrl = sourceConfig.url;
    const tier = sourceConfig.tier === 'B' ? client_1.SourceTier.B : sourceConfig.tier === 'C' ? client_1.SourceTier.C : client_1.SourceTier.A;
    for (const p of products) {
        if (!p.name?.trim())
            continue;
        const releaseDate = parseDate(p.releaseDate);
        const preorderDate = parseDate(p.preorderDate);
        const existing = await prisma.releaseProduct.findFirst({
            where: {
                releaseId: release.id,
                name: p.name.trim(),
            },
        });
        const data = {
            name: p.name.trim(),
            productType: mapProductType(p.productType || 'other'),
            category: release.category,
            msrp: p.msrp ?? null,
            estimatedResale: p.estimatedResale ?? null,
            releaseDate,
            preorderDate,
            imageUrl: p.imageUrl ?? null,
            buyUrl: p.buyUrl ?? null,
            contentsSummary: p.contentsSummary ?? null,
            sourceTier: tier,
            sourceUrl,
            confidence: client_1.Confidence.confirmed,
        };
        if (existing) {
            // Change detection: log diffs before update
            if (await recordChange(existing.id, 'releaseDate', formatValue(existing.releaseDate), formatValue(releaseDate), sourceUrl))
                changesCount++;
            if (await recordChange(existing.id, 'preorderDate', formatValue(existing.preorderDate), formatValue(preorderDate), sourceUrl))
                changesCount++;
            if (await recordChange(existing.id, 'msrp', formatValue(existing.msrp), formatValue(data.msrp), sourceUrl))
                changesCount++;
            if (await recordChange(existing.id, 'estimatedResale', formatValue(existing.estimatedResale), formatValue(data.estimatedResale), sourceUrl))
                changesCount++;
            await prisma.releaseProduct.update({
                where: { id: existing.id },
                data,
            });
        }
        else {
            await prisma.releaseProduct.create({
                data: {
                    releaseId: release.id,
                    ...data,
                },
            });
            upserted++;
        }
    }
    return { upserted, changes: changesCount };
}
async function scrapeAndUpsertReleaseProducts() {
    const sources = (0, releaseIntelSources_1.getTierBSources)();
    let totalProductsUpserted = 0;
    let totalChanges = 0;
    for (const source of sources) {
        try {
            console.log(`🔄 [Tier B] ${source.name}...`);
            const html = await fetchHtml(source.url);
            const payload = await extractWithOpenAi(html, source.name);
            if (!payload.releases?.length) {
                console.log(`   No releases extracted from ${source.name}`);
                continue;
            }
            for (const set of payload.releases) {
                const category = set.category;
                const release = await findReleaseForSet(set.setName, category);
                if (!release) {
                    console.log(`   No matching release for set "${set.setName}" (${category}); skipping`);
                    continue;
                }
                const { upserted, changes } = await upsertProductsForSet(release, set.products || [], {
                    url: source.url,
                    tier: source.tier,
                });
                totalProductsUpserted += upserted;
                totalChanges += changes;
            }
        }
        catch (err) {
            console.error(`❌ Scrape failed for ${source.url}:`, err);
        }
    }
    return {
        sources: sources.length,
        productsUpserted: totalProductsUpserted,
        changesDetected: totalChanges,
    };
}
//# sourceMappingURL=releaseScrapeService.js.map