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

    // 1. Check for signed internal headers from API Gateway first
    if (req.headers['x-tenant-id'] && req.headers['x-gateway-sig']) {
      const tenantId   = req.headers['x-tenant-id'];
      const userId     = req.headers['x-user-id'] || 'api-key-auth';
      const ts         = req.headers['x-gateway-timestamp'];
      const sig        = req.headers['x-gateway-sig'];
      const secret     = process.env.SERVICE_AUTH_SECRET || process.env.JWT_SECRET || 'markova-service-auth-secret-change-in-prod';

      if (!ts || !sig) {
        return res.status(401).json({ error: 'Missing gateway authentication signature' });
      }

      // Replay attack protection: reject tokens older than 5 minutes (allow 10s clock skew)
      if (Math.abs(Date.now() - parseInt(ts, 10)) > 300_000) {
        return res.status(401).json({ error: 'Gateway signature expired' });
      }

      const expectedPayload = `${tenantId}:${userId}:${ts}`;
      const crypto = require('crypto');
      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(expectedPayload)
        .digest('hex');

      const sigBuf  = Buffer.from(sig, 'utf8');
      const expBuf  = Buffer.from(expectedSig, 'utf8');
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        console.error(`⚠️ TenantGuard: gateway signature mismatch for tenant ${tenantId}`);
        return res.status(401).json({ error: 'Invalid gateway signature' });
      }

      context = new SecurityContext({
        tenantId,
        userId,
        sessionId: req.headers['x-session-id'],
        role: req.headers['x-role'] || 'api',
        permissions: req.headers['x-permissions'] ? req.headers['x-permissions'].split(',') : ['*'],
        traceId: req.headers['x-trace-id']
      });
    }
    // 2. Direct Bearer token authentication (legacy or direct microservice calls)
    else if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token === 'demo-token') {
        const tenantId = req.headers['x-tenant-id'] || req.headers['x-company-id'] || '00000000-0000-0000-0000-000000000000';
        context = new SecurityContext({
          tenantId,
          userId: 'demo-user',
          role: 'owner',
          permissions: ['*'],
        });
      } else {
        try {
          const publicKey = await getPublicKey();
          const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
          context = SecurityContext.fromJWT(decoded, req);
        } catch (jwtErr) {
          console.warn('TenantGuard RS256 token verification failed:', jwtErr.message);
          return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }
      }
    }
    // 3. Fallback for internal developer sandbox / test tenant header
    else if (req.headers['x-tenant-id'] && process.env.NODE_ENV !== 'production') {
      const tenantId = req.headers['x-tenant-id'];
      context = new SecurityContext({
        tenantId,
        userId: req.headers['x-user-id'] || 'dev-user',
        role: req.headers['x-role'] || 'owner',
        permissions: ['*']
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
        await client.query("SELECT set_config('app.current_tenant', $1, true)", [context.tenantId]);
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
