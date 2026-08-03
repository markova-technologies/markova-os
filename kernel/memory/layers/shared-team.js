/**
 * Shared Team Memory (Cross-agent shared state so Sales and Support can query each other)
 */
class SharedTeamMemory {
  constructor(redisClient) {
    this.redis = redisClient;
    this.memoryStore = new Map();
  }

  async getTeamMemory(companyId, teamId, key) {
    if (this.redis) {
      const val = await this.redis.get(`mem:team:${companyId}:${teamId}:${key}`);
      return val ? JSON.parse(val) : null;
    }
    return this.memoryStore.get(`${companyId}:${teamId}:${key}`) || null;
  }

  async setTeamMemory(companyId, teamId, key, value, ttlSeconds = 86400) {
    if (this.redis) {
      await this.redis.setEx(`mem:team:${companyId}:${teamId}:${key}`, ttlSeconds, JSON.stringify(value));
    } else {
      this.memoryStore.set(`${companyId}:${teamId}:${key}`, value);
    }
  }
}

module.exports = SharedTeamMemory;
