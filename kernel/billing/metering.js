class MeteringEngine {
  constructor(pool, eventBus) {
    this.pool = pool;
    this.eventBus = eventBus;
  }

  async recordUsage(companyId, resourceType, amount = 1) {
    // Upsert usage and check limits
    const result = await this.pool.query(
      `UPDATE usage_limits 
       SET current_usage = current_usage + $1
       WHERE company_id = $2 AND resource_type = $3
       RETURNING current_usage, max_limit`,
      [amount, companyId, resourceType]
    );

    if (result.rows.length === 0) {
      // Record doesn't exist, create it (assuming unlimited initially if not defined)
      await this.pool.query(
        `INSERT INTO usage_limits (company_id, resource_type, current_usage, max_limit)
         VALUES ($1, $2, $3, 0)`,
        [companyId, resourceType, amount]
      );
      return { allowed: true };
    }

    const { current_usage, max_limit } = result.rows[0];

    // max_limit == 0 means unlimited
    if (max_limit > 0 && current_usage > max_limit) {
      if (this.eventBus) {
        await this.eventBus.publish('billing.limit_exceeded', {
          companyId,
          resourceType,
          currentUsage: current_usage,
          maxLimit: max_limit
        });
      }
      return { allowed: false, current_usage, max_limit };
    }

    return { allowed: true, current_usage, max_limit };
  }

  async checkLimit(companyId, resourceType) {
    const result = await this.pool.query(
      `SELECT current_usage, max_limit FROM usage_limits WHERE company_id = $1 AND resource_type = $2`,
      [companyId, resourceType]
    );

    if (result.rows.length === 0) return true; // default allow if not defined
    const { current_usage, max_limit } = result.rows[0];
    return max_limit === 0 || current_usage < max_limit;
  }
}

module.exports = MeteringEngine;
