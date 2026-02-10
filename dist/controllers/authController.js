"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.getMe = getMe;
exports.logout = logout;
exports.refreshToken = refreshToken;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
async function hashPassword(password) {
    return bcryptjs_1.default.hash(password, 12);
}
async function comparePassword(password, hash) {
    return bcryptjs_1.default.compare(password, hash);
}
async function register(req, res, next) {
    try {
        const { email, password, name } = req.body;
        const existingUser = await database_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            throw errorHandler_1.Errors.conflict('Email already registered');
        }
        const hashedPassword = await hashPassword(password);
        // Create user first without nested preferences to avoid failures if user_preferences
        // table is missing or schema is out of sync in production
        const user = await database_1.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: name || null,
            },
            include: { preferences: true },
        });
        // Optionally create default preferences; if it fails, user is still created
        try {
            await database_1.prisma.userPreferences.create({
                data: {
                    userId: user.id,
                    categories: [],
                    priceRangeMin: 0,
                    priceRangeMax: 10000,
                    grades: [],
                    graders: [],
                    dealAlertThreshold: 15,
                    notificationChannels: ['email'],
                },
            });
        }
        catch (prefErr) {
            console.error('Failed to create default preferences for user', user.id, prefErr);
            // Continue — preferences can be created when user updates settings
        }
        // Re-fetch user with preferences in case we just created them
        const userWithPrefs = await database_1.prisma.user.findUnique({
            where: { id: user.id },
            include: { preferences: true },
        });
        const finalUser = userWithPrefs ?? user;
        const token = (0, auth_1.generateToken)(finalUser);
        res.status(201).json({
            success: true,
            data: {
                user: {
                    id: finalUser.id,
                    email: finalUser.email,
                    name: finalUser.name,
                    plan: finalUser.plan,
                    preferences: finalUser.preferences,
                },
                token,
            },
        });
    }
    catch (error) {
        console.error('Register error:', error);
        next(error);
    }
}
async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        const user = await database_1.prisma.user.findUnique({
            where: { email },
            include: { preferences: true },
        });
        if (!user) {
            throw errorHandler_1.Errors.unauthorized('Invalid email or password');
        }
        const isValidPassword = await comparePassword(password, user.password);
        if (!isValidPassword) {
            throw errorHandler_1.Errors.unauthorized('Invalid email or password');
        }
        if (user.status !== 'active') {
            throw errorHandler_1.Errors.forbidden('Account is not active');
        }
        const token = (0, auth_1.generateToken)(user);
        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    plan: user.plan,
                    preferences: user.preferences,
                },
                token,
            },
        });
    }
    catch (error) {
        next(error);
    }
}
async function getMe(req, res, next) {
    try {
        if (!req.user) {
            throw errorHandler_1.Errors.unauthorized();
        }
        const user = await database_1.prisma.user.findUnique({
            where: { id: req.user.id },
            include: { preferences: true },
        });
        if (!user) {
            throw errorHandler_1.Errors.notFound('User');
        }
        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                name: user.name,
                plan: user.plan,
                preferences: user.preferences,
                createdAt: user.createdAt,
            },
        });
    }
    catch (error) {
        next(error);
    }
}
async function logout(req, res, next) {
    try {
        res.json({ success: true, data: { message: 'Logged out successfully' } });
    }
    catch (error) {
        next(error);
    }
}
async function refreshToken(req, res, next) {
    try {
        if (!req.user) {
            throw errorHandler_1.Errors.unauthorized();
        }
        const user = await database_1.prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user || user.status !== 'active') {
            throw errorHandler_1.Errors.unauthorized();
        }
        const token = (0, auth_1.generateToken)(user);
        res.json({ success: true, data: { token } });
    }
    catch (error) {
        next(error);
    }
}
//# sourceMappingURL=authController.js.map