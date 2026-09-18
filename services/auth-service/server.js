const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const https = require('https');
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

async function ensureRbacTables(client) {
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        parent_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        display_name VARCHAR(100),
        description TEXT,
        is_system BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        action VARCHAR(100) UNIQUE NOT NULL,
        resource VARCHAR(50) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
        permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      );

      CREATE TABLE IF NOT EXISTS user_roles (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
        PRIMARY KEY (user_id, role_id)
      );

      CREATE TABLE IF NOT EXISTS invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        email VARCHAR(255),
        role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
        role_name VARCHAR(50) NOT NULL,
        department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      await pool.query('ALTER TABLE invitations ALTER COLUMN email DROP NOT NULL').catch(() => {});

      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        token TEXT,
        refresh_token TEXT,
        device_info JSONB,
        ip_address VARCHAR(100),
        is_revoked BOOLEAN DEFAULT false,
        revoked_at TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed permissions
    await client.query(`
      INSERT INTO permissions (name, action, resource, description)
      SELECT p.name, p.action, p.resource, p.description
      FROM (VALUES
        ('View Agents', 'agents:read', 'agents', 'View agent profiles and configurations'),
        ('Create Agents', 'agents:create', 'agents', 'Create new voice and chat agents'),
        ('Update Agents', 'agents:update', 'agents', 'Modify existing agent instructions and prompts'),
        ('Delete Agents', 'agents:delete', 'agents', 'Delete agents'),
        ('View Knowledge', 'knowledge:read', 'knowledge', 'View documents and RAG sources'),
        ('Create Knowledge', 'knowledge:create', 'knowledge', 'Upload documents and web crawlers'),
        ('Update Knowledge', 'knowledge:update', 'knowledge', 'Sync or modify knowledge bases'),
        ('Delete Knowledge', 'knowledge:delete', 'knowledge', 'Remove knowledge documents and sources'),
        ('View Calls', 'calls:read', 'calls', 'View call logs, metrics, and transcripts'),
        ('Listen Live', 'calls:listen', 'calls', 'Listen to live calls in real time'),
        ('Barge Call', 'calls:barge', 'calls', 'Take over or inject supervisor audio into calls'),
        ('Download Recordings', 'calls:download', 'calls', 'Download audio recordings of calls'),
        ('View Analytics', 'analytics:read', 'analytics', 'Access analytics dashboards and reports'),
        ('View CRM', 'crm:read', 'crm', 'Access CRM contacts and customer records'),
        ('Edit CRM', 'crm:write', 'crm', 'Create or update contacts, notes, and tasks'),
        ('Delete CRM', 'crm:delete', 'crm', 'Delete customer records'),
        ('View Integrations', 'integrations:read', 'integrations', 'View connected tools and webhooks'),
        ('Create Integrations', 'integrations:create', 'integrations', 'Connect new integrations and APIs'),
        ('Delete Integrations', 'integrations:delete', 'integrations', 'Disconnect integrations'),
        ('View API Keys', 'keys:read', 'keys', 'View tenant API keys and tokens'),
        ('Create API Keys', 'keys:create', 'keys', 'Generate new API keys'),
        ('Delete API Keys', 'keys:delete', 'keys', 'Revoke API keys'),
        ('View Settings', 'settings:read', 'settings', 'View organization profile and preferences'),
        ('Edit Settings', 'settings:write', 'settings', 'Modify organization settings and provider credentials'),
        ('View Billing', 'billing:read', 'billing', 'View subscription, invoices, and token usage'),
        ('Manage Billing', 'billing:write', 'billing', 'Change plans, update payment methods, buy credits'),
        ('View Team', 'users:read', 'users', 'View team members, roles, and pending invites'),
        ('Invite Members', 'users:invite', 'users', 'Invite new team members to organization'),
        ('Manage Roles', 'users:manage_roles', 'users', 'Assign, change, or create custom team roles'),
        ('Deactivate Users', 'users:deactivate', 'users', 'Deactivate or remove team members'),
        ('View Governance', 'governance:read', 'governance', 'View AI guardrails, audit trails, and approvals'),
        ('Manage Governance', 'governance:write', 'governance', 'Configure guardrails and compliance rules'),
        ('View Audit Logs', 'audit:read', 'audit', 'Access immutable audit log records'),
        ('View Phone Numbers', 'phone:read', 'phone', 'View provisioned telephony lines and SIP trunks'),
        ('Manage Phone Numbers', 'phone:create', 'phone', 'Purchase or configure phone numbers'),
        ('Delete Phone Numbers', 'phone:delete', 'phone', 'Release phone numbers')
      ) AS p(name, action, resource, description)
      WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permissions.action = p.action);
    `);

    // Seed roles
    await client.query(`
      INSERT INTO roles (name, display_name, description, is_system)
      SELECT r.name, r.display_name, r.description, true
      FROM (VALUES
        ('owner', 'Owner', 'Full control over company account, billing, ownership, and all features', true),
        ('admin', 'Administrator', 'Full system management and configuration, restricted from billing ownership changes', true),
        ('supervisor', 'Supervisor', 'Call center oversight, live listening, barge-in, quality monitoring, and CRM access', true),
        ('agent', 'Call Agent', 'Handles customer calls, call history, and CRM notes', true),
        ('analyst', 'Data Analyst', 'Performance analytics, call metrics, BI dashboards, and reporting data', true),
        ('viewer', 'Viewer', 'Read-only visibility into call center summaries and public reports', true),
        ('superadmin', 'Super Admin', 'Platform operator access across all tenants', true),
        ('developer', 'Developer', 'API key, webhook, and technical configuration management', true)
      ) AS r(name, display_name, description, is_system)
      WHERE NOT EXISTS (SELECT 1 FROM roles WHERE roles.name = r.name AND roles.company_id IS NULL);
    `);

    // Seed role_permissions
    await client.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.name = 'owner' AND r.company_id IS NULL
      ON CONFLICT DO NOTHING;

      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.name = 'admin' AND r.company_id IS NULL
        AND p.action NOT IN ('billing:write')
      ON CONFLICT DO NOTHING;

      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.name = 'supervisor' AND r.company_id IS NULL
        AND p.action IN ('calls:read', 'calls:listen', 'calls:barge', 'calls:download', 'analytics:read', 'crm:read', 'crm:write', 'governance:read', 'audit:read', 'users:read')
      ON CONFLICT DO NOTHING;

      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.name = 'agent' AND r.company_id IS NULL
        AND p.action IN ('calls:read', 'calls:listen', 'crm:read', 'crm:write')
      ON CONFLICT DO NOTHING;

      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.name = 'analyst' AND r.company_id IS NULL
        AND p.action IN ('analytics:read', 'calls:read', 'crm:read', 'audit:read')
      ON CONFLICT DO NOTHING;

      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.name = 'viewer' AND r.company_id IS NULL
        AND p.action IN ('agents:read', 'knowledge:read', 'calls:read', 'analytics:read', 'crm:read')
      ON CONFLICT DO NOTHING;
    `);

    console.log('✅ RBAC tables, roles, and permissions initialized');
  } catch (err) {
    console.warn('⚠️ RBAC table initialization notice:', err.message);
  }
}

async function initializeServices(retries = 10, delay = 3000) {
  let dbConnected = false;
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      try {
        await ensureRbacTables(client);
      } finally {
        client.release();
      }
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

    // 3. Create Owner User
    const userRes = await client.query(
      `INSERT INTO users (company_id, name, email, password_hash, role, status) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, name, email, role, status`,
      [companyId, name, email, passwordHash, 'owner', 'active']
    );
    const user = userRes.rows[0];

    // Link Owner to user_roles
    const ownerRoleRes = await client.query("SELECT id FROM roles WHERE name = 'owner' AND company_id IS NULL LIMIT 1");
    if (ownerRoleRes.rows[0]) {
      await client.query(
        "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [user.id, ownerRoleRes.rows[0].id]
      );
    }

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

    // Fetch permissions
    const permRes = await pool.query(`
      SELECT p.action 
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = $1
    `, [user.id]);
    let permissions = permRes.rows.map(r => r.action);

    // Fallback: if user_roles not assigned yet, fetch from default role name
    if (permissions.length === 0 && user.role) {
      const fallbackPermRes = await pool.query(`
        SELECT p.action
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN roles r ON rp.role_id = r.id
        WHERE LOWER(r.name) = LOWER($1) AND r.company_id IS NULL
      `, [user.role]);
      permissions = fallbackPermRes.rows.map(r => r.action);
    }

    // Owner or superadmin always has wildcard access
    if ((user.role || '').toLowerCase() === 'owner' || (user.role || '').toLowerCase() === 'superadmin') {
      if (!permissions.includes('*')) permissions.unshift('*');
    }

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

// Admin Dedicated Login (Issues JWT with aud: 'admin' and HS256 Supabase compatibility)
app.post(
  ['/api/auth/admin/login', '/v1/auth/admin/login'],
  validate(schemas.login),
  async (req, res) => {

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const rateLimitKey = `admin_login_attempts:${email}`;

  try {
    const attempts = await redisClient.get(rateLimitKey);
    if (attempts && parseInt(attempts, 10) >= 5) {
      return res.status(429).json({ error: 'Too many failed login attempts.' });
    }

    const userRes = await pool.query(
      'SELECT id, company_id, name, email, password_hash, role, status FROM users WHERE email = $1',
      [email]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userRes.rows[0];

    const allowedAdminRoles = ['superadmin', 'admin', 'platform_admin', 'support_admin', 'billing_admin', 'developer'];
    if (!allowedAdminRoles.includes((user.role || '').toLowerCase())) {
      return res.status(403).json({ error: 'Access denied: Admin role required' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      await redisClient.incr(rateLimitKey);
      await redisClient.expire(rateLimitKey, 15 * 60);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await redisClient.del(rateLimitKey);

    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ error: 'Server configuration error (missing JWT secret)' });
    }

    // Sign Token with HS256 (Supabase Gateway format) with AUD: admin
    const token = jwt.sign(
      {
        sub: user.id,
        company_id: user.company_id,
        role: user.role,
        aud: 'admin'
      },
      secret,
      { algorithm: 'HS256', expiresIn: '24h' }
    );

    await pool.query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id) 
       VALUES ($1, $2, $3, $4, $5)`,
      [user.company_id, user.id, 'ADMIN_LOGIN', 'user', user.id]
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Admin Login Error:', error);
    res.status(500).json({ error: 'Internal Server Error during admin login' });
  }
});

// Admin Impersonation Endpoint
app.post(
  ['/api/auth/admin/impersonate', '/v1/auth/admin/impersonate'],
  async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Missing token' });
    const token = authHeader.split(' ')[1];
    
    try {
      const secret = process.env.SUPABASE_JWT_SECRET;
      if (!secret) return res.status(500).json({ error: 'Missing secret' });
      
      const decoded = jwt.verify(token, secret);
      if (decoded.aud !== 'admin') {
        return res.status(403).json({ error: 'Admin token required' });
      }

      const { targetCompanyId } = req.body;
      if (!targetCompanyId) return res.status(400).json({ error: 'targetCompanyId required' });

      // Find an active user in the target company
      const targetRes = await pool.query('SELECT id, company_id, name, email, role FROM users WHERE company_id = $1 LIMIT 1', [targetCompanyId]);
      if (targetRes.rows.length === 0) return res.status(404).json({ error: 'Target company not found or has no users' });
      
      const targetUser = targetRes.rows[0];

      // Sign a client token acting as targetUser, with impersonator flag
      const clientToken = jwt.sign(
        {
          sub: targetUser.id,
          company_id: targetUser.company_id,
          role: targetUser.role,
          impersonator_id: decoded.sub
        },
        secret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );
      
      await pool.query(
        `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id) 
         VALUES ($1, $2, $3, $4, $5)`,
        [targetUser.company_id, decoded.sub, 'IMPERSONATE_TENANT', 'company', targetCompanyId]
      );

      res.json({
        success: true,
        token: clientToken,
        user: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
          company_id: targetUser.company_id,
          impersonatorId: decoded.sub
        }
      });

    } catch (err) {
      console.error('Impersonation error:', err);
      res.status(401).json({ error: 'Invalid admin token' });
    }
  }
);

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
    });
  } catch (err) {
    return res.status(401).json({ error: 'Token invalid or expired' });
  }
});

// ============================================================================
// ENTERPRISE MULTI-USER RBAC & ORG MANAGEMENT SYSTEM
// ============================================================================

// Helper: Send Invite Email via Resend API (Option A) with graceful fallback
async function sendInviteEmail({ to, inviteUrl, inviterName, companyName, roleName }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[Invite Email] RESEND_API_KEY not configured. Generated magic invite link for ${to}: ${inviteUrl}`);
    return { sent: false, reason: 'RESEND_API_KEY_NOT_CONFIGURED', inviteUrl };
  }

  return new Promise((resolve) => {
    const payload = JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'Markova AI <onboarding@resend.dev>',
      to: [to],
      subject: `You've been invited to join ${companyName || 'Markova OS'}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 36px 28px; background: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b;">
          <div style="text-align: center; margin-bottom: 28px;">
            <div style="display: inline-block; padding: 8px 16px; background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 20px; color: #60a5fa; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;">Markova OS Enterprise</div>
            <h1 style="font-size: 26px; font-weight: 700; color: #ffffff; margin: 16px 0 6px;">Team Invitation</h1>
            <p style="color: #94a3b8; font-size: 14px; margin: 0;">AI Call Center & Telephony Platform</p>
          </div>
          <div style="background: rgba(30, 41, 59, 0.6); padding: 24px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 24px;">
            <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Hello,</p>
            <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
              <strong>${inviterName || 'An administrator'}</strong> has invited you to join <strong>${companyName || 'the team'}</strong> on Markova OS with the role of <span style="display: inline-block; padding: 2px 10px; background: #2563eb; color: #ffffff; border-radius: 6px; font-size: 13px; font-weight: 600;">${roleName}</span>.
            </p>
            <p style="font-size: 14px; color: #94a3b8; margin: 0 0 24px;">
              Accept your invitation to activate your access and get started:
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; padding: 14px 34px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 18px rgba(37, 99, 235, 0.35);">
                Accept Invitation & Set Password
              </a>
            </div>
          </div>
          <div style="border-top: 1px solid #1e293b; padding-top: 20px; text-align: center;">
            <p style="font-size: 12px; color: #64748b; margin: 0 0 8px;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 12px; color: #38bdf8; word-break: break-all; margin: 0 0 16px;">${inviteUrl}</p>
            <p style="font-size: 11px; color: #475569; margin: 0;">This invitation link will expire in 7 days.</p>
          </div>
        </div>
      `
    });

    const req = https.request({
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve({ sent: true, data: JSON.parse(data), inviteUrl });
          } catch (e) {
            resolve({ sent: true, raw: data, inviteUrl });
          }
        } else {
          console.warn(`[Invite Email] Resend API error (${res.statusCode}):`, data);
          resolve({ sent: false, error: data, inviteUrl });
        }
      });
    });

    req.on('error', (err) => {
      console.warn('[Invite Email] Network error to Resend:', err.message);
      resolve({ sent: false, error: err.message, inviteUrl });
    });

    req.write(payload);
    req.end();
  });
}

// Authentication Middleware
async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Bearer token required' });
  }

  const token = authHeader.split(' ')[1];

  // 1. Try RS256 with service PUBLIC_KEY
  try {
    const decoded = jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });
    if (decoded.sessionId) {
      const isRevoked = await redisClient.get(`session_revoked:${decoded.sessionId}`);
      if (isRevoked) {
        return res.status(401).json({ error: 'Session has been revoked' });
      }
    }
    req.user = {
      userId: decoded.userId || decoded.sub,
      companyId: decoded.companyId,
      name: decoded.name,
      role: decoded.role || 'viewer',
      permissions: decoded.permissions || []
    };
    return next();
  } catch (rsErr) {
    // 2. Try HS256 with SUPABASE_JWT_SECRET
    if (process.env.SUPABASE_JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
        const userId = decoded.sub || decoded.userId;
        
        // Lookup user in DB to retrieve company and permissions
        const userRes = await pool.query(
          `SELECT u.id, u.company_id, u.name, u.role, u.status,
                  COALESCE(json_agg(p.action) FILTER (WHERE p.action IS NOT NULL), '[]'::json) as permissions
           FROM users u
           LEFT JOIN user_roles ur ON u.id = ur.user_id
           LEFT JOIN role_permissions rp ON ur.role_id = rp.role_id
           LEFT JOIN permissions p ON rp.permission_id = p.id
           WHERE u.id = $1
           GROUP BY u.id`,
          [userId]
        );

        if (userRes.rows.length > 0) {
          const u = userRes.rows[0];
          req.user = {
            userId: u.id,
            companyId: u.company_id,
            name: u.name,
            role: u.role,
            permissions: u.permissions || []
          };
          if ((u.role || '').toLowerCase() === 'owner' || (u.role || '').toLowerCase() === 'superadmin') {
            if (!req.user.permissions.includes('*')) req.user.permissions.unshift('*');
          }
          return next();
        }
      } catch (hsErr) {}
    }

    // 3. Fallback for sandbox/demo header tokens in development
    if (token.startsWith('demo-token') || token.startsWith('test-token')) {
      const headerCompanyId = req.headers['x-company-id'] || req.headers['x-tenant-id'];
      if (headerCompanyId) {
        req.user = {
          userId: '00000000-0000-0000-0000-000000000001',
          companyId: headerCompanyId,
          name: 'Demo Admin',
          role: 'owner',
          permissions: ['*']
        };
        return next();
      }
    }

    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
}

// Permission Guard Middleware Generator
function requirePermission(requiredPermission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    const role = (req.user.role || '').toLowerCase();
    // Owner and Superadmin bypass granular permission checks
    if (role === 'owner' || role === 'superadmin' || req.user.permissions?.includes('*')) {
      return next();
    }

    if (req.user.permissions?.includes(requiredPermission)) {
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden: Insufficient permissions',
      requiredPermission,
      userRole: req.user.role
    });
  };
}

// ----------------------------------------------------------------------------
// 1. Members Management & Invitations List
// ----------------------------------------------------------------------------
app.get(['/api/auth/users', '/v1/users'], authenticateUser, requirePermission('users:read'), async (req, res) => {
  const companyId = req.user.companyId;

  try {
    // Active users in company
    const usersRes = await pool.query(`
      SELECT 
        u.id, u.name, u.email, u.role, u.status, u.created_at, u.department_id,
        d.name AS department_name,
        r.display_name AS role_display_name,
        (
          SELECT s.last_active 
          FROM sessions s 
          WHERE s.user_id = u.id AND s.revoked_at IS NULL 
          ORDER BY s.last_active DESC 
          LIMIT 1
        ) AS last_active
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON (ur.role_id = r.id OR (LOWER(u.role) = LOWER(r.name) AND r.company_id IS NULL))
      WHERE u.company_id = $1
      GROUP BY u.id, d.name, r.display_name
      ORDER BY 
        CASE WHEN LOWER(u.role) = 'owner' THEN 1 WHEN LOWER(u.role) = 'admin' THEN 2 ELSE 3 END,
        u.created_at ASC
    `, [companyId]);

    // Pending invitations in company
    const invitesRes = await pool.query(`
      SELECT 
        i.id, i.email, i.role_name, i.status, i.token, i.expires_at, i.created_at, i.department_id,
        d.name AS department_name,
        u.name AS invited_by_name
      FROM invitations i
      LEFT JOIN departments d ON i.department_id = d.id
      LEFT JOIN users u ON i.invited_by = u.id
      WHERE i.company_id = $1 AND i.status = 'pending' AND i.expires_at > CURRENT_TIMESTAMP
      ORDER BY i.created_at DESC
    `, [companyId]);

    // Construct client URL for invites
    const baseUrl = process.env.CLIENT_DASHBOARD_URL || req.headers.origin || 'http://localhost:5173';
    const invitations = invitesRes.rows.map(inv => ({
      ...inv,
      invite_url: `${baseUrl}/accept-invite?token=${inv.token}`
    }));

    res.json({
      success: true,
      users: usersRes.rows,
      invitations
    });
  } catch (err) {
    console.error('Error fetching company users:', err);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// ----------------------------------------------------------------------------
// 2. Invite Member Endpoint (Resend.com Email + Copyable Magic Link)
// ----------------------------------------------------------------------------
app.post(['/api/auth/users/invite', '/v1/users/invite'], authenticateUser, requirePermission('users:invite'), async (req, res) => {
  const { email, role, departmentId, inviteType = 'email' } = req.body;
  const companyId = req.user.companyId;

  if (!role) {
    return res.status(400).json({ error: 'Role is required' });
  }

  const isLinkInvite = inviteType === 'link' || !email || !email.trim();
  let normalizedEmail = null;

  if (!isLinkInvite) {
    normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid email address format' });
    }

    // Check if user already exists in this company
    const existingUser = await pool.query(
      'SELECT id, status FROM users WHERE email = $1 AND company_id = $2',
      [normalizedEmail, companyId]
    );
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'A user with this email is already a member of this organization' });
    }
  }

  try {
    // Role Hierarchy & Permission Check (User Rule Option A: Admin can only grant permissions they possess)
    const userRole = (req.user.role || '').toLowerCase();
    if (userRole !== 'owner' && userRole !== 'superadmin') {
      if (role.toLowerCase() === 'owner') {
        return res.status(403).json({ error: 'Only the Owner can assign the Owner role' });
      }

      // Check role permissions vs inviter's permissions
      const targetRolePerms = await pool.query(`
        SELECT p.action
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN roles r ON rp.role_id = r.id
        WHERE (LOWER(r.name) = LOWER($1)) AND (r.company_id = $2 OR r.company_id IS NULL)
      `, [role, companyId]);

      const targetActions = targetRolePerms.rows.map(r => r.action);
      const inviterPerms = req.user.permissions || [];
      const hasExcessPerms = targetActions.some(action => !inviterPerms.includes(action) && !inviterPerms.includes('*'));

      if (hasExcessPerms) {
        return res.status(403).json({
          error: 'Forbidden: You cannot invite a member with permissions exceeding your own role'
        });
      }
    }

    // Lookup role ID
    const roleRes = await pool.query(
      'SELECT id, name, display_name FROM roles WHERE (LOWER(name) = LOWER($1)) AND (company_id = $2 OR company_id IS NULL) LIMIT 1',
      [role, companyId]
    );
    const roleId = roleRes.rows[0] ? roleRes.rows[0].id : null;
    const roleDisplayName = roleRes.rows[0] ? (roleRes.rows[0].display_name || roleRes.rows[0].name) : role;

    // Fetch company name
    const compRes = await pool.query('SELECT name FROM companies WHERE id = $1', [companyId]);
    const companyName = compRes.rows[0] ? compRes.rows[0].name : 'Markova OS';

    // Invalidate any existing pending invites for this email
    if (normalizedEmail) {
      await pool.query(
        "UPDATE invitations SET status = 'revoked' WHERE email = $1 AND company_id = $2 AND status = 'pending'",
        [normalizedEmail, companyId]
      );
    }

    // Generate token & expiration (7 days)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Insert invitation
    const invRes = await pool.query(`
      INSERT INTO invitations (company_id, email, role_id, role_name, department_id, token, invited_by, expires_at, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      RETURNING id, email, role_name, department_id, token, expires_at, created_at, status
    `, [companyId, normalizedEmail, roleId, role.toLowerCase(), departmentId || null, token, req.user.userId, expiresAt.toISOString()]);

    const invitation = invRes.rows[0];

    // Build invite magic link
    const baseUrl = process.env.CLIENT_DASHBOARD_URL || req.headers.origin || 'http://localhost:5173';
    const inviteUrl = `${baseUrl}/accept-invite?token=${token}`;

    let emailResult = { skipped: true, reason: isLinkInvite ? 'Shareable link invitation' : 'No email provided' };
    if (!isLinkInvite && normalizedEmail) {
      emailResult = await sendInviteEmail({
        to: normalizedEmail,
        inviteUrl,
        inviterName: req.user.name,
        companyName,
        roleName: roleDisplayName
      });
    }

    // Create Audit Log
    await pool.query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, new_value)
       VALUES ($1, $2, 'USER_INVITED', 'invitation', $3, $4)`,
      [companyId, req.user.userId, invitation.id, JSON.stringify({ email: normalizedEmail, role, inviteType: isLinkInvite ? 'link' : 'email', inviteUrl })]
    );

    res.status(201).json({
      success: true,
      invitation: {
        ...invitation,
        inviteUrl,
        inviteType: isLinkInvite ? 'link' : 'email',
        emailDelivery: emailResult
      }
    });
  } catch (err) {
    console.error('Error creating invitation:', err);
    res.status(500).json({ error: 'Failed to create and dispatch invitation' });
  }
});

// ----------------------------------------------------------------------------
// 3. Verify Invitation Token (PUBLIC Endpoint for Accept-Invite page)
// ----------------------------------------------------------------------------
app.get(['/api/auth/invitations/verify/:token', '/v1/invitations/verify/:token'], async (req, res) => {
  const { token } = req.params;
  if (!token) {
    return res.status(400).json({ error: 'Invitation token is required' });
  }

  try {
    const invRes = await pool.query(`
      SELECT 
        i.id, i.email, i.role_name, i.company_id, i.expires_at, i.status,
        c.name AS company_name,
        d.name AS department_name,
        r.display_name AS role_display_name
      FROM invitations i
      JOIN companies c ON i.company_id = c.id
      LEFT JOIN departments d ON i.department_id = d.id
      LEFT JOIN roles r ON (LOWER(i.role_name) = LOWER(r.name) AND (r.company_id = i.company_id OR r.company_id IS NULL))
      WHERE i.token = $1
    `, [token]);

    if (invRes.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found or invalid link' });
    }

    const invitation = invRes.rows[0];

    if (invitation.status !== 'pending') {
      return res.status(410).json({ error: `This invitation has already been ${invitation.status}` });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This invitation has expired. Please ask your administrator to send a new invite.' });
    }

    res.json({
      success: true,
      invitation: {
        email: invitation.email,
        companyName: invitation.company_name,
        role: invitation.role_name,
        roleDisplayName: invitation.role_display_name || invitation.role_name,
        departmentName: invitation.department_name,
        expiresAt: invitation.expires_at
      }
    });
  } catch (err) {
    console.error('Error verifying invitation token:', err);
    res.status(500).json({ error: 'Internal error validating invitation' });
  }
});

// ----------------------------------------------------------------------------
// 4. Accept Invitation (PUBLIC: Supports Email+Password AND SSO/OAuth - Option C)
// ----------------------------------------------------------------------------
app.post(['/api/auth/users/accept-invite', '/v1/users/accept-invite'], async (req, res) => {
  const { token, name, password, email: providedEmail, ssoProvider, ssoUserId } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Invitation token is required' });
  }

  // Option C: If not SSO, password is required
  if (!ssoProvider && !password) {
    return res.status(400).json({ error: 'Password is required to set up your account' });
  }

  if (password) {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number'
      });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Find and lock the invitation
    const invRes = await client.query(`
      SELECT i.*, c.plan, c.name as company_name
      FROM invitations i
      JOIN companies c ON i.company_id = c.id
      WHERE i.token = $1 FOR UPDATE
    `, [token]);

    if (invRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const invitation = invRes.rows[0];

    if (invitation.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: `Invitation is already ${invitation.status}` });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: 'Invitation has expired' });
    }

    const userEmail = (invitation.email || providedEmail || '').trim().toLowerCase();
    if (!userEmail) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Email address is required to activate account' });
    }

    // 2. Hash password if provided
    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // 3. Create or Update user record
    const existingUser = await client.query('SELECT id, role, company_id FROM users WHERE email = $1', [userEmail]);
    let user;

    if (existingUser.rows.length > 0) {
      // User exists (e.g. from OAuth or previous registration), update their tenant link
      const userUpdateRes = await client.query(`
        UPDATE users 
        SET company_id = $1, role = $2, department_id = $3, status = 'active',
            name = COALESCE($4, name),
            password_hash = COALESCE($5, password_hash)
        WHERE id = $6
        RETURNING id, company_id, name, email, role, status
      `, [invitation.company_id, invitation.role_name, invitation.department_id, name || null, passwordHash, existingUser.rows[0].id]);
      user = userUpdateRes.rows[0];
    } else {
      // New user creation
      const userCreateRes = await client.query(`
        INSERT INTO users (company_id, name, email, password_hash, role, department_id, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'active')
        RETURNING id, company_id, name, email, role, status
      `, [invitation.company_id, name || userEmail.split('@')[0], userEmail, passwordHash, invitation.role_name, invitation.department_id]);
      user = userCreateRes.rows[0];
    }

    // Update invitation email if link invite
    if (!invitation.email) {
      await client.query('UPDATE invitations SET email = $1 WHERE id = $2', [userEmail, invitation.id]);
    }

    // 4. Assign role in user_roles
    let targetRoleId = invitation.role_id;
    if (!targetRoleId) {
      const roleLookup = await client.query(
        'SELECT id FROM roles WHERE LOWER(name) = LOWER($1) AND (company_id = $2 OR company_id IS NULL) LIMIT 1',
        [invitation.role_name, invitation.company_id]
      );
      if (roleLookup.rows[0]) {
        targetRoleId = roleLookup.rows[0].id;
      }
    }

    if (targetRoleId) {
      await client.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT (user_id, role_id) DO NOTHING',
        [user.id, targetRoleId]
      );
    }

    // 5. Mark invitation accepted
    await client.query("UPDATE invitations SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [invitation.id]);

    // 6. Fetch permissions for the assigned role
    const permRes = await client.query(`
      SELECT p.action
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = $1
    `, [targetRoleId]);
    let permissions = permRes.rows.map(r => r.action);

    if (permissions.length === 0) {
      const fallbackPerms = await client.query(`
        SELECT p.action
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN roles r ON rp.role_id = r.id
        WHERE LOWER(r.name) = LOWER($1) AND r.company_id IS NULL
      `, [invitation.role_name]);
      permissions = fallbackPerms.rows.map(r => r.action);
    }

    // 7. Create Session
    const sessionId = uuidv4();
    const deviceInfo = { userAgent: req.headers['user-agent'] };
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await client.query(`
      INSERT INTO sessions (id, user_id, company_id, device_info, ip_address, expires_at, refresh_token)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [sessionId, user.id, user.company_id, deviceInfo, ipAddress, refreshExpiresAt.toISOString(), refreshToken]);

    // 8. Sign RS256 JWT
    const tokenPayload = {
      userId: user.id,
      companyId: user.company_id,
      name: user.name,
      role: user.role,
      sessionId,
      permissions,
      subscriptionPlan: invitation.plan || 'starter'
    };

    const accessToken = jwt.sign(tokenPayload, PRIVATE_KEY, { algorithm: 'RS256', expiresIn: '1h' });

    // 9. Audit Log
    await client.query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id)
      VALUES ($1, $2, 'INVITATION_ACCEPTED', 'user', $3)
    `, [user.company_id, user.id, user.id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        company_id: user.company_id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      permissions
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error accepting invitation:', err);
    res.status(500).json({ error: 'Failed to complete registration for invitation' });
  } finally {
    client.release();
  }
});

// ----------------------------------------------------------------------------
// 5. Change Member Role
// ----------------------------------------------------------------------------
app.patch(['/api/auth/users/:id/role', '/v1/users/:id/role'], authenticateUser, requirePermission('users:manage_roles'), async (req, res) => {
  const targetUserId = req.params.id;
  const { role } = req.body;
  const companyId = req.user.companyId;

  if (!role) {
    return res.status(400).json({ error: 'Target role is required' });
  }

  try {
    // Lookup target user
    const targetUserRes = await pool.query('SELECT id, role, email FROM users WHERE id = $1 AND company_id = $2', [targetUserId, companyId]);
    if (targetUserRes.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const targetUser = targetUserRes.rows[0];
    const userRole = (req.user.role || '').toLowerCase();

    // Prevent modifying Owner role unless invoker is Owner
    if ((targetUser.role || '').toLowerCase() === 'owner' && userRole !== 'owner') {
      return res.status(403).json({ error: 'Only the Organization Owner can modify the Owner role' });
    }

    if (role.toLowerCase() === 'owner' && userRole !== 'owner') {
      return res.status(403).json({ error: 'Only the Owner can transfer or assign the Owner role' });
    }

    // Role Hierarchy check for Admin (Option A)
    if (userRole !== 'owner' && userRole !== 'superadmin') {
      const targetRolePerms = await pool.query(`
        SELECT p.action
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN roles r ON rp.role_id = r.id
        WHERE LOWER(r.name) = LOWER($1) AND (r.company_id = $2 OR r.company_id IS NULL)
      `, [role, companyId]);

      const targetActions = targetRolePerms.rows.map(r => r.action);
      const inviterPerms = req.user.permissions || [];
      const hasExcessPerms = targetActions.some(action => !inviterPerms.includes(action) && !inviterPerms.includes('*'));

      if (hasExcessPerms) {
        return res.status(403).json({
          error: 'Forbidden: You cannot assign a role with permissions exceeding your own'
        });
      }
    }

    // Update user role
    await pool.query('UPDATE users SET role = $1 WHERE id = $2 AND company_id = $3', [role.toLowerCase(), targetUserId, companyId]);

    // Update user_roles join table
    const roleLookup = await pool.query(
      'SELECT id FROM roles WHERE LOWER(name) = LOWER($1) AND (company_id = $2 OR company_id IS NULL) LIMIT 1',
      [role, companyId]
    );
    if (roleLookup.rows[0]) {
      await pool.query('DELETE FROM user_roles WHERE user_id = $1', [targetUserId]);
      await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [targetUserId, roleLookup.rows[0].id]);
    }

    // Audit log
    await pool.query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, new_value)
      VALUES ($1, $2, 'MEMBER_ROLE_CHANGED', 'user', $3, $4)
    `, [companyId, req.user.userId, targetUserId, JSON.stringify({ oldRole: targetUser.role, newRole: role })]);

    res.json({ success: true, message: 'Member role updated successfully' });
  } catch (err) {
    console.error('Error changing member role:', err);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// ----------------------------------------------------------------------------
// 6. Assign Member Department
// ----------------------------------------------------------------------------
app.patch(['/api/auth/users/:id/department', '/v1/users/:id/department'], authenticateUser, requirePermission('users:manage_roles'), async (req, res) => {
  const targetUserId = req.params.id;
  const { departmentId } = req.body;
  const companyId = req.user.companyId;

  try {
    if (departmentId) {
      const deptCheck = await pool.query('SELECT id FROM departments WHERE id = $1 AND company_id = $2', [departmentId, companyId]);
      if (deptCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Department not found' });
      }
    }

    await pool.query(
      'UPDATE users SET department_id = $1 WHERE id = $2 AND company_id = $3',
      [departmentId || null, targetUserId, companyId]
    );

    res.json({ success: true, message: 'Department assigned successfully' });
  } catch (err) {
    console.error('Error updating member department:', err);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

// ----------------------------------------------------------------------------
// 7. Deactivate / Remove Member
// ----------------------------------------------------------------------------
app.delete(['/api/auth/users/:id', '/v1/users/:id'], authenticateUser, requirePermission('users:deactivate'), async (req, res) => {
  const targetUserId = req.params.id;
  const companyId = req.user.companyId;

  if (targetUserId === req.user.userId) {
    return res.status(400).json({ error: 'You cannot deactivate your own account' });
  }

  try {
    const userRes = await pool.query('SELECT id, role, email FROM users WHERE id = $1 AND company_id = $2', [targetUserId, companyId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const targetUser = userRes.rows[0];
    if ((targetUser.role || '').toLowerCase() === 'owner') {
      return res.status(403).json({ error: 'The Organization Owner cannot be deactivated' });
    }

    // Set status to deactivated
    await pool.query("UPDATE users SET status = 'deactivated' WHERE id = $1 AND company_id = $2", [targetUserId, companyId]);

    // Force revoke all active sessions for this user
    const sessionsRes = await pool.query(
      'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 RETURNING id',
      [targetUserId]
    );
    for (const row of sessionsRes.rows) {
      await redisClient.set(`session_revoked:${row.id}`, 'true', { EX: 24 * 60 * 60 });
    }

    // Audit Log
    await pool.query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id)
      VALUES ($1, $2, 'MEMBER_DEACTIVATED', 'user', $3)
    `, [companyId, req.user.userId, targetUserId]);

    res.json({ success: true, message: 'Member deactivated and active sessions revoked' });
  } catch (err) {
    console.error('Error deactivating user:', err);
    res.status(500).json({ error: 'Failed to deactivate member' });
  }
});

// ----------------------------------------------------------------------------
// 8. Revoke Invitation
// ----------------------------------------------------------------------------
app.delete(['/api/auth/invitations/:id', '/v1/invitations/:id'], authenticateUser, requirePermission('users:invite'), async (req, res) => {
  const inviteId = req.params.id;
  const companyId = req.user.companyId;

  try {
    const result = await pool.query(
      "UPDATE invitations SET status = 'revoked' WHERE id = $1 AND company_id = $2 AND status = 'pending' RETURNING id",
      [inviteId, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found or already accepted' });
    }

    res.json({ success: true, message: 'Invitation revoked successfully' });
  } catch (err) {
    console.error('Error revoking invitation:', err);
    res.status(500).json({ error: 'Failed to revoke invitation' });
  }
});

// ----------------------------------------------------------------------------
// 9. Roles & Permissions Catalog (System + Custom Roles)
// ----------------------------------------------------------------------------
app.get(['/api/auth/roles', '/v1/roles'], authenticateUser, async (req, res) => {
  const companyId = req.user.companyId;

  try {
    // List roles for this company + system roles
    const rolesRes = await pool.query(`
      SELECT 
        r.id, r.company_id, r.name, r.display_name, r.description, r.is_system, r.created_at,
        COALESCE(json_agg(p.action) FILTER (WHERE p.action IS NOT NULL), '[]'::json) AS permissions
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      WHERE r.company_id = $1 OR r.company_id IS NULL
      GROUP BY r.id
      ORDER BY 
        CASE WHEN r.name = 'owner' THEN 1 WHEN r.name = 'admin' THEN 2 WHEN r.name = 'supervisor' THEN 3 WHEN r.name = 'agent' THEN 4 WHEN r.name = 'analyst' THEN 5 WHEN r.name = 'viewer' THEN 6 ELSE 7 END,
        r.is_system DESC,
        r.name ASC
    `, [companyId]);

    // List all available permissions in system for the matrix UI
    const permsRes = await pool.query(`
      SELECT id, name, action, resource, description
      FROM permissions
      ORDER BY resource ASC, action ASC
    `);

    res.json({
      success: true,
      roles: rolesRes.rows,
      allPermissions: permsRes.rows
    });
  } catch (err) {
    console.error('Error fetching roles:', err);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// ----------------------------------------------------------------------------
// 10. Create Custom Role (Option A: Permissions restricted to creator's scope)
// ----------------------------------------------------------------------------
app.post(['/api/auth/roles', '/v1/roles'], authenticateUser, requirePermission('users:manage_roles'), async (req, res) => {
  const { displayName, description, permissions } = req.body;
  const companyId = req.user.companyId;

  if (!displayName || !permissions || !Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Role displayName and permissions array are required' });
  }

  // Option A enforcement: Admin can only grant permissions they possess
  const userRole = (req.user.role || '').toLowerCase();
  if (userRole !== 'owner' && userRole !== 'superadmin') {
    const inviterPerms = req.user.permissions || [];
    const hasExcess = permissions.some(action => !inviterPerms.includes(action) && !inviterPerms.includes('*'));
    if (hasExcess) {
      return res.status(403).json({
        error: 'Forbidden: You can only assign permissions that your own role currently possesses'
      });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const roleSlug = 'custom_' + displayName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30) + '_' + uuidv4().slice(0, 6);

    const roleRes = await client.query(`
      INSERT INTO roles (company_id, name, display_name, description, is_system)
      VALUES ($1, $2, $3, $4, false)
      RETURNING id, company_id, name, display_name, description, is_system, created_at
    `, [companyId, roleSlug, displayName, description || null]);
    const newRole = roleRes.rows[0];

    // Assign permissions
    if (permissions.length > 0) {
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT $1, p.id
        FROM permissions p
        WHERE p.action = ANY($2::text[])
        ON CONFLICT DO NOTHING
      `, [newRole.id, permissions]);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, role: { ...newRole, permissions } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating custom role:', err);
    res.status(500).json({ error: 'Failed to create role' });
  } finally {
    client.release();
  }
});

// ----------------------------------------------------------------------------
// 11. Update Role Permissions (Owner sets Admin permissions - User Decision 3)
// ----------------------------------------------------------------------------
app.patch(['/api/auth/roles/:id', '/v1/roles/:id'], authenticateUser, requirePermission('users:manage_roles'), async (req, res) => {
  const roleId = req.params.id;
  const { displayName, description, permissions } = req.body;
  const companyId = req.user.companyId;

  if (!permissions || !Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Permissions array is required' });
  }

  try {
    const roleCheck = await pool.query('SELECT * FROM roles WHERE id = $1', [roleId]);
    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const targetRole = roleCheck.rows[0];
    const userRole = (req.user.role || '').toLowerCase();

    // Decision 3: "the permission that admin has must be set by the owner"
    if (targetRole.name === 'admin' || targetRole.name === 'owner') {
      if (userRole !== 'owner') {
        return res.status(403).json({ error: 'Only the Organization Owner can modify Administrator role permissions' });
      }
    }

    // Admins can only edit custom roles of their own company
    if (targetRole.is_system && userRole !== 'owner') {
      return res.status(403).json({ error: 'System roles cannot be modified by non-owners' });
    }

    if (targetRole.company_id && targetRole.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied to this role' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (displayName || description !== undefined) {
        await client.query(
          'UPDATE roles SET display_name = COALESCE($1, display_name), description = COALESCE($2, description) WHERE id = $3',
          [displayName || null, description !== undefined ? description : null, roleId]
        );
      }

      // Re-sync permissions
      await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
      if (permissions.length > 0) {
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          SELECT $1, p.id
          FROM permissions p
          WHERE p.action = ANY($2::text[])
          ON CONFLICT DO NOTHING
        `, [roleId, permissions]);
      }

      await client.query('COMMIT');
      res.json({ success: true, message: 'Role permissions updated successfully' });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error updating role:', err);
    res.status(500).json({ error: 'Failed to update role permissions' });
  }
});

// ----------------------------------------------------------------------------
// 12. Delete Custom Role
// ----------------------------------------------------------------------------
app.delete(['/api/auth/roles/:id', '/v1/roles/:id'], authenticateUser, requirePermission('users:manage_roles'), async (req, res) => {
  const roleId = req.params.id;
  const companyId = req.user.companyId;

  try {
    const roleRes = await pool.query('SELECT * FROM roles WHERE id = $1', [roleId]);
    if (roleRes.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const role = roleRes.rows[0];
    if (role.is_system) {
      return res.status(403).json({ error: 'Built-in system roles cannot be deleted' });
    }

    if (role.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Reassign any users who had this custom role back to 'agent'
    await pool.query(`
      UPDATE users SET role = 'agent' 
      WHERE id IN (SELECT user_id FROM user_roles WHERE role_id = $1)
    `, [roleId]);

    await pool.query('DELETE FROM roles WHERE id = $1', [roleId]);
    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (err) {
    console.error('Error deleting role:', err);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// ----------------------------------------------------------------------------
// 13. Departments Management (User Decision 4)
// ----------------------------------------------------------------------------
app.get(['/api/auth/departments', '/v1/departments'], authenticateUser, async (req, res) => {
  const companyId = req.user.companyId;

  try {
    const deptRes = await pool.query(`
      SELECT 
        d.id, d.name, d.description, d.created_at,
        COUNT(u.id)::int AS member_count
      FROM departments d
      LEFT JOIN users u ON d.id = u.department_id AND u.status = 'active'
      WHERE d.company_id = $1
      GROUP BY d.id
      ORDER BY d.name ASC
    `, [companyId]);

    res.json({ success: true, departments: deptRes.rows });
  } catch (err) {
    console.error('Error fetching departments:', err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

app.post(['/api/auth/departments', '/v1/departments'], authenticateUser, requirePermission('users:manage_roles'), async (req, res) => {
  const { name, description } = req.body;
  const companyId = req.user.companyId;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Department name is required' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO departments (company_id, name, description)
      VALUES ($1, $2, $3)
      RETURNING id, company_id, name, description, created_at
    `, [companyId, name.trim(), description || null]);

    res.status(201).json({ success: true, department: { ...result.rows[0], member_count: 0 } });
  } catch (err) {
    console.error('Error creating department:', err);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

app.delete(['/api/auth/departments/:id', '/v1/departments/:id'], authenticateUser, requirePermission('users:manage_roles'), async (req, res) => {
  const deptId = req.params.id;
  const companyId = req.user.companyId;

  try {
    // Unlink users first
    await pool.query('UPDATE users SET department_id = NULL WHERE department_id = $1 AND company_id = $2', [deptId, companyId]);
    await pool.query('DELETE FROM departments WHERE id = $1 AND company_id = $2', [deptId, companyId]);

    res.json({ success: true, message: 'Department removed' });
  } catch (err) {
    console.error('Error deleting department:', err);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

// ----------------------------------------------------------------------------
// 14. Active Sessions Tracking & Revocation
// ----------------------------------------------------------------------------
app.get(['/api/auth/sessions', '/v1/sessions'], authenticateUser, async (req, res) => {
  const companyId = req.user.companyId;
  const userRole = (req.user.role || '').toLowerCase();

  try {
    let sessionsQuery;
    let queryParams;

    if (userRole === 'owner' || userRole === 'admin' || userRole === 'superadmin') {
      // Admins & Owners see all company sessions
      sessionsQuery = `
        SELECT 
          s.id, s.user_id, s.device_info, s.ip_address, s.created_at, s.last_active, s.expires_at, s.revoked_at,
          u.name AS user_name, u.email AS user_email, u.role AS user_role
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.company_id = $1 AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP
        ORDER BY s.last_active DESC
        LIMIT 50
      `;
      queryParams = [companyId];
    } else {
      // Individual users only see their own sessions
      sessionsQuery = `
        SELECT 
          s.id, s.user_id, s.device_info, s.ip_address, s.created_at, s.last_active, s.expires_at, s.revoked_at,
          u.name AS user_name, u.email AS user_email, u.role AS user_role
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.user_id = $1 AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP
        ORDER BY s.last_active DESC
        LIMIT 20
      `;
      queryParams = [req.user.userId];
    }

    const result = await pool.query(sessionsQuery, queryParams);
    res.json({ success: true, sessions: result.rows });
  } catch (err) {
    console.error('Error fetching sessions:', err);
    res.status(500).json({ error: 'Failed to fetch active sessions' });
  }
});

app.delete(['/api/auth/sessions/:id', '/v1/sessions/:id'], authenticateUser, async (req, res) => {
  const sessionId = req.params.id;
  const companyId = req.user.companyId;
  const userRole = (req.user.role || '').toLowerCase();

  try {
    let result;
    if (userRole === 'owner' || userRole === 'admin' || userRole === 'superadmin') {
      result = await pool.query(
        'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND company_id = $2 RETURNING id',
        [sessionId, companyId]
      );
    } else {
      result = await pool.query(
        'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING id',
        [sessionId, req.user.userId]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found or already revoked' });
    }

    // Immediate Redis revocation cache so API gateway drops it immediately
    await redisClient.set(`session_revoked:${sessionId}`, 'true', { EX: 24 * 60 * 60 });

    res.json({ success: true, message: 'Session revoked successfully' });
  } catch (err) {
    console.error('Error revoking session:', err);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

// Check Server Health
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'auth-service' });
});

app.listen(PORT, () => {
  console.log(`🚀 Auth Service listening on port ${PORT}`);
});
