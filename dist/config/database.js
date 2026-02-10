"use strict";
// ============================================
// CardCommand Center - Database Configuration
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.isConnected = exports.prisma = void 0;
exports.connectDatabase = connectDatabase;
exports.disconnectDatabase = disconnectDatabase;
const client_1 = require("@prisma/client");
// Create Prisma client with logging in development
const prisma = new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
});
exports.prisma = prisma;
// Track connection state
let isConnected = false;
exports.isConnected = isConnected;
// Handle connection
async function connectDatabase() {
    try {
        await prisma.$connect();
        exports.isConnected = isConnected = true;
        console.log('✅ Database connected successfully');
    }
    catch (error) {
        console.error('❌ Database connection failed:', error);
        console.log('⚠️  Application will continue without database - some features may not work');
        // Don't exit - let the app start for health checks
    }
}
async function disconnectDatabase() {
    if (isConnected) {
        await prisma.$disconnect();
        console.log('👋 Database disconnected');
    }
}
//# sourceMappingURL=database.js.map