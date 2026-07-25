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
      `SELECT t.company_id, c.name as company_name, c.plan
       FROM tenant_api_keys t
       JOIN companies c ON t.company_id = c.id
       WHERE t.key_hash = $1 AND t.status = 'active'`,
      [keyHash]
    );

    if (result.rows.length === 0) {
      return res.json({ valid: false });
    }

    res.json({
      valid: true,
      companyId: result.rows[0].company_id,
      companyName: result.rows[0].company_name,
      plan: result.rows[0].plan
    });
  } catch (error) {
    console.error('Verify API Key Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Protect all other tenant routes with TenantGuard
app.use('/api/tenant', TenantGuard);


// Helper: hash key
function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

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
      'SELECT id, name, key_prefix, status, created_at FROM tenant_api_keys WHERE company_id = $1',
      [ctx.tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get API Keys Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create Company API Key
app.post('/api/tenant/keys', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Key name is required' });

  try {
    const ctx = req.securityContext;
    // Generate actual token: mk_live_[32 random hex characters]
    const rawToken = 'mk_live_' + crypto.randomBytes(16).toString('hex');
    const keyPrefix = rawToken.slice(0, 12); // mk_live_xxxx
    const keyHash = hashApiKey(rawToken);

    const result = await tenantDb.query(ctx, 
      `INSERT INTO tenant_api_keys (company_id, name, key_hash, key_prefix, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, name, key_prefix, status, created_at`,
      [ctx.tenantId, name, keyHash, keyPrefix]
    );

    // Save key details in Postgres, return actual raw key ONLY ONCE during creation
    res.status(201).json({
      ...result.rows[0],
      api_key: rawToken
    });
  } catch (error) {
    console.error('Create API Key Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



// Get Company Usage Metrics
app.get('/api/tenant/usage', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const companyId = ctx.tenantId;

    // 1. Check Redis for real-time live usage cache
    const cacheKey = `company:${companyId}:usage`;
    const cachedUsage = await redisClient.hGetAll(cacheKey);

    if (cachedUsage && Object.keys(cachedUsage).length > 0) {
      return res.json({
        company_id: companyId,
        call_minutes: parseInt(cachedUsage.call_minutes || 0),
        stt_seconds: parseInt(cachedUsage.stt_seconds || 0),
        tts_characters: parseInt(cachedUsage.tts_characters || 0),
        llm_tokens: parseInt(cachedUsage.llm_tokens || 0)
      });
    }

    // 2. Fallback to DB query
    const dbResult = await tenantDb.query(ctx, 
      'SELECT call_minutes, stt_seconds, tts_characters, llm_tokens FROM usage_metrics WHERE company_id = $1',
      [companyId]
    );

    if (dbResult.rows.length === 0) {
      return res.status(404).json({ error: 'Metrics record not found' });
    }

    // Cache metrics to Redis
    const metrics = dbResult.rows[0];
    await redisClient.hSet(cacheKey, {
      call_minutes: metrics.call_minutes.toString(),
      stt_seconds: metrics.stt_seconds.toString(),
      tts_characters: metrics.tts_characters.toString(),
      llm_tokens: metrics.llm_tokens.toString()
    });
    // Set 5 minute expiration
    await redisClient.expire(cacheKey, 300);

    res.json({
      company_id: companyId,
      ...metrics
    });
  } catch (error) {
    console.error('Get Usage Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Increment Usage (Called by internal services)
app.post('/api/tenant/usage/increment', internalGuard, async (req, res) => {
  const { companyId, callMinutes, sttSeconds, ttsCharacters, llmTokens } = req.body;

  if (!companyId) return res.status(400).json({ error: 'Company ID is required' });

  try {
    const ctx = { tenantId: companyId, isServiceAccount: true };
    // 1. Update in Postgres
    await tenantDb.query(
      ctx,
      `UPDATE usage_metrics 
       SET call_minutes = call_minutes + $1, 
           stt_seconds = stt_seconds + $2, 
           tts_characters = tts_characters + $3, 
           llm_tokens = llm_tokens + $4
       WHERE company_id = $5`,
      [callMinutes || 0, sttSeconds || 0, ttsCharacters || 0, llmTokens || 0, companyId]
    );

    // 2. Synchronize to Redis cache
    const cacheKey = `company:${companyId}:usage`;
    await redisClient.hIncrBy(cacheKey, 'call_minutes', callMinutes || 0);
    await redisClient.hIncrBy(cacheKey, 'stt_seconds', sttSeconds || 0);
    await redisClient.hIncrBy(cacheKey, 'tts_characters', ttsCharacters || 0);
    await redisClient.hIncrBy(cacheKey, 'llm_tokens', llmTokens || 0);

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'tenant-service' });
});

app.listen(PORT, () => {
  console.log(`🚀 Tenant Service listening on port ${PORT}`);
});
