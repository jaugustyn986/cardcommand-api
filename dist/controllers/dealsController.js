"use strict";
// ============================================
// CardCommand Center - Deals Controller
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeals = getDeals;
exports.getDeal = getDeal;
exports.trackDeal = trackDeal;
exports.untrackDeal = untrackDeal;
exports.getTrackedDeals = getTrackedDeals;
exports.dealStream = dealStream;
const database_1 = require("../config/database");
const errorHandler_1 = require("../middleware/errorHandler");
// Get deals with filters
async function getDeals(req, res, next) {
    try {
        const page = parseInt(req.query.page) || 1;
        const perPage = Math.min(parseInt(req.query.perPage) || 20, 100);
        const where = { isActive: true };
        const totalCount = await database_1.prisma.deal.count({ where }).catch(() => 0);
        const deals = await database_1.prisma.deal.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * perPage,
            take: perPage,
        }).catch(() => []);
        res.json({
            success: true,
            data: deals,
            pagination: {
                page,
                perPage,
                totalCount,
                totalPages: Math.ceil(totalCount / perPage) || 1,
            },
        });
    }
    catch (error) {
        console.error('Get deals error:', error);
        res.json({
            success: true,
            data: [],
            pagination: { page: 1, perPage: 20, totalCount: 0, totalPages: 1 },
        });
    }
}
// Get single deal
async function getDeal(req, res, next) {
    try {
        const { id } = req.params;
        const deal = await database_1.prisma.deal.findUnique({
            where: { id },
        });
        if (!deal) {
            throw errorHandler_1.Errors.notFound('Deal');
        }
        res.json({ success: true, data: deal });
    }
    catch (error) {
        next(error);
    }
}
// Track a deal
async function trackDeal(req, res, next) {
    try {
        if (!req.user) {
            throw errorHandler_1.Errors.unauthorized();
        }
        const { id } = req.params;
        const deal = await database_1.prisma.deal.findUnique({
            where: { id },
        });
        if (!deal) {
            throw errorHandler_1.Errors.notFound('Deal');
        }
        await database_1.prisma.trackedDeal.create({
            data: {
                userId: req.user.id,
                dealId: id,
            },
        });
        res.json({
            success: true,
            data: { message: 'Deal tracked successfully' },
        });
    }
    catch (error) {
        next(error);
    }
}
// Untrack a deal
async function untrackDeal(req, res, next) {
    try {
        if (!req.user) {
            throw errorHandler_1.Errors.unauthorized();
        }
        const { id } = req.params;
        await database_1.prisma.trackedDeal.deleteMany({
            where: {
                userId: req.user.id,
                dealId: id,
            },
        });
        res.json({
            success: true,
            data: { message: 'Deal untracked successfully' },
        });
    }
    catch (error) {
        next(error);
    }
}
// Get user's tracked deals
async function getTrackedDeals(req, res, next) {
    try {
        if (!req.user) {
            throw errorHandler_1.Errors.unauthorized();
        }
        const trackedDeals = await database_1.prisma.trackedDeal.findMany({
            where: { userId: req.user.id },
            include: { deal: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            data: trackedDeals.map(td => td.deal),
        });
    }
    catch (error) {
        next(error);
    }
}
// Server-Sent Events for real-time deal updates
function dealStream(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write('data: {"type": "connected"}\n\n');
    const keepAlive = setInterval(() => {
        res.write('data: {"type": "ping"}\n\n');
    }, 30000);
    req.on('close', () => {
        clearInterval(keepAlive);
    });
}
//# sourceMappingURL=dealsController.js.map