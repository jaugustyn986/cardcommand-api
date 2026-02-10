// ============================================
// CardCommand Center - API Routes
// ============================================

import { Router } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { validate, schemas } from '../middleware/validate';
import * as authController from '../controllers/authController';
import * as dealsController from '../controllers/dealsController';
import * as portfolioController from '../controllers/portfolioController';
import * as releasesController from '../controllers/releasesController';
import * as trendingController from '../controllers/trendingController';
import * as adminController from '../controllers/adminController';

const router = Router();

// ============================================
// Auth Routes
// ============================================

router.post('/auth/register', validate(schemas.register), authController.register);
router.post('/auth/login', validate(schemas.login), authController.login);
router.get('/auth/me', authenticateToken, authController.getMe);
router.post('/auth/logout', authenticateToken, authController.logout);
router.post('/auth/refresh', authenticateToken, authController.refreshToken);

// ============================================
// Deals Routes
// ============================================

router.get('/deals', optionalAuth, validate(schemas.dealFilters), dealsController.getDeals);
router.get('/deals/stream', dealsController.dealStream);
router.get('/deals/:id', optionalAuth, dealsController.getDeal);
router.post('/deals/:id/track', authenticateToken, dealsController.trackDeal);
router.delete('/deals/:id/track', authenticateToken, dealsController.untrackDeal);
router.get('/deals/tracked/list', authenticateToken, dealsController.getTrackedDeals);

// ============================================
// Portfolio Routes
// ============================================

router.get('/portfolio', authenticateToken, portfolioController.getPortfolio);
router.get('/portfolio/stats', authenticateToken, portfolioController.getPortfolioStats);
router.get('/portfolio/grading-queue', authenticateToken, portfolioController.getGradingQueue);
router.post('/portfolio', authenticateToken, validate(schemas.createPortfolioItem), portfolioController.addPortfolioItem);
router.patch('/portfolio/:id', authenticateToken, validate(schemas.updatePortfolioItem), portfolioController.updatePortfolioItem);
router.delete('/portfolio/:id', authenticateToken, portfolioController.deletePortfolioItem);
router.post('/portfolio/:id/grading-queue', authenticateToken, portfolioController.addToGradingQueue);

// ============================================
// Releases Routes
// ============================================

router.get('/releases', optionalAuth, releasesController.getReleases);
router.get('/releases/products', optionalAuth, releasesController.getReleaseProducts);
router.get('/releases/:id', optionalAuth, releasesController.getRelease);
router.post('/releases/:id/remind', authenticateToken, releasesController.setReminder);
router.delete('/releases/:id/remind', authenticateToken, releasesController.removeReminder);
router.get('/releases/reminders/list', authenticateToken, releasesController.getReminders);

// ============================================
// Trending Routes
// ============================================

router.get('/trending', optionalAuth, trendingController.getTrending);
router.get('/trending/heatmap', optionalAuth, trendingController.getHeatmap);

// ============================================
// User Routes (placeholder)
// ============================================

router.get('/user/preferences', authenticateToken, (req, res) => {
  res.json({ success: true, data: req.user?.preferences || null });
});

router.patch('/user/preferences', authenticateToken, validate(schemas.updatePreferences), (req, res) => {
  res.json({ success: true, data: req.body });
});

// ============================================
// Admin Routes
// ============================================

router.post('/admin/releases/sync', authenticateToken, adminController.triggerReleaseSync);
router.get('/admin/releases/status', authenticateToken, adminController.getSyncStatus);
router.get('/admin/health', adminController.getApiHealth);

export default router;
