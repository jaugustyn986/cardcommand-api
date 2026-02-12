// ============================================
// CardCommand Center - Release Intel Source Registry
// Drives the 3-tier ingestion pipeline (A/B/C)
// ============================================

import type { Category } from '@prisma/client';

export type SourceTierType = 'A' | 'B' | 'C';
export type SourceType = 'official' | 'retailer' | 'distributor' | 'news' | 'community';

export interface ReleaseIntelSource {
  id: string;
  name: string;
  url: string;
  tier: SourceTierType;
  category: Category;
  sourceType: SourceType;
  enabled: boolean;
  includeInScrape?: boolean;
  /** Optional: schedule hint for future cron (e.g. "daily", "twice_daily") */
  schedule?: string;
}

/**
 * Tier A: No-scrape (APIs, feeds) – preferred.
 * Tier B: Light fetch + parse (allowed HTML pages).
 * Tier C: Manual/curated or rumor – promote when second source agrees.
 */
export const RELEASE_INTEL_SOURCES: ReleaseIntelSource[] = [
  {
    id: 'pokemon-tcg-api',
    name: 'Pokémon TCG API',
    url: 'https://api.pokemontcg.io/v2/sets',
    tier: 'A',
    category: 'pokemon',
    sourceType: 'official',
    enabled: true,
    includeInScrape: false,
    schedule: 'daily',
  },
  {
    id: 'scryfall-sets',
    name: 'Scryfall Sets (MTG)',
    url: 'https://api.scryfall.com/sets',
    tier: 'A',
    category: 'mtg',
    sourceType: 'official',
    enabled: true,
    includeInScrape: false,
    schedule: 'daily',
  },
  {
    id: 'pokemon-center-tcg',
    name: 'Pokémon Center TCG',
    url: 'https://www.pokemoncenter.com/category/trading-card-game',
    tier: 'A',
    category: 'pokemon',
    sourceType: 'official',
    enabled: true,
    includeInScrape: true,
    schedule: 'twice_daily',
  },
  {
    id: 'wotc-products',
    name: 'Wizards Product Hub',
    url: 'https://magic.wizards.com/en/products',
    tier: 'A',
    category: 'mtg',
    sourceType: 'official',
    enabled: true,
    includeInScrape: true,
    schedule: 'daily',
  },
  {
    id: 'ign-pokemon-2026',
    name: 'IGN Pokémon TCG 2026',
    url: 'https://www.ign.com/articles/pokemon-tcg-full-release-schedule-2026',
    tier: 'B',
    category: 'pokemon',
    sourceType: 'news',
    enabled: true,
    includeInScrape: true,
    schedule: 'daily',
  },
  {
    id: 'pokemon-com-expansions',
    name: 'Pokémon.com TCG Expansions',
    url: 'https://www.pokemon.com/us/pokemon-tcg/trading-card-expansions',
    tier: 'B',
    category: 'pokemon',
    sourceType: 'official',
    enabled: true,
    includeInScrape: true,
    schedule: 'daily',
  },
  {
    id: 'pokemon-com-perfect-order',
    name: 'Pokémon.com Mega Evolution—Perfect Order',
    url: 'https://www.pokemon.com/us/pokemon-tcg/mega-evolution-perfect-order',
    tier: 'B',
    category: 'pokemon',
    sourceType: 'official',
    enabled: true,
    includeInScrape: true,
    schedule: 'daily',
  },
  {
    id: 'pokemon-press-schedule',
    name: 'Pokémon Press TCG Schedule',
    url: 'https://press.pokemon.com/en/Items/Schedule/Pokemon-Trading-Card-Game',
    tier: 'B',
    category: 'pokemon',
    sourceType: 'official',
    enabled: true,
    includeInScrape: true,
    schedule: 'daily',
  },
  {
    id: 'gts-distribution-pokemon',
    name: 'GTS Distribution (Pokemon)',
    url: 'https://www.gtsdistribution.com/pc_product_search_results.asp?search_prod=Pokemon',
    tier: 'B',
    category: 'pokemon',
    sourceType: 'distributor',
    enabled: true,
    includeInScrape: true,
    schedule: 'daily',
  },
  {
    id: 'alliance-games-tcg',
    name: 'Alliance Games (TCG)',
    url: 'https://www.alliance-games.com/',
    tier: 'B',
    category: 'pokemon',
    sourceType: 'distributor',
    enabled: true,
    includeInScrape: true,
    schedule: 'daily',
  },
  {
    id: 'southern-hobby-tcg',
    name: 'Southern Hobby (TCG)',
    url: 'https://www.southernhobby.com/trading-card-games-c-1.html',
    tier: 'B',
    category: 'pokemon',
    sourceType: 'distributor',
    enabled: true,
    includeInScrape: true,
    schedule: 'daily',
  },
  {
    id: 'gamestop-pokemon',
    name: 'GameStop Pokemon',
    url: 'https://www.gamestop.com/search/?q=pokemon+tcg+preorder',
    tier: 'B',
    category: 'pokemon',
    sourceType: 'retailer',
    enabled: true,
    includeInScrape: true,
    schedule: 'twice_daily',
  },
  {
    id: 'bestbuy-pokemon',
    name: 'Best Buy Pokemon',
    url: 'https://www.bestbuy.com/site/searchpage.jsp?st=pokemon+tcg+preorder',
    tier: 'B',
    category: 'pokemon',
    sourceType: 'retailer',
    enabled: true,
    includeInScrape: true,
    schedule: 'twice_daily',
  },
  {
    id: 'target-pokemon',
    name: 'Target Pokemon',
    url: 'https://www.target.com/s?searchTerm=pokemon+tcg+preorder',
    tier: 'B',
    category: 'pokemon',
    sourceType: 'retailer',
    enabled: true,
    includeInScrape: true,
    schedule: 'twice_daily',
  },
  {
    id: 'bulbapedia-expansions',
    name: 'Bulbapedia TCG Expansions',
    url: 'https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_Trading_Card_Game_expansions',
    tier: 'B',
    category: 'pokemon',
    sourceType: 'news',
    enabled: true,
    includeInScrape: true,
    schedule: 'daily',
  },
  {
    id: 'pokebeach-news',
    name: 'PokéBeach (news / early intel)',
    url: 'https://pokebeach.com/',
    tier: 'C',
    category: 'pokemon',
    sourceType: 'community',
    enabled: true,
    includeInScrape: true,
    schedule: 'daily',
  },
  {
    id: 'one-piece-official-products',
    name: 'One Piece Card Game Products',
    url: 'https://en.onepiece-cardgame.com/products/',
    tier: 'A',
    category: 'one_piece',
    sourceType: 'official',
    enabled: true,
    includeInScrape: true,
    schedule: 'daily',
  },
  {
    id: 'lorcana-official',
    name: 'Disney Lorcana Official',
    url: 'https://www.disneylorcana.com/en-US',
    tier: 'A',
    category: 'lorcana',
    sourceType: 'official',
    enabled: true,
    includeInScrape: true,
    schedule: 'daily',
  },
  {
    id: 'yugioh-official-products',
    name: 'Yu-Gi-Oh! Products',
    url: 'https://www.yugioh-card.com/en/products/',
    tier: 'A',
    category: 'yugioh',
    sourceType: 'official',
    enabled: true,
    includeInScrape: true,
    schedule: 'daily',
  },
];

export function getSourcesByTier(tier: SourceTierType): ReleaseIntelSource[] {
  return RELEASE_INTEL_SOURCES.filter((s) => s.enabled && s.tier === tier);
}

export function getTierBSources(): ReleaseIntelSource[] {
  return getSourcesByTier('B');
}

export function getTierCSources(): ReleaseIntelSource[] {
  return getSourcesByTier('C');
}

/** All scrape sources (B + C) for the pipeline; C products get confidence rumor */
export function getScrapeSources(): ReleaseIntelSource[] {
  return RELEASE_INTEL_SOURCES.filter((s) => s.enabled && s.includeInScrape !== false);
}
