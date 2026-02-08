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
router.get('/releases/:id', optionalAuth, releasesController.getRelease);
router.post('/releases/:id/remind', optionalAuth, releasesController.setReminder);
router.delete('/releases/:id/remind', optionalAuth, releasesController.removeReminder);
router.get('/releases/reminders/list', optionalAuth, releasesController.getReminders);

// ============================================
// Trending Routes (placeholder)
// ============================================

router.get('/trending', optionalAuth, (req, res) => {
  res.json({ success: true, data: [] });
});

router.get('/trending/heatmap', optionalAuth, (req, res) => {
  res.json({ 
    success: true, 
    data: {
      categories: ['Baseball', 'Basketball', 'Football', 'TCG'],
      priceRanges: ['$0-50', '$50-250', '$250-1K', '$1K+'],
      bubbles: [],
    }
  });
});

// ============================================
// User Routes (placeholder)
// ============================================

router.get('/user/preferences', authenticateToken, (req, res) => {
  res.json({ success: true, data: req.user?.preferences || null });
});

router.patch('/user/preferences', authenticateToken, validate(schemas.updatePreferences), (req, res) => {
  res.json({ success: true, data: req.body });
});

export default router;
