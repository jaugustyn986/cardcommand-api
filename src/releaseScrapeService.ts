// ============================================
// CardCommand Center - Release Scrape Service
// Tier B pipeline: fetch HTML → extract via AI → validate → upsert + change log
// ============================================

import { PrismaClient, Category, SourceTier, Confidence } from '@prisma/client';
import axios from 'axios';
import {
  getScrapeSources,
  type ReleaseIntelSource,
  type SourceTierType,
  type SourceType,
} from './releaseIntelSources';
import { generateReleaseStrategyForProductId } from './releaseStrategyService';

const prisma = new PrismaClient();

const USER_AGENT = 'Mozilla/5.0 (compatible; CardCommandBot/1.0; +https://cardcommand.vercel.app)';
const RATE_LIMIT_MS = 1500;
const EXTRACTION_MAX_INPUT_CHARS = 120_000;

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

interface ExtractedSetCandidate {
  setName: string;
  category: Category;
  products: ExtractedProduct[];
  source: ReleaseIntelSource;
}

interface PokemonComExpansionItem {
  title: string;
  url: string;
  system?: string;
  releaseDate?: string;
  thumbnail?: string;
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

function cleanHtmlText(input: string): string {
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;|&#8212;|&#x2014;/gi, '—')
    .replace(/&ndash;|&#8211;|&#x2013;/gi, '–')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toAbsolutePokemonUrl(pathOrUrl?: string): string | undefined {
  if (!pathOrUrl) return undefined;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
  if (pathOrUrl.startsWith('/')) return `https://www.pokemon.com${pathOrUrl}`;
  return `https://www.pokemon.com/${pathOrUrl}`;
}

function parsePokemonComSetPage(html: string, sourceUrl: string): ExtractedPayload {
  const titleMatch =
    html.match(/<meta\s+name="pkm-title"\s+content="([^"]+)"/i) ||
    html.match(/<title>([^<]+)\|/i) ||
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const rawSetName = titleMatch?.[1] ? cleanHtmlText(titleMatch[1]) : '';
  const setName = rawSetName.replace(/^Pok[eé]mon\s+TCG:\s*/i, '').trim();

  const dateMatch = html.match(
    /Release\s*Date<\/td>\s*<td[^>]*>\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})\s*<\/td>/i,
  );
  const releaseDate = dateMatch?.[1] ? new Date(dateMatch[1]).toISOString().slice(0, 10) : undefined;

  const summaryMatch = html.match(/<p>([\s\S]{80,1200}?)<\/p>/i);
  const contentsSummary = summaryMatch?.[1] ? cleanHtmlText(summaryMatch[1]).slice(0, 500) : undefined;

  const imageMatch =
    html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
    html.match(/<img[^>]+src="([^"]+me[^"]+logo[^"]+)"/i);
  const imageUrl = imageMatch?.[1] ? toAbsolutePokemonUrl(imageMatch[1]) : undefined;

  if (!setName) return { releases: [] };

  return {
    releases: [
      {
        setName,
        category: 'pokemon',
        products: [
          {
            name: setName,
            productType: 'set_default',
            releaseDate,
            imageUrl,
            buyUrl: sourceUrl,
            contentsSummary,
          },
        ],
      },
    ],
  };
}

async function fetchPokemonComExpansionsApiPayload(): Promise<ExtractedPayload> {
  try {
    const { data } = await axios.get<PokemonComExpansionItem[]>('https://www.pokemon.com/api/1/us/expansions', {
      timeout: 15000,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });

    const items = Array.isArray(data) ? data : [];
    const releases: ExtractedSet[] = [];
    for (const item of items) {
      const setName = cleanHtmlText(item.title || '').replace(/^Pok[eé]mon\s+TCG:\s*/i, '').trim();
      if (!setName) continue;

      const parsedDate =
        item.releaseDate && !isNaN(new Date(item.releaseDate).getTime())
          ? new Date(item.releaseDate).toISOString().slice(0, 10)
          : undefined;
      const sourceUrl = toAbsolutePokemonUrl(item.url);

      releases.push({
        setName,
        category: 'pokemon',
        products: [
          {
            name: setName,
            productType: 'set_default',
            releaseDate: parsedDate,
            imageUrl: toAbsolutePokemonUrl(item.thumbnail),
            buyUrl: sourceUrl,
            contentsSummary: item.system ? `Series: ${cleanHtmlText(item.system)}` : undefined,
          },
        ],
      });
    }

    return { releases };
  } catch (err) {
    console.error('❌ Pokémon expansions API fetch failed:', err);
    return { releases: [] };
  }
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
          "productType": "set_default | elite_trainer_box | booster_box | booster_bundle | tin | collection | blister | build_battle | other",
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
- productType must be one of: set_default, elite_trainer_box, booster_box, booster_bundle, tin, collection, blister, build_battle, other.
- If a page is expansion-level (set-level) and does not clearly list distinct sealed SKUs, include one fallback product with:
  - name = setName
  - productType = "set_default"
  - releaseDate from the page when present
  - imageUrl/buyUrl/contentsSummary when present.
- Only set msrp when the page shows a clearly labeled retail / MSRP price for that specific product.
- Only set estimatedResale when the page gives a clear, current market price signal (e.g. current price on a marketplace listing for a sealed product). Do NOT guess.
- Only set buyUrl when there is a clear button or link to buy or preorder that exact product.
- For topChases, only include specific card names that the page strongly highlights as key pulls or chase cards for this product. If you cannot find any, use an empty array.
- Output only valid JSON, no other text.`;

function buildExtractionInput(html: string): string {
  if (html.length <= EXTRACTION_MAX_INPUT_CHARS) return html;
  // Dynamic pages often place relevant data far from the beginning; include head + tail.
  const half = Math.floor(EXTRACTION_MAX_INPUT_CHARS / 2);
  return `${html.slice(0, half)}\n...[middle truncated]...\n${html.slice(-half)}`;
}

async function extractWithOpenAi(
  html: string,
  sourceLabel: string,
  expectedCategory?: Category,
): Promise<ExtractedPayload> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ OPENAI_API_KEY not set; skipping AI extraction');
    return { releases: [] };
  }

  const extractionInput = buildExtractionInput(html);

  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey });

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_EXTRACTION_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM },
      {
        role: 'user',
        content: `Source: ${sourceLabel}\nExpected TCG category: ${expectedCategory || 'unknown'}\n\nExtract release and product data from this HTML:\n\n${extractionInput}`,
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

function sourceTierRank(tier: SourceTierType): number {
  if (tier === 'A') return 3;
  if (tier === 'B') return 2;
  return 1;
}

function sourceTypeWeight(sourceType: SourceType): number {
  switch (sourceType) {
    case 'official':
      return 10;
    case 'distributor':
      return 6;
    case 'retailer':
      return 4;
    case 'news':
      return 0;
    case 'community':
      return -8;
    default:
      return 0;
  }
}

function computeConfidenceScore(
  source: ReleaseIntelSource,
  corroborationCount: number,
  lastSeenAt: Date,
): number {
  const tierBase = source.tier === 'A' ? 72 : source.tier === 'B' ? 56 : 38;
  const corroborationBonus = Math.min(20, Math.max(0, corroborationCount - 1) * 8);
  const ageDays = Math.max(0, Math.floor((Date.now() - lastSeenAt.getTime()) / (1000 * 60 * 60 * 24)));
  const recencyPenalty = Math.min(15, ageDays);
  const score = tierBase + sourceTypeWeight(source.sourceType) + corroborationBonus - recencyPenalty;
  return Math.max(5, Math.min(99, score));
}

function confidenceEnumFromScore(score: number): Confidence {
  if (score >= 75) return Confidence.confirmed;
  if (score >= 50) return Confidence.unconfirmed;
  return Confidence.rumor;
}

// ============================================
// Match extracted setName to a Release in DB
// Uses substring match first, then fuzzy (Jaro-Winkler–like) if no exact match
// ============================================

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/** Levenshtein distance → similarity (0–1). 1 = identical. */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const lenA = a.length;
  const lenB = b.length;
  const maxLen = Math.max(lenA, lenB);
  const dp: number[][] = Array(lenA + 1)
    .fill(null)
    .map(() => Array(lenB + 1).fill(0));
  for (let i = 0; i <= lenA; i++) dp[i][0] = i;
  for (let j = 0; j <= lenB; j++) dp[0][j] = j;
  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  const dist = dp[lenA][lenB];
  return 1 - dist / maxLen;
}

const FUZZY_MATCH_THRESHOLD = 0.82;

async function findReleaseForSet(setName: string, category: Category) {
  const normalized = normalizeForMatch(setName);
  const releases = await prisma.release.findMany({
    where: { category },
    include: { products: true },
  });

  // 1. Exact substring match (containment)
  for (const r of releases) {
    const rNorm = normalizeForMatch(r.name);
    if (rNorm.includes(normalized) || normalized.includes(rNorm)) {
      return r;
    }
  }

  // 2. Fuzzy match if no containment
  let best: (typeof releases)[0] | null = null;
  let bestScore = FUZZY_MATCH_THRESHOLD;
  for (const r of releases) {
    const rNorm = normalizeForMatch(r.name);
    const score = stringSimilarity(normalized, rNorm);
    if (score >= bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}

function manufacturerForCategory(category: Category): string {
  switch (category) {
    case 'pokemon':
      return 'The Pokémon Company';
    case 'mtg':
      return 'Wizards of the Coast';
    case 'yugioh':
      return 'Konami';
    default:
      return 'Unknown';
  }
}

function defaultMsrpForCategory(category: Category): number {
  switch (category) {
    case 'pokemon':
      return 4.99;
    case 'mtg':
      return 5.99;
    default:
      return 9.99;
  }
}

function inferReleaseDate(products: ExtractedProduct[]): Date | null {
  for (const p of products) {
    const d = parseDate(p.releaseDate);
    if (d) return d;
  }
  return null;
}

function inferReleaseMsrp(category: Category, products: ExtractedProduct[]): number {
  for (const p of products) {
    if (typeof p.msrp === 'number' && Number.isFinite(p.msrp) && p.msrp > 0) {
      return p.msrp;
    }
  }
  return defaultMsrpForCategory(category);
}

async function ensureReleaseForSet(
  setName: string,
  category: Category,
  products: ExtractedProduct[],
): Promise<{ id: string; category: Category }> {
  const existing = await findReleaseForSet(setName, category);
  if (existing) return existing;

  const inferredDate = inferReleaseDate(products) ?? new Date();
  const created = await prisma.release.create({
    data: {
      name: setName,
      releaseDate: inferredDate,
      category,
      manufacturer: manufacturerForCategory(category),
      msrp: inferReleaseMsrp(category, products),
      estimatedResale: null,
      hypeScore: null,
      imageUrl: null,
      topChases: [],
      printRun: null,
      description: `Scraped release candidate for ${setName}.`,
      isReleased: inferredDate <= new Date(),
    },
  });

  console.log(`🆕 Created release from scrape: "${setName}" (${category})`);
  return created;
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
  sourceConfig: {
    url: string;
    tier: SourceTierType;
    confidence: Confidence;
    supportingSources?: string[];
    sourceType?: SourceType;
  },
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

    const sourceEvidence =
      sourceConfig.supportingSources && sourceConfig.supportingSources.length > 1
        ? ` Sources: ${sourceConfig.supportingSources.join(', ')}.`
        : '';

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
      contentsSummary: combinedContentsSummary
        ? `${combinedContentsSummary}${sourceEvidence}`
        : sourceEvidence || null,
      sourceTier: tier,
      sourceUrl,
      confidence: sourceConfig.confidence,
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
  const candidates: ExtractedSetCandidate[] = [];

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
      let payload: ExtractedPayload = { releases: [] };

      if (source.id === 'pokemon-com-expansions') {
        // Deterministic official endpoint; avoids missing JS-rendered entries.
        payload = await fetchPokemonComExpansionsApiPayload();
      } else if (source.id === 'pokemon-com-perfect-order') {
        const html = await fetchHtml(source.url);
        payload = parsePokemonComSetPage(html, source.url);
      } else {
        const html = await fetchHtml(source.url);
        payload = await extractWithOpenAi(html, source.name, source.category);
      }

      if (!payload.releases?.length) {
        console.log(`   No releases extracted from ${source.name}`);
        continue;
      }

      for (const set of payload.releases) {
        const category = (set.category || source.category) as Category;
        const products: ExtractedProduct[] =
          Array.isArray(set.products) && set.products.length > 0
            ? set.products
            : [
                {
                  name: set.setName,
                  productType: 'set_default',
                  contentsSummary: 'Set-level fallback product inferred from expansion page.',
                },
              ];
        candidates.push({
          setName: set.setName,
          category,
          products,
          source,
        });
      }
    } catch (err) {
      console.error(`❌ Scrape failed for ${source.url}:`, err);
    }
  }

  // Merge corroborating candidates across sources into one logical set payload.
  const normalizeSetKey = (name: string) =>
    normalizeForMatch(name)
      .replace(/^pokemon tcg\s+/i, '')
      .replace(/^magic the gathering\s+/i, '')
      .trim();
  const grouped = new Map<string, ExtractedSetCandidate[]>();
  for (const c of candidates) {
    const key = `${c.category}|${normalizeSetKey(c.setName)}`;
    const list = grouped.get(key) || [];
    list.push(c);
    grouped.set(key, list);
  }

  const rankSource = (s: ReleaseIntelSource): number =>
    sourceTierRank(s.tier) * 100 + sourceTypeWeight(s.sourceType);

  for (const [_, group] of grouped.entries()) {
    if (group.length === 0) continue;
    const sortedByTrust = [...group].sort((a, b) => rankSource(b.source) - rankSource(a.source));
    const primary = sortedByTrust[0];

    // Merge products by normalized name, preferring stronger source for conflicting fields.
    const mergedByProduct = new Map<string, ExtractedProduct>();
    for (const candidate of sortedByTrust) {
      for (const rawProduct of candidate.products) {
        const productName = rawProduct.name?.trim() || candidate.setName;
        const productKey = normalizeForMatch(productName || candidate.setName || 'set-default');
        const existing = mergedByProduct.get(productKey);
        if (!existing) {
          mergedByProduct.set(productKey, {
            name: productName,
            productType: rawProduct.productType || 'set_default',
            msrp: rawProduct.msrp,
            estimatedResale: rawProduct.estimatedResale,
            releaseDate: rawProduct.releaseDate,
            preorderDate: rawProduct.preorderDate,
            imageUrl: rawProduct.imageUrl,
            buyUrl: rawProduct.buyUrl,
            contentsSummary: rawProduct.contentsSummary,
            topChases: rawProduct.topChases,
          });
          continue;
        }
        mergedByProduct.set(productKey, {
          ...existing,
          msrp: existing.msrp ?? rawProduct.msrp,
          estimatedResale: existing.estimatedResale ?? rawProduct.estimatedResale,
          releaseDate: existing.releaseDate ?? rawProduct.releaseDate,
          preorderDate: existing.preorderDate ?? rawProduct.preorderDate,
          imageUrl: existing.imageUrl ?? rawProduct.imageUrl,
          buyUrl: existing.buyUrl ?? rawProduct.buyUrl,
          contentsSummary: existing.contentsSummary ?? rawProduct.contentsSummary,
          topChases:
            existing.topChases && existing.topChases.length > 0
              ? existing.topChases
              : rawProduct.topChases,
        });
      }
    }

    const mergedProducts = Array.from(mergedByProduct.values());
    const supportingSourceNames = Array.from(new Set(group.map((g) => g.source.name)));
    const confidenceScore = computeConfidenceScore(primary.source, supportingSourceNames.length, new Date());
    const confidence = confidenceEnumFromScore(confidenceScore);

    const release = await ensureReleaseForSet(primary.setName, primary.category, mergedProducts);
    const beforeStrategies = await (prisma as any).releaseProductStrategy.count({
      where: { releaseProduct: { releaseId: release.id } },
    });

    const { upserted, changes } = await upsertProductsForSet(release, mergedProducts, {
      url: primary.source.url,
      tier: primary.source.tier,
      confidence,
      supportingSources: supportingSourceNames,
      sourceType: primary.source.sourceType,
    });
    totalProductsUpserted += upserted;
    totalChanges += changes;

    if (release.category === 'pokemon') {
      const afterStrategies = await (prisma as any).releaseProductStrategy.count({
        where: { releaseProduct: { releaseId: release.id } },
      });
      const generatedForSet = Math.max(0, afterStrategies - beforeStrategies);
      if (generatedForSet > 0) {
        console.log(
          `   Strategies generated for set "${primary.setName}" (${release.id}): ${generatedForSet}`,
        );
        totalStrategies += generatedForSet;
      }
    }
  }

  return {
    sources: sources.length,
    productsUpserted: totalProductsUpserted,
    changesDetected: totalChanges,
    strategiesGenerated: totalStrategies,
  };
}
