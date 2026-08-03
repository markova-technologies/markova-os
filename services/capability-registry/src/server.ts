import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import axios from 'axios';
import dotenv from 'dotenv';
import { Capability, CapabilityType, CapabilityStatus } from '@markova/shared-types';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5005;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Helper for tenant context extraction
function getTenantId(req: Request): string {
  const tenantId = (req.headers['x-company-id'] || req.headers['x-tenant-id']) as string;
  if (!tenantId) {
    throw new Error('Tenant context (X-Company-ID or X-Tenant-ID) is required');
  }
  return tenantId;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPABILITY REGISTRY ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', service: 'capability-registry', version: '1.0.0' });
});

// 1. Discovery: List Capabilities for Tenant
app.get('/v1/capabilities', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const result = await pool.query(
      `SELECT id, company_id, name, type, webhook_url, created_at 
       FROM tools 
       WHERE company_id = $1 ORDER BY name ASC`,
      [tenantId]
    );

    const capabilities: Capability[] = result.rows.map(row => ({
      id: row.id,
      company_id: row.company_id,
      name: row.name,
      description: row.name,
      type: (row.type as CapabilityType) || CapabilityType.TOOL,
      version: '1.0.0',
      schema: { webhook_url: row.webhook_url },
      permissions: ['*'],
      status: CapabilityStatus.ACTIVE,
      created_at: row.created_at
    }));

    res.json({ success: true, capabilities });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 2. Register/Update Capability
app.post('/v1/capabilities', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { name, type, webhook_url, method = 'POST' } = req.body;

    if (!name || !webhook_url) {
      return res.status(400).json({ error: 'Name and webhook_url are required' });
    }

    const result = await pool.query(
      `INSERT INTO tools (company_id, name, type, webhook_url, method)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, type, webhook_url, created_at`,
      [tenantId, name, type || 'webhook', webhook_url, method]
    );

    const tool = result.rows[0];
    res.status(201).json({
      success: true,
      capability: {
        id: tool.id,
        company_id: tenantId,
        name: tool.name,
        type: tool.type,
        version: '1.0.0',
        schema: { webhook_url: tool.webhook_url },
        permissions: ['*'],
        status: CapabilityStatus.ACTIVE,
        created_at: tool.created_at
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Permissions Verification
app.post('/v1/capabilities/verify', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { capabilityId, agentId } = req.body;

    if (!capabilityId) {
      return res.status(400).json({ error: 'capabilityId is required' });
    }

    const result = await pool.query(
      `SELECT id FROM tools WHERE id = $1 AND company_id = $2`,
      [capabilityId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ allowed: false, reason: 'Capability not owned by tenant or inactive' });
    }

    res.json({ allowed: true, capabilityId, agentId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Execution Proxy
app.post('/v1/capabilities/:id/execute', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const payload = req.body;

    const toolRes = await pool.query(
      `SELECT webhook_url, method FROM tools WHERE id = $1 AND company_id = $2`,
      [id, tenantId]
    );

    if (toolRes.rows.length === 0) {
      return res.status(404).json({ error: 'Capability not found or unauthorized' });
    }

    const { webhook_url, method } = toolRes.rows[0];

    // Proxy execution call
    const response = await axios({
      method: method || 'POST',
      url: webhook_url,
      data: payload,
      headers: {
        'x-tenant-id': tenantId,
        'x-source': 'markova-capability-registry'
      },
      timeout: 15000
    });

    res.json({
      success: true,
      status: response.status,
      data: response.data
    });
  } catch (err: any) {
    console.error('Capability execution error:', err.message);
    res.status(502).json({
      error: 'Capability execution failed',
      details: err.response?.data || err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Capability Registry microservice running on port ${PORT}`);
});
