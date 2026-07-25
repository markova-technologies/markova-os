/**
 * Tenant-Aware Database Wrapper
 * Enforces Row-Level Security (RLS) by wrapping queries in a transaction
 * and setting the `app.current_tenant` local variable.
 */
class TenantDb {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Executes a callback within a tenant-scoped transaction.
   * RLS policies will be enforced based on the SecurityContext.
   */
  async withTenant(securityContext, callback) {
    if (!securityContext || (!securityContext.tenantId && !securityContext.isServiceAccount)) {
      throw new Error('TenantDb: Missing valid SecurityContext');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Only set tenant if we have one (service accounts might bypass RLS or use default)
      if (securityContext.tenantId) {
        await client.query("SET LOCAL app.current_tenant = $1", [securityContext.tenantId]);
      }

      // Execute the actual query/logic
      const result = await callback(client);

      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Helper for simple single queries
   */
  async query(securityContext, sql, params = []) {
    return this.withTenant(securityContext, async (client) => {
      return client.query(sql, params);
    });
  }
}

module.exports = TenantDb;
