import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('error', (error) => {
  console.error('Redis error:', error);
});

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  },

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  },

  async delete(key: string): Promise<void> {
    await redis.del(key);
  },
};

export const cacheKeys = {
  deals: (filters: string) => `deals:${filters}`,
  deal: (id: string) => `deal:${id}`,
  portfolio: (userId: string) => `portfolio:${userId}`,
  portfolioStats: (userId: string) => `portfolio:stats:${userId}`,
  releases: (category?: string) => `releases:${category || 'all'}`,
  trending: (timeframe: string) => `trending:${timeframe}`,
};
