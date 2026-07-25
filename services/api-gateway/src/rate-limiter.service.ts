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
    starter: 60,
    growth: 200,
    enterprise: 1000,
  };

  constructor() {
    this.redisClient = createClient({
      url: `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`,
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
      const requests = await this.redisClient.incr(rateLimitKey);

      if (requests === 1) {
        // Set expiry for 1 minute window
        await this.redisClient.expire(rateLimitKey, 60);
      }

      const limit = this.PLAN_LIMITS[plan] ?? this.PLAN_LIMITS.starter;
      return requests > limit;
    } catch (err) {
      console.error('Rate limit checking failed:', err.message);
      return false; // Fail open to prevent service denial
    }
  }
}
