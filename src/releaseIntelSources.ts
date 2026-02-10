// ============================================
// CardCommand Center - Release Intel Source Registry
// Drives the 3-tier ingestion pipeline (A/B/C)
// ============================================

import type { Category } from '@prisma/client';

export type SourceTierType = 'A' | 'B' | 'C';

export interface ReleaseIntelSource {
  id: string;
  name: string;
  url: string;
  tier: SourceTierType;
  category: Category;
  enabled: boolean;
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
    enabled: true,
    schedule: 'daily',
  },
  {
    id: 'scryfall-sets',
    name: 'Scryfall Sets (MTG)',
    url: 'https://api.scryfall.com/sets',
    tier: 'A',
    category: 'mtg',
    enabled: true,
    schedule: 'daily',
  },
  {
    id: 'ign-pokemon-2026',
    name: 'IGN Pokémon TCG 2026',
    url: 'https://www.ign.com/articles/pokemon-tcg-full-release-schedule-2026',
    tier: 'B',
    category: 'pokemon',
    enabled: true,
    schedule: 'daily',
  },
  {
    id: 'pokemon-com-expansions',
    name: 'Pokémon.com TCG Expansions',
    url: 'https://www.pokemon.com/us/pokemon-tcg/trading-card-expansions',
    tier: 'B',
    category: 'pokemon',
    enabled: true,
    schedule: 'daily',
  },
  // Future: Pokémon press schedule, Pokémon Center preorder dates, Bulbapedia, PokéBeach
];

export function getSourcesByTier(tier: SourceTierType): ReleaseIntelSource[] {
  return RELEASE_INTEL_SOURCES.filter((s) => s.enabled && s.tier === tier);
}

export function getTierBSources(): ReleaseIntelSource[] {
  return getSourcesByTier('B');
}
