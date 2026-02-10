import { User, Plan, Category, Liquidity } from '@prisma/client';
export type { UserWithPreferences } from '../middleware/auth';
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    meta?: PaginationMeta;
    error?: ApiError;
}
export interface PaginationMeta {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
}
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, string[]>;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface RegisterRequest {
    email: string;
    password: string;
    name?: string;
}
export interface UpdatePreferencesRequest {
    categories?: Category[];
    priceRangeMin?: number;
    priceRangeMax?: number;
    grades?: string[];
    graders?: string[];
    dealAlertThreshold?: number;
    notificationChannels?: string[];
}
export interface CreatePortfolioItemRequest {
    cardName: string;
    cardSet: string;
    year: number;
    grade: string;
    grader?: string;
    currentValue: number;
    purchasePrice: number;
    quantity?: number;
    imageUrl?: string;
    notes?: string;
}
export interface UpdatePortfolioItemRequest {
    currentValue?: number;
    quantity?: number;
    notes?: string;
    inGradingQueue?: boolean;
}
export interface DealFilters {
    categories?: Category[];
    minSavings?: number;
    maxPrice?: number;
    grades?: string[];
    marketplaces?: string[];
    search?: string;
}
export interface PriceHistoryFilters {
    cardName: string;
    cardSet: string;
    year: number;
    grade: string;
    grader?: string;
    days?: number;
}
export interface EbaySearchResult {
    itemId: string;
    title: string;
    price: {
        value: string;
        currency: string;
    };
    image?: {
        imageUrl: string;
    };
    seller: {
        username: string;
        feedbackScore: number;
        feedbackPercentage: string;
    };
    itemWebUrl: string;
    condition?: string;
    listingEndDate?: string;
}
export interface EbayPriceResult {
    title: string;
    price: string;
    currency: string;
    soldDate: string;
}
export interface PSAPopReport {
    cardName: string;
    cardSet: string;
    year: number;
    totalGraded: number;
    grade10: number;
    grade9: number;
    grade8: number;
}
export interface Strategy {
    primary: 'Flip' | 'Short Hold' | 'Long Hold' | 'Avoid' | 'Grade First';
    confidence: number;
    reasoning: string;
    scenarios: StrategyScenario[];
    risks: string[];
    alternatives: string[];
    keyFactors: StrategyFactor[];
}
export interface StrategyScenario {
    timeframe: string;
    projectedReturn: number;
    confidence: number;
    liquidity: 'High' | 'Medium' | 'Low';
}
export interface StrategyFactor {
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    detail: string;
}
export { User, Plan, Category, Liquidity };
//# sourceMappingURL=index.d.ts.map