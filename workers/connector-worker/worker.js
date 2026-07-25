/**
 * Markova Connector Worker
 * ─────────────────────────────────────────────────────────────────────────────
 * Background service that processes the connector sync queue from Redis.
 * 
 * Handles:
 *   - Scheduled API connector pulls
 *   - Google Sheets sync
 *   - External DB polling
 *   - Retry logic for failed syncs
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Pool } = require('pg');
const { createClient } = require('redis');
const axios = require('axios');
require('dotenv').config();

// ─────────────────────────────────────────────────────────────────────────────
// Connections
// ─────────────────────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const redis = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
redis.on('error', (err) => console.error('Redis Error:', err));

// ─────────────────────────────────────────────────────────────────────────────
// Worker Constants
// ─────────────────────────────────────────────────────────────────────────────
const SYNC_QUEUE = 'connector_sync_queue';
const POLL_INTERVAL_MS = 5000;       // Check queue every 5 seconds
const SCHEDULE_INTERVAL_MS = 60000;  // Check for scheduled syncs every 1 minute

// ─────────────────────────────────────────────────────────────────────────────
// Startup
// ─────────────────────────────────────────────────────────────────────────────
async function init() {
  console.log('🔄 Connector Worker starting...');

  // Connect DB with retry
  for (let i = 0; i < 10; i++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('✅ Worker connected to PostgreSQL');
      break;
    } catch (err) {
      console.log(`⚠️ DB attempt ${i + 1}/10 failed. Retrying in 3s...`);
      await sleep(3000);
      if (i === 9) { console.error('❌ DB connection failed.'); process.exit(1); }
    }
  }

  // Connect Redis with retry
  for (let i = 0; i < 10; i++) {
    try {
      await redis.connect();
      console.log('✅ Worker connected to Redis');
      break;
    } catch (err) {
      console.log(`⚠️ Redis attempt ${i + 1}/10 failed. Retrying in 3s...`);
      await sleep(3000);
      if (i === 9) { console.error('❌ Redis connection failed.'); process.exit(1); }
    }
  }

  console.log('🚀 Connector Worker running. Listening for jobs...');

  // Start loops
  processQueueLoop();
  scheduledSyncLoop();
}

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE PROCESSOR
// Continuously polls Redis queue and processes sync jobs
// ─────────────────────────────────────────────────────────────────────────────
async function processQueueLoop() {
  while (true) {
    try {
      const jobRaw = await redis.lPop(SYNC_QUEUE);
      if (jobRaw) {
        const job = JSON.parse(jobRaw);
        console.log(`⚙️ Processing sync job: connector=${job.connectorId} type=${job.type}`);
        await processSyncJob(job);
      }
    } catch (err) {
      console.error('Queue loop error:', err.message);
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED SYNC LOOP
// Every minute, checks for active API/Sheets connectors and enqueues them
// ─────────────────────────────────────────────────────────────────────────────
async function scheduledSyncLoop() {
  while (true) {
    await sleep(SCHEDULE_INTERVAL_MS);
    try {
      console.log('⏰ Checking for scheduled connector syncs...');

      // Find all active API and Google Sheet connectors
      const result = await pool.query(
        `SELECT id, company_id, type, name, config
         FROM integrations
         WHERE type IN ('api', 'google_sheets', 'database')
           AND status = 'active'`
      );

      for (const connector of result.rows) {
        // Check if it's time to sync (simple: sync every configured interval or default 15min)
        const config = connector.config || {};
        const intervalMinutes = config.syncIntervalMinutes || 15;

        // Check last sync time
        const lastRun = await pool.query(
          `SELECT finished_at FROM connector_runs
           WHERE connector_id = $1 AND status = 'completed'
           ORDER BY finished_at DESC LIMIT 1`,
          [connector.id]
        );

        const needsSync = lastRun.rows.length === 0 ||
          (Date.now() - new Date(lastRun.rows[0].finished_at).getTime()) > intervalMinutes * 60 * 1000;

        if (needsSync) {
          console.log(`📅 Scheduling sync for: ${connector.name} (${connector.type})`);
          await redis.rPush(SYNC_QUEUE, JSON.stringify({
            connectorId: connector.id,
            companyId: connector.company_id,
            type: connector.type,
            config: connector.config,
            scheduledAt: Date.now(),
          }));
        }
      }
    } catch (err) {
      console.error('Scheduled sync loop error:', err.message);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JOB PROCESSOR
// Routes sync job to the correct handler based on connector type
// ─────────────────────────────────────────────────────────────────────────────
async function processSyncJob(job) {
  const { connectorId, companyId, type, config } = job;

  // Create run record
  const runResult = await pool.query(
    `INSERT INTO connector_runs (company_id, connector_id, status)
     VALUES ($1, $2, 'running')
     RETURNING id`,
    [companyId, connectorId]
  );
  const runId = runResult.rows[0].id;

  try {
    let rowsProcessed = 0;

    switch (type) {
      case 'api':
        rowsProcessed = await syncApiConnector(connectorId, companyId, config);
        break;
      case 'google_sheets':
        rowsProcessed = await syncGoogleSheetsConnector(connectorId, companyId, config);
        break;
      case 'database':
        rowsProcessed = await syncDatabaseConnector(connectorId, companyId, config);
        break;
      default:
        console.log(`⚠️ No sync handler for type: ${type}. Skipping.`);
        rowsProcessed = 0;
    }

    // Mark completed
    await pool.query(
      `UPDATE connector_runs
       SET status = 'completed', records_processed = $1, finished_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [rowsProcessed, runId]
    );

    console.log(`✅ Sync complete for connector ${connectorId}: ${rowsProcessed} rows processed`);
  } catch (err) {
    console.error(`❌ Sync failed for connector ${connectorId}:`, err.message);

    await pool.query(
      `UPDATE connector_runs
       SET status = 'failed', error_message = $1, finished_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [err.message, runId]
    );

    // Retry: push back with attempt count
    const attempt = (job.attempt || 0) + 1;
    if (attempt <= 3) {
      const backoffMs = attempt * 30000; // 30s, 60s, 90s backoff
      console.log(`⏳ Retry #${attempt} for connector ${connectorId} in ${backoffMs / 1000}s`);
      setTimeout(async () => {
        await redis.rPush(SYNC_QUEUE, JSON.stringify({ ...job, attempt }));
      }, backoffMs);
    } else {
      console.error(`💀 Connector ${connectorId} failed permanently after 3 retries`);
      await pool.query(
        'UPDATE integrations SET status = $1 WHERE id = $2',
        ['error', connectorId]
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * API Connector: Pull data from external REST API and store
 */
async function syncApiConnector(connectorId, companyId, config) {
  const { url, method = 'GET', headers = {}, dataPath } = config;

  const response = await axios({
    method,
    url,
    headers: {
      'User-Agent': 'Markova-Connector/2.0',
      ...headers,
    },
    timeout: 15000,
  });

  let data = response.data;

  // Navigate to nested array if dataPath specified (e.g., "results" or "data.items")
  if (dataPath) {
    const parts = dataPath.split('.');
    for (const part of parts) {
      data = data[part];
    }
  }

  if (!Array.isArray(data)) {
    data = [data]; // Wrap single object
  }

  if (data.length === 0) return 0;

  return await upsertConnectorData(connectorId, companyId, data);
}

/**
 * Google Sheets Connector: Read public sheet via CSV export URL
 */
async function syncGoogleSheetsConnector(connectorId, companyId, config) {
  const { sheetUrl, sheetName } = config;

  // Convert Google Sheets URL to CSV export URL
  let csvUrl = sheetUrl;
  const sheetsMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (sheetsMatch) {
    const spreadsheetId = sheetsMatch[1];
    csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
    if (sheetName) {
      csvUrl += `&sheet=${encodeURIComponent(sheetName)}`;
    }
  }

  const response = await axios.get(csvUrl, { timeout: 15000, responseType: 'text' });
  const csvText = response.data;

  // Parse CSV
  const lines = csvText.split('\n').filter(Boolean);
  if (lines.length < 2) return 0;

  const headers = lines[0].split(',').map((h) =>
    h.trim().replace(/"/g, '').toLowerCase().replace(/[^a-z0-9_]/g, '_')
  );

  const rows = lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/"/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || null; });
    return obj;
  });

  return await upsertConnectorData(connectorId, companyId, rows);
}

/**
 * Database Connector: Query external Postgres DB and mirror data
 */
async function syncDatabaseConnector(connectorId, companyId, config) {
  const { connectionString, query } = config;

  const externalPool = new Pool({ connectionString, connectionTimeoutMillis: 10000 });

  try {
    const result = await externalPool.query(query);
    const rows = result.rows;

    if (rows.length === 0) return 0;

    return await upsertConnectorData(connectorId, companyId, rows);
  } finally {
    await externalPool.end();
  }
}

/**
 * Generic: Upsert array of objects into connector's dynamic table
 */
async function upsertConnectorData(connectorId, companyId, data) {
  const columns = Object.keys(data[0]).map((k) =>
    k.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  );

  const tableName = `conn_${connectorId.replace(/-/g, '_')}`;

  // Create table if not exists
  const colDefs = columns.map((c) => `"${c}" TEXT`).join(', ');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${tableName}" (
      _row_id SERIAL PRIMARY KEY,
      ${colDefs},
      _imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Clear and re-insert
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM "${tableName}"`);

    const colList = columns.map((c) => `"${c}"`).join(', ');
    let inserted = 0;

    const CHUNK = 500;
    for (let i = 0; i < data.length; i += CHUNK) {
      const chunk = data.slice(i, i + CHUNK);
      const placeholders = chunk
        .map((_, ri) => `(${columns.map((_, ci) => `$${ri * columns.length + ci + 1}`).join(', ')})`)
        .join(', ');

      const values = chunk.flatMap((row) => {
        const origKeys = Object.keys(row);
        return columns.map((col, idx) => {
          const origKey = origKeys.find(
            (k) => k.toLowerCase().replace(/[^a-z0-9_]/g, '_') === col
          );
          return origKey !== undefined && row[origKey] !== null ? String(row[origKey]) : null;
        });
      });

      await client.query(
        `INSERT INTO "${tableName}" (${colList}) VALUES ${placeholders}`,
        values
      );
      inserted += chunk.length;
    }

    await client.query('COMMIT');

    // Upsert metadata
    await pool.query(
      `INSERT INTO connector_data_tables (company_id, connector_id, table_name, columns, row_count)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (table_name) DO UPDATE
         SET columns = $4, row_count = $5, updated_at = CURRENT_TIMESTAMP`,
      [companyId, connectorId, tableName, JSON.stringify(columns), inserted]
    );

    return inserted;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Connector Worker shutting down...');
  await redis.quit();
  await pool.end();
  process.exit(0);
});

// Start
init().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
