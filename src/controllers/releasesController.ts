// ============================================
// CardCommand Center - Releases Controller
// ============================================

import { Request, Response } from 'express';
import { PrismaClient, Confidence } from '@prisma/client';

const prisma = new PrismaClient();

function deriveSourceType(url?: string | null): 'official' | 'retailer' | 'distributor' | 'news' | 'community' {
  const u = (url || '').toLowerCase();
  if (!u) return 'news';
  if (u.includes('pokemon.com') || u.includes('wizards.com') || u.includes('konami') || u.includes('onepiece-cardgame') || u.includes('disneylorcana')) {
    return 'official';
  }
  if (u.includes('gtsdistribution') || u.includes('southernhobby') || u.includes('alliance-games')) {
    return 'distributor';
  }
  if (u.includes('gamestop') || u.includes('bestbuy') || u.includes('target')) {
    return 'retailer';
  }
  if (u.includes('pokebeach') || u.includes('reddit') || u.includes('x.com') || u.includes('twitter.com')) {
    return 'community';
  }
  return 'news';
}

function deriveConfidenceScore(
  confidence: Confidence,
  sourceTier?: 'A' | 'B' | 'C' | null,
): number {
  const base = confidence === 'confirmed' ? 80 : confidence === 'unconfirmed' ? 60 : 35;
  const tierBoost = sourceTier === 'A' ? 8 : sourceTier === 'B' ? 2 : 0;
  return Math.max(0, Math.min(100, base + tierBoost));
}

function deriveStatus(releaseDate?: Date | null, confidence?: Confidence): 'rumor' | 'announced' | 'official' | 'released' {
  if (releaseDate && releaseDate <= new Date()) return 'released';
  if (confidence === 'rumor') return 'rumor';
  if (confidence === 'unconfirmed') return 'announced';
  return 'official';
}

// ============================================
// Get All Releases
// ============================================

export const getReleases = async (req: Request, res: Response) => {
  try {
    const {
      category,
      categories,
      upcoming,
      all,
      fromDate,
      toDate,
      sortBy = 'releaseDate',
      sortOrder = 'asc',
      page = '1',
      perPage = '20',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const perPageNum = Math.min(100, Math.max(1, parseInt(perPage as string, 10)));
    const skip = (pageNum - 1) * perPageNum;

    const where: Record<string, unknown> = {};

    // Category filters
    if (categories && typeof categories === 'string' && categories.trim().length > 0) {
      // Multi-select: categories=pokemon,mtg
      const categoryList = categories
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      if (categoryList.length > 0) {
        where.category = { in: categoryList };
      }
    } else if (category && typeof category === 'string') {
      // Backwards-compatible single-category filter
      where.category = category;
    }

    // Date range filters
    if (fromDate || toDate) {
      const range: { gte?: Date; lte?: Date } = {};
      if (fromDate && typeof fromDate === 'string') {
        const parsed = new Date(fromDate);
        if (!isNaN(parsed.getTime())) {
          range.gte = parsed;
        }
      }
      if (toDate && typeof toDate === 'string') {
        const parsed = new Date(toDate);
        if (!isNaN(parsed.getTime())) {
          range.lte = parsed;
        }
      }
      if (range.gte || range.lte) {
        where.releaseDate = range;
      }
    } else {
      // Default: show releases from 1 month ago through 3 months from now
      if (all === 'true') {
        // No date filter
      } else if (upcoming === 'true') {
        where.releaseDate = { gte: new Date() };
      } else {
        const now = new Date();
        const from = new Date(now);
        from.setMonth(from.getMonth() - 1);
        const to = new Date(now);
        to.setMonth(to.getMonth() + 3);
        where.releaseDate = { gte: from, lte: to };
      }
    }

    const orderBy: Record<string, string> = {};
    orderBy[sortBy as string] = sortOrder as string;

    // Get releases with count
    const [releases, totalCount] = await Promise.all([
      prisma.release.findMany({
        where,
        orderBy,
        skip,
        take: perPageNum,
      }),
      prisma.release.count({ where })
    ]);

    // Transform releases for response
    const transformedReleases = releases.map(release => ({
      id: release.id,
      name: release.name,
      releaseDate: release.releaseDate.toISOString(),
      category: release.category,
      manufacturer: release.manufacturer,
      msrp: Number(release.msrp),
      estimatedResale: release.estimatedResale ? Number(release.estimatedResale) : undefined,
      hypeScore: release.hypeScore ? Number(release.hypeScore) : undefined,
      imageUrl: release.imageUrl,
      topChases: release.topChases,
      printRun: release.printRun,
      description: release.description,
      isReleased: release.isReleased,
      createdAt: release.createdAt.toISOString(),
      updatedAt: release.updatedAt.toISOString(),
    }));

    res.json({
      success: true,
      data: transformedReleases,
      pagination: {
        page: pageNum,
        perPage: perPageNum,
        totalCount,
        totalPages: Math.ceil(totalCount / perPageNum)
      }
    });
  } catch (error) {
    console.error('Error fetching releases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch releases'
    });
  }
};

// ============================================
// Get Release Products (boxes, tins, etc.)
// ============================================

export const getReleaseProducts = async (req: Request, res: Response) => {
  try {
    const {
      category,
      categories,
      fromDate,
      toDate,
      confidence: confidenceParam,
      sortBy = 'releaseDate',
      sortOrder = 'asc',
      page = '1',
      perPage = '20',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const perPageNum = Math.min(100, Math.max(1, parseInt(perPage as string, 10)));
    const skip = (pageNum - 1) * perPageNum;

    const where: Record<string, unknown> = {};

    // Confidence filter (confirmed | unconfirmed | rumor); omit = return all
    if (confidenceParam && typeof confidenceParam === 'string' && ['confirmed', 'unconfirmed', 'rumor'].includes(confidenceParam)) {
      where.confidence = confidenceParam as Confidence;
    }

    // Category filters (multi-select first, then single for backward compatibility)
    if (categories && typeof categories === 'string' && categories.trim().length > 0) {
      const categoryList = categories
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      if (categoryList.length > 0) {
        where.category = { in: categoryList };
      }
    } else if (category && typeof category === 'string') {
      where.category = category;
    }

    // Date range filters (optional)
    if (fromDate || toDate) {
      const range: { gte?: Date; lte?: Date } = {};
      if (fromDate && typeof fromDate === 'string') {
        const parsed = new Date(fromDate);
        if (!isNaN(parsed.getTime())) {
          range.gte = parsed;
        }
      }
      if (toDate && typeof toDate === 'string') {
        const parsed = new Date(toDate);
        if (!isNaN(parsed.getTime())) {
          range.lte = parsed;
        }
      }
      if (range.gte || range.lte) {
        where.releaseDate = range;
      }
    }

    const orderBy: Record<string, string> = {};
    orderBy[sortBy as string] = sortOrder as string;

    // Fetch enough to dedupe by logical product (same category + set name + product name)
    const fetchLimit = Math.min(500, perPageNum * 10);
    const allProducts = await prisma.releaseProduct.findMany({
      where,
      orderBy,
      take: fetchLimit,
      include: {
        release: true,
        strategies: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // One card per logical product. Use canonicalized set keys to collapse naming variants
    // like "Ascended Heroes (Mega Evolution)" vs "Mega Evolution—Ascended Heroes".
    const normalize = (s: string) =>
      (s || '')
        .toLowerCase()
        .replace(/<[^>]+>/g, ' ')
        .replace(/&mdash;|&#8212;|&#x2014;/gi, '—')
        .replace(/&ndash;|&#8211;|&#x2013;/gi, '–')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const canonicalSetName = (name: string): string => {
      const n = normalize(name);
      const m = n.match(/^(.+?)\s*\((.+?)\)$/);
      if (!m) return n;
      const left = m[1].trim();
      const right = m[2].trim();
      // Sort components so "foo (bar)" and "bar—foo" share a stable key.
      return [left, right].sort().join(' ');
    };
    const productIdentity = (p: (typeof allProducts)[0]): string => {
      if (p.productType === 'set_default') return 'set_default';
      return normalize(p.productType || p.name || 'unknown');
    };
    const productCompletenessScore = (p: (typeof allProducts)[0]): number => {
      let score = 0;
      if (p.msrp != null) score += 1;
      if (p.estimatedResale != null) score += 1;
      if (p.buyUrl) score += 1;
      if (p.contentsSummary) score += 1;
      if (p.sourceUrl) score += 1;
      if (p.strategies && p.strategies.length > 0) score += 1;
      if (p.productType !== 'set_default') score += 1;
      return score;
    };
    const seen = new Map<string, (typeof allProducts)[0]>();
    for (const p of allProducts) {
      const key = `${p.category}|${canonicalSetName(p.release.name)}|${productIdentity(p)}`;
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, p);
        continue;
      }
      const thisScore = productCompletenessScore(p);
      const existingScore = productCompletenessScore(existing);
      const preferThis =
        thisScore > existingScore ||
        (thisScore === existingScore && p.updatedAt > existing.updatedAt);
      if (preferThis) seen.set(key, p);
    }
    const deduped = Array.from(seen.values());
    const totalCount = deduped.length;
    const products = deduped.slice(skip, skip + perPageNum);

    const transformedProducts = products.map((product) => {
      const latestStrategy = product.strategies && product.strategies.length > 0 ? product.strategies[0] : null;

      return {
        id: product.id,
        name: product.name,
        productType: product.productType,
        category: product.category,
        msrp: product.msrp ?? undefined,
        estimatedResale: product.estimatedResale ?? undefined,
        releaseDate: product.releaseDate ? product.releaseDate.toISOString() : undefined,
        preorderDate: product.preorderDate ? product.preorderDate.toISOString() : undefined,
        imageUrl: product.imageUrl ?? product.release.imageUrl ?? undefined,
        buyUrl: product.buyUrl ?? undefined,
        contentsSummary: product.contentsSummary ?? undefined,
        setName: product.release.name,
        setHypeScore: product.release.hypeScore ? Number(product.release.hypeScore) : undefined,
        confidence: product.confidence,
        confidenceScore: deriveConfidenceScore(product.confidence, product.sourceTier as 'A' | 'B' | 'C' | null),
        sourceType: deriveSourceType(product.sourceUrl),
        status: deriveStatus(product.releaseDate, product.confidence),
        sourceUrl: product.sourceUrl ?? undefined,
        strategy: latestStrategy
          ? {
              primary: latestStrategy.primary,
              confidence: latestStrategy.confidence,
              reasonSummary: latestStrategy.reasonSummary,
              keyFactors: latestStrategy.keyFactors ?? undefined,
            }
          : undefined,
      };
    });

    res.json({
      success: true,
      data: transformedProducts,
      pagination: {
        page: pageNum,
        perPage: perPageNum,
        totalCount,
        totalPages: Math.ceil(totalCount / perPageNum),
      },
    });
  } catch (error) {
    console.error('Error fetching release products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch release products',
    });
  }
};

// ============================================
// Get Release Product Changes (date/price changes for "what changed" UX)
// ============================================

export const getReleaseChanges = async (req: Request, res: Response) => {
  try {
    const { limit = '50', since } = req.query;
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const sinceDate = since && typeof since === 'string' ? new Date(since) : undefined;

    const where: { detectedAt?: { gte: Date } } = {};
    if (sinceDate && !isNaN(sinceDate.getTime())) {
      where.detectedAt = { gte: sinceDate };
    }

    const changes = await prisma.releaseProductChange.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
      take: limitNum,
      include: {
        releaseProduct: {
          include: { release: true },
        },
      },
    });

    const data = changes.map((c) => ({
      id: c.id,
      field: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue,
      detectedAt: c.detectedAt.toISOString(),
      sourceUrl: c.sourceUrl ?? undefined,
      productName: c.releaseProduct.name,
      productId: c.releaseProduct.id,
      setName: c.releaseProduct.release.name,
      category: c.releaseProduct.category,
    }));

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching release changes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch release changes',
    });
  }
};

// ============================================
// Get Single Release
// ============================================

export const getRelease = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const release = await prisma.release.findUnique({
      where: { id }
    });

    if (!release) {
      return res.status(404).json({
        success: false,
        error: 'Release not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: release.id,
        name: release.name,
        releaseDate: release.releaseDate.toISOString(),
        category: release.category,
        manufacturer: release.manufacturer,
        msrp: Number(release.msrp),
        estimatedResale: release.estimatedResale ? Number(release.estimatedResale) : undefined,
        hypeScore: release.hypeScore ? Number(release.hypeScore) : undefined,
        imageUrl: release.imageUrl,
        topChases: release.topChases,
        printRun: release.printRun,
        description: release.description,
        isReleased: release.isReleased,
        createdAt: release.createdAt.toISOString(),
        updatedAt: release.updatedAt.toISOString(),
      }
    });
  } catch (error) {
    console.error('Error fetching release:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch release'
    });
  }
};

// ============================================
// Create Release (Admin only)
// ============================================

export const createRelease = async (req: Request, res: Response) => {
  try {
    const releaseData = req.body;

    const release = await prisma.release.create({
      data: {
        name: releaseData.name,
        releaseDate: new Date(releaseData.releaseDate),
        category: releaseData.category,
        manufacturer: releaseData.manufacturer,
        msrp: releaseData.msrp,
        estimatedResale: releaseData.estimatedResale,
        hypeScore: releaseData.hypeScore,
        imageUrl: releaseData.imageUrl,
        topChases: releaseData.topChases || [],
        printRun: releaseData.printRun,
        description: releaseData.description,
      }
    });

    res.status(201).json({
      success: true,
      data: release
    });
  } catch (error) {
    console.error('Error creating release:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create release'
    });
  }
};

// ============================================
// Placeholder reminder functions (will implement later)
// ============================================

export const setReminder = async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Reminder feature coming soon' });
};

export const removeReminder = async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Reminder feature coming soon' });
};

export const getReminders = async (req: Request, res: Response) => {
  res.json({ success: true, data: [] });
};
