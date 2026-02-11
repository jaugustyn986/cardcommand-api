// ============================================
// CardCommand Center - Release Scrape Service
// Tier B pipeline: fetch HTML → extract via AI → validate → upsert + change log
// ============================================

import { PrismaClient, Category, SourceTier, Confidence } from '@prisma/client';
import axios from 'axios';
import { getScrapeSources, type SourceTierType } from './releaseIntelSources';
import { generateReleaseStrategyForProductId } from './releaseStrategyService';

const prisma = new PrismaClient();

const USER_AGENT = 'Mozilla/5.0 (compatible; CardCommandBot/1.0; +https://cardcommand.vercel.app)';
const RATE_LIMIT_MS = 1500;

// ============================================
// Extraction types (AI returns this shape)
// ============================================

export interface ExtractedProduct {
  name: string;
  productType: string;
  msrp?: number;
  estimatedResale?: number;
  releaseDate?: string;
  preorderDate?: string;
  imageUrl?: string;
  buyUrl?: string;
  /** Short summary of product contents and context (e.g. boosters, promos, etc.) */
  contentsSummary?: string;
  /**
   * Optional: explicit list of top chase cards for this product
   * (e.g. ["Charizard ex SAR", "Umbreon ex SAR"]).
   */
  topChases?: string[];
}

export interface ExtractedSet {
  setName: string;
  category: 'pokemon' | 'mtg' | 'yugioh' | 'one_piece' | 'lorcana' | 'digimon';
  products: ExtractedProduct[];
}

export interface ExtractedPayload {
  releases: ExtractedSet[];
}

// ============================================
// robots.txt check (compliance: skip if disallowed)
// ============================================

function getOrigin(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

function getPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname || '/';
  } catch {
    return '/';
  }
}

/** Returns true if we are allowed to fetch this URL per robots.txt; false = skip. */
async function allowedByRobotsTxt(url: string): Promise<boolean> {
  const origin = getOrigin(url);
  const path = getPath(url);
  if (!origin) return false;

  const robotsUrl = `${origin}/robots.txt`;
  let robotsBody: string;
  try {
    const { data } = await axios.get<string>(robotsUrl, {
      timeout: 8000,
      responseType: 'text',
      headers: { 'User-Agent': USER_AGENT },
      validateStatus: (s) => s === 200 || s === 404,
    });
    robotsBody = typeof data === 'string' ? data : '';
  } catch {
    return true; // If we can't fetch robots.txt, allow (fail open)
  }

  if (!robotsBody || robotsBody.trim().length === 0) return true;

  const lines = robotsBody.split(/\r?\n/);
  let inStarBlock = false;
  const disallows: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^User-agent:\s*/i.test(trimmed)) {
      const agent = trimmed.replace(/^User-agent:\s*/i, '').trim().toLowerCase();
      inStarBlock = agent === '*';
      if (inStarBlock) disallows.length = 0;
    } else if (inStarBlock && /^Disallow:\s*/i.test(trimmed)) {
      const pathRule = trimmed.replace(/^Disallow:\s*/i, '').trim();
      if (pathRule.length > 0) disallows.push(pathRule);
    }
  }

  for (const rule of disallows) {
    if (rule === '/') return false;
    const prefix = rule.replace(/\*$/, '');
    if (path === rule || (prefix && path.startsWith(prefix))) return false;
  }
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Fetch HTML (with a simple user-agent)
// ============================================

async function fetchHtml(url: string): Promise<string> {
  const { data } = await axios.get<string>(url, {
    timeout: 15000,
    responseType: 'text',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html',
    },
    maxRedirects: 3,
  });
  return data;
}

// ============================================
// Extract structured data from HTML via OpenAI
// ============================================

const EXTRACTION_SYSTEM = `You are a data extractor for a trading card release calendar. Given HTML from a webpage about TCG/sports card releases, output a single JSON object with this exact shape (no markdown, no code fence). Be precise about MSRP vs resale/market prices, and prefer information that is clearly labeled on the page:

{
  "releases": [
    {
      "setName": "Exact set or expansion name as shown (e.g. Ascended Heroes, Perfect Order)",
      "category": "pokemon" or "mtg" or "yugioh" or "one_piece" or "lorcana" or "digimon",
      "products": [
        {
          "name": "Full product name (e.g. Ascended Heroes Elite Trainer Box)",
          "productType": "elite_trainer_box | booster_box | booster_bundle | tin | collection | blister | build_battle | other",
          "msrp": number or null,                 // Retail price printed or clearly labeled as MSRP / Manufacturer's suggested price
          "estimatedResale": number or null,      // Reasonable expected secondary-market price (if the page clearly implies it, otherwise null)
          "releaseDate": "YYYY-MM-DD or null",
          "preorderDate": "YYYY-MM-DD or null",
          "imageUrl": "url string or null",
          "buyUrl": "url string or null",         // Direct link to buy / preorder this exact product (e.g. Pokémon Center, TCGPlayer, retailer PDP)
          "contentsSummary": "Short description of contents and context (e.g. 9 boosters, 1 SAR promo, from Pokémon Center PDP) or null",
          "topChases": ["Optional list of the most desirable individual cards for this product, or empty array if not clear"]
        }
      ]
    }
  ]
}

Rules:
- Only include releases and products you can clearly identify from the page.
- Use "pokemon" for Pokémon TCG, "mtg" for Magic, \"yugioh\" for Yu-Gi-Oh!, etc. If the game is unclear, omit that release.
- productType must be one of: elite_trainer_box, booster_box, booster_bundle, tin, collection, blister, build_battle, other.
- Only set msrp when the page shows a clearly labeled retail / MSRP price for that specific product.
- Only set estimatedResale when the page gives a clear, current market price signal (e.g. current price on a marketplace listing for a sealed product). Do NOT guess.
- Only set buyUrl when there is a clear button or link to buy or preorder that exact product.
- For topChases, only include specific card names that the page strongly highlights as key pulls or chase cards for this product. If you cannot find any, use an empty array.
- Output only valid JSON, no other text.`;

async function extractWithOpenAi(html: string, sourceLabel: string): Promise<ExtractedPayload> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ OPENAI_API_KEY not set; skipping AI extraction');
    return { releases: [] };
  }

  // Truncate HTML to stay under context limits (keep first ~80k chars)
  const truncated = html.length > 80_000 ? html.slice(0, 80_000) + '\n...[truncated]' : html;

  const OpenAI = (await import('openai')).default;
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
    return JSON.parse(content) as ExtractedPayload;
  } catch {
    console.error('Failed to parse OpenAI extraction JSON:', content?.slice(0, 200));
    return { releases: [] };
  }
}

// ============================================
// Match extracted setName to a Release in DB
// ============================================

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

async function findReleaseForSet(setName: string, category: Category) {
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

function mapProductType(raw: string): string {
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
  if (allowed.includes(lower)) return lower;
  if (lower.includes('etb') || lower.includes('elite')) return 'elite_trainer_box';
  if (lower.includes('booster_box') || lower.includes('display')) return 'booster_box';
  if (lower.includes('bundle')) return 'booster_bundle';
  if (lower.includes('tin')) return 'tin';
  if (lower.includes('collection')) return 'collection';
  if (lower.includes('blister')) return 'blister';
  if (lower.includes('build') && lower.includes('battle')) return 'build_battle';
  return 'other';
}

function parseDate(s: string | undefined): Date | null {
  if (!s || typeof s !== 'string') return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ============================================
// Record a field change for release_product_changes
// ============================================

function formatValue(v: Date | number | null | undefined): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

async function recordChange(
  releaseProductId: string,
  field: string,
  oldValue: string | null,
  newValue: string | null,
  sourceUrl: string | null,
): Promise<boolean> {
  if (oldValue === newValue) return false;
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

async function upsertProductsForSet(
  release: { id: string; category: Category },
  products: ExtractedProduct[],
  sourceConfig: { url: string; tier: SourceTierType },
): Promise<{ upserted: number; changes: number }> {
  let upserted = 0;
  let changesCount = 0;
  const sourceUrl = sourceConfig.url;
  const tier = sourceConfig.tier === 'B' ? SourceTier.B : sourceConfig.tier === 'C' ? SourceTier.C : SourceTier.A;

  for (const p of products) {
    if (!p.name?.trim()) continue;

    const releaseDate = parseDate(p.releaseDate);
    const preorderDate = parseDate(p.preorderDate);

    const existing = await prisma.releaseProduct.findFirst({
      where: {
        releaseId: release.id,
        name: p.name.trim(),
      },
    });

    // Prefer explicit topChases when provided; otherwise fall back to contentsSummary as-is.
    const topChasesSummary =
      Array.isArray(p.topChases) && p.topChases.length > 0
        ? `Top chases: ${p.topChases.join(', ')}`
        : undefined;

    const combinedContentsSummary =
      p.contentsSummary && topChasesSummary
        ? `${p.contentsSummary} ${topChasesSummary}`
        : p.contentsSummary || topChasesSummary || null;

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
      contentsSummary: combinedContentsSummary,
      sourceTier: tier,
      sourceUrl,
      confidence: sourceConfig.tier === 'C' ? Confidence.rumor : Confidence.confirmed,
    };

    if (existing) {
      let strategyNeedsUpdate = false;
      // Change detection: log diffs before update
      if (await recordChange(existing.id, 'releaseDate', formatValue(existing.releaseDate), formatValue(releaseDate), sourceUrl)) { changesCount++; strategyNeedsUpdate = true; }
      if (await recordChange(existing.id, 'preorderDate', formatValue(existing.preorderDate), formatValue(preorderDate), sourceUrl)) { changesCount++; strategyNeedsUpdate = true; }
      if (await recordChange(existing.id, 'msrp', formatValue(existing.msrp), formatValue(data.msrp), sourceUrl)) { changesCount++; strategyNeedsUpdate = true; }
      if (await recordChange(existing.id, 'estimatedResale', formatValue(existing.estimatedResale), formatValue(data.estimatedResale), sourceUrl)) { changesCount++; strategyNeedsUpdate = true; }

      await prisma.releaseProduct.update({
        where: { id: existing.id },
        data,
      });

      if (strategyNeedsUpdate && release.category === 'pokemon') {
        try {
          await generateReleaseStrategyForProductId(existing.id);
        } catch (err) {
          console.error('Error generating release strategy (update):', err);
        }
      }
    } else {
      const created = await prisma.releaseProduct.create({
        data: {
          releaseId: release.id,
          ...data,
        },
      });
      upserted++;

      if (release.category === 'pokemon') {
        try {
          await generateReleaseStrategyForProductId(created.id);
        } catch (err) {
          console.error('Error generating release strategy (create):', err);
        }
      }
    }
  }
  return { upserted, changes: changesCount };
}

// ============================================
// Main: run Tier B + C pipeline (scrape sources with robots + rate limit)
// ============================================

export interface ScrapeResult {
  sources: number;
  productsUpserted: number;
  changesDetected: number;
  strategiesGenerated: number;
}

export async function scrapeAndUpsertReleaseProducts(): Promise<ScrapeResult> {
  const sources = getScrapeSources();
  let totalProductsUpserted = 0;
  let totalChanges = 0;
  let totalStrategies = 0;

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (i > 0) await sleep(RATE_LIMIT_MS);

    try {
      const allowed = await allowedByRobotsTxt(source.url);
      if (!allowed) {
        console.log(`⏭️ Skipping ${source.name} (disallowed by robots.txt)`);
        continue;
      }

      console.log(`🔄 [Tier ${source.tier}] ${source.name}...`);
      const html = await fetchHtml(source.url);
      const payload = await extractWithOpenAi(html, source.name);

      if (!payload.releases?.length) {
        console.log(`   No releases extracted from ${source.name}`);
        continue;
      }

      for (const set of payload.releases) {
        const category = set.category as Category;
        const release = await findReleaseForSet(set.setName, category);
        if (!release) {
          console.log(`   No matching release for set "${set.setName}" (${category}); skipping`);
          continue;
        }
        const beforeStrategies = await prisma.releaseProductStrategy.count({
          where: { releaseProduct: { releaseId: release.id } },
        });

        const { upserted, changes } = await upsertProductsForSet(release, set.products || [], {
          url: source.url,
          tier: source.tier,
        });
        totalProductsUpserted += upserted;
        totalChanges += changes;

        if (release.category === 'pokemon') {
          const afterStrategies = await prisma.releaseProductStrategy.count({
            where: { releaseProduct: { releaseId: release.id } },
          });
          const generatedForSet = Math.max(0, afterStrategies - beforeStrategies);
          if (generatedForSet > 0) {
            console.log(
              `   Strategies generated for set "${set.setName}" (${release.id}): ${generatedForSet}`,
            );
            totalStrategies += generatedForSet;
          }
        }
      }
    } catch (err) {
      console.error(`❌ Scrape failed for ${source.url}:`, err);
    }
  }

  return {
    sources: sources.length,
    productsUpserted: totalProductsUpserted,
    changesDetected: totalChanges,
    strategiesGenerated: totalStrategies,
  };
}
