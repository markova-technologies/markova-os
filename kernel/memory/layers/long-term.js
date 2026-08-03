/**
 * Long-Term Memory (Customer profiles, interaction history, persistent facts)
 */
class LongTermMemory {
  constructor(pgPool) {
    this.pool = pgPool;
  }

  async getCustomerMemory(companyId, callerNumber) {
    if (!this.pool) return null;
    const res = await this.pool.query(
      `SELECT id, name, email, phone, company_name 
       FROM crm_contacts 
       WHERE company_id = $1 AND phone = $2 LIMIT 1`,
      [companyId, callerNumber]
    );
    return res.rows[0] || null;
  }

  async recordInteraction(companyId, callerNumber, summary) {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO audit_logs (company_id, action, details) 
       VALUES ($1, 'LONG_TERM_MEMORY_STORED', $2)`,
      [companyId, JSON.stringify({ callerNumber, summary })]
    );
  }
}

module.exports = LongTermMemory;
