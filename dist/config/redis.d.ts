import Redis from 'ioredis';
declare let redis: Redis | null;
declare let redisAvailable: boolean;
export { redis, redisAvailable };
export declare const cache: {
    get<T>(_key: string): Promise<T | null>;
    set(_key: string, _value: unknown, _ttlSeconds?: number): Promise<void>;
    delete(_key: string): Promise<void>;
    deletePattern(_pattern: string): Promise<void>;
};
export declare const cacheKeys: {
    deals: (filters: string) => string;
    deal: (id: string) => string;
    portfolio: (userId: string) => string;
    portfolioStats: (userId: string) => string;
    releases: (category?: string) => string;
    trending: (timeframe: string) => string;
    priceHistory: (cardKey: string) => string;
};
//# sourceMappingURL=redis.d.ts.map