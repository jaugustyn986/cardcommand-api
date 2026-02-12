// ============================================
// CardCommand Center - Validation Middleware
// ============================================

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { z } from 'zod';

// Validation middleware factory
export function validate(schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details: Record<string, string[]> = {};
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          if (!details[path]) {
            details[path] = [];
          }
          details[path].push(err.message);
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details,
          },
        });
        return;
      }
      next(error);
    }
  };
}

// Common validation schemas
export const schemas = {
  // Auth schemas
  login: {
    body: z.object({
      email: z.string().email('Invalid email address'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
    }),
  },
  
  register: {
    body: z.object({
      email: z.string().email('Invalid email address'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      name: z.string().optional(),
    }),
  },

  // Deal filters
  dealFilters: {
    query: z.object({
      categories: z.string().optional().transform(val => val?.split(',')),
      minSavings: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
      maxPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
      grades: z.string().optional().transform(val => val?.split(',')),
      search: z.string().optional(),
      page: z.string().optional().transform(val => val ? parseInt(val) : 1),
      perPage: z.string().optional().transform(val => val ? parseInt(val) : 20),
    }),
  },

  // Portfolio
  createPortfolioItem: {
    body: z.object({
      cardName: z.string().min(1, 'Card name is required'),
      cardSet: z.string().min(1, 'Set name is required'),
      year: z.number().int().min(1900).max(2100),
      grade: z.string().min(1, 'Grade is required'),
      grader: z.string().optional(),
      currentValue: z.number().positive(),
      purchasePrice: z.number().positive(),
      quantity: z.number().int().positive().default(1),
      imageUrl: z.string().url().optional(),
      notes: z.string().optional(),
    }),
  },

  updatePortfolioItem: {
    body: z.object({
      currentValue: z.number().positive().optional(),
      quantity: z.number().int().positive().optional(),
      notes: z.string().optional(),
      inGradingQueue: z.boolean().optional(),
    }),
  },

  // User preferences
  updatePreferences: {
    body: z.object({
      categories: z.array(z.string()).optional(),
      priceRangeMin: z.number().min(0).optional(),
      priceRangeMax: z.number().min(0).optional(),
      grades: z.array(z.string()).optional(),
      graders: z.array(z.string()).optional(),
      dealAlertThreshold: z.number().min(0).max(100).optional(),
      notificationChannels: z.array(z.string()).optional(),
    }),
  },

  tcgGameParam: {
    params: z.object({
      game: z.enum(['pokemon', 'mtg', 'yugioh']),
    }),
  },

  tcgSetsQuery: {
    query: z.object({
      sort: z.enum(['release_date_desc', 'release_date_asc']).optional(),
      page: z.string().optional(),
      perPage: z.string().optional(),
    }),
  },

  tcgSetCardsQuery: {
    query: z.object({
      query: z.string().optional(),
      rarity: z.string().optional(),
      page: z.string().optional(),
      perPage: z.string().optional(),
    }),
    params: z.object({
      game: z.enum(['pokemon', 'mtg', 'yugioh']),
      setId: z.string().min(1),
    }),
  },

  tcgCardParams: {
    params: z.object({
      game: z.enum(['pokemon', 'mtg', 'yugioh']),
      cardId: z.string().min(1),
    }),
  },
};
