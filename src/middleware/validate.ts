import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, z } from 'zod';

export function validate(schema: { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schema.body) req.body = schema.body.parse(req.body);
      if (schema.query) req.query = schema.query.parse(req.query);
      if (schema.params) req.params = schema.params.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details: Record<string, string[]> = {};
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          if (!details[path]) details[path] = [];
          details[path].push(err.message);
        });

        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details },
        });
        return;
      }
      next(error);
    }
  };
}

export const schemas = {
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
  dealFilters: {
    query: z.object({
      categories: z.string().optional().transform(val => val?.split(',')),
      minSavings: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
      maxPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
      search: z.string().optional(),
      page: z.string().optional().transform(val => val ? parseInt(val) : 1),
      perPage: z.string().optional().transform(val => val ? parseInt(val) : 20),
    }),
  },
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
};
