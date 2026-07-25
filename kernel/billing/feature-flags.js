class FeatureFlags {
  constructor(pool) {
    this.pool = pool;
  }

  async isEnabled(companyId, featureName, defaultState = false) {
    const result = await this.pool.query(
      `SELECT is_enabled FROM feature_flags WHERE company_id = $1 AND feature_name = $2`,
      [companyId, featureName]
    );

    if (result.rows.length === 0) {
      return defaultState;
    }

    return result.rows[0].is_enabled;
  }

  async enableFeature(companyId, featureName) {
    await this.pool.query(
      `INSERT INTO feature_flags (company_id, feature_name, is_enabled)
       VALUES ($1, $2, true)
       ON CONFLICT (company_id, feature_name) 
       DO UPDATE SET is_enabled = true`,
      [companyId, featureName]
    );
  }

  async disableFeature(companyId, featureName) {
    await this.pool.query(
      `UPDATE feature_flags SET is_enabled = false WHERE company_id = $1 AND feature_name = $2`,
      [companyId, featureName]
    );
  }
}

module.exports = FeatureFlags;
