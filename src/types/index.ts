// ============================================
// CardCommand Center - Type Definitions
// ============================================

import { Request } from 'express';
import { User, Plan, Category, Liquidity, Sentiment } from '@prisma/client';

// ============================================
// Express Extensions
// ============================================

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// ============================================
// Authenticated Request Type
// ============================================

export interface AuthenticatedRequest extends Request {
  user: User;
}

// ============================================
// API Response Types
// ============================================

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

// ============================================
// Request Body Types
// ============================================

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

// ============================================
// Filter Types
// ============================================

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

// ============================================
// External API Types
// ============================================

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
  // ... other grades
}

// ============================================
// Strategy Types (matching frontend)
// ============================================

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

// ============================================
// Re-exports from Prisma
// ============================================

export { User, Plan, Category, Liquidity, Sentiment };
