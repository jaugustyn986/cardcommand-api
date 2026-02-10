export interface ExtractedProduct {
    name: string;
    productType: string;
    msrp?: number;
    estimatedResale?: number;
    releaseDate?: string;
    preorderDate?: string;
    imageUrl?: string;
    buyUrl?: string;
    contentsSummary?: string;
}
export interface ExtractedSet {
    setName: string;
    category: 'pokemon' | 'mtg' | 'yugioh' | 'one_piece' | 'lorcana' | 'digimon';
    products: ExtractedProduct[];
}
export interface ExtractedPayload {
    releases: ExtractedSet[];
}
export interface ScrapeResult {
    sources: number;
    productsUpserted: number;
    changesDetected: number;
}
export declare function scrapeAndUpsertReleaseProducts(): Promise<ScrapeResult>;
//# sourceMappingURL=releaseScrapeService.d.ts.map