"use strict";
// ============================================
// CardCommand Center - Validation Middleware
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.schemas = void 0;
exports.validate = validate;
const zod_1 = require("zod");
const zod_2 = require("zod");
// Validation middleware factory
function validate(schema) {
    return (req, res, next) => {
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
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const details = {};
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
exports.schemas = {
    // Auth schemas
    login: {
        body: zod_2.z.object({
            email: zod_2.z.string().email('Invalid email address'),
            password: zod_2.z.string().min(8, 'Password must be at least 8 characters'),
        }),
    },
    register: {
        body: zod_2.z.object({
            email: zod_2.z.string().email('Invalid email address'),
            password: zod_2.z.string().min(8, 'Password must be at least 8 characters'),
            name: zod_2.z.string().optional(),
        }),
    },
    // Deal filters
    dealFilters: {
        query: zod_2.z.object({
            categories: zod_2.z.string().optional().transform(val => val?.split(',')),
            minSavings: zod_2.z.string().optional().transform(val => val ? parseFloat(val) : undefined),
            maxPrice: zod_2.z.string().optional().transform(val => val ? parseFloat(val) : undefined),
            grades: zod_2.z.string().optional().transform(val => val?.split(',')),
            search: zod_2.z.string().optional(),
            page: zod_2.z.string().optional().transform(val => val ? parseInt(val) : 1),
            perPage: zod_2.z.string().optional().transform(val => val ? parseInt(val) : 20),
        }),
    },
    // Portfolio
    createPortfolioItem: {
        body: zod_2.z.object({
            cardName: zod_2.z.string().min(1, 'Card name is required'),
            cardSet: zod_2.z.string().min(1, 'Set name is required'),
            year: zod_2.z.number().int().min(1900).max(2100),
            grade: zod_2.z.string().min(1, 'Grade is required'),
            grader: zod_2.z.string().optional(),
            currentValue: zod_2.z.number().positive(),
            purchasePrice: zod_2.z.number().positive(),
            quantity: zod_2.z.number().int().positive().default(1),
            imageUrl: zod_2.z.string().url().optional(),
            notes: zod_2.z.string().optional(),
        }),
    },
    updatePortfolioItem: {
        body: zod_2.z.object({
            currentValue: zod_2.z.number().positive().optional(),
            quantity: zod_2.z.number().int().positive().optional(),
            notes: zod_2.z.string().optional(),
            inGradingQueue: zod_2.z.boolean().optional(),
        }),
    },
    // User preferences
    updatePreferences: {
        body: zod_2.z.object({
            categories: zod_2.z.array(zod_2.z.string()).optional(),
            priceRangeMin: zod_2.z.number().min(0).optional(),
            priceRangeMax: zod_2.z.number().min(0).optional(),
            grades: zod_2.z.array(zod_2.z.string()).optional(),
            graders: zod_2.z.array(zod_2.z.string()).optional(),
            dealAlertThreshold: zod_2.z.number().min(0).max(100).optional(),
            notificationChannels: zod_2.z.array(zod_2.z.string()).optional(),
        }),
    },
};
//# sourceMappingURL=validate.js.map