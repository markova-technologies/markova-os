const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { createClient } = require('redis');
const axios = require('axios');
const EventBus = require('../../kernel/events/bus');
const { EventTypes } = require('../../kernel/events/registry');
const TenantGuard = require('../../kernel/identity/tenant-guard');
const TenantDb = require('../../kernel/identity/tenant-db');
const requestLogger = require('../../kernel/identity/request-logger');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5004;

app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Postgres Connection Pool with retries
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
const tenantDb = new TenantDb(pool);

app.use('/api', TenantGuard);

// Redis client for retry queue
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});
const eventBus = new EventBus(process.env.REDIS_URL || 'redis://redis:6379');

redisClient.on('error', (err) => console.error('Redis Client Error', err));

async function initialize() {
  // 1. Connect Postgres
  let dbConnected = false;
  for (let i = 0; i < 10; i++) {
    try {
      const client = await pool.connect();
      client.release();
      dbConnected = true;
      console.log('✅ Tool Engine connected to PostgreSQL');
      break;
    } catch (err) {
      console.log(`⚠️ Database connection attempt ${i + 1} failed. Retrying in 3000ms...`);
      await new Promise(res => setTimeout(res, 3000));
    }
  }
  if (!dbConnected) {
    console.error('❌ Tool Database connection failed');
    process.exit(1);
  }

  // 2. Connect Redis
  let redisConnected = false;
  for (let i = 0; i < 10; i++) {
    try {
      await redisClient.connect();
      redisConnected = true;
      console.log('✅ Tool Engine connected to Redis');
      break;
    } catch (err) {
      console.log(`⚠️ Redis connection attempt ${i + 1} failed. Retrying in 3000ms...`);
      await new Promise(res => setTimeout(res, 3000));
    }
  }
  if (!redisConnected) {
    console.error('❌ Tool Redis connection failed');
    process.exit(1);
  }
}

initialize();

// Unified Plugin Execution Interface
class WebhookPlugin {
  async execute(tool, payload) {
    const config = {
      method: tool.method || 'POST',
      url: tool.webhook_url,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Markova-Tool-Engine/2.0'
      },
      data: payload,
      timeout: 8000 // 8 second timeout
    };

    const response = await axios(config);
    return response.data;
  }
}

class RpaPlugin {
  async execute(tool, payload) {
    const jobId = `rpa_job_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const jobData = {
      job_id: jobId,
      action_type: tool.action_type || 'web_scrape',
      data: payload
    };
    
    // Push to RPA queue
    await redisClient.rPush('rpa_task_queue', JSON.stringify(jobData));
    
    // In a real implementation we might poll for the result in rpa_result_queue 
    // or return a tracking ID and use webhooks. For now, return acknowledging dispatch.
    return { status: 'dispatched', job_id: jobId, message: 'RPA task queued for execution.' };
  }
}

const plugins = {
  webhook: new WebhookPlugin(),
  n8n: new WebhookPlugin(), // n8n behaves like a webhook target endpoint for HTTP trigger nodes
  rpa: new RpaPlugin()
};

// Retry Worker/Queue Handler using Redis
async function queueRetry(companyId, toolId, payload, attempt = 1) {
  const retryJob = {
    companyId,
    toolId,
    payload,
    attempt,
    timestamp: Date.now()
  };

  const queueKey = 'tool_retry_queue';
  await redisClient.rPush(queueKey, JSON.stringify(retryJob));
  console.log(`⏳ Enqueued tool retry job (Attempt #${attempt}) for tool ${toolId}`);
}

// Background retry loop (runs every 10 seconds)
setInterval(async () => {
  try {
    const queueKey = 'tool_retry_queue';
    const jobRaw = await redisClient.lPop(queueKey);
    if (!jobRaw) return;

    const job = JSON.parse(jobRaw);
    console.log(`⚙️ Processing tool retry job (Attempt #${job.attempt}) for tool ${job.toolId}`);

    const ctx = { tenantId: job.companyId, isServiceAccount: true };

    const result = await tenantDb.query(
      ctx,
      'SELECT id, type, name, webhook_url, method FROM tools WHERE id = $1',
      [job.toolId]
    );

    if (result.rows.length === 0) {
      console.log(`❌ Tool ${job.toolId} no longer exists. Skipping retry.`);
      return;
    }

    const tool = result.rows[0];
    const pluginType = tool.type || 'webhook';
    const plugin = plugins[pluginType];

    if (!plugin) {
      console.log(`❌ Unsupported tool type: ${pluginType}. Skipping retry.`);
      return;
    }

    try {
      await plugin.execute(tool, job.payload);
      console.log(`✅ Tool ${tool.name} retry succeeded on attempt #${job.attempt}`);
      
      // Log Audit Log Success
      await tenantDb.query(
        ctx,
        `INSERT INTO audit_logs (company_id, action, entity_type, entity_id) 
         VALUES ($1, $2, $3, $4)`,
        [job.companyId, `TOOL_RETRY_SUCCESS_A${job.attempt}`, 'tool', tool.id]
      );
    } catch (err) {
      console.log(`⚠️ Tool ${tool.name} retry attempt #${job.attempt} failed: ${err.message}`);
      if (job.attempt < 3) {
        // Backoff and schedule again
        await queueRetry(job.companyId, job.toolId, job.payload, job.attempt + 1);
      } else {
        console.error(`❌ Tool ${tool.name} execution failed permanently after 3 attempts`);
        // Log permanent failure
        await tenantDb.query(
          ctx,
          `INSERT INTO audit_logs (company_id, action, entity_type, entity_id) 
           VALUES ($1, $2, $3, $4)`,
          [job.companyId, 'TOOL_FAILED_PERMANENTLY', 'tool', tool.id]
        );
      }
    }
  } catch (error) {
    console.error('Error running retry worker loop:', error.message);
  }
}, 10000);

// Endpoint: Execute Tool
app.post('/api/tools/execute', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const { toolId, payload } = req.body;

  if (!toolId) return res.status(400).json({ error: 'Tool ID is required' });

  try {
    // 1. Fetch Tool config
    const result = await tenantDb.query(
      ctx,
      'SELECT id, type, name, webhook_url, method FROM tools WHERE id = $1 AND company_id = $2',
      [toolId, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tool configuration not found' });
    }

    const tool = result.rows[0];

    // 2. Dispatch execution to appropriate plugin
    const pluginType = tool.type || 'webhook'; // Default to webhook for backward compatibility
    const plugin = plugins[pluginType];
    
    if (!plugin) {
      return res.status(400).json({ error: `Unsupported tool type: ${pluginType}` });
    }
    
    try {
      const responseData = await plugin.execute(tool, payload);
      
      await eventBus.publish(EventTypes.TOOL_EXECUTED, {
        tenantId: companyId,
        toolId: toolId,
        agentId: payload.agentId || 'unknown',
        success: true,
        executionTimeMs: 100 // Mocked for now
      }, { source: 'tool-engine' });

      res.json({ success: true, response: responseData });
    } catch (err) {
      console.error(`Tool Execution Failed: ${err.message}. Enqueueing retry job...`);
      
      await eventBus.publish(EventTypes.TOOL_FAILED, {
        tenantId: companyId,
        toolId: toolId,
        agentId: payload.agentId || 'unknown',
        success: false,
        error: err.message
      }, { source: 'tool-engine' });

      // Schedule Async Retry in Redis
      await queueRetry(companyId, toolId, payload, 1);
      
      // Return immediate response to the Orchestrator with acknowledgment
      res.status(202).json({ 
        success: false, 
        message: 'Tool execution timed out or failed. Scheduled for retry.',
        retryScheduled: true
      });
    }
  } catch (error) {
    console.error('Execute Tool Router Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- STANDARD CRUD ENDPOINTS ---

// List Tools
app.get('/api/tools', async (req, res) => {
  const ctx = req.securityContext;

  try {
    const result = await tenantDb.query(
      ctx,
      'SELECT id, name, description, webhook_url, method, created_at FROM tools WHERE company_id = $1 ORDER BY name ASC',
      [ctx.tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List Tools Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create Tool
app.post('/api/tools', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const userId = ctx.userId || null;
  const { name, description, webhook_url, method } = req.body;

  if (!name || !webhook_url) return res.status(400).json({ error: 'Name and Webhook URL are required' });

  try {
    const result = await tenantDb.query(
      ctx,
      `INSERT INTO tools (company_id, name, description, webhook_url, method)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, description, webhook_url, method, created_at`,
      [companyId, name, description, webhook_url, method || 'POST']
    );

    // Create Audit Log
    await tenantDb.query(
      ctx,
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id) 
       VALUES ($1, $2, $3, $4, $5)`,
      [companyId, userId, 'TOOL_CREATED', 'tool', result.rows[0].id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create Tool Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update Tool
app.put('/api/tools/:id', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const { id } = req.params;
  const { name, description, webhook_url, method } = req.body;

  try {
    const result = await tenantDb.query(
      ctx,
      `UPDATE tools 
       SET name = COALESCE($1, name), 
           description = COALESCE($2, description), 
           webhook_url = COALESCE($3, webhook_url), 
           method = COALESCE($4, method)
       WHERE id = $5 AND company_id = $6
       RETURNING id, name, description, webhook_url, method`,
      [name, description, webhook_url, method, id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update Tool Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete Tool
app.delete('/api/tools/:id', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const { id } = req.params;

  try {
    const result = await tenantDb.query(
      ctx,
      'DELETE FROM tools WHERE id = $1 AND company_id = $2 RETURNING id',
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    res.json({ success: true, message: 'Tool deleted successfully' });
  } catch (error) {
    console.error('Delete Tool Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'tool-engine' });
});

app.listen(PORT, () => {
  console.log(`🚀 Tool Engine Service listening on port ${PORT}`);
});
