const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const TenantGuard = require('../../kernel/identity/tenant-guard');
const TenantDb = require('../../kernel/identity/tenant-db');
const requestLogger = require('../../kernel/identity/request-logger');

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestLogger);

const PORT = process.env.PORT || 6004;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/markova' });
const tenantDb = new TenantDb(pool);

app.use('/api', TenantGuard);

// Get Memory
app.get('/api/memory/:entityType/:entityId/:key', async (req, res) => {
  const ctx = req.securityContext;
  const { entityType, entityId, key } = req.params;

  try {
    const result = await tenantDb.query(
      ctx,
      'SELECT value FROM memory_entries WHERE company_id = $1 AND entity_type = $2 AND entity_id = $3 AND key = $4',
      [ctx.tenantId, entityType, entityId, key]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Memory not found' });
    res.json({ value: result.rows[0].value });
  } catch (error) {
    console.error('Get memory error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Set Memory
app.post('/api/memory/:entityType/:entityId/:key', async (req, res) => {
  const ctx = req.securityContext;
  const { entityType, entityId, key } = req.params;
  const { value } = req.body;

  try {
    await tenantDb.query(
      ctx,
      `INSERT INTO memory_entries (company_id, entity_type, entity_id, key, value)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (company_id, entity_type, entity_id, key) DO UPDATE 
       SET value = EXCLUDED.value, updated_at = NOW()`,
      [ctx.tenantId, entityType, entityId, key, JSON.stringify(value)]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Set memory error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'memory-runtime' });
});

app.listen(PORT, () => {
  console.log(`🚀 Memory Runtime listening on port ${PORT}`);
});
