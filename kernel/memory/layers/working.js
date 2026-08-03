/**
 * Working Memory (Scratchpad for active turn processing)
 * High-speed, ephemeral key-value store.
 */
class WorkingMemory {
  constructor(redisClient) {
    this.redis = redisClient;
    this.localCache = new Map();
  }

  async get(sessionKey, key) {
    if (this.redis) {
      const val = await this.redis.get(`mem:working:${sessionKey}:${key}`);
      return val ? JSON.parse(val) : null;
    }
    return this.localCache.get(`${sessionKey}:${key}`) || null;
  }

  async set(sessionKey, key, value, ttlSeconds = 300) {
    if (this.redis) {
      await this.redis.setEx(`mem:working:${sessionKey}:${key}`, ttlSeconds, JSON.stringify(value));
    } else {
      this.localCache.set(`${sessionKey}:${key}`, value);
    }
  }

  async clear(sessionKey) {
    if (this.redis) {
      const keys = await this.redis.keys(`mem:working:${sessionKey}:*`);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } else {
      for (const k of this.localCache.keys()) {
        if (k.startsWith(`${sessionKey}:`)) this.localCache.delete(k);
      }
    }
  }
}

module.exports = WorkingMemory;
