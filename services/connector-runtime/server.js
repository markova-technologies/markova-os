const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { GoogleSheetsConnector } = require('../../kernel/connector');
const EventBus = require('../../kernel/events/bus');
const { EventTypes } = require('../../kernel/events/registry');
const TenantGuard = require('../../kernel/identity/tenant-guard');
const TenantDb = require('../../kernel/identity/tenant-db');
const requestLogger = require('../../kernel/identity/request-logger');

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestLogger);

const PORT = process.env.PORT || 6008;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/markova' });
const eventBus = new EventBus(process.env.REDIS_URL || 'redis://redis:6379');
const tenantDb = new TenantDb(pool);

app.use('/api', TenantGuard);

const adapters = {
  'google_sheet': new GoogleSheetsConnector()
};

// Register a new integration
app.post('/api/connectors', async (req, res) => {
  const ctx = req.securityContext;
  const { type, name, config } = req.body;

  if (!type || !adapters[type]) {
    return res.status(400).json({ error: 'Valid type required' });
  }

  try {
    const adapter = adapters[type];
    await adapter.connect(config);

    const result = await tenantDb.query(
      ctx,
      'INSERT INTO integrations (company_id, type, name, config) VALUES ($1, $2, $3, $4) RETURNING id',
      [ctx.tenantId, type, name, JSON.stringify(config)]
    );

    res.json({ success: true, integrationId: result.rows[0].id });
  } catch (error) {
    console.error('Connector creation error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Trigger a sync manually
app.post('/api/connectors/:id/sync', async (req, res) => {
  const ctx = req.securityContext;
  const { id } = req.params;

  try {
    const result = await tenantDb.query(ctx, 'SELECT * FROM integrations WHERE id = $1 AND company_id = $2', [id, ctx.tenantId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const integration = result.rows[0];
    const adapter = adapters[integration.type];

    const syncResult = await adapter.syncDown(integration.config, null);

    // Publish event
    await eventBus.publish(EventTypes.INTEGRATION_SYNCED, {
      tenantId: ctx.tenantId,
      integrationId: id,
      type: integration.type,
      recordsProcessed: syncResult.records.length,
      success: true
    }, { source: 'connector-runtime' });

    res.json({ success: true, syncResult });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'connector-runtime' });
});

app.listen(PORT, () => {
  console.log(`🚀 Connector Runtime listening on port ${PORT}`);
});
