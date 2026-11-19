import { Injectable } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

/**
 * Plan-aware rate limiter using Redis.
 * Limits are per-tenant per minute.
 */
@Injectable()
export class RateLimiterService {
  private redisClient: RedisClientType;

  // Per-plan request limits (requests per minute)
  private readonly PLAN_LIMITS: Record<string, number> = {
    // Canonical plan IDs (from tenant-service pricing)
    starter: 60,
    basic: 60,
    growth: 200,
    plus: 200,
    enterprise: 1000,
    // Legacy aliases
    free: 30,
    trial: 30,
  };

  constructor() {
    const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`;
    this.redisClient = createClient({
      url: redisUrl,
    }) as RedisClientType;
    this.redisClient.on('error', (err) =>
      console.error('Redis RateLimiter Error', err),
    );
    this.redisClient
      .connect()
      .catch((err) =>
        console.error('Failed to connect to Redis for RateLimiter:', err),
      );
  }

  /**
   * Returns true if the tenant has exceeded their plan's rate limit.
   * Silently fails open (returns false) if Redis is unavailable.
   */
  async isRateLimited(tenantId: string, plan = 'starter'): Promise<boolean> {
    try {
      const rateLimitKey = `rate_limit:${tenantId}`;
      const multi = this.redisClient.multi();
      multi.incr(rateLimitKey);
      multi.expire(rateLimitKey, 60, 'NX');
      const results = await multi.exec();

      const requests = (results?.[0] as unknown as number) ?? 1;
      const limit = this.PLAN_LIMITS[plan] ?? this.PLAN_LIMITS.starter;
      return requests > limit;
    } catch (err: any) {
      console.error('Rate limit checking failed:', err?.message || err);
      return false; // Fail open to prevent service denial
    }
  }
}
