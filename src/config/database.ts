// ============================================
// CardCommand Center - Database Configuration
// ============================================

import { PrismaClient } from '@prisma/client';

// Create Prisma client with logging in development
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});

// Track connection state
let isConnected = false;

// Handle connection
export async function connectDatabase() {
  try {
    await prisma.$connect();
    isConnected = true;
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.log('⚠️  Application will continue without database - some features may not work');
    // Don't exit - let the app start for health checks
  }
}

export async function disconnectDatabase() {
  if (isConnected) {
    await prisma.$disconnect();
    console.log('👋 Database disconnected');
  }
}

export { prisma, isConnected };
