import sys

with open("server.js", "r", encoding="utf-8") as f:
    content = f.read()

injection_point = "// Get Company Usage Metrics (Phase 3 - sum of ledger events)"

webhook_code = """
// ─── Phase 12: Developer Webhooks ──────────────────────────────────────────────────

app.get('/api/tenant/webhooks', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const result = await tenantDb.query(ctx, 
      'SELECT id, environment, webhook_url, created_at, updated_at FROM developer_webhooks WHERE company_id =  ORDER BY created_at DESC',
      [ctx.tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch Webhooks Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/tenant/webhooks', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const { environment = 'test', webhook_url } = req.body;
    
    if (!webhook_url) return res.status(400).json({ error: 'webhook_url is required' });
    if (environment !== 'test' && environment !== 'live') {
      return res.status(400).json({ error: 'environment must be "test" or "live"' });
    }

    const { randomBytes } = require('crypto');
    const secret_key = 'whsec_' + randomBytes(32).toString('hex');

    const result = await tenantDb.query(ctx,
      INSERT INTO developer_webhooks (company_id, environment, webhook_url, secret_key)
       VALUES (, , , )
       ON CONFLICT (company_id, environment) 
       DO UPDATE SET webhook_url = EXCLUDED.webhook_url, updated_at = CURRENT_TIMESTAMP
       RETURNING id, environment, webhook_url, secret_key, created_at, updated_at,
      [ctx.tenantId, environment, webhook_url, secret_key]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create Webhook Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/tenant/webhooks/:environment', async (req, res) => {
  try {
    const ctx = req.securityContext;
    const result = await tenantDb.query(ctx,
      DELETE FROM developer_webhooks WHERE environment =  AND company_id =  RETURNING id,
      [req.params.environment, ctx.tenantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found for this environment' });
    }
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Delete Webhook Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get Company Usage Metrics (Phase 3 - sum of ledger events)
"""

if injection_point in content:
    content = content.replace(injection_point, webhook_code.strip())
    with open("server.js", "w", encoding="utf-8") as f:
        f.write(content)
    print("Patch successful")
else:
    print("Injection point not found")
