const jwt = require('jsonwebtoken');
const axios = require('axios');
const SecurityContext = require('./security-context');

let cachedPublicKey = null;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:5001';

async function getPublicKey() {
  if (cachedPublicKey) return cachedPublicKey;
  try {
    const response = await axios.get(`${AUTH_SERVICE_URL}/api/auth/public-key`);
    cachedPublicKey = response.data.publicKey;
    return cachedPublicKey;
  } catch (err) {
    console.error('Failed to fetch public key from Auth Service:', err.message);
    throw new Error('Authentication unavailable');
  }
}

async function TenantGuard(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let context = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const publicKey = await getPublicKey();
      const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
      context = SecurityContext.fromJWT(decoded, req);
    } 
    // Otherwise check for API key or internal headers from Gateway
    else if (req.headers['x-tenant-id']) {
      context = new SecurityContext({
        tenantId: req.headers['x-tenant-id'],
        userId: req.headers['x-user-id'],
        sessionId: req.headers['x-session-id'],
        role: req.headers['x-role'],
        permissions: req.headers['x-permissions'] ? req.headers['x-permissions'].split(',') : [],
        traceId: req.headers['x-trace-id']
      });
    }

    if (!context) {
      return res.status(401).json({ error: 'Unauthorized: Missing Security Context' });
    }

    // This throws if tenantId is missing
    context.validate();

    // Attach to request
    req.securityContext = context;

    // We can't automatically run SET app.current_tenant here because pg connections 
    // are pulled from a pool per-query, not per-request. 
    // It is up to the service handler to wrap the transaction with the tenant setting.
    // However, if we expose a helper here it makes it easier:
    req.withTenantDb = async (pool, callback) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SET LOCAL app.current_tenant = $1", [context.tenantId]);
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    };

    next();
  } catch (err) {
    console.error('TenantGuard Error:', err.message);
    return res.status(403).json({ error: 'Forbidden: Invalid Security Context' });
  }
}

module.exports = TenantGuard;
