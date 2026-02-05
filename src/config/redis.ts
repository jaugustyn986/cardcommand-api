// ============================================
// CardCommand Center - Redis Configuration
// ============================================

import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

// Create Redis client only if REDIS_URL is provided
let redis: Redis | null = null;
let redisAvailable = false;

if (redisUrl) {
  redis = new Redis(redisUrl, {
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
  });

  // Handle connection events
  redis.on('connect', () => {
    console.log('✅ Redis connected');
    redisAvailable = true;
  });

  redis.on('error', (error) => {
    console.error('❌ Redis error:', error.message);
    redisAvailable = false;
  });
} else {
  console.log('⚠️  REDIS_URL not set, caching disabled');
}

export { redis, redisAvailable };

// Cache helpers - gracefully handle missing Redis
export const cache = {
  async get<T>(_key: string): Promise<T | null> {
    if (!redisAvailable || !redis) return null;
    try {
      const data = await redis.get(_key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async set(_key: string, _value: unknown, _ttlSeconds = 300): Promise<void> {
    if (!redisAvailable || !redis) return;
    try {
      await redis.setex(_key, _ttlSeconds, JSON.stringify(_value));
    } catch {
      // Silently fail if Redis is unavailable
    }
  },

  async delete(_key: string): Promise<void> {
    if (!redisAvailable || !redis) return;
    try {
      await redis.del(_key);
    } catch {
      // Silently fail if Redis is unavailable
    }
  },

  async deletePattern(_pattern: string): Promise<void> {
    if (!redisAvailable || !redis) return;
    try {
      const keys = await redis.keys(_pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {
      // Silently fail if Redis is unavailable
    }
  },
};

// Cache key generators
export const cacheKeys = {
  deals: (filters: string) => `deals:${filters}`,
  deal: (id: string) => `deal:${id}`,
  portfolio: (userId: string) => `portfolio:${userId}`,
  portfolioStats: (userId: string) => `portfolio:stats:${userId}`,
  releases: (category?: string) => `releases:${category || 'all'}`,
  trending: (timeframe: string) => `trending:${timeframe}`,
  priceHistory: (cardKey: string) => `price:${cardKey}`,
};
