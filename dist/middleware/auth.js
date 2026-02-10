"use strict";
// ============================================
// CardCommand Center - Authentication Middleware
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.authenticateToken = authenticateToken;
exports.optionalAuth = optionalAuth;
exports.requirePlan = requirePlan;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const JWT_SECRET = (process.env.JWT_SECRET || 'your-secret-key');
// Generate JWT token - accepts User or UserWithPreferences
function generateToken(user) {
    const payload = {
        userId: user.id,
        email: user.email,
        plan: user.plan,
    };
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn });
}
// Verify JWT token
function verifyToken(token) {
    return jsonwebtoken_1.default.verify(token, JWT_SECRET);
}
// Authentication middleware
async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1]; // Bearer TOKEN
        if (!token) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Access token required',
                },
            });
            return;
        }
        const payload = verifyToken(token);
        // Get full user from database
        const user = await database_1.prisma.user.findUnique({
            where: { id: payload.userId },
            include: { preferences: true },
        });
        if (!user) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'User not found',
                },
            });
            return;
        }
        if (user.status !== 'active') {
            res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Account is not active',
                },
            });
            return;
        }
        req.user = user;
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Invalid token',
                },
            });
            return;
        }
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'TOKEN_EXPIRED',
                    message: 'Token expired',
                },
            });
            return;
        }
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Authentication failed',
            },
        });
    }
}
// Optional authentication (for public routes that can be enhanced with auth)
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1];
        if (token) {
            const payload = verifyToken(token);
            const user = await database_1.prisma.user.findUnique({
                where: { id: payload.userId },
                include: { preferences: true },
            });
            if (user && user.status === 'active') {
                req.user = user;
            }
        }
        next();
    }
    catch {
        // Ignore errors for optional auth
        next();
    }
}
// Plan-based authorization middleware
function requirePlan(...allowedPlans) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                },
            });
            return;
        }
        if (!allowedPlans.includes(req.user.plan)) {
            res.status(403).json({
                success: false,
                error: {
                    code: 'PLAN_REQUIRED',
                    message: `This feature requires ${allowedPlans.join(' or ')} plan`,
                },
            });
            return;
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map