const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { createClient } = require('redis');
const axios = require('axios');
const dns = require('dns').promises;
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
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});
const tenantDb = new TenantDb(pool);

// Unauthenticated health check for orchestration and cloud probes
app.get(['/health', '/api/health', '/v1/health'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'tool-engine',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

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
      console.log(`⚠️ Database connection attempt ${i + 1} failed (${err.message}). Retrying in 3000ms...`);
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
      startRetryWorker();
      break;
    } catch (err) {
      console.log(`⚠️ Redis connection attempt ${i + 1} failed (${err.message}). Retrying in 3000ms...`);
      await new Promise(res => setTimeout(res, 3000));
    }
  }
  if (!redisConnected) {
    console.error('❌ Tool Redis connection failed');
    process.exit(1);
  }
}

if (require.main === module) {
  initialize();
}

function decodeIpv4Octets(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim().toLowerCase();

  // 1. Dotted-decimal format: e.g. "127.0.0.1" or "169.254.169.254"
  const dotMatch = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (dotMatch) {
    const octets = dotMatch.slice(1).map(Number);
    if (octets.every(o => o <= 255)) {
      return octets;
    }
    return null;
  }

  // 2. Colon-hex format from WHATWG URL parser or IPv6 hex words: e.g. "7f00:1" or "a9fe:a9fe"
  const hexMatch = s.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMatch) {
    const high = parseInt(hexMatch[1], 16);
    const low = parseInt(hexMatch[2], 16);
    if (isNaN(high) || isNaN(low) || high > 0xffff || low > 0xffff) return null;
    const a = (high >> 8) & 0xff;
    const b = high & 0xff;
    const c = (low >> 8) & 0xff;
    const d = low & 0xff;
    return [a, b, c, d];
  }

  return null;
}

function isRestrictedIpv4(a, b, c, d) {
  if (a > 255 || b > 255 || c > 255 || d > 255) return true;
  if (a === 0) return true;                          // 0.0.0.0/8 (Current network)
  if (a === 10) return true;                         // 10.0.0.0/8 (RFC 1918)
  if (a === 127) return true;                        // 127.0.0.0/8 (Loopback)
  if (a === 169 && b === 254) return true;           // 169.254.0.0/16 (Link-Local & Cloud Metadata, 169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12 (RFC 1918)
  if (a === 192 && b === 168) return true;          // 192.168.0.0/16 (RFC 1918)
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a >= 224) return true;                         // 224.0.0.0/4 (Multicast & Reserved)
  return false;
}

function isPrivateOrRestrictedIp(ip) {
  if (!ip || typeof ip !== 'string') return true;
  let normalized = ip.toLowerCase().trim().replace(/^\[|\]$/g, '');

  // 1. Direct standard IPv4 dotted-decimal
  const directIpv4 = decodeIpv4Octets(normalized);
  if (directIpv4 && normalized.includes('.')) {
    return isRestrictedIpv4(...directIpv4);
  }

  // 2. IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  // Covers compressed ::ffff: and uncompressed 0:0:0:0:0:ffff:
  if (
    normalized.startsWith('::ffff:') ||
    normalized.startsWith('0:0:0:0:0:ffff:') ||
    normalized.startsWith('0000:0000:0000:0000:0000:ffff:')
  ) {
    const ffffIndex = normalized.indexOf('ffff:');
    const rest = normalized.slice(ffffIndex + 5);
    const octets = decodeIpv4Octets(rest);
    // If an IP starts with ::ffff: and cannot be parsed into 4 valid public octets, fail closed
    if (!octets) return true;
    return isRestrictedIpv4(...octets);
  }

  // 3. IPv4-compatible IPv6 (deprecated, e.g. ::127.0.0.1 or ::7f00:1)
  if (
    (normalized.startsWith('::') && !normalized.startsWith('::ffff:')) ||
    normalized.startsWith('0:0:0:0:0:0:') ||
    normalized.startsWith('0000:0000:0000:0000:0000:0000:')
  ) {
    // ::1 loopback or :: unspecified
    if (normalized === '::1' || normalized === '::' || /^(0|:)*1$/.test(normalized) || /^[0:]+$/.test(normalized)) {
      return true;
    }
    const rest = normalized.startsWith('::')
      ? normalized.slice(2)
      : normalized.replace(/^(?:0000|0):(?:0000|0):(?:0000|0):(?:0000|0):(?:0000|0):(?:0000|0):/, '');
    const octets = decodeIpv4Octets(rest);
    if (octets) {
      if (isRestrictedIpv4(...octets)) return true;
      // Deprecated IPv4-compatible format is not permitted for outbound webhooks
      return true;
    }
  }

  // 4. IPv6 Loopback, Unspecified, Link-Local, ULA, Multicast, Documentation
  if (normalized === '::1' || normalized === '::') return true;
  if (/^(0|:)*1$/.test(normalized) || /^[0:]+$/.test(normalized)) return true;
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true; // fe80::/10
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // fc00::/7
  if (normalized.startsWith('ff')) return true; // ff00::/8 multicast
  if (normalized.startsWith('2001:db8:') || normalized.startsWith('2001:0db8:')) return true; // documentation

  return false;
}

async function isSafeWebhookUrl(urlString) {
  try {
    if (!urlString || typeof urlString !== 'string') return false;
    const parsed = new URL(urlString);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const rawHostname = parsed.hostname.toLowerCase();
    const cleanHostname = rawHostname.replace(/^\[|\]$/g, '');
    if (
      cleanHostname === 'localhost' ||
      cleanHostname.endsWith('.local') ||
      cleanHostname.endsWith('.internal') ||
      cleanHostname === 'metadata.google.internal'
    ) {
      return false;
    }
    if (isPrivateOrRestrictedIp(cleanHostname)) {
      return false;
    }
    const addresses = await dns.lookup(cleanHostname, { all: true });
    if (!addresses || addresses.length === 0) return false;
    for (const addr of addresses) {
      if (isPrivateOrRestrictedIp(addr.address)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

// Unified Plugin Execution Interface
class WebhookPlugin {
  async execute(tool, payload) {
    const isSafe = await isSafeWebhookUrl(tool.webhook_url);
    if (!isSafe) {
      throw new Error(`SSRF Blocked: Webhook target URL ${tool.webhook_url} is not permitted.`);
    }

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

// Background retry loop (runs every 10 seconds once Redis connects)
function startRetryWorker() {
  setInterval(async () => {
    try {
      if (!redisClient.isOpen) return;
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
}

function planAllowsExecution(plan) {
  const p = String(plan || 'starter').toLowerCase();
  return p === 'pro' || p === 'plus';
}

function thresholdForAction(workflowSettings, actionType) {
  const thresholds = (workflowSettings && workflowSettings.confidence_thresholds) || {};
  const key = String(actionType || 'default').toLowerCase();
  const raw = thresholds[key] != null ? thresholds[key] : thresholds.default;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0.85;
}

async function writeToolAudit(ctx, companyId, userId, action, toolId, details) {
  const uid =
    userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
      ? userId
      : null;
  await tenantDb.query(
    ctx,
    `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, new_value, reason)
     VALUES ($1, $2, $3, 'tool', $4, $5::jsonb, $6)`,
    [companyId, uid, action, toolId, JSON.stringify(details || {}), details?.reason || null]
  );
}

// Endpoint: Execute Tool (body.toolId) + /v1 alias POST /api/tools/:id/execute
async function executeToolHandler(req, res, toolIdOverride) {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const userId = ctx.userId || null;
  const toolId = toolIdOverride || req.body.toolId;
  const payload = req.body.payload || req.body;
  const confidence = Number(req.body.confidence ?? payload.confidence ?? 1);
  const actionType = req.body.action_type || payload.action_type || 'default';
  const callId = req.body.call_id || payload.call_id || null;

  if (!toolId) return res.status(400).json({ error: 'Tool ID is required' });

  try {
    const companyRes = await tenantDb.query(
      ctx,
      'SELECT plan, workflow_settings FROM companies WHERE id = $1',
      [companyId]
    );
    if (companyRes.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    const { plan, workflow_settings: workflowSettings } = companyRes.rows[0];

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
    const threshold = thresholdForAction(workflowSettings, actionType);
    const conf = Number.isFinite(confidence) ? confidence : 0;

    // Basic/starter: propose only — never auto-execute on the business system
    if (!planAllowsExecution(plan)) {
      await writeToolAudit(ctx, companyId, userId, 'TOOL_PROPOSED', toolId, {
        plan,
        confidence: conf,
        threshold,
        action_type: actionType,
        call_id: callId,
        payload,
        reason: 'Plan does not include workflow execution (upgrade to Pro/Plus)',
      });
      return res.status(202).json({
        success: false,
        executed: false,
        status: 'proposed',
        plan,
        message: 'Action recorded for dashboard review. Execution requires Pro or Plus.',
        confidence: conf,
        threshold,
      });
    }

    // Below confidence threshold → human approval queue
    if (conf < threshold) {
      const approval = await tenantDb.query(
        ctx,
        `INSERT INTO approval_queue
           (company_id, requester_id, requester_type, action, context, reason, status)
         VALUES ($1, $2, 'agent', $3, $4::jsonb, $5, 'pending')
         RETURNING id, status, created_at`,
        [
          companyId,
          null,
          `tool.execute:${tool.name}`,
          JSON.stringify({ tool_id: toolId, call_id: callId, action_type: actionType, confidence: conf, threshold, payload }),
          `Confidence ${conf} below threshold ${threshold} for action_type=${actionType}`,
        ]
      );
      await writeToolAudit(ctx, companyId, userId, 'TOOL_PENDING_APPROVAL', toolId, {
        plan,
        confidence: conf,
        threshold,
        action_type: actionType,
        call_id: callId,
        approval_id: approval.rows[0].id,
        payload,
        reason: 'Below confidence threshold',
      });
      return res.status(202).json({
        success: false,
        executed: false,
        status: 'pending_approval',
        approval_id: approval.rows[0].id,
        confidence: conf,
        threshold,
        action_type: actionType,
      });
    }

    // 2. Dispatch execution to appropriate plugin
    const pluginType = tool.type || 'webhook';
    const plugin = plugins[pluginType];

    if (!plugin) {
      return res.status(400).json({ error: `Unsupported tool type: ${pluginType}` });
    }

    try {
      const responseData = await plugin.execute(tool, payload);

      await writeToolAudit(ctx, companyId, userId, 'TOOL_EXECUTED', toolId, {
        plan,
        confidence: conf,
        threshold,
        action_type: actionType,
        call_id: callId,
        response: responseData,
        reason: 'Auto-executed above confidence threshold',
      });

      await eventBus.publish(EventTypes.TOOL_EXECUTED, {
        tenantId: companyId,
        toolId: toolId,
        agentId: payload.agentId || 'unknown',
        success: true,
        callId,
        confidence: conf,
        executionTimeMs: 100
      }, { source: 'tool-engine' });

      res.json({
        success: true,
        executed: true,
        status: 'executed',
        confidence: conf,
        threshold,
        response: responseData,
      });
    } catch (err) {
      console.error(`Tool Execution Failed: ${err.message}. Enqueueing retry job...`);

      await writeToolAudit(ctx, companyId, userId, 'TOOL_FAILED', toolId, {
        plan,
        confidence: conf,
        threshold,
        action_type: actionType,
        call_id: callId,
        error: err.message,
        reason: 'Execution failed; retry scheduled',
      });

      await eventBus.publish(EventTypes.TOOL_FAILED, {
        tenantId: companyId,
        toolId: toolId,
        agentId: payload.agentId || 'unknown',
        success: false,
        error: err.message
      }, { source: 'tool-engine' });

      await queueRetry(companyId, toolId, payload, 1);

      res.status(202).json({
        success: false,
        executed: false,
        status: 'retry_scheduled',
        message: 'Tool execution timed out or failed. Scheduled for retry.',
        retryScheduled: true
      });
    }
  } catch (error) {
    console.error('Execute Tool Router Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

app.post('/api/tools/execute', (req, res) => executeToolHandler(req, res));
app.post('/api/tools/:id/execute', (req, res) => executeToolHandler(req, res, req.params.id));

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

function auditUserId(userId) {
  if (!userId) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
    ? userId
    : null;
}

// Create Tool
app.post('/api/tools', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const userId = auditUserId(ctx.userId);
  const { name, description, webhook_url, method } = req.body;

  if (!name || !webhook_url) return res.status(400).json({ error: 'Name and Webhook URL are required' });

  const isSafe = await isSafeWebhookUrl(webhook_url);
  if (!isSafe) {
    return res.status(400).json({ error: 'SSRF Blocked: Webhook target URL is not permitted' });
  }

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
    if (webhook_url) {
      const isSafe = await isSafeWebhookUrl(webhook_url);
      if (!isSafe) {
        return res.status(400).json({ error: 'SSRF Blocked: Webhook target URL is not permitted' });
      }
    }
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

let server = null;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`🚀 Tool Engine Service listening on port ${PORT}`);
  });
}

const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      try {
        await pool.end();
        if (redisClient?.isOpen) {
          await redisClient.quit();
        }
        console.log('Tool Engine Service closed all connections cleanly.');
        process.exit(0);
      } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server, isPrivateOrRestrictedIp, isSafeWebhookUrl };
