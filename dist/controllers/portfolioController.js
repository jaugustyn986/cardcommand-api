"use strict";
// ============================================
// CardCommand Center - Portfolio Controller
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPortfolio = getPortfolio;
exports.getGradingQueue = getGradingQueue;
exports.addToGradingQueue = addToGradingQueue;
exports.addPortfolioItem = addPortfolioItem;
exports.updatePortfolioItem = updatePortfolioItem;
exports.deletePortfolioItem = deletePortfolioItem;
exports.getPortfolioStats = getPortfolioStats;
const database_1 = require("../config/database");
const errorHandler_1 = require("../middleware/errorHandler");
// Get user's portfolio
async function getPortfolio(req, res, next) {
    try {
        if (!req.user) {
            throw errorHandler_1.Errors.unauthorized();
        }
        const portfolio = await database_1.prisma.portfolioItem.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            data: portfolio,
        });
    }
    catch (error) {
        next(error);
    }
}
// Get grading queue
async function getGradingQueue(req, res, next) {
    try {
        if (!req.user) {
            throw errorHandler_1.Errors.unauthorized();
        }
        const queue = await database_1.prisma.portfolioItem.findMany({
            where: {
                userId: req.user.id,
                inGradingQueue: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            data: queue,
        });
    }
    catch (error) {
        next(error);
    }
}
// Add item to grading queue
async function addToGradingQueue(req, res, next) {
    try {
        if (!req.user) {
            throw errorHandler_1.Errors.unauthorized();
        }
        const { id } = req.params;
        const item = await database_1.prisma.portfolioItem.findFirst({
            where: { id, userId: req.user.id },
        });
        if (!item) {
            throw errorHandler_1.Errors.notFound('Portfolio item');
        }
        const updated = await database_1.prisma.portfolioItem.update({
            where: { id },
            data: { inGradingQueue: true },
        });
        res.json({
            success: true,
            data: updated,
        });
    }
    catch (error) {
        next(error);
    }
}
// Add item to portfolio
async function addPortfolioItem(req, res, next) {
    try {
        if (!req.user) {
            throw errorHandler_1.Errors.unauthorized();
        }
        const { cardName, cardSet, year, grade, grader, currentValue, purchasePrice, quantity, imageUrl, notes, } = req.body;
        const item = await database_1.prisma.portfolioItem.create({
            data: {
                userId: req.user.id,
                cardName,
                cardSet,
                year,
                grade,
                grader,
                currentValue,
                purchasePrice,
                quantity: quantity || 1,
                imageUrl,
                notes,
            },
        });
        res.json({
            success: true,
            data: item,
        });
    }
    catch (error) {
        next(error);
    }
}
// Update portfolio item
async function updatePortfolioItem(req, res, next) {
    try {
        if (!req.user) {
            throw errorHandler_1.Errors.unauthorized();
        }
        const { id } = req.params;
        const { currentValue, quantity, notes, inGradingQueue } = req.body;
        const item = await database_1.prisma.portfolioItem.findFirst({
            where: { id, userId: req.user.id },
        });
        if (!item) {
            throw errorHandler_1.Errors.notFound('Portfolio item');
        }
        const updated = await database_1.prisma.portfolioItem.update({
            where: { id },
            data: {
                currentValue,
                quantity,
                notes,
                inGradingQueue,
            },
        });
        res.json({
            success: true,
            data: updated,
        });
    }
    catch (error) {
        next(error);
    }
}
// Delete portfolio item
async function deletePortfolioItem(req, res, next) {
    try {
        if (!req.user) {
            throw errorHandler_1.Errors.unauthorized();
        }
        const { id } = req.params;
        const item = await database_1.prisma.portfolioItem.findFirst({
            where: { id, userId: req.user.id },
        });
        if (!item) {
            throw errorHandler_1.Errors.notFound('Portfolio item');
        }
        await database_1.prisma.portfolioItem.delete({
            where: { id },
        });
        res.json({
            success: true,
            data: { message: 'Item deleted' },
        });
    }
    catch (error) {
        next(error);
    }
}
// Get portfolio stats
async function getPortfolioStats(req, res, next) {
    try {
        if (!req.user) {
            throw errorHandler_1.Errors.unauthorized();
        }
        const items = await database_1.prisma.portfolioItem.findMany({
            where: { userId: req.user.id },
        });
        const stats = items.reduce((acc, item) => {
            const currentValue = Number(item.currentValue);
            const purchasePrice = Number(item.purchasePrice);
            acc.totalValue += currentValue * item.quantity;
            acc.totalCost += purchasePrice * item.quantity;
            acc.totalProfit += (currentValue - purchasePrice) * item.quantity;
            return acc;
        }, {
            totalValue: 0,
            totalCost: 0,
            totalProfit: 0,
        });
        const profitPercent = stats.totalCost > 0
            ? (stats.totalProfit / stats.totalCost) * 100
            : 0;
        res.json({
            success: true,
            data: {
                ...stats,
                profitPercent: Number(profitPercent.toFixed(2)),
            },
        });
    }
    catch (error) {
        next(error);
    }
}
//# sourceMappingURL=portfolioController.js.map