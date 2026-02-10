"use strict";
// ============================================
// CardCommand Center - API Routes
// ============================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const authController = __importStar(require("../controllers/authController"));
const dealsController = __importStar(require("../controllers/dealsController"));
const portfolioController = __importStar(require("../controllers/portfolioController"));
const releasesController = __importStar(require("../controllers/releasesController"));
const trendingController = __importStar(require("../controllers/trendingController"));
const adminController = __importStar(require("../controllers/adminController"));
const router = (0, express_1.Router)();
// ============================================
// Auth Routes
// ============================================
router.post('/auth/register', (0, validate_1.validate)(validate_1.schemas.register), authController.register);
router.post('/auth/login', (0, validate_1.validate)(validate_1.schemas.login), authController.login);
router.get('/auth/me', auth_1.authenticateToken, authController.getMe);
router.post('/auth/logout', auth_1.authenticateToken, authController.logout);
router.post('/auth/refresh', auth_1.authenticateToken, authController.refreshToken);
// ============================================
// Deals Routes
// ============================================
router.get('/deals', auth_1.optionalAuth, (0, validate_1.validate)(validate_1.schemas.dealFilters), dealsController.getDeals);
router.get('/deals/stream', dealsController.dealStream);
router.get('/deals/:id', auth_1.optionalAuth, dealsController.getDeal);
router.post('/deals/:id/track', auth_1.authenticateToken, dealsController.trackDeal);
router.delete('/deals/:id/track', auth_1.authenticateToken, dealsController.untrackDeal);
router.get('/deals/tracked/list', auth_1.authenticateToken, dealsController.getTrackedDeals);
// ============================================
// Portfolio Routes
// ============================================
router.get('/portfolio', auth_1.authenticateToken, portfolioController.getPortfolio);
router.get('/portfolio/stats', auth_1.authenticateToken, portfolioController.getPortfolioStats);
router.get('/portfolio/grading-queue', auth_1.authenticateToken, portfolioController.getGradingQueue);
router.post('/portfolio', auth_1.authenticateToken, (0, validate_1.validate)(validate_1.schemas.createPortfolioItem), portfolioController.addPortfolioItem);
router.patch('/portfolio/:id', auth_1.authenticateToken, (0, validate_1.validate)(validate_1.schemas.updatePortfolioItem), portfolioController.updatePortfolioItem);
router.delete('/portfolio/:id', auth_1.authenticateToken, portfolioController.deletePortfolioItem);
router.post('/portfolio/:id/grading-queue', auth_1.authenticateToken, portfolioController.addToGradingQueue);
// ============================================
// Releases Routes
// ============================================
router.get('/releases', auth_1.optionalAuth, releasesController.getReleases);
router.get('/releases/products', auth_1.optionalAuth, releasesController.getReleaseProducts);
router.get('/releases/changes', auth_1.optionalAuth, releasesController.getReleaseChanges);
router.get('/releases/:id', auth_1.optionalAuth, releasesController.getRelease);
router.post('/releases/:id/remind', auth_1.authenticateToken, releasesController.setReminder);
router.delete('/releases/:id/remind', auth_1.authenticateToken, releasesController.removeReminder);
router.get('/releases/reminders/list', auth_1.authenticateToken, releasesController.getReminders);
// ============================================
// Trending Routes
// ============================================
router.get('/trending', auth_1.optionalAuth, trendingController.getTrending);
router.get('/trending/heatmap', auth_1.optionalAuth, trendingController.getHeatmap);
// ============================================
// User Routes (placeholder)
// ============================================
router.get('/user/preferences', auth_1.authenticateToken, (req, res) => {
    res.json({ success: true, data: req.user?.preferences || null });
});
router.patch('/user/preferences', auth_1.authenticateToken, (0, validate_1.validate)(validate_1.schemas.updatePreferences), (req, res) => {
    res.json({ success: true, data: req.body });
});
// ============================================
// Admin Routes
// ============================================
router.post('/admin/releases/sync', auth_1.authenticateToken, adminController.triggerReleaseSync);
router.get('/admin/releases/status', auth_1.authenticateToken, adminController.getSyncStatus);
router.get('/admin/health', adminController.getApiHealth);
exports.default = router;
//# sourceMappingURL=index.js.map