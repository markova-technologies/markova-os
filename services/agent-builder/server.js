const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const TenantGuard = require('../../kernel/identity/tenant-guard');
const TenantDb = require('../../kernel/identity/tenant-db');
const requestLogger = require('../../kernel/identity/request-logger');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5003;

app.use(cors());
app.use(express.json());

// Postgres Connection Pool with retries
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const tenantDb = new TenantDb(pool);

app.use('/api', TenantGuard);

async function connectDb() {
  for (let i = 0; i < 10; i++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('✅ Agent Builder Service connected to PostgreSQL');
      return;
    } catch (err) {
      console.log(`⚠️ Database connection attempt ${i + 1} failed. Retrying in 3000ms...`);
      await new Promise(res => setTimeout(res, 3000));
    }
  }
  console.error('❌ Database connection failed');
  process.exit(1);
}

connectDb();

// Create Agent
app.post('/api/builder/agents', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const userId = ctx.userId || null;
  const { name, prompt, voice_provider, voice_id, model_provider, model_id } = req.body;

  if (!name || !prompt || !voice_provider || !voice_id || !model_provider || !model_id) {
    return res.status(400).json({ error: 'Missing required agent fields' });
  }

  try {
    const agent = await tenantDb.withTenant(ctx, async (client) => {
      // 1. Create Agent record
      const agentRes = await client.query(
        `INSERT INTO agents (company_id, name, prompt, voice_provider, voice_id, model_provider, model_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, prompt, voice_provider, voice_id, model_provider, model_id, created_at`,
        [companyId, name, prompt, voice_provider, voice_id, model_provider, model_id]
      );
      const agent = agentRes.rows[0];

      // 2. Create Agent Version 1
      await client.query(
        `INSERT INTO agent_versions (agent_id, version_number, prompt, model_provider, model_id, voice_provider, voice_id)
         VALUES ($1, 1, $2, $3, $4, $5, $6)`,
        [agent.id, prompt, model_provider, model_id, voice_provider, voice_id]
      );

      // Create Audit Log
      await client.query(
        `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id) 
         VALUES ($1, $2, $3, $4, $5)`,
        [companyId, userId, 'AGENT_CREATED', 'agent', agent.id]
      );

      return agent;
    });

    res.status(201).json(agent);
  } catch (error) {
    console.error('Create Agent Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// List Agents for Company
app.get('/api/builder/agents', async (req, res) => {
  const ctx = req.securityContext;

  try {
    const result = await tenantDb.query(
      ctx,
      'SELECT id, name, prompt, voice_provider, voice_id, model_provider, model_id, created_at FROM agents WHERE company_id = $1 ORDER BY name ASC',
      [ctx.tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List Agents Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get Single Agent details
app.get('/api/builder/agents/:id', async (req, res) => {
  const ctx = req.securityContext;
  const { id } = req.params;

  try {
    const result = await tenantDb.query(
      ctx,
      'SELECT id, name, prompt, voice_provider, voice_id, model_provider, model_id, created_at FROM agents WHERE id = $1 AND company_id = $2',
      [id, ctx.tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get Agent Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update Agent & Create New Version
app.put('/api/builder/agents/:id', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const userId = ctx.userId || null;
  const { id } = req.params;
  const { name, prompt, voice_provider, voice_id, model_provider, model_id } = req.body;

  try {
    const updatedAgent = await tenantDb.withTenant(ctx, async (client) => {
      // 1. Fetch current agent details to verify ownership
      const agentCheck = await client.query(
        'SELECT id FROM agents WHERE id = $1 AND company_id = $2',
        [id, companyId]
      );

      if (agentCheck.rows.length === 0) {
        throw new Error('NOT_FOUND');
      }

      // 2. Fetch the latest version number for version increment
      const versionRes = await client.query(
        'SELECT COALESCE(MAX(version_number), 0) as max_version FROM agent_versions WHERE agent_id = $1',
        [id]
      );
      const nextVersion = versionRes.rows[0].max_version + 1;

      // 3. Update core Agent record
      const updateRes = await client.query(
        `UPDATE agents 
         SET name = COALESCE($1, name), 
             prompt = COALESCE($2, prompt), 
             voice_provider = COALESCE($3, voice_provider), 
             voice_id = COALESCE($4, voice_id), 
             model_provider = COALESCE($5, model_provider), 
             model_id = COALESCE($6, model_id),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7 AND company_id = $8
         RETURNING id, name, prompt, voice_provider, voice_id, model_provider, model_id, updated_at`,
        [name, prompt, voice_provider, voice_id, model_provider, model_id, id, companyId]
      );
      const updatedAgent = updateRes.rows[0];

      // 4. Save to Versions table
      await client.query(
        `INSERT INTO agent_versions (agent_id, version_number, prompt, model_provider, model_id, voice_provider, voice_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id, 
          nextVersion, 
          updatedAgent.prompt, 
          updatedAgent.model_provider, 
          updatedAgent.model_id, 
          updatedAgent.voice_provider, 
          updatedAgent.voice_id
        ]
      );

      // Create Audit Log
      await client.query(
        `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id) 
         VALUES ($1, $2, $3, $4, $5)`,
        [companyId, userId, 'AGENT_UPDATED', 'agent', id]
      );

      return updatedAgent;
    });

    res.json(updatedAgent);
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Agent not found' });
    }
    console.error('Update Agent Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get Rollback History (Versions list)
app.get('/api/builder/agents/:id/versions', async (req, res) => {
  const ctx = req.securityContext;
  const { id } = req.params;

  try {
    // Verify ownership
    const agentCheck = await tenantDb.query(
      ctx,
      'SELECT id FROM agents WHERE id = $1 AND company_id = $2',
      [id, ctx.tenantId]
    );
    if (agentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const versions = await tenantDb.query(
      ctx,
      'SELECT id, version_number, prompt, model_provider, model_id, voice_provider, voice_id, created_at FROM agent_versions WHERE agent_id = $1 ORDER BY version_number DESC',
      [id]
    );

    res.json(versions.rows);
  } catch (error) {
    console.error('Get Agent Versions Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Rollback Agent to a Specific Version
app.post('/api/builder/agents/:id/versions/:versionId/rollback', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const userId = ctx.userId || null;
  const { id, versionId } = req.params;

  try {
    const updatedRes = await tenantDb.withTenant(ctx, async (client) => {
      // 1. Verify ownership of agent
      const agentCheck = await client.query(
        'SELECT id FROM agents WHERE id = $1 AND company_id = $2',
        [id, companyId]
      );
      if (agentCheck.rows.length === 0) {
        throw new Error('AGENT_NOT_FOUND');
      }

      // 2. Fetch specific version configurations
      const versionRes = await client.query(
        'SELECT prompt, model_provider, model_id, voice_provider, voice_id FROM agent_versions WHERE id = $1 AND agent_id = $2',
        [versionId, id]
      );
      if (versionRes.rows.length === 0) {
        throw new Error('VERSION_NOT_FOUND');
      }
      const versionConfig = versionRes.rows[0];

      // 3. Get next version number for this rollback event
      const nextVerRes = await client.query(
        'SELECT COALESCE(MAX(version_number), 0) as max_version FROM agent_versions WHERE agent_id = $1',
        [id]
      );
      const nextVersion = nextVerRes.rows[0].max_version + 1;

      // 4. Update core Agent record
      const updateRes = await client.query(
        `UPDATE agents 
         SET prompt = $1, model_provider = $2, model_id = $3, voice_provider = $4, voice_id = $5, updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING id, name, prompt, voice_provider, voice_id, model_provider, model_id, updated_at`,
        [
          versionConfig.prompt,
          versionConfig.model_provider,
          versionConfig.model_id,
          versionConfig.voice_provider,
          versionConfig.voice_id,
          id
        ]
      );

      // 5. Save rollback as a new history record
      await client.query(
        `INSERT INTO agent_versions (agent_id, version_number, prompt, model_provider, model_id, voice_provider, voice_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          nextVersion,
          versionConfig.prompt,
          versionConfig.model_provider,
          versionConfig.model_id,
          versionConfig.voice_provider,
          versionConfig.voice_id
        ]
      );

      // Create Audit Log
      await client.query(
        `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id) 
         VALUES ($1, $2, $3, $4, $5)`,
        [companyId, userId, 'AGENT_ROLLBACK', 'agent', id]
      );

      return updateRes.rows[0];
    });

    res.json(updatedRes);
  } catch (error) {
    if (error.message === 'AGENT_NOT_FOUND') return res.status(404).json({ error: 'Agent not found' });
    if (error.message === 'VERSION_NOT_FOUND') return res.status(404).json({ error: 'Agent version record not found' });

    console.error('Agent Rollback Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete Agent
app.delete('/api/builder/agents/:id', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const userId = ctx.userId || null;
  const { id } = req.params;

  try {
    await tenantDb.withTenant(ctx, async (client) => {
      const result = await client.query(
        'DELETE FROM agents WHERE id = $1 AND company_id = $2 RETURNING id',
        [id, companyId]
      );

      if (result.rows.length === 0) {
        throw new Error('NOT_FOUND');
      }

      // Create Audit Log
      await client.query(
        `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id) 
         VALUES ($1, $2, $3, $4, $5)`,
        [companyId, userId, 'AGENT_DELETED', 'agent', id]
      );
    });

    res.json({ success: true, message: 'Agent deleted successfully' });
  } catch (error) {
    if (error.message === 'NOT_FOUND') return res.status(404).json({ error: 'Agent not found' });
    console.error('Delete Agent Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'agent-builder' });
});

app.listen(PORT, () => {
  console.log(`🚀 Agent Builder Service listening on port ${PORT}`);
});
