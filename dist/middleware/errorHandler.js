"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Errors = exports.ApiError = void 0;
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
const client_1 = require("@prisma/client");
class ApiError extends Error {
    constructor(statusCode, code, message, details) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}
exports.ApiError = ApiError;
exports.Errors = {
    badRequest: (message, details) => new ApiError(400, 'BAD_REQUEST', message, details),
    unauthorized: (message = 'Unauthorized') => new ApiError(401, 'UNAUTHORIZED', message),
    forbidden: (message = 'Forbidden') => new ApiError(403, 'FORBIDDEN', message),
    notFound: (resource = 'Resource') => new ApiError(404, 'NOT_FOUND', `${resource} not found`),
    conflict: (message) => new ApiError(409, 'CONFLICT', message),
    internal: (message = 'Internal server error') => new ApiError(500, 'INTERNAL_ERROR', message),
};
function errorHandler(err, _req, res, _next) {
    console.error('Error:', err);
    if (err instanceof ApiError) {
        res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
                details: err.details,
            },
        });
        return;
    }
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
            res.status(409).json({
                success: false,
                error: { code: 'DUPLICATE_ERROR', message: 'Record already exists' },
            });
            return;
        }
        if (err.code === 'P2025') {
            res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Record not found' },
            });
            return;
        }
    }
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
        },
    });
}
function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`,
        },
    });
}
//# sourceMappingURL=errorHandler.js.map