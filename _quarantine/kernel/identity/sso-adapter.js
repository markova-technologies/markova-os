class SSOAdapter {
  constructor(pool) {
    this.pool = pool;
  }

  async getConnection(companyId) {
    const res = await this.pool.query(
      'SELECT * FROM sso_connections WHERE company_id = $1 AND is_active = true',
      [companyId]
    );
    return res.rows[0] || null;
  }

  async createConnection(companyId, provider, idpEntityId, ssoUrl, certificate) {
    const res = await this.pool.query(
      `INSERT INTO sso_connections (company_id, provider, idp_entity_id, sso_url, certificate, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (company_id) 
       DO UPDATE SET provider = $2, idp_entity_id = $3, sso_url = $4, certificate = $5, is_active = true
       RETURNING *`,
      [companyId, provider, idpEntityId, ssoUrl, certificate]
    );
    return res.rows[0];
  }
}

module.exports = SSOAdapter;
