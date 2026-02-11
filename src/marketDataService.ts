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
}

/**
 * Search TCGPlayer for sealed product market price.
 * Requires: TCGPLAYER_PUBLIC_KEY, TCGPLAYER_PRIVATE_KEY (OAuth tokens)
 * Docs: https://docs.tcgplayer.com/docs
 */
export async function fetchTcgPlayerSealedPrice(
  productName: string,
  setOrCategory: string,
): Promise<MarketPriceResult | null> {
  const publicKey = process.env.TCGPLAYER_PUBLIC_KEY;
  const privateKey = process.env.TCGPLAYER_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return null;
  }

  try {
    // TODO: Implement TCGPlayer OAuth + Catalog/SKU search for sealed product
    // 1. Get access token via client credentials
    // 2. Search catalog for product (e.g. "Ascended Heroes Booster Box")
    // 3. Get market price for matching SKU
    void productName;
    void setOrCategory;
    void axios;
    return null;
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
): Promise<MarketPriceResult | null> {
  const tcg = await fetchTcgPlayerSealedPrice(productName, setOrCategory);
  if (tcg) return tcg;
  const ebay = await fetchEbaySoldSealedPrice(productName);
  if (ebay) return ebay;
  return null;
}
