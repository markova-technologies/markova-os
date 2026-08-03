/**
 * Business Memory (Organization rules, SLA thresholds, company policies)
 */
class BusinessMemory {
  constructor(pgPool) {
    this.pool = pgPool;
  }

  async getBusinessContext(companyId) {
    if (!this.pool) return {};
    const res = await this.pool.query(
      `SELECT name, plan, workflow_settings FROM companies WHERE id = $1`,
      [companyId]
    );
    if (res.rows.length === 0) return {};
    return {
      companyName: res.rows[0].name,
      plan: res.rows[0].plan,
      settings: res.rows[0].workflow_settings
    };
  }
}

module.exports = BusinessMemory;
