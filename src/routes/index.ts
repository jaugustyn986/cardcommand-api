import { Router } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { validate, schemas } from '../middleware/validate';
import * as authController from '../controllers/authController';
import * as dealsController from '../controllers/dealsController';
import * as portfolioController from '../controllers/portfolioController';

const router = Router();

// Auth routes
router.post('/auth/register', validate(schemas.register), authController.register);
router.post('/auth/login', validate(schemas.login), authController.login);
router.get('/auth/me', authenticateToken, authController.getMe);
router.post('/auth/logout', authenticateToken, authController.logout);
router.post('/auth/refresh', authenticateToken, authController.refreshToken);

// Deals routes
router.get('/deals', optionalAuth, validate(schemas.dealFilters), dealsController.getDeals);
router.get('/deals/stream', dealsController.dealStream);
router.get('/deals/:id', optionalAuth, dealsController.getDeal);
router.post('/deals/:id/track', authenticateToken, dealsController.trackDeal);
router.delete('/deals/:id/track', authenticateToken, dealsController.untrackDeal);
router.get('/deals/tracked/list', authenticateToken, dealsController.getTrackedDeals);

// Portfolio routes
router.get('/portfolio', authenticateToken, portfolioController.getPortfolio);
router.get('/portfolio/stats', authenticateToken, portfolioController.getPortfolioStats);
router.get('/portfolio/grading-queue', authenticateToken, portfolioController.getGradingQueue);
router.post('/portfolio', authenticateToken, validate(schemas.createPortfolioItem), portfolioController.addPortfolioItem);
router.patch('/portfolio/:id', authenticateToken, portfolioController.updatePortfolioItem);
router.delete('/portfolio/:id', authenticateToken, portfolioController.deletePortfolioItem);
router.post('/portfolio/:id/grading-queue', authenticateToken, portfolioController.addToGradingQueue);

// Placeholder routes
router.get('/releases', optionalAuth, (req, res) => res.json({ success: true, data: [] }));
router.get('/trending', optionalAuth, (req, res) => res.json({ success: true, data: [] }));
router.get('/trending/heatmap', optionalAuth, (req, res) => res.json({ 
  success: true, 
  data: { categories: [], priceRanges: [], bubbles: [] } 
}));
router.get('/user/preferences', authenticateToken, (req, res) => 
  res.json({ success: true, data: req.user?.preferences || {} })
);

export default router;
