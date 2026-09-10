const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const TenantGuard = require('../../kernel/identity/tenant-guard');
const TenantDb = require('../../kernel/identity/tenant-db');
const requestLogger = require('../../kernel/identity/request-logger');
const PromptRegistry = require('./prompt_registry');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5003;

app.use(cors());
app.use(express.json());

// Postgres Connection Pool with retries
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

const tenantDb = new TenantDb(pool);

app.use('/api', TenantGuard);

async function connectDb() {
  for (let i = 0; i < 10; i++) {
    try {
      const client = await pool.connect();
      try {
        // Ensure UUID extension if available
        try {
          await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
        } catch (extErr) {
          console.warn('UUID extension notice:', extErr.message);
        }

        // Execute DDL statements in strict dependency order
        const ddlStatements = [
          // 1. Companies (tenants)
          `CREATE TABLE IF NOT EXISTS companies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            plan VARCHAR(50) DEFAULT 'starter',
            status VARCHAR(50) DEFAULT 'active',
            max_agents INT DEFAULT 5,
            workflow_settings JSONB NOT NULL DEFAULT '{"confidence_thresholds":{"default":0.85,"refund":0.95,"update_address":0.70,"update_contact":0.75}}'::jsonb,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );`,

          // 2. Teams
          `CREATE TABLE IF NOT EXISTS teams (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            type VARCHAR(50) DEFAULT 'general',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );`,

          // 3. Agents (must precede any table that has foreign key REFERENCES agents(id))
          `CREATE TABLE IF NOT EXISTS agents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            prompt TEXT NOT NULL,
            voice_provider VARCHAR(100) NOT NULL DEFAULT 'edge_tts',
            voice_id VARCHAR(100) NOT NULL DEFAULT 'am-ET-MekdesNeural',
            model_provider VARCHAR(100) NOT NULL DEFAULT 'groq',
            model_id VARCHAR(100) NOT NULL DEFAULT 'llama-3.3-70b-versatile',
            team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
            temperature NUMERIC DEFAULT 0.3,
            stt_provider VARCHAR(100) DEFAULT 'elevenlabs_scribe',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );`,

          // 4. Agent Versions
          `CREATE TABLE IF NOT EXISTS agent_versions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
            version_number INT NOT NULL,
            prompt TEXT NOT NULL,
            model_provider VARCHAR(100) NOT NULL,
            model_id VARCHAR(100) NOT NULL,
            voice_provider VARCHAR(100) NOT NULL,
            voice_id VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );`,

          // 5. Tools
          `CREATE TABLE IF NOT EXISTS tools (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            webhook_url TEXT NOT NULL,
            method VARCHAR(10) DEFAULT 'POST',
            type VARCHAR(50) DEFAULT 'webhook',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );`,

          // 6. Knowledge Sources
          `CREATE TABLE IF NOT EXISTS knowledge_sources (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            type VARCHAR(50) NOT NULL,
            status VARCHAR(50) DEFAULT 'ready',
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );`,

          // 7. Team Agents bridge
          `CREATE TABLE IF NOT EXISTS team_agents (
            team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
            agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
            role VARCHAR(100) DEFAULT 'member',
            PRIMARY KEY (team_id, agent_id)
          );`,

          // 8. Commander Agents bridge
          `CREATE TABLE IF NOT EXISTS commander_agents (
            team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
            agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
            routing_rules JSONB,
            PRIMARY KEY (team_id, agent_id)
          );`,

          // 9. Agent Tools bridge
          `CREATE TABLE IF NOT EXISTS agent_tools (
            agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
            tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
            PRIMARY KEY (agent_id, tool_id)
          );`,

          // 10. Agent Knowledge Sources bridge
          `CREATE TABLE IF NOT EXISTS agent_knowledge_sources (
            agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
            source_id UUID REFERENCES knowledge_sources(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (agent_id, source_id)
          );`,

          // 11. Calls
          `CREATE TABLE IF NOT EXISTS calls (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
            agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
            customer_number VARCHAR(50),
            status VARCHAR(50) DEFAULT 'initiated',
            start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            end_time TIMESTAMP,
            turn_count INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );`,

          // 12. Audit Logs
          `CREATE TABLE IF NOT EXISTS audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
            user_id UUID,
            action VARCHAR(100) NOT NULL,
            entity_type VARCHAR(100) NOT NULL,
            entity_id UUID NOT NULL,
            details JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );`,

          // 13. Column migrations for existing tables
          `ALTER TABLE agents ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;`,
          `ALTER TABLE agents ADD COLUMN IF NOT EXISTS temperature NUMERIC DEFAULT 0.3;`,
          `ALTER TABLE agents ADD COLUMN IF NOT EXISTS stt_provider VARCHAR(100) DEFAULT 'elevenlabs_scribe';`,
          `ALTER TABLE tools ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'webhook';`
        ];

        for (const sql of ddlStatements) {
          try {
            await client.query(sql);
          } catch (ddlErr) {
            console.warn(`DDL Notice on statement: ${ddlErr.message}`);
          }
        }
      } finally {
        client.release();
      }
      console.log('✅ Agent Builder Service connected to PostgreSQL with verified schema');
      return;
    } catch (err) {
      console.log(`⚠️ Database connection attempt ${i + 1} failed (${err.message}). Retrying in 3000ms...`);
      await new Promise(res => setTimeout(res, 3000));
    }
  }
  console.error('❌ Database connection failed');
  process.exit(1);
}

connectDb();

function auditUserId(ctx) {
  const id = ctx && ctx.userId;
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

function normalizeAgentBody(body = {}) {
  const voice = body.voice_config || {};
  const model = body.model_config || {};
  return {
    name: body.name,
    prompt: body.prompt,
    language: body.language || 'am',
    voice_provider: body.voice_provider || voice.provider || voice.voice_provider || 'edge_tts',
    voice_id: body.voice_id || voice.voice_id || voice.id || 'am-ET-MekdesNeural',
    model_provider: body.model_provider || model.provider || model.model_provider || 'groq',
    model_id: body.model_id || model.model_id || model.id || 'llama-3.3-70b-versatile',
    team_id: body.team_id || null,
    temperature: body.temperature !== undefined ? parseFloat(body.temperature) : 0.3,
    stt_provider: body.stt_provider || 'elevenlabs_scribe',
  };
}

// ── Teams & Commander Auto-Setup Endpoints ─────────────────────────────────

async function ensureCommanderAgent(ctx) {
  const companyId = ctx.tenantId;

  // 1. Fast path: check if an agent already exists as Commander or in a Commander team
  const existingAgent = await tenantDb.query(
    ctx,
    `SELECT a.id, a.name, a.prompt, a.voice_provider, a.voice_id, a.model_provider, a.model_id, a.team_id, a.temperature, a.stt_provider
     FROM agents a
     LEFT JOIN teams t ON t.id = a.team_id
     WHERE a.company_id = $1 AND (t.type = 'commander' OR a.name ILIKE '%commander%')
     LIMIT 1`,
    [companyId]
  );

  if (existingAgent.rows.length > 0) {
    return existingAgent.rows[0];
  }

  // 2. Safe transaction auto-provisioning
  return await tenantDb.withTenant(ctx, async (client) => {
    // Check again inside transaction to prevent race conditions
    const checkAgain = await client.query(
      `SELECT a.id, a.name, a.prompt, a.voice_provider, a.voice_id, a.model_provider, a.model_id, a.team_id, a.temperature, a.stt_provider
       FROM agents a
       LEFT JOIN teams t ON t.id = a.team_id
       WHERE a.company_id = $1 AND (t.type = 'commander' OR a.name ILIKE '%commander%')
       LIMIT 1`,
      [companyId]
    );
    if (checkAgain.rows.length > 0) {
      return checkAgain.rows[0];
    }

    // A. Ensure Commander Team
    let commanderTeamId;
    const cmdTeamRes = await client.query(
      `SELECT id FROM teams WHERE company_id = $1 AND type = 'commander' LIMIT 1`,
      [companyId]
    );
    if (cmdTeamRes.rows.length > 0) {
      commanderTeamId = cmdTeamRes.rows[0].id;
    } else {
      const newCmdTeam = await client.query(
        `INSERT INTO teams (company_id, name, type)
         VALUES ($1, 'Commander Agent', 'commander')
         RETURNING id`,
        [companyId]
      );
      commanderTeamId = newCmdTeam.rows[0].id;
    }

    // B. Ensure Standard Team (Sales / Support)
    const stdTeamRes = await client.query(
      `SELECT id FROM teams WHERE company_id = $1 AND type = 'standard' LIMIT 1`,
      [companyId]
    );
    if (stdTeamRes.rows.length === 0) {
      await client.query(
        `INSERT INTO teams (company_id, name, type)
         VALUES ($1, 'Customer Care & Sales', 'standard')`,
        [companyId]
      );
    }

    // C. Create default Commander Agent (Almaz)
    const defaultPrompt = `You are Almaz, the primary Commander and Orchestrator AI for this enterprise call center.
Your role is to warmly greet customers in Amharic (ሰላም! እንኳን ወደ ድርጅታችን ደህና መጡ), understand their inquiry, identify their needs, and provide clear assistance or direct their request to the appropriate department.
Always maintain a professional, respectful, and helpful Ethiopian conversational tone. Keep spoken responses concise, natural, and friendly.`;

    const agentRes = await client.query(
      `INSERT INTO agents (company_id, name, prompt, voice_provider, voice_id, model_provider, model_id, team_id, temperature, stt_provider)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name, prompt, voice_provider, voice_id, model_provider, model_id, team_id, temperature, stt_provider, created_at`,
      [
        companyId,
        'Almaz - Commander Agent',
        defaultPrompt,
        'edge_tts',
        'am-ET-MekdesNeural',
        'groq',
        'llama-3.3-70b-versatile',
        commanderTeamId,
        0.3,
        'elevenlabs_scribe'
      ]
    );
    const agent = agentRes.rows[0];

    // D. Create version 1
    await client.query(
      `INSERT INTO agent_versions (agent_id, version_number, prompt, model_provider, model_id, voice_provider, voice_id)
       VALUES ($1, 1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [agent.id, agent.prompt, agent.model_provider, agent.model_id, agent.voice_provider, agent.voice_id]
    );

    // E. Link to team_agents and commander_agents
    await client.query(
      `INSERT INTO team_agents (team_id, agent_id, role)
       VALUES ($1, $2, 'commander')
       ON CONFLICT (team_id, agent_id) DO NOTHING`,
      [commanderTeamId, agent.id]
    );

    await client.query(
      `INSERT INTO commander_agents (team_id, agent_id, routing_rules)
       VALUES ($1, $2, '{"default_route": "support"}'::jsonb)
       ON CONFLICT (team_id, agent_id) DO NOTHING`,
      [commanderTeamId, agent.id]
    );

    console.log(`✅ Auto-provisioned Commander Agent (Almaz) for company ${companyId}`);
    return agent;
  });
}

// List teams for Company (guarantees Commander team and agent are auto-provisioned)
app.get('/api/builder/teams', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;

  try {
    // 1. Ensure Commander Agent and teams exist
    await ensureCommanderAgent(ctx);

    // 2. Query all teams with updated member counts
    const teamsResult = await tenantDb.query(
      ctx,
      `SELECT t.id, t.name, t.type, t.created_at, COUNT(a.id)::int as count
       FROM teams t
       LEFT JOIN agents a ON a.team_id = t.id
       WHERE t.company_id = $1
       GROUP BY t.id, t.name, t.type, t.created_at
       ORDER BY CASE WHEN t.type = 'commander' THEN 0 ELSE 1 END, t.name ASC`,
      [companyId]
    );

    const mapped = teamsResult.rows.map(t => ({
      ...t,
      isCommander: t.type === 'commander'
    }));

    res.json(mapped);
  } catch (error) {
    console.error('List Teams Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create new Team
app.post('/api/builder/teams', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const { name, type } = req.body || {};

  if (!name) {
    return res.status(400).json({ error: 'Team name is required' });
  }

  try {
    const result = await tenantDb.query(
      ctx,
      `INSERT INTO teams (company_id, name, type)
       VALUES ($1, $2, COALESCE($3, 'standard'))
       RETURNING id, name, type, created_at`,
      [companyId, name, type || 'standard']
    );

    res.status(201).json({
      ...result.rows[0],
      count: 0,
      isCommander: result.rows[0].type === 'commander'
    });
  } catch (error) {
    console.error('Create Team Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete Team
app.delete('/api/builder/teams/:id', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const { id } = req.params;

  try {
    const result = await tenantDb.query(
      ctx,
      'DELETE FROM teams WHERE id = $1 AND company_id = $2 RETURNING id',
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json({ success: true, message: 'Team deleted' });
  } catch (error) {
    console.error('Delete Team Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get Commander team and agent info
app.get('/api/builder/teams/commander', async (req, res) => {
  const ctx = req.securityContext;

  try {
    const commanderAgent = await ensureCommanderAgent(ctx);
    res.json(commanderAgent);
  } catch (error) {
    console.error('Get Commander Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Agents Endpoints ───────────────────────────────────────────────────────

// Create Agent
app.post('/api/builder/agents', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const userId = auditUserId(ctx);
  const { 
    name, 
    prompt, 
    voice_provider, 
    voice_id, 
    model_provider, 
    model_id, 
    team_id, 
    temperature, 
    stt_provider, 
    language 
  } = normalizeAgentBody(req.body);

  if (!name || !prompt || !voice_provider || !voice_id || !model_provider || !model_id) {
    return res.status(400).json({
      error: 'Missing required agent fields',
      required: ['name', 'prompt', 'voice_config|voice_provider+voice_id', 'model_config|model_provider+model_id'],
    });
  }

  const violations = PromptRegistry.scanPromptSafety(prompt);
  if (violations.length > 0) {
      return res.status(400).json({ error: `Prompt rejected by safety scanner. Violations:\n${violations.join('\n')}` });
  }

  try {
    // Quota check: enforce max_agents per company plan
    const quotaRes = await pool.query(
      `SELECT c.max_agents, COUNT(a.id)::int AS current_count
       FROM companies c
       LEFT JOIN agents a ON a.company_id = c.id
       WHERE c.id = $1
       GROUP BY c.max_agents`,
      [companyId]
    );
    if (quotaRes.rows.length > 0) {
      const { max_agents, current_count } = quotaRes.rows[0];
      if (max_agents > 0 && current_count >= max_agents) {
        return res.status(402).json({
          error: 'Agent limit reached',
          detail: `Your plan allows up to ${max_agents} agent(s). You currently have ${current_count}. Upgrade your plan to create more.`,
          current: current_count,
          limit: max_agents,
        });
      }
    }

    const agent = await tenantDb.withTenant(ctx, async (client) => {
      // 1. Create Agent record
      const agentRes = await client.query(
        `INSERT INTO agents (company_id, name, prompt, voice_provider, voice_id, model_provider, model_id, team_id, temperature, stt_provider)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, name, prompt, voice_provider, voice_id, model_provider, model_id, team_id, temperature, stt_provider, created_at`,
        [companyId, name, prompt, voice_provider, voice_id, model_provider, model_id, team_id, temperature, stt_provider]
      );
      const newAgent = agentRes.rows[0];

      // 2. Map to team_agents if team_id provided
      if (team_id) {
        await client.query(
          `INSERT INTO team_agents (team_id, agent_id, role)
           VALUES ($1, $2, 'member')
           ON CONFLICT DO NOTHING`,
          [team_id, newAgent.id]
        );
      }

      // 3. Create Agent Version 1
      await client.query(
        `INSERT INTO agent_versions (agent_id, version_number, prompt, model_provider, model_id, voice_provider, voice_id)
         VALUES ($1, 1, $2, $3, $4, $5, $6)`,
        [newAgent.id, prompt, model_provider, model_id, voice_provider, voice_id]
      );

      // Create Audit Log
      await client.query(
        `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id) 
         VALUES ($1, $2, $3, $4, $5)`,
        [companyId, userId, 'AGENT_CREATED', 'agent', newAgent.id]
      );

      return newAgent;
    });

    res.status(201).json({
      ...agent,
      language: language || 'am',
      voice_config: { provider: agent.voice_provider, voice_id: agent.voice_id },
      model_config: { provider: agent.model_provider, model_id: agent.model_id },
    });
  } catch (error) {
    console.error('Create Agent Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// List Agents for Company
app.get('/api/builder/agents', async (req, res) => {
  const ctx = req.securityContext;

  try {
    // Ensure default Commander Agent exists so new users immediately receive Almaz
    await ensureCommanderAgent(ctx);

    const result = await tenantDb.query(
      ctx,
      `SELECT id, name, prompt, voice_provider, voice_id, model_provider, model_id, team_id, temperature, stt_provider, created_at, updated_at 
       FROM agents 
       WHERE company_id = $1 
       ORDER BY CASE WHEN name ILIKE '%commander%' THEN 0 ELSE 1 END, name ASC`,
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
      `SELECT id, name, prompt, voice_provider, voice_id, model_provider, model_id, team_id, temperature, stt_provider, created_at, updated_at 
       FROM agents 
       WHERE id = $1 AND company_id = $2`,
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
  const userId = auditUserId(ctx);
  const { id } = req.params;
  const { 
    name, 
    prompt, 
    voice_provider, 
    voice_id, 
    model_provider, 
    model_id, 
    team_id, 
    temperature, 
    stt_provider 
  } = req.body;

  const violations = PromptRegistry.scanPromptSafety(prompt);
  if (violations.length > 0) {
      return res.status(400).json({ error: `Prompt rejected by safety scanner. Violations:\n${violations.join('\n')}` });
  }

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
             team_id = COALESCE($7, team_id),
             temperature = COALESCE($8, temperature),
             stt_provider = COALESCE($9, stt_provider),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $10 AND company_id = $11
         RETURNING id, name, prompt, voice_provider, voice_id, model_provider, model_id, team_id, temperature, stt_provider, updated_at`,
        [name, prompt, voice_provider, voice_id, model_provider, model_id, team_id, temperature, stt_provider, id, companyId]
      );
      const updatedAgentRecord = updateRes.rows[0];

      // Update team_agents association
      if (team_id) {
        await client.query(
          `INSERT INTO team_agents (team_id, agent_id, role)
           VALUES ($1, $2, 'member')
           ON CONFLICT (team_id, agent_id) DO NOTHING`,
          [team_id, id]
        );
      }

      // 4. Save to Versions table
      await client.query(
        `INSERT INTO agent_versions (agent_id, version_number, prompt, model_provider, model_id, voice_provider, voice_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id, 
          nextVersion, 
          updatedAgentRecord.prompt, 
          updatedAgentRecord.model_provider, 
          updatedAgentRecord.model_id, 
          updatedAgentRecord.voice_provider, 
          updatedAgentRecord.voice_id
        ]
      );

      // Create Audit Log
      await client.query(
        `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id) 
         VALUES ($1, $2, $3, $4, $5)`,
        [companyId, userId, 'AGENT_UPDATED', 'agent', id]
      );

      return updatedAgentRecord;
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
      `SELECT id, version_number as version, prompt, model_provider, model_id, voice_provider, voice_id, created_at 
       FROM agent_versions 
       WHERE agent_id = $1 
       ORDER BY version_number DESC`,
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
  const userId = auditUserId(ctx);
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
         RETURNING id, name, prompt, voice_provider, voice_id, model_provider, model_id, team_id, temperature, stt_provider, updated_at`,
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

// ── Agent Knowledge Base Association Endpoints ─────────────────────────────

// List connected knowledge sources for an agent
app.get('/api/builder/agents/:id/knowledge', async (req, res) => {
  const ctx = req.securityContext;
  const { id } = req.params;

  try {
    const result = await tenantDb.query(
      ctx,
      `SELECT ks.id, ks.name, ks.type, ks.status, aks.created_at as connected_at
       FROM agent_knowledge_sources aks
       JOIN knowledge_sources ks ON ks.id = aks.source_id
       WHERE aks.agent_id = $1 AND ks.company_id = $2
       ORDER BY aks.created_at DESC`,
      [id, ctx.tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get Agent Knowledge Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Attach knowledge source to agent
app.post('/api/builder/agents/:id/knowledge/:sourceId', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const { id, sourceId } = req.params;

  try {
    const result = await tenantDb.query(
      ctx,
      `INSERT INTO agent_knowledge_sources (agent_id, source_id)
       SELECT $1, $2
       WHERE EXISTS (SELECT 1 FROM agents WHERE id = $1 AND company_id = $3)
         AND EXISTS (SELECT 1 FROM knowledge_sources WHERE id = $2 AND company_id = $3)
       ON CONFLICT (agent_id, source_id) DO NOTHING
       RETURNING agent_id, source_id`,
      [id, sourceId, companyId]
    );

    res.json({ success: true, connected: true, agent_id: id, source_id: sourceId });
  } catch (error) {
    console.error('Attach Knowledge Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Detach knowledge source from agent
app.delete('/api/builder/agents/:id/knowledge/:sourceId', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const { id, sourceId } = req.params;

  try {
    await tenantDb.query(
      ctx,
      `DELETE FROM agent_knowledge_sources
       WHERE agent_id = $1 AND source_id = $2
         AND EXISTS (SELECT 1 FROM agents WHERE id = $1 AND company_id = $3)`,
      [id, sourceId, companyId]
    );

    res.json({ success: true, disconnected: true });
  } catch (error) {
    console.error('Detach Knowledge Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Agent Tools & Integration Association Endpoints ────────────────────────

// List connected tools for an agent
app.get('/api/builder/agents/:id/tools', async (req, res) => {
  const ctx = req.securityContext;
  const { id } = req.params;

  try {
    const result = await tenantDb.query(
      ctx,
      `SELECT t.id, t.name, t.description, t.webhook_url, t.method, t.type
       FROM agent_tools at
       JOIN tools t ON t.id = at.tool_id
       WHERE at.agent_id = $1 AND t.company_id = $2
       ORDER BY t.name ASC`,
      [id, ctx.tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get Agent Tools Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Attach tool to agent
app.post('/api/builder/agents/:id/tools/:toolId', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const { id, toolId } = req.params;

  try {
    await tenantDb.query(
      ctx,
      `INSERT INTO agent_tools (agent_id, tool_id)
       SELECT $1, $2
       WHERE EXISTS (SELECT 1 FROM agents WHERE id = $1 AND company_id = $3)
         AND EXISTS (SELECT 1 FROM tools WHERE id = $2 AND company_id = $3)
       ON CONFLICT (agent_id, tool_id) DO NOTHING`,
      [id, toolId, companyId]
    );

    res.json({ success: true, connected: true, agent_id: id, tool_id: toolId });
  } catch (error) {
    console.error('Attach Tool Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Detach tool from agent
app.delete('/api/builder/agents/:id/tools/:toolId', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const { id, toolId } = req.params;

  try {
    await tenantDb.query(
      ctx,
      `DELETE FROM agent_tools
       WHERE agent_id = $1 AND tool_id = $2
         AND EXISTS (SELECT 1 FROM agents WHERE id = $1 AND company_id = $3)`,
      [id, toolId, companyId]
    );

    res.json({ success: true, disconnected: true });
  } catch (error) {
    console.error('Detach Tool Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Agent Analytics & Stats Endpoint ───────────────────────────────────────

app.get('/api/builder/agents/:id/stats', async (req, res) => {
  const ctx = req.securityContext;
  const { id } = req.params;

  try {
    const statsRes = await tenantDb.query(
      ctx,
      `SELECT 
         COUNT(*)::int AS total_calls,
         COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(end_time, CURRENT_TIMESTAMP) - start_time)))::int, 0) AS avg_duration_seconds,
         COALESCE(ROUND((COUNT(*) FILTER (WHERE status = 'completed')::numeric / NULLIF(COUNT(*), 0)::numeric) * 100), 100)::int AS success_rate,
         COALESCE(SUM(turn_count)::int, 0) AS total_turns
       FROM calls
       WHERE agent_id = $1 AND company_id = $2`,
      [id, ctx.tenantId]
    );

    const s = statsRes.rows[0] || { total_calls: 0, avg_duration_seconds: 0, success_rate: 100, total_turns: 0 };
    const mins = Math.floor(s.avg_duration_seconds / 60);
    const secs = s.avg_duration_seconds % 60;
    const formattedDuration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    res.json({
      totalCalls: s.total_calls,
      avgDuration: formattedDuration,
      avgDurationSeconds: s.avg_duration_seconds,
      successRate: `${s.success_rate}%`,
      totalTurns: s.total_turns
    });
  } catch (error) {
    console.error('Agent Stats Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Sandbox test-call (Phase 2) — no billing; requires test env (enforced at gateway for API keys)
app.post('/api/builder/agents/:id/test-call', async (req, res) => {
  const ctx = req.securityContext;
  const { id } = req.params;
  const { to_number } = req.body || {};
  const env = req.headers['x-markova-env'] || 'test';

  if (!to_number) {
    return res.status(400).json({ error: 'to_number is required' });
  }
  if (env === 'live') {
    return res.status(403).json({ error: 'test-call is sandbox-only' });
  }

  try {
    const agentRes = await tenantDb.query(
      ctx,
      'SELECT id, name FROM agents WHERE id = $1 AND company_id = $2',
      [id, ctx.tenantId]
    );
    if (agentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://orchestrator:6000';
    const axios = require('axios');
    const response = await axios.post(
      `${orchestratorUrl}/v1/calls`,
      { agent_id: id, to_number, sandbox: true },
      {
        headers: {
          'x-tenant-id': ctx.tenantId,
          'x-company-id': ctx.tenantId,
          'x-markova-env': 'test',
          'content-type': 'application/json',
        },
        timeout: 15000,
        validateStatus: () => true,
      }
    );

    if (response.status >= 400) {
      return res.status(response.status).json(response.data);
    }

    res.status(201).json({
      success: true,
      sandbox: true,
      billed: false,
      agent: agentRes.rows[0],
      call: response.data,
    });
  } catch (error) {
    console.error('test-call error:', error.message);
    res.status(502).json({ error: 'Failed to place sandbox test call', detail: error.message });
  }
});

// Delete Agent
app.delete('/api/builder/agents/:id', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const userId = auditUserId(ctx);
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
