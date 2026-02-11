// ============================================
// CardCommand Center - Release Sync Service
// Syncs release data from external APIs
// ============================================

import { PrismaClient, Category, Release, SourceTier } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// ============================================
// Pokemon TCG API Sync
// https://pokemontcg.io/
// ============================================

interface PokemonSet {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  legalities: {
    unlimited?: string;
    standard?: string;
    expanded?: string;
  };
  ptcgoCode?: string;
  releaseDate: string;
  updatedAt: string;
  images: {
    symbol: string;
    logo: string;
  };
}

export async function syncPokemonReleases(): Promise<number> {
  try {
    console.log('🔄 Syncing Pokemon TCG releases...');
    
    const response = await axios.get('https://api.pokemontcg.io/v2/sets', {
      headers: {
        'X-Api-Key': process.env.POKEMON_TCG_API_KEY || '',
      },
    });

    const sets: PokemonSet[] = response.data.data;
    let syncedCount = 0;

    for (const set of sets) {
      // Skip if release is too old (older than 1 year)
      const releaseDate = new Date(set.releaseDate);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      if (releaseDate < oneYearAgo) continue;

      // Check if release already exists (we store name as "Name (Series)" so match both)
      const possibleNames = [set.name, `${set.name} (${set.series})`];
      const existingRelease = await prisma.release.findFirst({
        where: {
          name: { in: possibleNames },
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
        await ensureDefaultReleaseProduct(updatedRelease, { category: 'pokemon', set });
      } else {
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
        await ensureDefaultReleaseProduct(newRelease, { category: 'pokemon', set });
        syncedCount++;
      }
    }

    console.log(`✅ Synced ${syncedCount} Pokemon releases`);
    return syncedCount;
  } catch (error) {
    console.error('❌ Error syncing Pokemon releases:', error);
    return 0;
  }
}

// ============================================
// Scryfall API Sync (Magic: The Gathering)
// https://scryfall.com/docs/api
// ============================================

interface ScryfallSet {
  object: string;
  id: string;
  code: string;
  mtgo_code?: string;
  tcgplayer_id?: number;
  name: string;
  set_type: string;
  released_at?: string;
  block_code?: string;
  block?: string;
  parent_set_code?: string;
  card_count: number;
  printed_size?: number;
  digital: boolean;
  foil_only: boolean;
  nonfoil_only: boolean;
  scryfall_uri: string;
  uri: string;
  icon_svg_uri: string;
  search_uri: string;
}

export async function syncMTGReleases(): Promise<number> {
  try {
    console.log('🔄 Syncing MTG releases...');
    
    const response = await axios.get('https://api.scryfall.com/sets');
    const sets: ScryfallSet[] = response.data.data;
    let syncedCount = 0;

    for (const set of sets) {
      // Skip digital-only sets
      if (set.digital) continue;
      
      // Skip if no release date
      if (!set.released_at) continue;

      const releaseDate = new Date(set.released_at);
      
      // Skip if release is too old
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      if (releaseDate < oneYearAgo) continue;

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
        await ensureDefaultReleaseProduct(updatedRelease, { category: 'mtg', set });
      } else {
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
        await ensureDefaultReleaseProduct(newRelease, { category: 'mtg', set });
        syncedCount++;
      }
    }

    console.log(`✅ Synced ${syncedCount} MTG releases`);
    return syncedCount;
  } catch (error) {
    console.error('❌ Error syncing MTG releases:', error);
    return 0;
  }
}

// ============================================
// Helper Functions
// ============================================

function estimateMsrp(category: Category, setName: string): number {
  // Estimate MSRP based on category and set name patterns
  const name = setName.toLowerCase();
  
  switch (category) {
    case 'pokemon':
      if (name.includes('elite trainer box') || name.includes('etb')) return 49.99;
      if (name.includes('booster box')) return 143.99;
      if (name.includes('collection box')) return 24.99;
      if (name.includes('tin')) return 29.99;
      return 4.99; // Single booster pack
      
    case 'mtg':
      if (name.includes('collector')) return 22.99;
      if (name.includes('draft') || name.includes('set')) return 5.99;
      if (name.includes('play')) return 19.99;
      return 5.99; // Draft booster
      
    default:
      return 9.99;
  }
}

function calculateHypeScore(set: PokemonSet): number {
  // Calculate hype score based on various factors
  let score = 5.0; // Base score
  
  // Newer sets get higher hype
  const releaseDate = new Date(set.releaseDate);
  const daysUntil = Math.ceil((releaseDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  
  if (daysUntil > 0 && daysUntil <= 30) {
    score += 2.0; // High hype for upcoming releases
  } else if (daysUntil > 30 && daysUntil <= 90) {
    score += 1.0;
  }
  
  // Popular series get higher scores
  const popularSeries = ['Scarlet & Violet', 'Sword & Shield', 'Sun & Moon'];
  if (popularSeries.some(s => set.series.includes(s))) {
    score += 1.0;
  }
  
  return Math.min(score, 10.0);
}

function calculateMTGHypeScore(set: ScryfallSet): number {
  let score = 5.0;
  
  if (!set.released_at) return score;
  
  const releaseDate = new Date(set.released_at);
  const daysUntil = Math.ceil((releaseDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  
  if (daysUntil > 0 && daysUntil <= 30) {
    score += 2.0;
  } else if (daysUntil > 30 && daysUntil <= 90) {
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

export async function syncAllReleases(): Promise<{ pokemon: number; mtg: number }> {
  const [pokemon, mtg] = await Promise.all([
    syncPokemonReleases(),
    syncMTGReleases(),
  ]);
  
  return { pokemon, mtg };
}

// ============================================
// Tier A link builders (consistent UX across all products)
// ============================================

function tierALinksForPokemon(set: PokemonSet): { buyUrl: string; sourceUrl: string } {
  const q = encodeURIComponent(set.name);
  return {
    buyUrl: `https://www.tcgplayer.com/search/pokemon/product?q=${q}`,
    sourceUrl: 'https://www.pokemon.com/us/pokemon-tcg/trading-card-expansions',
  };
}

function tierALinksForMTG(set: ScryfallSet): { buyUrl: string; sourceUrl: string } {
  const q = encodeURIComponent(set.name);
  return {
    buyUrl: `https://www.tcgplayer.com/search/magic/product?q=${q}`,
    sourceUrl: set.scryfall_uri || `https://scryfall.com/sets/${set.code}`,
  };
}

/** Conservative heuristic for sealed resale when Tier A has no market data (typically ~5–10% above MSRP at release) */
function tierAEstimatedResale(msrp: number): number {
  return Math.round(msrp * 1.08 * 100) / 100;
}

// ============================================
// Release Product helpers
// ============================================

type TierAMetadata = { category: 'pokemon'; set: PokemonSet } | { category: 'mtg'; set: ScryfallSet };

async function ensureDefaultReleaseProduct(
  release: Release,
  tierAMeta?: TierAMetadata,
): Promise<void> {
  const existing = await prisma.releaseProduct.findFirst({
    where: { releaseId: release.id },
  });

  let buyUrl: string | null = null;
  let sourceUrl: string | null = null;
  let estimatedResale: number | null = release.estimatedResale ?? null;

  if (tierAMeta) {
    if (tierAMeta.category === 'pokemon') {
      const links = tierALinksForPokemon(tierAMeta.set);
      buyUrl = links.buyUrl;
      sourceUrl = links.sourceUrl;
    } else {
      const links = tierALinksForMTG(tierAMeta.set);
      buyUrl = links.buyUrl;
      sourceUrl = links.sourceUrl;
    }
    if (estimatedResale == null && release.msrp != null) {
      estimatedResale = tierAEstimatedResale(release.msrp);
    }
  }

  const productData = {
    name: `${release.name} - Booster Product`,
    productType: 'set_default' as const,
    category: release.category,
    msrp: release.msrp,
    estimatedResale,
    releaseDate: release.releaseDate,
    preorderDate: null as Date | null,
    imageUrl: release.imageUrl,
    buyUrl,
    sourceUrl,
    sourceTier: tierAMeta ? SourceTier.A : null,
    contentsSummary: release.description,
  };

  if (existing) {
    await prisma.releaseProduct.update({
      where: { id: existing.id },
      data: {
        buyUrl: buyUrl ?? existing.buyUrl,
        sourceUrl: sourceUrl ?? existing.sourceUrl,
        estimatedResale: estimatedResale ?? existing.estimatedResale,
        sourceTier: tierAMeta ? SourceTier.A : existing.sourceTier,
      },
    });
    return;
  }

  await prisma.releaseProduct.create({
    data: {
      releaseId: release.id,
      ...productData,
    },
  });
}

/** Backfill buyUrl, sourceUrl, estimatedResale for set_default products that are missing them */
export async function backfillTierALinks(): Promise<number> {
  const products = await prisma.releaseProduct.findMany({
    where: {
      productType: 'set_default',
      OR: [{ buyUrl: null }, { sourceUrl: null }, { estimatedResale: null }],
    },
    include: { release: true },
  });

  let updated = 0;
  for (const p of products) {
    const q = encodeURIComponent(p.release.name);
    const buyUrl =
      p.release.category === 'pokemon'
        ? `https://www.tcgplayer.com/search/pokemon/product?q=${q}`
        : p.release.category === 'mtg'
          ? `https://www.tcgplayer.com/search/magic/product?q=${q}`
          : null;
    const sourceUrl =
      p.release.category === 'pokemon'
        ? 'https://www.pokemon.com/us/pokemon-tcg/trading-card-expansions'
        : p.release.category === 'mtg'
          ? 'https://scryfall.com/sets'
          : null;
    const estimatedResale =
      p.msrp != null ? Math.round(p.msrp * 1.08 * 100) / 100 : null;

    await prisma.releaseProduct.update({
      where: { id: p.id },
      data: {
        buyUrl: buyUrl ?? p.buyUrl,
        sourceUrl: sourceUrl ?? p.sourceUrl,
        estimatedResale: estimatedResale ?? p.estimatedResale,
        sourceTier: p.sourceTier ?? SourceTier.A,
      },
    });
    updated++;
  }
  if (updated > 0) {
    console.log(`✅ Tier A links backfill: updated ${updated} products`);
  }
  return updated;
}

