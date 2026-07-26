const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { createClient } = require('redis');
const crypto = require('crypto');
const TenantGuard = require('../../kernel/identity/tenant-guard');
const TenantDb = require('../../kernel/identity/tenant-db');
const serviceAuth = require('../../kernel/identity/service-auth');
const requestLogger = require('../../kernel/identity/request-logger');
require('dotenv').config();

const app = express();
app.use(requestLogger);
const PORT = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());

// Postgres Connection Pool with retries
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Redis client setup
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

async function initializeServices() {
  // 1. Connect Postgres
  let dbConnected = false;
  for (let i = 0; i < 10; i++) {
    try {
      const client = await pool.connect();
      client.release();
      dbConnected = true;
      console.log('✅ Tenant Service connected to PostgreSQL');
      break;
    } catch (err) {
      console.log(`⚠️ Database connection attempt ${i + 1} failed. Retrying in 3000ms...`);
      await new Promise(res => setTimeout(res, 3000));
    }
  }
  if (!dbConnected) {
    console.error('❌ Tenant Database connection failed');
    process.exit(1);
  }

  // 2. Connect Redis
  let redisConnected = false;
  for (let i = 0; i < 10; i++) {
    try {
      await redisClient.connect();
      redisConnected = true;
      console.log('✅ Tenant Service connected to Redis');
      break;
    } catch (err) {
      console.log(`⚠️ Redis connection attempt ${i + 1} failed. Retrying in 3000ms...`);
      await new Promise(res => setTimeout(res, 3000));
    }
  }
  if (!redisConnected) {
    console.error('❌ Tenant Redis connection failed');
    process.exit(1);
  }
}

initializeServices();

const tenantDb = new TenantDb(pool);
const internalGuard = serviceAuth.guard.bind(serviceAuth);

// The /verify endpoint is called by API Gateway internally
app.post('/api/tenant/keys/verify', internalGuard, async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'API Key is required' });

  try {
    const keyHash = hashApiKey(apiKey);
    const result = await pool.query(
      `SELECT t.company_id, t.environment, c.name as company_name, c.plan
       FROM tenant_api_keys t
       JOIN companies c ON t.company_id = c.id
       WHERE t.key_hash = $1 AND t.status = 'active'`,
      [keyHash]
    );

    if (result.rows.length === 0) {
      return res.json({ valid: false });
    }

    const row = result.rows[0];
    res.json({
      valid: true,
      companyId: row.company_id,
      companyName: row.company_name,
      plan: row.plan,
      environment: row.environment || (apiKey.startsWith('mk_live_') ? 'live' : 'test'),
    });
  } catch (error) {
    console.error('Verify API Key Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Helper: hash key
function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function getPublicPricing() {
  return {
    currency: 'ETB',
    unit: 'per_minute',
    sandbox: {
      name: 'Sandbox',
      price_etb_per_minute: 0,
      card_required: false,
      notes: 'mk_test_ keys — no real telephony spend, no card required.',
    },
    tiers: [
      {
        id: 'basic',
        name: 'Basic',
        price_etb_per_minute_inbound: 2.5,
        price_etb_per_minute_outbound: null,
        outbound_minutes_included: 30,
        concurrent_agents: 1,
        workflow_execution: false,
        support: 'standard',
        summary: 'Inbound voice agent answers & transcribes; intended actions shown on dashboard only.',
      },
      {
        id: 'pro',
        name: 'Pro',
        price_etb_per_minute_inbound: 2.0,
        price_etb_per_minute_outbound: 2.0,
        outbound_minutes_included: 300,
        concurrent_agents: 3,
        workflow_execution: true,
        support: 'priority',
        summary: 'Inbound + outbound; workflow actions execute on your connected system.',
      },
      {
        id: 'plus',
        name: 'Plus',
        price_etb_per_minute_inbound: 3.0,
        price_etb_per_minute_outbound: 3.0,
        outbound_minutes_included: 1000,
        concurrent_agents: 10,
        workflow_execution: true,
        priority_queue: true,
        support: 'dedicated',
        summary: 'Premium rate, higher concurrency, priority execution queue.',
      },
    ],
    add_ons: [
      {
        id: 'outbound_pack_100',
        name: 'Outbound minute pack (100)',
        price_etb: 200,
        notes: 'Available on Basic without upgrading to Pro.',
      },
    ],
    overage: 'auto_bill',
    annual_discount_percent: 15,
  };
}

function extractBillingSignature(headerValue) {
  const raw = String(headerValue || '');
  if (!raw) return null;
  if (raw.startsWith('sha256=')) return raw.slice('sha256='.length);
  const v1 = raw.split(',').map((p) => p.trim()).find((p) => p.startsWith('v1='));
  if (v1) return v1.slice(3);
  return raw;
}

// Public routes (must be registered before TenantGuard)
app.get('/api/tenant/pricing', (_req, res) => {
  res.json(getPublicPricing());
});

app.post('/api/tenant/billing/webhooks/:provider', async (req, res) => {
  const provider = req.params.provider;
  const secret = process.env.BILLING_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'BILLING_WEBHOOK_SECRET not configured' });
  }
  const signatureHeader = req.headers['x-billing-signature'] || req.headers['stripe-signature'];
  if (!signatureHeader) {
    return res.status(401).json({ error: 'Missing webhook signature' });
  }

  const bodyString = JSON.stringify(req.body || {});
  const expected = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
  const provided = extractBillingSignature(signatureHeader);
  if (!provided || provided.length !== expected.length) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }
  try {
    const ok = crypto.timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'));
    if (!ok) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  } catch {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const eventType = req.body?.type || req.body?.event || 'unknown';
  const companyId = req.body?.company_id || req.body?.data?.company_id;
  const amount = Number(req.body?.amount_etb ?? req.body?.amount ?? req.body?.data?.amount_etb ?? 0);
  const description = req.body?.description || `${provider} ${eventType}`;

  if (companyId && (eventType === 'invoice.paid' || eventType === 'invoice.created')) {
    try {
      const ctx = { tenantId: companyId, isServiceAccount: true };
      await tenantDb.query(
        ctx,
        `INSERT INTO billing_line_items (company_id, description, amount_usd, type, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          companyId,
          description,
          amount,
          eventType === 'invoice.paid' ? 'invoice' : 'pending_invoice',
          eventType === 'invoice.paid' ? 'paid' : 'open',
        ]
      );
    } catch (err) {
      console.error('Billing webhook persist error:', err.message);
      return res.status(500).json({ error: 'Failed to persist billing event' });
    }
  }

  res.json({ received: true, provider, type: eventType, verified: true });
});

// Protect tenant + CRM routes with TenantGuard (CRM leads was previously unauthenticated)
app.use('/api/tenant', TenantGuard);
app.use('/api/crm', TenantGuard);

// Get Company Info/Limits
app.get('/api/tenant/company', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const result = await tenantDb.query(ctx, 
      'SELECT id, name, plan, status, max_agents, created_at FROM companies WHERE id = $1',
      [ctx.tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get Company Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update Company Info/Limits
app.put('/api/tenant/company', async (req, res) => {
  const { name, plan, max_agents } = req.body;

  try {
    const ctx = req.securityContext;
    const result = await tenantDb.query(ctx, 
      `UPDATE companies 
       SET name = COALESCE($1, name), plan = COALESCE($2, plan), max_agents = COALESCE($3, max_agents), updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 
       RETURNING id, name, plan, status, max_agents`,
      [name, plan, max_agents, ctx.tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update Company Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get Company API Keys
app.get('/api/tenant/keys', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const result = await tenantDb.query(ctx, 
      'SELECT id, name, key_prefix, environment, status, created_at FROM tenant_api_keys WHERE company_id = $1 ORDER BY created_at DESC',
      [ctx.tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get API Keys Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create Company API Key
// environment: "test" (default, mk_test_*) | "live" (mk_live_*)
app.post('/api/tenant/keys', async (req, res) => {
  const { name, environment = 'test' } = req.body;
  if (!name) return res.status(400).json({ error: 'Key name is required' });
  if (environment !== 'test' && environment !== 'live') {
    return res.status(400).json({ error: 'environment must be "test" or "live"' });
  }

  try {
    const ctx = req.securityContext;
    const rawToken = `mk_${environment}_` + crypto.randomBytes(16).toString('hex');
    const keyPrefix = rawToken.slice(0, 12);
    const keyHash = hashApiKey(rawToken);

    const result = await tenantDb.query(ctx, 
      `INSERT INTO tenant_api_keys (company_id, name, key_hash, key_prefix, environment, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING id, name, key_prefix, environment, status, created_at`,
      [ctx.tenantId, name, keyHash, keyPrefix, environment]
    );

    // Full key returned ONLY ONCE at creation
    res.status(201).json({
      ...result.rows[0],
      api_key: rawToken
    });
  } catch (error) {
    console.error('Create API Key Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete API Key
app.delete('/api/tenant/keys/:id', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const result = await tenantDb.query(ctx,
      `DELETE FROM tenant_api_keys WHERE id = $1 AND company_id = $2 RETURNING id`,
      [req.params.id, ctx.tenantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Delete API Key Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



// Get Company Usage Metrics (Phase 3 — sum of ledger events)
app.get('/api/tenant/usage', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const companyId = ctx.tenantId;
    const cacheKey = `company:${companyId}:usage`;

    const dbResult = await tenantDb.query(ctx,
      `SELECT
         COALESCE(SUM(call_minutes), 0)::int AS call_minutes,
         COALESCE(SUM(stt_seconds), 0)::int AS stt_seconds,
         COALESCE(SUM(tts_characters), 0)::int AS tts_characters,
         COALESCE(SUM(llm_tokens), 0)::bigint AS llm_tokens,
         COUNT(*)::int AS event_count
       FROM usage_metrics
       WHERE company_id = $1`,
      [companyId]
    );

    const metrics = dbResult.rows[0] || {
      call_minutes: 0,
      stt_seconds: 0,
      tts_characters: 0,
      llm_tokens: 0,
      event_count: 0,
    };

    await redisClient.hSet(cacheKey, {
      call_minutes: String(metrics.call_minutes),
      stt_seconds: String(metrics.stt_seconds),
      tts_characters: String(metrics.tts_characters),
      llm_tokens: String(metrics.llm_tokens),
    });
    await redisClient.expire(cacheKey, 300);

    res.json({
      company_id: companyId,
      period: 'current',
      call_minutes: Number(metrics.call_minutes),
      stt_seconds: Number(metrics.stt_seconds),
      tts_characters: Number(metrics.tts_characters),
      llm_tokens: Number(metrics.llm_tokens),
      event_count: Number(metrics.event_count),
    });
  } catch (error) {
    console.error('Get Usage Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Increment Usage (Called by internal services)
// ledgerWritten=true: orchestrator already INSERTed the event — only refresh Redis
app.post('/api/tenant/usage/increment', internalGuard, async (req, res) => {
  const {
    companyId,
    callMinutes,
    sttSeconds,
    ttsCharacters,
    llmTokens,
    ledgerWritten,
  } = req.body;

  if (!companyId) return res.status(400).json({ error: 'Company ID is required' });

  try {
    const ctx = { tenantId: companyId, isServiceAccount: true };
    if (!ledgerWritten) {
      await tenantDb.query(
        ctx,
        `INSERT INTO usage_metrics (company_id, call_minutes, stt_seconds, tts_characters, llm_tokens)
         VALUES ($1, $2, $3, $4, $5)`,
        [companyId, callMinutes || 0, sttSeconds || 0, ttsCharacters || 0, llmTokens || 0]
      );
    }

    const cacheKey = `company:${companyId}:usage`;
    await redisClient.del(cacheKey);

    res.json({ success: true });
  } catch (error) {
    console.error('Increment Usage Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Capture CRM Leads (From Amharic Demo / Voiceflow)
app.post('/api/contact', async (req, res) => {
  const { firstName, lastName, email, phone, company, whoYouAre, service, message } = req.body;
  // Use a default company ID for demo purposes if not provided
  const companyId = req.headers['x-company-id'] || '00000000-0000-0000-0000-000000000000';
  const ctx = { tenantId: companyId, isServiceAccount: true }; // Service account for public endpoint

  try {
    // If the default demo company doesn't exist, we might get a foreign key error.
    // For a robust system, we should either ensure the company exists, or allow nulls.
    // But since schema says company_id REFERENCES companies, we need to handle it.
    // Let's do a simple insert, assuming companyId is valid or letting it fail gracefully.
    
    // As a workaround for the demo, let's look up any existing company to attach the lead to
    const companyResult = await tenantDb.query(ctx, 'SELECT id FROM companies LIMIT 1');
    const actualCompanyId = companyResult.rows.length > 0 ? companyResult.rows[0].id : null;

    if (!actualCompanyId) {
      return res.status(400).json({ success: false, message: 'No companies found to attach lead to.' });
    }

    const result = await tenantDb.query(
      ctx,
      `INSERT INTO crm_leads (company_id, first_name, last_name, email, phone, company, role, service_interest, message, source, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [actualCompanyId, firstName, lastName, email, phone, company, whoYouAre, service, message, 'voiceflow_amharic', 'new']
    );

    res.json({ success: true, message: 'Lead captured successfully', id: result.rows[0].id });
  } catch (error) {
    console.error('CRM Lead Capture Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Get Dashboard Stats for Command Center
app.get('/api/tenant/stats', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const companyId = ctx.tenantId;
    
    const activeCalls = await tenantDb.query(ctx, "SELECT COUNT(*) FROM calls WHERE company_id = $1 AND status = 'active'", [companyId]);
    const activeAgents = await tenantDb.query(ctx, "SELECT COUNT(*) FROM agents WHERE company_id = $1", [companyId]);
    const newLeads = await tenantDb.query(ctx, "SELECT COUNT(*) FROM crm_leads WHERE company_id = $1 AND created_at >= CURRENT_DATE", [companyId]);
    const appointments = await tenantDb.query(ctx, "SELECT COUNT(*) FROM crm_appointments WHERE company_id = $1 AND created_at >= CURRENT_DATE", [companyId]);
    const activeTeams = await tenantDb.query(ctx, "SELECT COUNT(*) FROM teams WHERE company_id = $1", [companyId]);

    res.json({
      activeCalls: parseInt(activeCalls.rows[0].count),
      activeAgents: parseInt(activeAgents.rows[0].count),
      activeTeams: parseInt(activeTeams.rows[0].count),
      newLeads: parseInt(newLeads.rows[0].count),
      appointmentsBooked: parseInt(appointments.rows[0].count)
    });
  } catch (error) {
    console.error('Get Stats Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get CRM Leads
app.get('/api/crm/leads', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const result = await tenantDb.query(ctx, 
      `SELECT id, first_name, last_name, email, phone, company, role, service_interest, status, source, created_at 
       FROM crm_leads 
       WHERE company_id = $1 
       ORDER BY created_at DESC`,
      [ctx.tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get CRM Leads Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ==============================================
// Organization Hierarchy (Departments)
// ==============================================

// Create a department
app.post('/api/tenant/departments', async (req, res) => {
  const { name, parent_department_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Department name is required' });

  try {
    const ctx = req.securityContext;
    const result = await tenantDb.query(ctx, 
      `INSERT INTO departments (company_id, name, parent_department_id) 
       VALUES ($1, $2, $3) RETURNING *`,
      [ctx.tenantId, name, parent_department_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create Department Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get all departments
app.get('/api/tenant/departments', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const result = await tenantDb.query(ctx, 'SELECT * FROM departments WHERE company_id = $1', [ctx.tenantId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Get Departments Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get Organization Tree
app.get('/api/tenant/org-tree', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const companyId = ctx.tenantId;
    
    const depts = await tenantDb.query(ctx, 'SELECT id, name, parent_department_id FROM departments WHERE company_id = $1', [companyId]);
    const users = await tenantDb.query(ctx, 'SELECT id, name, role, department_id FROM users WHERE company_id = $1', [companyId]);
    const agents = await tenantDb.query(ctx, 'SELECT id, name, department_id FROM agents WHERE company_id = $1', [companyId]);

    // Build the tree
    const deptMap = {};
    const rootDepts = [];

    // Initialize map
    depts.rows.forEach(d => {
      deptMap[d.id] = { ...d, children: [], users: [], agents: [] };
    });

    // Populate users & agents
    users.rows.forEach(u => {
      if (u.department_id && deptMap[u.department_id]) {
        deptMap[u.department_id].users.push(u);
      }
    });

    agents.rows.forEach(a => {
      if (a.department_id && deptMap[a.department_id]) {
        deptMap[a.department_id].agents.push(a);
      }
    });

    // Link parents & children
    depts.rows.forEach(d => {
      if (d.parent_department_id && deptMap[d.parent_department_id]) {
        deptMap[d.parent_department_id].children.push(deptMap[d.id]);
      } else {
        rootDepts.push(deptMap[d.id]);
      }
    });

    // Also include unassigned users/agents at the root
    const unassignedUsers = users.rows.filter(u => !u.department_id);
    const unassignedAgents = agents.rows.filter(a => !a.department_id);

    res.json({
      departments: rootDepts,
      unassigned: {
        users: unassignedUsers,
        agents: unassignedAgents
      }
    });
  } catch (error) {
    console.error('Get Org Tree Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Phone numbers (Phase 2) ──────────────────────────────────────────────────

app.post('/api/tenant/numbers/search', async (req, res) => {
  const { country = 'ET', area_code, contains } = req.body || {};
  const env = req.headers['x-markova-env'] || 'test';
  // Sandbox returns deterministic fake inventory; live would call Twilio (not wired yet)
  const samples = [
    { phone_number: `+251911${String(Math.floor(100000 + Math.random() * 899999))}`, capabilities: ['voice'], monthly_cost_etb: 0 },
    { phone_number: `+251912${String(Math.floor(100000 + Math.random() * 899999))}`, capabilities: ['voice'], monthly_cost_etb: 0 },
  ].filter((n) => !contains || n.phone_number.includes(contains));
  res.json({ environment: env, country, area_code: area_code || null, results: samples });
});

app.get('/api/tenant/numbers', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const result = await tenantDb.query(ctx,
      `SELECT id, phone_number, provider, agent_id, status, settings, created_at
       FROM phone_numbers WHERE company_id = $1 ORDER BY created_at DESC`,
      [ctx.tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List numbers error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/tenant/numbers', async (req, res) => {
  const { phone_number, provider = 'twilio', agent_id, settings } = req.body || {};
  if (!phone_number) return res.status(400).json({ error: 'phone_number is required' });
  try {
    const ctx = req.securityContext;
    const env = req.headers['x-markova-env'] || 'test';
    const defaults = {
      recording_enabled: true,
      ivr_enabled: false,
      ivr_menu: null,
      voicemail_email: null,
      transfer_number: null,
    };
    const mergedSettings = { ...defaults, ...(settings || {}) };
    const result = await tenantDb.query(ctx,
      `INSERT INTO phone_numbers (company_id, phone_number, provider, agent_id, status, settings)
       VALUES ($1, $2, $3, $4, 'active', $5::jsonb)
       RETURNING id, phone_number, provider, agent_id, status, settings, created_at`,
      [ctx.tenantId, phone_number, env === 'test' ? 'sandbox' : provider, agent_id || null, JSON.stringify(mergedSettings)]
    );
    res.status(201).json({ ...result.rows[0], environment: env });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'phone_number already provisioned' });
    console.error('Create number error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/tenant/numbers/:id', async (req, res) => {
  const { agent_id, status, settings } = req.body || {};
  try {
    const ctx = req.securityContext;
    const result = await tenantDb.query(ctx,
      `UPDATE phone_numbers
       SET agent_id = COALESCE($1, agent_id),
           status = COALESCE($2, status),
           settings = CASE WHEN $3::jsonb IS NULL THEN settings ELSE settings || $3::jsonb END
       WHERE id = $4 AND company_id = $5
       RETURNING id, phone_number, provider, agent_id, status, settings, created_at`,
      [agent_id ?? null, status ?? null, settings ? JSON.stringify(settings) : null, req.params.id, ctx.tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Number not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update number error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/tenant/numbers/:id', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const result = await tenantDb.query(ctx,
      `DELETE FROM phone_numbers WHERE id = $1 AND company_id = $2 RETURNING id`,
      [req.params.id, ctx.tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Number not found' });
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Delete number error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Routing rules (Phase 4) ──────────────────────────────────────────────────

async function assertNumberOwned(ctx, numberId) {
  const result = await tenantDb.query(ctx,
    `SELECT id FROM phone_numbers WHERE id = $1 AND company_id = $2`,
    [numberId, ctx.tenantId]
  );
  return result.rows[0] || null;
}

app.get('/api/tenant/numbers/:id/routing-rules', async (req, res) => {
  try {
    const ctx = req.securityContext;
    if (!(await assertNumberOwned(ctx, req.params.id))) {
      return res.status(404).json({ error: 'Number not found' });
    }
    const result = await tenantDb.query(ctx,
      `SELECT id, phone_number_id, rules, created_at
       FROM routing_rules WHERE phone_number_id = $1 AND company_id = $2
       ORDER BY created_at ASC`,
      [req.params.id, ctx.tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List routing rules error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/tenant/numbers/:id/routing-rules', async (req, res) => {
  const rules = req.body?.rules ?? req.body;
  if (!Array.isArray(rules)) {
    return res.status(400).json({ error: 'rules must be an array of routing rule objects' });
  }
  try {
    const ctx = req.securityContext;
    if (!(await assertNumberOwned(ctx, req.params.id))) {
      return res.status(404).json({ error: 'Number not found' });
    }
    const result = await tenantDb.query(ctx,
      `INSERT INTO routing_rules (company_id, phone_number_id, rules)
       VALUES ($1, $2, $3::jsonb)
       RETURNING id, phone_number_id, rules, created_at`,
      [ctx.tenantId, req.params.id, JSON.stringify(rules)]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create routing rules error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/tenant/numbers/:id/routing-rules/:ruleId', async (req, res) => {
  const rules = req.body?.rules ?? req.body;
  if (!Array.isArray(rules)) {
    return res.status(400).json({ error: 'rules must be an array of routing rule objects' });
  }
  try {
    const ctx = req.securityContext;
    const result = await tenantDb.query(ctx,
      `UPDATE routing_rules SET rules = $1::jsonb
       WHERE id = $2 AND phone_number_id = $3 AND company_id = $4
       RETURNING id, phone_number_id, rules, created_at`,
      [JSON.stringify(rules), req.params.ruleId, req.params.id, ctx.tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Routing rule set not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update routing rules error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/tenant/numbers/:id/routing-rules/:ruleId', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const result = await tenantDb.query(ctx,
      `DELETE FROM routing_rules
       WHERE id = $1 AND phone_number_id = $2 AND company_id = $3
       RETURNING id`,
      [req.params.ruleId, req.params.id, ctx.tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Routing rule set not found' });
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Delete routing rules error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Workflow confidence thresholds (Pro/Plus)
app.get('/api/tenant/workflow-settings', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const result = await tenantDb.query(ctx,
      `SELECT plan, workflow_settings FROM companies WHERE id = $1`,
      [ctx.tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Company not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get workflow settings error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/tenant/workflow-settings', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const patch = req.body?.workflow_settings || req.body;
    if (!patch || typeof patch !== 'object') {
      return res.status(400).json({ error: 'workflow_settings object required' });
    }
    const result = await tenantDb.query(ctx,
      `UPDATE companies
       SET workflow_settings = COALESCE(workflow_settings, '{}'::jsonb) || $1::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING plan, workflow_settings`,
      [JSON.stringify(patch), ctx.tenantId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update workflow settings error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Usage history — recent ledger events (current totals: GET /api/tenant/usage)
app.get('/api/tenant/usage/history', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const result = await tenantDb.query(ctx,
      `SELECT id, call_minutes, stt_seconds, tts_characters, llm_tokens, created_at
       FROM usage_metrics
       WHERE company_id = $1
         AND (call_minutes > 0 OR stt_seconds > 0 OR tts_characters > 0 OR llm_tokens > 0)
       ORDER BY created_at DESC
       LIMIT $2`,
      [ctx.tenantId, limit]
    );
    res.json({
      company_id: ctx.tenantId,
      items: result.rows,
    });
  } catch (error) {
    console.error('Usage history error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Billing invoices
app.get('/api/tenant/billing/invoices', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const result = await tenantDb.query(ctx,
      `SELECT id, description, amount_usd, type, status, created_at
       FROM billing_line_items WHERE company_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [ctx.tenantId]
    );
    res.json({
      currency: 'ETB',
      invoices: (result.rows || []).map((r) => ({
        id: r.id,
        description: r.description,
        amount_usd: r.amount_usd,
        amount_etb: r.amount_usd, // column historically named amount_usd; values are ETB in Phase 3
        type: r.type,
        status: r.status,
        created_at: r.created_at,
      })),
    });
  } catch (error) {
    console.error('Billing invoices error:', error);
    res.json({ currency: 'ETB', invoices: [] });
  }
});

// ── Onboarding conversational layers (Phase 2 / Section 5) ───────────────────

app.post('/api/tenant/onboarding/integration/chat', async (req, res) => {
  const { message = '', system_type } = req.body || {};
  const ctx = req.securityContext;
  const lower = String(message).toLowerCase();
  let reply;
  let suggested_calls = [];

  if (!system_type && !lower.includes('crm') && !lower.includes('erp')) {
    reply = 'What system are you connecting? (e.g. CRM, ERP, booking, ticketing). Reply with the type and I will generate the sandbox API steps.';
  } else {
    const kind = system_type || (lower.includes('erp') ? 'erp' : 'crm');
    reply = `For a ${kind} integration in sandbox: (1) create a mk_test_ key, (2) create an agent, (3) provision a sandbox number, (4) place a test-call. No live telephony spend.`;
    suggested_calls = [
      { method: 'POST', path: '/v1/keys', body: { name: `${kind}-sandbox`, environment: 'test' } },
      { method: 'POST', path: '/v1/agents', body: { name: `${kind} Agent`, prompt: 'You are a helpful Amharic-capable voice agent.', voice_config: { provider: 'edge', voice_id: 'am-ET-MekdesNeural' }, model_config: { provider: 'groq', model_id: 'llama-3.3-70b-versatile' }, language: 'am' } },
      { method: 'POST', path: '/v1/numbers/search', body: { country: 'ET' } },
    ];
  }

  res.json({
    role: 'integration_agent',
    tenant_id: ctx.tenantId,
    reply,
    suggested_calls,
  });
});

app.post('/api/tenant/onboarding/training/chat', async (req, res) => {
  const { message = '', step } = req.body || {};
  const ctx = req.securityContext;
  const lower = String(message).toLowerCase();
  let reply;
  let suggested_calls = [];

  if (step === 'consent' || lower.includes('consent') || lower.includes('agree')) {
    reply = 'Confirmed: your knowledge is used only to configure your own agent. Shared model improvement is not offered in this version. Next, upload product FAQs or policies.';
    suggested_calls = [
      { method: 'POST', path: '/v1/knowledge/sources', body: { name: 'Company Knowledge', type: 'upload' } },
    ];
  } else if (lower.includes('faq') || lower.includes('upload') || step === 'upload') {
    reply = 'Create a knowledge source, then POST a document to /v1/knowledge/sources/{id}/documents. Isolation is tenant-scoped — other companies cannot see your content.';
    suggested_calls = [
      { method: 'POST', path: '/v1/knowledge/sources', body: { name: 'FAQs', type: 'upload' } },
      { method: 'POST', path: '/v1/knowledge/search', body: { query: 'opening hours' } },
    ];
  } else {
    reply = 'I am the Training Agent. I will collect product info, policies, FAQs, and tone — used only for your agent. Type "consent" to acknowledge, or "upload" to start adding knowledge.';
  }

  res.json({
    role: 'training_agent',
    tenant_id: ctx.tenantId,
    reply,
    suggested_calls,
    consent: {
      data_use: 'configure_own_agent_only',
      shared_model_improvement: false,
    },
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'tenant-service' });
});

app.listen(PORT, () => {
  console.log(`🚀 Tenant Service listening on port ${PORT}`);
});
