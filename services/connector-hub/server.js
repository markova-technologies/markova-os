const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Pool } = require('pg');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const TenantGuard = require('../../kernel/identity/tenant-guard');
const TenantDb = require('../../kernel/identity/tenant-db');
const requestLogger = require('../../kernel/identity/request-logger');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5005;

app.use(cors());
app.use(express.json());
app.use(requestLogger);

// ─────────────────────────────────────────────────────────────────────────────
// File Upload Storage Config
// ─────────────────────────────────────────────────────────────────────────────
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/connector-uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'));
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// PostgreSQL Connection Pool
// ─────────────────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const tenantDb = new TenantDb(pool);

app.use('/api/connector-hub', (req, res, next) => {
  if (req.path.includes('/webhook/')) return next();
  if (req.path.includes('/types')) return next();
  TenantGuard(req, res, next);
});

async function initialize() {
  for (let i = 0; i < 10; i++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('✅ Connector Hub connected to PostgreSQL');
      break;
    } catch (err) {
      console.log(`⚠️ DB connection attempt ${i + 1} failed. Retrying in 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
      if (i === 9) {
        console.error('❌ Connector Hub: DB connection failed permanently.');
        process.exit(1);
      }
    }
  }

  // Ensure connector data tables exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS connector_data_tables (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
      connector_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
      table_name VARCHAR(255) NOT NULL UNIQUE,
      columns JSONB NOT NULL,
      row_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Connector Hub schema ready');
}

initialize();

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTOR TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const CONNECTOR_TYPES = {
  excel: {
    name: 'Excel Connector',
    description: 'Upload .xlsx or .xls files — parsed into searchable tables',
    category: 'file',
    configSchema: { sheetName: 'string?' },
  },
  csv: {
    name: 'CSV Connector',
    description: 'Upload CSV files — parsed into searchable tables',
    category: 'file',
    configSchema: { delimiter: 'string?', hasHeader: 'boolean?' },
  },
  google_sheets: {
    name: 'Google Sheets Connector',
    description: 'Connect a Google Sheet via URL (read-only)',
    category: 'cloud',
    configSchema: { sheetUrl: 'string', sheetName: 'string?', apiKey: 'string?' },
  },
  telegram: {
    name: 'Telegram Connector',
    description: 'Connect a Telegram bot to receive/send messages',
    category: 'messaging',
    configSchema: { botToken: 'string', chatId: 'string?' },
  },
  whatsapp: {
    name: 'WhatsApp Connector',
    description: 'Connect WhatsApp Business API',
    category: 'messaging',
    configSchema: { phoneNumberId: 'string', accessToken: 'string', webhookVerifyToken: 'string' },
  },
  webhook: {
    name: 'Custom Webhook',
    description: 'Push data from any system to Markova via webhook',
    category: 'api',
    configSchema: { secret: 'string?' },
  },
  api: {
    name: 'Custom API Connector',
    description: 'Pull data from any REST API on a schedule',
    category: 'api',
    configSchema: { url: 'string', method: 'string?', headers: 'object?', authType: 'string?' },
  },
  database: {
    name: 'Database Connector',
    description: 'Connect an external PostgreSQL or MySQL database',
    category: 'database',
    configSchema: { connectionString: 'string', query: 'string' },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Safe table name from connector id
// ─────────────────────────────────────────────────────────────────────────────
function safeTableName(connectorId) {
  return `conn_${connectorId.replace(/-/g, '_')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Parse Excel/CSV buffer into rows+columns
// ─────────────────────────────────────────────────────────────────────────────
function parseSpreadsheet(filePath, options = {}) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = options.sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in workbook`);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
  });

  if (rows.length === 0) throw new Error('File is empty');

  // First row is headers
  const rawHeaders = rows[0].map((h, i) => (h ? String(h).trim() : `column_${i + 1}`));
  const headers = rawHeaders.map((h) =>
    h.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^(\d)/, 'col_$1')
  );

  const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell !== null));

  return {
    columns: headers,
    originalHeaders: rawHeaders,
    rows: dataRows.map((row) => {
      const obj = {};
      headers.forEach((col, i) => {
        obj[col] = row[i] !== undefined ? row[i] : null;
      });
      return obj;
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Create dynamic table in Postgres for connector data
// ─────────────────────────────────────────────────────────────────────────────
async function createDynamicTable(ctx, tableName, columns) {
  const colDefs = columns
    .map((col) => `"${col}" TEXT`)
    .join(', ');

  await tenantDb.query(ctx, `
    CREATE TABLE IF NOT EXISTS "${tableName}" (
      _row_id SERIAL PRIMARY KEY,
      ${colDefs},
      _imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Insert rows into dynamic table
// ─────────────────────────────────────────────────────────────────────────────
async function bulkInsertRows(ctx, tableName, columns, rows) {
  if (rows.length === 0) return 0;

  return await tenantDb.withTenant(ctx, async (client) => {
    // Clear existing rows first (for re-sync)
    await client.query(`DELETE FROM "${tableName}"`);

    const colList = columns.map((c) => `"${c}"`).join(', ');
    let inserted = 0;

    // Batch insert in chunks of 500 rows
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const placeholders = chunk
        .map((_, ri) =>
          `(${columns.map((_, ci) => `$${ri * columns.length + ci + 1}`).join(', ')})`
        )
        .join(', ');

      const values = chunk.flatMap((row) =>
        columns.map((col) => (row[col] !== null ? String(row[col]) : null))
      );

      await client.query(
        `INSERT INTO "${tableName}" (${colList}) VALUES ${placeholders}`,
        values
      );
      inserted += chunk.length;
    }

    return inserted;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES: Connector Types (Catalog)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/connector-hub/types', (req, res) => {
  const types = Object.entries(CONNECTOR_TYPES).map(([key, val]) => ({
    type: key,
    ...val,
  }));
  res.json(types);
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES: Integration (Connector) CRUD
// ─────────────────────────────────────────────────────────────────────────────

// List all integrations for a company
app.get('/api/connector-hub/integrations', async (req, res) => {
  const ctx = req.securityContext;

  try {
    const result = await tenantDb.query(
      ctx,
      `SELECT i.id, i.type, i.name, i.status, i.created_at,
              cdt.row_count, cdt.columns, cdt.updated_at as last_synced
       FROM integrations i
       LEFT JOIN connector_data_tables cdt ON cdt.connector_id = i.id
       WHERE i.company_id = $1
       ORDER BY i.created_at DESC`,
      [ctx.tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List Integrations Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get single integration
app.get('/api/connector-hub/integrations/:id', async (req, res) => {
  const ctx = req.securityContext;
  const { id } = req.params;

  try {
    const result = await tenantDb.query(
      ctx,
      `SELECT i.*, cdt.table_name, cdt.columns, cdt.row_count, cdt.updated_at as last_synced
       FROM integrations i
       LEFT JOIN connector_data_tables cdt ON cdt.connector_id = i.id
       WHERE i.id = $1 AND i.company_id = $2`,
      [id, ctx.tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get Integration Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create integration (config only — no data yet)
app.post('/api/connector-hub/integrations', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const { type, name, config } = req.body;

  if (!type || !name) return res.status(400).json({ error: 'type and name are required' });
  if (!CONNECTOR_TYPES[type]) return res.status(400).json({ error: `Unknown connector type: ${type}` });

  try {
    const result = await tenantDb.query(
      ctx,
      `INSERT INTO integrations (company_id, type, name, config)
       VALUES ($1, $2, $3, $4)
       RETURNING id, type, name, status, created_at`,
      [companyId, type, name, JSON.stringify(config || {})]
    );

    // Audit log
    await tenantDb.query(
      ctx,
      `INSERT INTO audit_logs (company_id, action, entity_type, entity_id)
       VALUES ($1, 'INTEGRATION_CREATED', 'integration', $2)`,
      [companyId, result.rows[0].id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create Integration Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete integration
app.delete('/api/connector-hub/integrations/:id', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const { id } = req.params;

  try {
    // Get table name before deleting
    const dtResult = await tenantDb.query(
      ctx,
      'SELECT table_name FROM connector_data_tables WHERE connector_id = $1',
      [id]
    );

    // Drop the dynamic data table if it exists
    if (dtResult.rows.length > 0) {
      const tableName = dtResult.rows[0].table_name;
      await tenantDb.query(ctx, `DROP TABLE IF EXISTS "${tableName}"`);
    }

    const result = await tenantDb.query(
      ctx,
      'DELETE FROM integrations WHERE id = $1 AND company_id = $2 RETURNING id',
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    res.json({ success: true, message: 'Integration deleted successfully' });
  } catch (err) {
    console.error('Delete Integration Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: Upload Excel / CSV file and ingest data
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/connector-hub/integrations/:id/upload', upload.single('file'), async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const { id } = req.params;

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const runId = null; // Will be set after creating run record
  let connectorRunId;

  try {
    // 1. Verify integration belongs to company
    const integResult = await tenantDb.query(
      ctx,
      'SELECT id, type, name, config FROM integrations WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );

    if (integResult.rows.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Integration not found' });
    }

    const integration = integResult.rows[0];
    if (!['excel', 'csv'].includes(integration.type)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: `File upload not supported for connector type: ${integration.type}` });
    }

    // 2. Create connector run record
    const runResult = await tenantDb.query(
      ctx,
      `INSERT INTO connector_runs (company_id, connector_id, status)
       VALUES ($1, $2, 'running')
       RETURNING id`,
      [companyId, id]
    );
    connectorRunId = runResult.rows[0].id;

    // 3. Parse the uploaded file
    const config = integration.config || {};
    const parsed = parseSpreadsheet(req.file.path, {
      sheetName: config.sheetName,
    });

    if (parsed.rows.length === 0) {
      throw new Error('File parsed successfully but contains no data rows');
    }

    // 4. Create dynamic table if needed
    const tableName = safeTableName(id);
    await createDynamicTable(ctx, tableName, parsed.columns);

    // 5. Bulk insert data
    const rowsInserted = await bulkInsertRows(ctx, tableName, parsed.columns, parsed.rows);

    // 6. Upsert connector_data_tables metadata
    await tenantDb.query(
      ctx,
      `INSERT INTO connector_data_tables (company_id, connector_id, table_name, columns, row_count)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (table_name) DO UPDATE
         SET columns = $4,
             row_count = $5,
             updated_at = CURRENT_TIMESTAMP`,
      [companyId, id, tableName, JSON.stringify(parsed.columns), rowsInserted]
    );

    // 7. Update connector run as completed
    await tenantDb.query(
      ctx,
      `UPDATE connector_runs
       SET status = 'completed', records_processed = $1, finished_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [rowsInserted, connectorRunId]
    );

    // 8. Update integration status
    await tenantDb.query(
      ctx,
      'UPDATE integrations SET status = $1 WHERE id = $2',
      ['active', id]
    );

    // Cleanup uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      rowsIngested: rowsInserted,
      columns: parsed.originalHeaders,
      tableName,
      runId: connectorRunId,
    });
  } catch (err) {
    console.error('Upload Error:', err);

    // Cleanup
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Mark run as failed
    if (connectorRunId) {
      await tenantDb.query(
        ctx,
        `UPDATE connector_runs
         SET status = 'failed', error_message = $1, finished_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [err.message, connectorRunId]
      ).catch(() => {});
    }

    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: Query data from a connector (for the Orchestrator/Agent)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/connector-hub/integrations/:id/query', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const { id } = req.params;
  const { search, filters, limit = 10, offset = 0 } = req.body;

  try {
    // Get the connector data table
    const dtResult = await tenantDb.query(
      ctx,
      `SELECT cdt.table_name, cdt.columns
       FROM connector_data_tables cdt
       JOIN integrations i ON i.id = cdt.connector_id
       WHERE cdt.connector_id = $1 AND i.company_id = $2`,
      [id, companyId]
    );

    if (dtResult.rows.length === 0) {
      return res.status(404).json({ error: 'No data found for this connector. Please upload or sync data first.' });
    }

    const { table_name: tableName, columns } = dtResult.rows[0];
    const cols = typeof columns === 'string' ? JSON.parse(columns) : columns;

    let query = `SELECT * FROM "${tableName}"`;
    const params = [];
    const conditions = [];

    // Full text search across all columns
    if (search) {
      const searchConditions = cols.map((col, i) => {
        params.push(`%${search}%`);
        return `"${col}"::text ILIKE $${params.length}`;
      });
      conditions.push(`(${searchConditions.join(' OR ')})`);
    }

    // Column-specific filters
    if (filters && typeof filters === 'object') {
      Object.entries(filters).forEach(([col, val]) => {
        if (cols.includes(col)) {
          params.push(val);
          conditions.push(`"${col}" = $${params.length}`);
        }
      });
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Get total count
    const countResult = await tenantDb.query(
      ctx,
      `SELECT COUNT(*) FROM "${tableName}"${conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Paginated results
    params.push(limit);
    params.push(offset);
    query += ` ORDER BY _row_id ASC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await tenantDb.query(ctx, query, params);

    res.json({
      columns: cols,
      rows: result.rows,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error('Query Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: Webhook Receiver (data push from external systems)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/connector-hub/webhook/:connectorId', async (req, res) => {
  const { connectorId } = req.params;
  const payload = req.body;

  try {
    const integResult = await pool.query(
      'SELECT id, company_id, type, config FROM integrations WHERE id = $1 AND type = $2',
      [connectorId, 'webhook']
    );

    if (integResult.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook connector not found' });
    }

    const integration = integResult.rows[0];
    const ctx = { tenantId: integration.company_id, isServiceAccount: true };
    const config = integration.config || {};

    // Optional secret verification
    if (config.secret) {
      const receivedSecret = req.headers['x-webhook-secret'];
      if (receivedSecret !== config.secret) {
        return res.status(401).json({ error: 'Invalid webhook secret' });
      }
    }

    // Upsert to connector data
    const tableName = safeTableName(connectorId);
    const columns = Object.keys(payload).map((k) =>
      k.toLowerCase().replace(/[^a-z0-9_]/g, '_')
    );

    await createDynamicTable(ctx, tableName, columns);

    const colList = columns.map((c) => `"${c}"`).join(', ');
    const vals = columns.map((_, i) => `$${i + 1}`).join(', ');
    const values = columns.map((col) => {
      const origKey = Object.keys(payload).find(
        (k) => k.toLowerCase().replace(/[^a-z0-9_]/g, '_') === col
      );
      return origKey ? String(payload[origKey]) : null;
    });

    await tenantDb.query(
      ctx,
      `INSERT INTO "${tableName}" (${colList}) VALUES (${vals})`,
      values
    );

    // Update metadata
    const count = await tenantDb.query(ctx, `SELECT COUNT(*) FROM "${tableName}"`);
    await tenantDb.query(
      ctx,
      `INSERT INTO connector_data_tables (company_id, connector_id, table_name, columns, row_count)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (table_name) DO UPDATE
         SET columns = $4, row_count = $5, updated_at = CURRENT_TIMESTAMP`,
      [integration.company_id, connectorId, tableName, JSON.stringify(columns), parseInt(count.rows[0].count)]
    );

    res.json({ success: true, message: 'Data received' });
  } catch (err) {
    console.error('Webhook Receiver Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: Connector Run History
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/connector-hub/integrations/:id/runs', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const { id } = req.params;

  try {
    const result = await tenantDb.query(
      ctx,
      `SELECT id, status, records_processed, started_at, finished_at, error_message
       FROM connector_runs
       WHERE connector_id = $1 AND company_id = $2
       ORDER BY started_at DESC
       LIMIT 20`,
      [id, companyId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Runs History Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: Preview connector data (first 50 rows)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/connector-hub/integrations/:id/preview', async (req, res) => {
  const ctx = req.securityContext;
  const companyId = ctx.tenantId;
  const { id } = req.params;

  try {
    const dtResult = await tenantDb.query(
      ctx,
      `SELECT cdt.table_name, cdt.columns, cdt.row_count
       FROM connector_data_tables cdt
       JOIN integrations i ON i.id = cdt.connector_id
       WHERE cdt.connector_id = $1 AND i.company_id = $2`,
      [id, companyId]
    );

    if (dtResult.rows.length === 0) {
      return res.status(404).json({ error: 'No data yet. Upload a file or sync first.' });
    }

    const { table_name: tableName, columns, row_count } = dtResult.rows[0];
    const result = await tenantDb.query(ctx, `SELECT * FROM "${tableName}" ORDER BY _row_id ASC LIMIT 50`);

    res.json({
      columns: typeof columns === 'string' ? JSON.parse(columns) : columns,
      rows: result.rows,
      total: row_count,
    });
  } catch (err) {
    console.error('Preview Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: Google Sheets Config Schema (returns what fields to collect)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/connector-hub/types/:type/schema', (req, res) => {
  const { type } = req.params;
  const connType = CONNECTOR_TYPES[type];
  if (!connType) return res.status(404).json({ error: `Unknown connector type: ${type}` });
  res.json(connType);
});

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'connector-hub', version: '2.0.0' });
});

app.listen(PORT, () => {
  console.log(`🚀 Connector Hub listening on port ${PORT}`);
});
