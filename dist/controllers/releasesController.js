"use strict";
// ============================================
// CardCommand Center - Releases Controller
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReminders = exports.removeReminder = exports.setReminder = exports.createRelease = exports.getRelease = exports.getReleaseChanges = exports.getReleaseProducts = exports.getReleases = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// ============================================
// Get All Releases
// ============================================
const getReleases = async (req, res) => {
    try {
        const { category, categories, upcoming, all, fromDate, toDate, sortBy = 'releaseDate', sortOrder = 'asc', page = '1', perPage = '20', } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10));
        const perPageNum = Math.min(100, Math.max(1, parseInt(perPage, 10)));
        const skip = (pageNum - 1) * perPageNum;
        const where = {};
        // Category filters
        if (categories && typeof categories === 'string' && categories.trim().length > 0) {
            // Multi-select: categories=pokemon,mtg
            const categoryList = categories
                .split(',')
                .map((c) => c.trim())
                .filter(Boolean);
            if (categoryList.length > 0) {
                where.category = { in: categoryList };
            }
        }
        else if (category && typeof category === 'string') {
            // Backwards-compatible single-category filter
            where.category = category;
        }
        // Date range filters
        if (fromDate || toDate) {
            const range = {};
            if (fromDate && typeof fromDate === 'string') {
                const parsed = new Date(fromDate);
                if (!isNaN(parsed.getTime())) {
                    range.gte = parsed;
                }
            }
            if (toDate && typeof toDate === 'string') {
                const parsed = new Date(toDate);
                if (!isNaN(parsed.getTime())) {
                    range.lte = parsed;
                }
            }
            if (range.gte || range.lte) {
                where.releaseDate = range;
            }
        }
        else {
            // Default: show releases from 1 month ago through 3 months from now
            if (all === 'true') {
                // No date filter
            }
            else if (upcoming === 'true') {
                where.releaseDate = { gte: new Date() };
            }
            else {
                const now = new Date();
                const from = new Date(now);
                from.setMonth(from.getMonth() - 1);
                const to = new Date(now);
                to.setMonth(to.getMonth() + 3);
                where.releaseDate = { gte: from, lte: to };
            }
        }
        const orderBy = {};
        orderBy[sortBy] = sortOrder;
        // Get releases with count
        const [releases, totalCount] = await Promise.all([
            prisma.release.findMany({
                where,
                orderBy,
                skip,
                take: perPageNum,
            }),
            prisma.release.count({ where })
        ]);
        // Transform releases for response
        const transformedReleases = releases.map(release => ({
            id: release.id,
            name: release.name,
            releaseDate: release.releaseDate.toISOString(),
            category: release.category,
            manufacturer: release.manufacturer,
            msrp: Number(release.msrp),
            estimatedResale: release.estimatedResale ? Number(release.estimatedResale) : undefined,
            hypeScore: release.hypeScore ? Number(release.hypeScore) : undefined,
            imageUrl: release.imageUrl,
            topChases: release.topChases,
            printRun: release.printRun,
            description: release.description,
            isReleased: release.isReleased,
            createdAt: release.createdAt.toISOString(),
            updatedAt: release.updatedAt.toISOString(),
        }));
        res.json({
            success: true,
            data: transformedReleases,
            pagination: {
                page: pageNum,
                perPage: perPageNum,
                totalCount,
                totalPages: Math.ceil(totalCount / perPageNum)
            }
        });
    }
    catch (error) {
        console.error('Error fetching releases:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch releases'
        });
    }
};
exports.getReleases = getReleases;
// ============================================
// Get Release Products (boxes, tins, etc.)
// ============================================
const getReleaseProducts = async (req, res) => {
    try {
        const { category, categories, fromDate, toDate, confidence: confidenceParam, sortBy = 'releaseDate', sortOrder = 'asc', page = '1', perPage = '20', } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10));
        const perPageNum = Math.min(100, Math.max(1, parseInt(perPage, 10)));
        const skip = (pageNum - 1) * perPageNum;
        const where = {};
        // Confidence filter (confirmed | unconfirmed | rumor); omit = return all
        if (confidenceParam && typeof confidenceParam === 'string' && ['confirmed', 'unconfirmed', 'rumor'].includes(confidenceParam)) {
            where.confidence = confidenceParam;
        }
        // Category filters (multi-select first, then single for backward compatibility)
        if (categories && typeof categories === 'string' && categories.trim().length > 0) {
            const categoryList = categories
                .split(',')
                .map((c) => c.trim())
                .filter(Boolean);
            if (categoryList.length > 0) {
                where.category = { in: categoryList };
            }
        }
        else if (category && typeof category === 'string') {
            where.category = category;
        }
        // Date range filters (optional)
        if (fromDate || toDate) {
            const range = {};
            if (fromDate && typeof fromDate === 'string') {
                const parsed = new Date(fromDate);
                if (!isNaN(parsed.getTime())) {
                    range.gte = parsed;
                }
            }
            if (toDate && typeof toDate === 'string') {
                const parsed = new Date(toDate);
                if (!isNaN(parsed.getTime())) {
                    range.lte = parsed;
                }
            }
            if (range.gte || range.lte) {
                where.releaseDate = range;
            }
        }
        const orderBy = {};
        orderBy[sortBy] = sortOrder;
        const [products, totalCount] = await Promise.all([
            prisma.releaseProduct.findMany({
                where,
                orderBy,
                skip,
                take: perPageNum,
                include: {
                    release: true,
                },
            }),
            prisma.releaseProduct.count({ where }),
        ]);
        const transformedProducts = products.map((product) => ({
            id: product.id,
            name: product.name,
            productType: product.productType,
            category: product.category,
            msrp: product.msrp ?? undefined,
            estimatedResale: product.estimatedResale ?? undefined,
            releaseDate: product.releaseDate ? product.releaseDate.toISOString() : undefined,
            preorderDate: product.preorderDate ? product.preorderDate.toISOString() : undefined,
            imageUrl: product.imageUrl ?? product.release.imageUrl ?? undefined,
            buyUrl: product.buyUrl ?? undefined,
            contentsSummary: product.contentsSummary ?? undefined,
            setName: product.release.name,
            setHypeScore: product.release.hypeScore ? Number(product.release.hypeScore) : undefined,
            confidence: product.confidence,
            sourceUrl: product.sourceUrl ?? undefined,
        }));
        res.json({
            success: true,
            data: transformedProducts,
            pagination: {
                page: pageNum,
                perPage: perPageNum,
                totalCount,
                totalPages: Math.ceil(totalCount / perPageNum),
            },
        });
    }
    catch (error) {
        console.error('Error fetching release products:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch release products',
        });
    }
};
exports.getReleaseProducts = getReleaseProducts;
// ============================================
// Get Release Product Changes (date/price changes for "what changed" UX)
// ============================================
const getReleaseChanges = async (req, res) => {
    try {
        const { limit = '50', since } = req.query;
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
        const sinceDate = since && typeof since === 'string' ? new Date(since) : undefined;
        const where = {};
        if (sinceDate && !isNaN(sinceDate.getTime())) {
            where.detectedAt = { gte: sinceDate };
        }
        const changes = await prisma.releaseProductChange.findMany({
            where,
            orderBy: { detectedAt: 'desc' },
            take: limitNum,
            include: {
                releaseProduct: {
                    include: { release: true },
                },
            },
        });
        const data = changes.map((c) => ({
            id: c.id,
            field: c.field,
            oldValue: c.oldValue,
            newValue: c.newValue,
            detectedAt: c.detectedAt.toISOString(),
            sourceUrl: c.sourceUrl ?? undefined,
            productName: c.releaseProduct.name,
            productId: c.releaseProduct.id,
            setName: c.releaseProduct.release.name,
            category: c.releaseProduct.category,
        }));
        res.json({
            success: true,
            data,
        });
    }
    catch (error) {
        console.error('Error fetching release changes:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch release changes',
        });
    }
};
exports.getReleaseChanges = getReleaseChanges;
// ============================================
// Get Single Release
// ============================================
const getRelease = async (req, res) => {
    try {
        const { id } = req.params;
        const release = await prisma.release.findUnique({
            where: { id }
        });
        if (!release) {
            return res.status(404).json({
                success: false,
                error: 'Release not found'
            });
        }
        res.json({
            success: true,
            data: {
                id: release.id,
                name: release.name,
                releaseDate: release.releaseDate.toISOString(),
                category: release.category,
                manufacturer: release.manufacturer,
                msrp: Number(release.msrp),
                estimatedResale: release.estimatedResale ? Number(release.estimatedResale) : undefined,
                hypeScore: release.hypeScore ? Number(release.hypeScore) : undefined,
                imageUrl: release.imageUrl,
                topChases: release.topChases,
                printRun: release.printRun,
                description: release.description,
                isReleased: release.isReleased,
                createdAt: release.createdAt.toISOString(),
                updatedAt: release.updatedAt.toISOString(),
            }
        });
    }
    catch (error) {
        console.error('Error fetching release:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch release'
        });
    }
};
exports.getRelease = getRelease;
// ============================================
// Create Release (Admin only)
// ============================================
const createRelease = async (req, res) => {
    try {
        const releaseData = req.body;
        const release = await prisma.release.create({
            data: {
                name: releaseData.name,
                releaseDate: new Date(releaseData.releaseDate),
                category: releaseData.category,
                manufacturer: releaseData.manufacturer,
                msrp: releaseData.msrp,
                estimatedResale: releaseData.estimatedResale,
                hypeScore: releaseData.hypeScore,
                imageUrl: releaseData.imageUrl,
                topChases: releaseData.topChases || [],
                printRun: releaseData.printRun,
                description: releaseData.description,
            }
        });
        res.status(201).json({
            success: true,
            data: release
        });
    }
    catch (error) {
        console.error('Error creating release:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create release'
        });
    }
};
exports.createRelease = createRelease;
// ============================================
// Placeholder reminder functions (will implement later)
// ============================================
const setReminder = async (req, res) => {
    res.json({ success: true, message: 'Reminder feature coming soon' });
};
exports.setReminder = setReminder;
const removeReminder = async (req, res) => {
    res.json({ success: true, message: 'Reminder feature coming soon' });
};
exports.removeReminder = removeReminder;
const getReminders = async (req, res) => {
    res.json({ success: true, data: [] });
};
exports.getReminders = getReminders;
//# sourceMappingURL=releasesController.js.map