"use strict";
// ============================================
// CardCommand Center - Redis Configuration
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheKeys = exports.cache = exports.redisAvailable = exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const redisUrl = process.env.REDIS_URL;
// Create Redis client only if REDIS_URL is provided
let redis = null;
exports.redis = redis;
let redisAvailable = false;
exports.redisAvailable = redisAvailable;
if (redisUrl) {
    exports.redis = redis = new ioredis_1.default(redisUrl, {
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        maxRetriesPerRequest: 3,
    });
    // Handle connection events
    redis.on('connect', () => {
        console.log('✅ Redis connected');
        exports.redisAvailable = redisAvailable = true;
    });
    redis.on('error', (error) => {
        console.error('❌ Redis error:', error.message);
        exports.redisAvailable = redisAvailable = false;
    });
}
else {
    console.log('⚠️  REDIS_URL not set, caching disabled');
}
// Cache helpers - gracefully handle missing Redis
exports.cache = {
    async get(_key) {
        if (!redisAvailable || !redis)
            return null;
        try {
            const data = await redis.get(_key);
            return data ? JSON.parse(data) : null;
        }
        catch {
            return null;
        }
    },
    async set(_key, _value, _ttlSeconds = 300) {
        if (!redisAvailable || !redis)
            return;
        try {
            await redis.setex(_key, _ttlSeconds, JSON.stringify(_value));
        }
        catch {
            // Silently fail if Redis is unavailable
        }
    },
    async delete(_key) {
        if (!redisAvailable || !redis)
            return;
        try {
            await redis.del(_key);
        }
        catch {
            // Silently fail if Redis is unavailable
        }
    },
    async deletePattern(_pattern) {
        if (!redisAvailable || !redis)
            return;
        try {
            const keys = await redis.keys(_pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        }
        catch {
            // Silently fail if Redis is unavailable
        }
    },
};
// Cache key generators
exports.cacheKeys = {
    deals: (filters) => `deals:${filters}`,
    deal: (id) => `deal:${id}`,
    portfolio: (userId) => `portfolio:${userId}`,
    portfolioStats: (userId) => `portfolio:stats:${userId}`,
    releases: (category) => `releases:${category || 'all'}`,
    trending: (timeframe) => `trending:${timeframe}`,
    priceHistory: (cardKey) => `price:${cardKey}`,
};
//# sourceMappingURL=redis.js.map