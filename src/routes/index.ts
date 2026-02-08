import { Router } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { validate, schemas } from '../middleware/validate';
import * as authController from '../controllers/authController';
import * as dealsController from '../controllers/dealsController';
import * as portfolioController from '../controllers/portfolioController';

const router = Router();

// Auth Routes
router.post('/auth/register', validate(schemas.register), authController.register);
router.post('/auth/login', validate(schemas.login), authController.login);
router.get('/auth/me', authenticateToken, authController.getMe);
router.post('/auth/logout', authenticateToken, authController.logout);
router.post('/auth/refresh', authenticateToken, authController.refreshToken);

// Deals Routes
router.get('/deals', optionalAuth, validate(schemas.dealFilters), dealsController.getDeals);
router.get('/deals/stream', dealsController.dealStream);
router.get('/deals/:id', optionalAuth, dealsController.getDeal);
router.post('/deals/:id/track', authenticateToken, dealsController.trackDeal);
router.delete('/deals/:id/track', authenticateToken, dealsController.untrackDeal);
router.get('/deals/tracked/list', authenticateToken, dealsController.getTrackedDeals);

// Portfolio Routes
router.get('/portfolio', authenticateToken, portfolioController.getPortfolio);
router.get('/portfolio/stats', authenticateToken, portfolioController.getPortfolioStats);
router.get('/portfolio/grading-queue', authenticateToken, portfolioController.getGradingQueue);
router.post('/portfolio', authenticateToken, validate(schemas.createPortfolioItem), portfolioController.addPortfolioItem);
router.patch('/portfolio/:id', authenticateToken, validate(schemas.updatePortfolioItem), portfolioController.updatePortfolioItem);
router.delete('/portfolio/:id', authenticateToken, portfolioController.deletePortfolioItem);
router.post('/portfolio/:id/grading-queue', authenticateToken, portfolioController.addToGradingQueue);

// Releases Routes - SIMPLIFIED
router.get('/releases', optionalAuth, async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    const releases = await prisma.release.findMany({
      orderBy: { releaseDate: 'asc' }
    });
    
    res.json({
      success: true,
      data: releases.map((r: any) => ({
        id: r.id,
        name: r.name,
        releaseDate: r.releaseDate.toISOString(),
        category: r.category,
        manufacturer: r.manufacturer,
        msrp: Number(r.msrp),
        estimatedResale: r.estimatedResale ? Number(r.estimatedResale) : null,
        hypeScore: r.hypeScore ? Number(r.hypeScore) : null,
        imageUrl: r.imageUrl,
        topChases: r.topChases,
        printRun: r.printRun,
        description: r.description,
        isReleased: r.isReleased,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch releases' });
  }
});

router.get('/releases/:id', optionalAuth, async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    const release = await prisma.release.findUnique({
      where: { id: req.params.id }
    });
    
    if (!release) {
      return res.status(404).json({ success: false, error: 'Release not found' });
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
        estimatedResale: release.estimatedResale ? Number(release.estimatedResale) : null,
        hypeScore: release.hypeScore ? Number(release.hypeScore) : null,
        imageUrl: release.imageUrl,
        topChases: release.topChases,
        printRun: release.printRun,
        description: release.description,
        isReleased: release.isReleased,
        createdAt: release.createdAt.toISOString(),
        updatedAt: release.updatedAt.toISOString(),
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch release' });
  }
});

// Trending Routes (placeholder)
router.get('/trending', optionalAuth, (req, res) => {
  res.json({ success: true, data: [] });
});

router.get('/trending/heatmap', optionalAuth, (req, res) => {
  res.json({ success: true, data: { categories: ['Baseball', 'Basketball', 'Football', 'TCG'], priceRanges: ['$0-50', '$50-250', '$250-1K', '$1K+'], bubbles: [] } });
});

// User Routes (placeholder)
router.get('/user/preferences', authenticateToken, (req, res) => {
  res.json({ success: true, data: null });
});

router.patch('/user/preferences', authenticateToken, (req, res) => {
  res.json({ success: true, data: req.body });
});

export default router;
