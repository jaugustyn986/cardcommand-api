// ============================================
// CardCommand Center - Market Data Service
// Phase 2: TCGPlayer / eBay integration for sealed product market prices
// Scaffold: implement fetchers when API keys are configured
// ============================================

import axios from 'axios';

export interface MarketPriceResult {
  source: 'tcgplayer' | 'ebay';
  price: number;
  currency: string;
  fetchedAt: string; // ISO
  /** e.g. "low", "market", "recent_sold" */
  priceType?: string;
  productName?: string;
  productUrl?: string;
  productKind?: 'booster_box' | 'booster_bundle' | 'booster_pack' | 'elite_trainer_box' | 'tin' | 'collection' | 'blister' | 'other';
}

interface SealedPriceOptions {
  preferredKinds?: Array<NonNullable<MarketPriceResult['productKind']>>;
  requirePreferredKinds?: boolean;
}

function inferProductKind(name?: string): NonNullable<MarketPriceResult['productKind']> {
  const n = (name || '').toLowerCase();
  if (n.includes('booster box')) return 'booster_box';
  if (n.includes('booster bundle')) return 'booster_bundle';
  if (n.includes('booster pack')) return 'booster_pack';
  if (n.includes('elite trainer box') || n.includes('etb')) return 'elite_trainer_box';
  if (n.includes('tin')) return 'tin';
  if (n.includes('collection')) return 'collection';
  if (n.includes('blister')) return 'blister';
  return 'other';
}

/**
 * Search TCGPlayer for sealed product market price.
 * Requires: TCGPLAYER_PUBLIC_KEY, TCGPLAYER_PRIVATE_KEY (OAuth tokens)
 * Docs: https://docs.tcgplayer.com/docs
 */
export async function fetchTcgPlayerSealedPrice(
  productName: string,
  setOrCategory: string,
  options: SealedPriceOptions = {},
): Promise<MarketPriceResult | null> {
  try {
    const query = `${productName} ${setOrCategory}`.trim();
    const queryUrl = `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(query)}`;
    const stopwords = new Set([
      'pokemon',
      'tcg',
      'booster',
      'box',
      'bundle',
      'pack',
      'packs',
      'tin',
      'collection',
      'elite',
      'trainer',
      'etb',
      'battle',
      'build',
      'product',
      'set',
      'the',
      'and',
      'for',
      'with',
    ]);
    const preferredTokens = productName
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.replace(/[^a-z0-9]/g, ''))
      .filter((t) => t.length >= 3 && !stopwords.has(t));
    const body = {
      algorithm: 'sales_dismax',
      from: 0,
      size: 30,
      filters: {
        term: {
          productLineName: ['pokemon'],
        },
      },
      listingSearch: {
        context: { cart: {} },
        filters: { term: { sellerStatus: 'Live', channelId: 0, mpSellerType: 'Gold' } },
        sort: { field: 'listingType', order: 'asc' },
      },
      context: { cart: {}, shippingCountry: 'US' },
      settings: { useFuzzySearch: true },
      sort: {},
      query,
    };

    const response = await axios.post<{
      results?: Array<{
        results?: Array<{
          sealed?: boolean;
          productName?: string;
          productUrlName?: string;
          productId?: number;
          marketPrice?: number;
          lowestPriceWithShipping?: number;
          lowestPrice?: number;
          score?: number;
        }>;
      }>;
    }>('https://mp-search-api.tcgplayer.com/v1/search/request', body, {
      timeout: Number.parseInt(process.env.TCGPLAYER_SEARCH_TIMEOUT_MS || '15000', 10) || 15000,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'CardCommand/1.0',
      },
      validateStatus: (s) => s >= 200 && s < 500,
    });

    const results = response.data?.results?.[0]?.results || [];
    if (results.length === 0) return null;

    const sealedKeyword = /(booster box|booster bundle|booster pack|elite trainer box|etb|tin|collection|blister|build battle)/i;
    const excludedKeyword = /(code card|single card|\s-\s\d+\/\d+)/i;
    const queryNorm = query.toLowerCase();

    const candidates = results
      .filter((r) => {
        const name = r.productName || '';
        const isSealed = r.sealed === true || sealedKeyword.test(name);
        return isSealed && !excludedKeyword.test(name);
      })
      .map((r) => {
        const price = r.marketPrice ?? r.lowestPriceWithShipping ?? r.lowestPrice;
        const name = (r.productName || '').toLowerCase();
        const tokenHits = queryNorm
          .split(/\s+/)
          .filter((t) => t.length >= 3)
          .reduce((acc, token) => (name.includes(token) ? acc + 1 : acc), 0);
        return {
          ...r,
          computedPrice: typeof price === 'number' ? price : null,
          tokenHits,
          preferredHits: preferredTokens.reduce((acc, token) => (name.includes(token) ? acc + 1 : acc), 0),
        };
      })
      .filter((r) => r.computedPrice != null && r.computedPrice > 0);

    if (candidates.length === 0) return null;

    const preferredCandidates =
      preferredTokens.length > 0 ? candidates.filter((c) => c.preferredHits > 0) : candidates;
    if (preferredTokens.length > 0 && preferredCandidates.length === 0) {
      return null;
    }
    const ranked = preferredCandidates.length > 0 ? preferredCandidates : candidates;
    const preferredKinds = new Set(options.preferredKinds || []);
    const kindMatched =
      preferredKinds.size > 0
        ? ranked.filter((r) => preferredKinds.has(inferProductKind(r.productName)))
        : ranked;
    if (options.requirePreferredKinds && preferredKinds.size > 0 && kindMatched.length === 0) {
      return null;
    }
    const pool = kindMatched.length > 0 ? kindMatched : ranked;

    pool.sort((a, b) => {
      const aKind = inferProductKind(a.productName);
      const bKind = inferProductKind(b.productName);
      const aPreferred = preferredKinds.has(aKind) ? 1 : 0;
      const bPreferred = preferredKinds.has(bKind) ? 1 : 0;
      if (bPreferred !== aPreferred) return bPreferred - aPreferred;
      // For ambiguous set-level products, down-rank single packs behind larger sealed items.
      const aPackPenalty = aKind === 'booster_pack' ? 1 : 0;
      const bPackPenalty = bKind === 'booster_pack' ? 1 : 0;
      if (aPackPenalty !== bPackPenalty) return aPackPenalty - bPackPenalty;
      if (b.preferredHits !== a.preferredHits) return b.preferredHits - a.preferredHits;
      if (b.tokenHits !== a.tokenHits) return b.tokenHits - a.tokenHits;
      return (b.score || 0) - (a.score || 0);
    });

    const best = pool[0];
    return {
      source: 'tcgplayer',
      price: Number(best.computedPrice),
      currency: 'USD',
      fetchedAt: new Date().toISOString(),
      priceType: best.marketPrice != null ? 'market' : 'lowest',
      productName: best.productName,
      productUrl: best.productId ? `https://www.tcgplayer.com/product/${best.productId}` : queryUrl,
      productKind: inferProductKind(best.productName),
    };
  } catch {
    return null;
  }
}

/**
 * Search eBay sold listings for sealed product market price.
 * Requires: EBAY_APP_ID (eBay Developer Program)
 * Docs: https://developer.ebay.com/docs
 */
export async function fetchEbaySoldSealedPrice(
  productName: string,
  categoryId?: string,
): Promise<MarketPriceResult | null> {
  const appId = process.env.EBAY_APP_ID;
  if (!appId) {
    return null;
  }

  try {
    // TODO: Implement eBay Finding API or Browse API
    // 1. Search sold listings for product (e.g. "Pokemon Ascended Heroes Booster Box")
    // 2. Compute median/avg of recent sold prices
    void productName;
    void categoryId;
    return null;
  } catch {
    return null;
  }
}

/**
 * Get best available market price from configured sources.
 * Used to enrich estimatedResale when real market data exists.
 */
export async function getSealedMarketPrice(
  productName: string,
  setOrCategory: string,
  options: SealedPriceOptions = {},
): Promise<MarketPriceResult | null> {
  const tcg = await fetchTcgPlayerSealedPrice(productName, setOrCategory, options);
  if (tcg) return tcg;
  const ebay = await fetchEbaySoldSealedPrice(productName);
  if (ebay) return ebay;
  return null;
}
