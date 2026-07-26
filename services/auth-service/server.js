const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('redis');
const requestLogger = require('../../kernel/identity/request-logger');
const { validate, schemas } = require('../../packages/shared-validation');
require('dotenv').config();

const app = express();
app.use(requestLogger);
const PORT = process.env.PORT || 5001;
const jwtKeyManager = require('./jwt-keys');

// We use asymmetric RS256 instead of HS256 to allow services to verify
// tokens without needing the private key that signs them.
const PRIVATE_KEY = jwtKeyManager.getPrivateKey();
const PUBLIC_KEY = jwtKeyManager.getPublicKey();

// Export the public key endpoint for other services (Phase 0 API Gateway hardening)
app.get(['/api/auth/public-key', '/v1/auth/public-key'], (req, res) => {
  res.json({ publicKey: PUBLIC_KEY });
});

// Legacy client-dashboard signup sends `company` instead of `companyName`
function normalizeClientRegisterBody(req, _res, next) {
  if (req.body && req.body.company && !req.body.companyName) {
    req.body.companyName = req.body.company;
  }
  next();
}


app.use(cors());
app.use(express.json());

// Postgres Connection Pool with retries
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Redis client setup for rate limiting
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});
redisClient.on('error', (err) => console.error('Redis Client Error in Auth', err));

async function initializeServices(retries = 10, delay = 3000) {
  let dbConnected = false;
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('✅ Auth Service connected to PostgreSQL database');
      dbConnected = true;
      break;
    } catch (err) {
      console.log(`⚠️ Database connection attempt ${i + 1} failed. Retrying in ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  if (!dbConnected) {
    console.error('❌ Database connection failed after maximum retries');
    process.exit(1);
  }

  try {
    await redisClient.connect();
    console.log('✅ Auth Service connected to Redis');
  } catch (err) {
    console.error('❌ Redis connection failed:', err);
    process.exit(1);
  }
}

initializeServices();

// Register Company & Admin User (Atomic Transaction)
// Paths: /api/auth/* (legacy), /v1/auth/* (canonical), /api/clients/* (client-dashboard)
app.post(
  ['/api/auth/register', '/v1/auth/register', '/api/clients/register'],
  normalizeClientRegisterBody,
  validate(schemas.register),
  async (req, res) => {

  const { name, companyName, email, password } = req.body;

  if (!name || !companyName || !email || !password) {
    return res.status(400).json({ error: 'All fields (name, companyName, email, password) are required' });
  }

  // Strong password policy
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if email already exists
    const emailCheck = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email is already registered' });
    }

    // 1. Create Company
    const companyRes = await client.query(
      'INSERT INTO companies (name) VALUES ($1) RETURNING id',
      [companyName]
    );
    const companyId = companyRes.rows[0].id;

    // Emit event (best-effort — must not fail registration)
    try {
      const EventBus = require('../../kernel/events/bus');
      const { EventTypes } = require('../../kernel/events/registry');
      const eventBus = new EventBus(process.env.REDIS_URL || 'redis://redis:6379');
      await eventBus.publish(EventTypes.TENANT_CREATED, {
        tenantId: companyId,
        companyId,
        companyName
      });
    } catch (eventErr) {
      console.warn('tenant.created event publish skipped:', eventErr.message);
    }

    // 2. Hash Password
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Create Admin User
    const userRes = await client.query(
      `INSERT INTO users (company_id, name, email, password_hash, role, status) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, name, email, role, status`,
      [companyId, name, email, passwordHash, 'admin', 'active']
    );
    const user = userRes.rows[0];

    // 4. Initialize Usage metrics record
    await client.query(
      'INSERT INTO usage_metrics (company_id) VALUES ($1)',
      [companyId]
    );

    // 5. Seed default templates if not exists
    await client.query(`
      INSERT INTO connector_templates (name, type, schema)
      VALUES 
        ('Google Sheets Sync', 'google_sheet', '{"spreadsheetId": "string", "range": "string"}'::jsonb),
        ('Excel Sync', 'excel', '{"filePath": "string"}'::jsonb),
        ('n8n Webhook Target', 'n8n', '{"webhookUrl": "string"}'::jsonb)
      ON CONFLICT DO NOTHING
    `);

    // Create Audit Log
    await client.query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id) 
       VALUES ($1, $2, $3, $4, $5)`,
      [companyId, user.id, 'COMPANY_REGISTERED', 'company', companyId]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, user: { ...user, company_id: companyId } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'Internal Server Error during registration' });
  } finally {
    client.release();
  }
});

// Login User
app.post(
  ['/api/auth/login', '/v1/auth/login', '/api/clients/login'],
  validate(schemas.login),
  async (req, res) => {

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const rateLimitKey = `login_attempts:${email}`;

  try {
    const attempts = await redisClient.get(rateLimitKey);
    if (attempts && parseInt(attempts, 10) >= 5) {
      return res.status(429).json({ error: 'Too many failed login attempts. Please try again in 15 minutes.' });
    }

    const userRes = await pool.query(
      'SELECT id, company_id, name, email, password_hash, role, status FROM users WHERE email = $1',
      [email]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userRes.rows[0];

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      await redisClient.incr(rateLimitKey);
      await redisClient.expire(rateLimitKey, 15 * 60); // 15 minutes lockout
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Successful login - clear failed attempts
    await redisClient.del(rateLimitKey);

    const companyRes = await pool.query('SELECT plan FROM companies WHERE id = $1', [user.company_id]);
    const plan = companyRes.rows[0] ? companyRes.rows[0].plan : 'starter';

    // Fetch permissions (simplistic)
    const permRes = await pool.query(`
      SELECT p.action 
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = $1
    `, [user.id]);
    const permissions = permRes.rows.map(r => r.action);

    // Create Session
    const sessionId = uuidv4();
    const deviceInfo = { userAgent: req.headers['user-agent'] };
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    
    // Refresh token
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await pool.query(
      `INSERT INTO sessions (id, user_id, company_id, device_info, ip_address, expires_at, refresh_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [sessionId, user.id, user.company_id, deviceInfo, ipAddress, refreshExpiresAt.toISOString(), refreshToken]
    );

    // Sign Token with RS256
    const token = jwt.sign(
      {
        userId: user.id,
        companyId: user.company_id,
        name: user.name,
        role: user.role,
        sessionId,
        permissions,
        subscriptionPlan: plan
      },
      PRIVATE_KEY,
      { algorithm: 'RS256', expiresIn: '1h' } // Short-lived access token
    );

    // Create Login Audit Log
    await pool.query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id) 
       VALUES ($1, $2, $3, $4, $5)`,
      [user.company_id, user.id, 'USER_LOGIN', 'user', user.id]
    );

    const userPayload = {
      id: user.id,
      company_id: user.company_id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    // Canonical shape uses `user`. Legacy /api/clients/login also includes `client`
    // so the frozen client-dashboard Login.jsx keeps working without a frontend change.
    const body = {
      success: true,
      token,
      refreshToken,
      user: userPayload
    };
    if (req.path.startsWith('/api/clients/')) {
      body.client = userPayload;
    }
    res.json(body);
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Internal Server Error during login' });
  }
});

// Token Verification Endpoint
app.post(['/api/auth/verify-token', '/v1/auth/verify-token'], async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    const decoded = jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });
    
    // Validate session wasn't revoked
    if (decoded.sessionId) {
      const sessionRes = await pool.query(
        'SELECT revoked_at FROM sessions WHERE id = $1',
        [decoded.sessionId]
      );
      if (sessionRes.rows.length === 0 || sessionRes.rows[0].revoked_at) {
        return res.json({ valid: false, error: 'Session has been revoked' });
      }
    }

    res.json({ valid: true, decoded });
  } catch (err) {
    res.json({ valid: false, error: 'Token invalid or expired' });
  }
});

// Refresh Token Endpoint
app.post(['/api/auth/refresh-token', '/v1/auth/refresh', '/v1/auth/refresh-token'], async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token is required' });

  try {
    const sessionRes = await pool.query(
      `SELECT s.id as session_id, s.user_id, s.company_id, s.expires_at, s.revoked_at,
              u.name, u.role, u.status, c.plan
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       JOIN companies c ON s.company_id = c.id
       WHERE s.refresh_token = $1`,
      [refreshToken]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const session = sessionRes.rows[0];

    if (session.revoked_at || session.status !== 'active' || new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Session expired or revoked' });
    }

    // Fetch permissions
    const permRes = await pool.query(`
      SELECT p.action 
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = $1
    `, [session.user_id]);
    const permissions = permRes.rows.map(r => r.action);

    // Issue new access token
    const token = jwt.sign(
      {
        userId: session.user_id,
        companyId: session.company_id,
        name: session.name,
        role: session.role,
        sessionId: session.session_id,
        permissions,
        subscriptionPlan: session.plan
      },
      PRIVATE_KEY,
      { algorithm: 'RS256', expiresIn: '1h' }
    );

    res.json({ success: true, token });
  } catch (err) {
    console.error('Refresh Token Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// SSO/SCIM mock routes removed in Phase 0 (quarantined under _quarantine/kernel/identity/).

// Logout User
app.post(['/api/auth/logout', '/v1/auth/logout'], async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(400).json({ error: 'Token is required' });
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });
    if (decoded.sessionId) {
      await pool.query('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1', [decoded.sessionId]);
      // Cache revocation for 24 hours so API Gateway can block it immediately without querying DB
      await redisClient.set(`session_revoked:${decoded.sessionId}`, 'true', { EX: 24 * 60 * 60 });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Current authenticated user (Phase 1 — was missing)
app.get(['/api/auth/me', '/v1/auth/me'], async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Bearer token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });

    if (decoded.sessionId) {
      const isRevoked = await redisClient.get(`session_revoked:${decoded.sessionId}`);
      if (isRevoked) {
        return res.status(401).json({ error: 'Session has been revoked' });
      }
      const sessionRes = await pool.query(
        'SELECT revoked_at FROM sessions WHERE id = $1',
        [decoded.sessionId]
      );
      if (sessionRes.rows.length === 0 || sessionRes.rows[0].revoked_at) {
        return res.status(401).json({ error: 'Session has been revoked' });
      }
    }

    const userRes = await pool.query(
      `SELECT u.id, u.company_id, u.name, u.email, u.role, u.status, c.name AS company_name, c.plan
       FROM users u
       JOIN companies c ON c.id = u.company_id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = userRes.rows[0];
    res.json({
      id: row.id,
      company_id: row.company_id,
      company_name: row.company_name,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      plan: row.plan,
      permissions: decoded.permissions || []
    });
  } catch (err) {
    return res.status(401).json({ error: 'Token invalid or expired' });
  }
});

// Check Server Health
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'auth-service' });
});

app.listen(PORT, () => {
  console.log(`🚀 Auth Service listening on port ${PORT}`);
});
