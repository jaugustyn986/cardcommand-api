import { User, Plan, Category, Liquidity, Sentiment } from '@prisma/client';

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

export interface DealFilters {
  categories?: Category[];
  minSavings?: number;
  maxPrice?: number;
  grades?: string[];
  marketplaces?: string[];
  search?: string;
}

export { User, Plan, Category, Liquidity, Sentiment };
