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
export declare const RELEASE_INTEL_SOURCES: ReleaseIntelSource[];
export declare function getSourcesByTier(tier: SourceTierType): ReleaseIntelSource[];
export declare function getTierBSources(): ReleaseIntelSource[];
//# sourceMappingURL=releaseIntelSources.d.ts.map