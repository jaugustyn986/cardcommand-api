// ============================================
// CardCommand Center - Main Application
// ============================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes';
import { connectDatabase, disconnectDatabase, isConnected } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { prisma } from './config/database';
import type { Category, Liquidity } from '@prisma/client';

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================
// Seed Function (Non-blocking)
// ============================================

async function seedDatabase() {
  try {
    // Wait for DB to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if deals exist
    const dealCount = await prisma.deal.count().catch(() => 0);
    
    if (dealCount === 0) {
      console.log('🌱 Database empty, seeding...');
      
      const deals = [
        {
          id: 'wembanyama-2023-prizm',
          cardName: '2023 Victor Wembanyama Prizm Silver',
          cardSet: 'Prizm',
          year: 2023,
          cardNumber: '301',
          grade: 'PSA 10',
          grader: 'PSA',
          marketPrice: 450,
          dealPrice: 385,
          savingsPercent: 14.4,
          savingsAmount: 65,
          marketplace: 'eBay',
          sellerRating: 99.2,
          sellerFeedback: 15420,
          listingUrl: 'https://ebay.com',
          category: 'basketball' as Category,
          liquidity: 'High' as Liquidity,
          lastSoldPrice: 420,
          thirtyDayAvg: 445,
          ninetyDayTrend: 12.5,
          popGraded: 1247,
          popGrade10: 892,
          isActive: true,
        },
        {
          id: 'zion-2019-prizm',
          cardName: '2019 Zion Williamson Prizm Base',
          cardSet: 'Prizm',
          year: 2019,
          cardNumber: '248',
          grade: 'PSA 9',
          grader: 'PSA',
          marketPrice: 180,
          dealPrice: 145,
          savingsPercent: 19.4,
          savingsAmount: 35,
          marketplace: 'TCGPlayer',
          sellerRating: 98.7,
          sellerFeedback: 3200,
          listingUrl: 'https://tcgplayer.com',
          category: 'basketball' as Category,
          liquidity: 'High' as Liquidity,
          lastSoldPrice: 165,
          thirtyDayAvg: 178,
          ninetyDayTrend: -3.2,
          popGraded: 8543,
          popGrade10: 5234,
          isActive: true,
        },
        {
          id: 'charizard-1999-base',
          cardName: 'Charizard Base Set 1st Edition',
          cardSet: 'Base Set',
          year: 1999,
          variation: 'Shadowless',
          grade: 'PSA 8',
          grader: 'PSA',
          marketPrice: 8500,
          dealPrice: 7200,
          savingsPercent: 15.3,
          savingsAmount: 1300,
          marketplace: 'eBay',
          sellerRating: 100,
          sellerFeedback: 850,
          listingUrl: 'https://ebay.com',
          category: 'pokemon' as Category,
          liquidity: 'Medium' as Liquidity,
          lastSoldPrice: 7800,
          thirtyDayAvg: 8450,
          ninetyDayTrend: 8.7,
          popGraded: 2341,
          popGrade10: 89,
          isActive: true,
        },
        {
          id: 'franco-2022-bowman',
          cardName: '2022 Wander Franco Bowman Chrome',
          cardSet: 'Bowman Chrome',
          year: 2022,
          cardNumber: '1',
          grade: 'PSA 10',
          grader: 'PSA',
          marketPrice: 320,
          dealPrice: 305,
          savingsPercent: 4.7,
          savingsAmount: 15,
          marketplace: 'eBay',
          sellerRating: 97.5,
          sellerFeedback: 1200,
          listingUrl: 'https://ebay.com',
          category: 'baseball' as Category,
          liquidity: 'High' as Liquidity,
          lastSoldPrice: 310,
          thirtyDayAvg: 318,
          ninetyDayTrend: -1.2,
          popGraded: 4567,
          popGrade10: 2890,
          isActive: true,
        },
        {
          id: 'macjones-2021-prizm',
          cardName: '2021 Mac Jones Prizm Silver',
          cardSet: 'Prizm',
          year: 2021,
          cardNumber: '336',
          grade: 'PSA 10',
          grader: 'PSA',
          marketPrice: 280,
          dealPrice: 225,
          savingsPercent: 19.6,
          savingsAmount: 55,
          marketplace: 'COMC',
          sellerRating: 99.8,
          sellerFeedback: 5600,
          listingUrl: 'https://comc.com',
          category: 'football' as Category,
          liquidity: 'Medium' as Liquidity,
          lastSoldPrice: 245,
          thirtyDayAvg: 275,
          ninetyDayTrend: -8.5,
          popGraded: 3456,
          popGrade10: 2100,
          isActive: true,
        },
        {
          id: 'caitlin-2024-prizm',
          cardName: '2024 Caitlin Clark Prizm WNBA',
          cardSet: 'Prizm WNBA',
          year: 2024,
          cardNumber: '101',
          grade: 'Raw',
          marketPrice: 150,
          dealPrice: 95,
          savingsPercent: 36.7,
          savingsAmount: 55,
          marketplace: 'eBay',
          sellerRating: 98.9,
          sellerFeedback: 2300,
          listingUrl: 'https://ebay.com',
          category: 'basketball' as Category,
          liquidity: 'High' as Liquidity,
          lastSoldPrice: 110,
          thirtyDayAvg: 145,
          ninetyDayTrend: 45.2,
          popGraded: 0,
          popGrade10: 0,
          isActive: true,
        },
      ];

      for (const deal of deals) {
        await prisma.deal.upsert({
          where: { id: deal.id },
          update: {},
          create: deal,
        });
      }

      console.log(`✅ Seeded ${deals.length} deals`);
    } else {
      console.log(`✅ Database already has ${dealCount} deals`);
    }
  } catch (error) {
    console.error('❌ Seed error (non-fatal):', (error as Error).message);
    // Don't crash - app works without seed
  }
}

// ============================================
// Middleware
// ============================================

// Security headers
app.use(helmet());

// CORS - Allow Vercel frontend
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'https://cardcommand-frontend.vercel.app',
  ],
  credentials: true,
}));

// Request logging
app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// Health Check
// ============================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    database: isConnected ? 'connected' : 'disconnected',
  });
});

// ============================================
// API Routes
// ============================================

app.use('/api', routes);

// ============================================
// Error Handling
// ============================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============================================
// Server Startup
// ============================================

async function startServer() {
  // Connect to database
  await connectDatabase();

  // Seed database if empty (non-blocking)
  seedDatabase().catch(() => {});

  // Start server
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🃏 CardCommand Center API                                ║
║                                                            ║
║   Environment: ${NODE_ENV.padEnd(43)}║
║   Port: ${PORT.toString().padEnd(50)}║
║   URL: http://localhost:${PORT}/api${' '.repeat(29)}║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
  });
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await disconnectDatabase();
  process.exit(0);
});

// Start the server
startServer();

export default app;
