import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { z } from 'zod';
export declare function validate(schema: {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
}): (req: Request, res: Response, next: NextFunction) => void;
export declare const schemas: {
    login: {
        body: z.ZodObject<{
            email: z.ZodString;
            password: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            email: string;
            password: string;
        }, {
            email: string;
            password: string;
        }>;
    };
    register: {
        body: z.ZodObject<{
            email: z.ZodString;
            password: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            email: string;
            password: string;
            name?: string | undefined;
        }, {
            email: string;
            password: string;
            name?: string | undefined;
        }>;
    };
    dealFilters: {
        query: z.ZodObject<{
            categories: z.ZodEffects<z.ZodOptional<z.ZodString>, string[] | undefined, string | undefined>;
            minSavings: z.ZodEffects<z.ZodOptional<z.ZodString>, number | undefined, string | undefined>;
            maxPrice: z.ZodEffects<z.ZodOptional<z.ZodString>, number | undefined, string | undefined>;
            grades: z.ZodEffects<z.ZodOptional<z.ZodString>, string[] | undefined, string | undefined>;
            search: z.ZodOptional<z.ZodString>;
            page: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
            perPage: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
        }, "strip", z.ZodTypeAny, {
            page: number;
            perPage: number;
            categories?: string[] | undefined;
            grades?: string[] | undefined;
            minSavings?: number | undefined;
            maxPrice?: number | undefined;
            search?: string | undefined;
        }, {
            categories?: string | undefined;
            grades?: string | undefined;
            minSavings?: string | undefined;
            maxPrice?: string | undefined;
            search?: string | undefined;
            page?: string | undefined;
            perPage?: string | undefined;
        }>;
    };
    createPortfolioItem: {
        body: z.ZodObject<{
            cardName: z.ZodString;
            cardSet: z.ZodString;
            year: z.ZodNumber;
            grade: z.ZodString;
            grader: z.ZodOptional<z.ZodString>;
            currentValue: z.ZodNumber;
            purchasePrice: z.ZodNumber;
            quantity: z.ZodDefault<z.ZodNumber>;
            imageUrl: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            year: number;
            cardName: string;
            cardSet: string;
            grade: string;
            currentValue: number;
            purchasePrice: number;
            quantity: number;
            grader?: string | undefined;
            imageUrl?: string | undefined;
            notes?: string | undefined;
        }, {
            year: number;
            cardName: string;
            cardSet: string;
            grade: string;
            currentValue: number;
            purchasePrice: number;
            grader?: string | undefined;
            quantity?: number | undefined;
            imageUrl?: string | undefined;
            notes?: string | undefined;
        }>;
    };
    updatePortfolioItem: {
        body: z.ZodObject<{
            currentValue: z.ZodOptional<z.ZodNumber>;
            quantity: z.ZodOptional<z.ZodNumber>;
            notes: z.ZodOptional<z.ZodString>;
            inGradingQueue: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            currentValue?: number | undefined;
            quantity?: number | undefined;
            notes?: string | undefined;
            inGradingQueue?: boolean | undefined;
        }, {
            currentValue?: number | undefined;
            quantity?: number | undefined;
            notes?: string | undefined;
            inGradingQueue?: boolean | undefined;
        }>;
    };
    updatePreferences: {
        body: z.ZodObject<{
            categories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            priceRangeMin: z.ZodOptional<z.ZodNumber>;
            priceRangeMax: z.ZodOptional<z.ZodNumber>;
            grades: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            graders: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            dealAlertThreshold: z.ZodOptional<z.ZodNumber>;
            notificationChannels: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            categories?: string[] | undefined;
            priceRangeMin?: number | undefined;
            priceRangeMax?: number | undefined;
            grades?: string[] | undefined;
            graders?: string[] | undefined;
            dealAlertThreshold?: number | undefined;
            notificationChannels?: string[] | undefined;
        }, {
            categories?: string[] | undefined;
            priceRangeMin?: number | undefined;
            priceRangeMax?: number | undefined;
            grades?: string[] | undefined;
            graders?: string[] | undefined;
            dealAlertThreshold?: number | undefined;
            notificationChannels?: string[] | undefined;
        }>;
    };
};
//# sourceMappingURL=validate.d.ts.map