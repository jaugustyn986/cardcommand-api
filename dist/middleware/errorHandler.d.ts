import { Request, Response, NextFunction } from 'express';
export declare class ApiError extends Error {
    statusCode: number;
    code: string;
    details?: Record<string, string[]>;
    constructor(statusCode: number, code: string, message: string, details?: Record<string, string[]>);
}
export declare const Errors: {
    badRequest: (message: string, details?: Record<string, string[]>) => ApiError;
    unauthorized: (message?: string) => ApiError;
    forbidden: (message?: string) => ApiError;
    notFound: (resource?: string) => ApiError;
    conflict: (message: string) => ApiError;
    internal: (message?: string) => ApiError;
};
export declare function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void;
export declare function notFoundHandler(req: Request, res: Response): void;
//# sourceMappingURL=errorHandler.d.ts.map