/**
 * Markova Event Processor Worker
 * ─────────────────────────────────────────────────────────────────────────────
 * Consumes events from the `markova_events` Redis Stream and persists them
 * to the `events` PostgreSQL table so analytics queries and audit logs work.
 *
 * Without this worker, the orchestrator publishes call.started / call.ended /
 * call.transferred events that are never stored — dashboard analytics and
 * governance pages always show empty event histories.
 *
 * Uses Redis XREADGROUP for reliable at-least-once delivery with ACK.
 * ─────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const { createClient } = require('redis');
const { Pool } = require('pg');

const DATABASE_URL   = process.env.DATABASE_URL;
const REDIS_URL      = process.env.REDIS_URL || 'redis://redis:6379';
const STREAM_KEY     = 'markova_events';
const GROUP_NAME     = 'event-processor';
const CONSUMER_NAME  = `worker-${process.pid}`;
const BATCH_SIZE     = parseInt(process.env.BATCH_SIZE || '10', 10);
const BLOCK_MS       = 2000; // block up to 2s waiting for new messages

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL must be set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
let redis;

// ─────────────────────────────────────────────────────────────────────────────
// Startup
// ─────────────────────────────────────────────────────────────────────────────

async function connectDb() {
  for (let i = 0; i < 10; i++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('✅ Event Processor connected to PostgreSQL');
      return;
    } catch (err) {
      console.log(`⚠️  DB attempt ${i + 1}/10 failed. Retrying...`);
      await sleep(3000);
    }
  }
  console.error('❌ PostgreSQL connection failed');
  process.exit(1);
}

async function connectRedis() {
  redis = createClient({ url: REDIS_URL });
  redis.on('error', (err) => console.error('Redis error:', err));
  await redis.connect();
  console.log('✅ Event Processor connected to Redis');

  // Create consumer group if it doesn't exist
  try {
    await redis.xGroupCreate(STREAM_KEY, GROUP_NAME, '$', { MKSTREAM: true });
    console.log(`✅ Consumer group '${GROUP_NAME}' created`);
  } catch (err) {
    if (!err.message.includes('BUSYGROUP')) {
      throw err; // Only ignore BUSYGROUP (already exists)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event persistence
// ─────────────────────────────────────────────────────────────────────────────

async function persistEvent(id, fields) {
  const { type, payload, timestamp, source, traceId } = fields;

  let parsedPayload;
  try {
    parsedPayload = typeof payload === 'string' ? JSON.parse(payload) : payload;
  } catch {
    parsedPayload = { raw: payload };
  }

  const tsMs = parseInt(timestamp || Date.now(), 10);
  const tsDate = isNaN(tsMs) ? new Date() : new Date(tsMs);

  await pool.query(
    `INSERT INTO events (id, type, payload, source, trace_id, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    [
      id,
      type || 'unknown',
      JSON.stringify(parsedPayload),
      source || 'orchestrator',
      traceId || null,
      tsDate,
    ]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main processing loop
// ─────────────────────────────────────────────────────────────────────────────

async function processMessages() {
  const response = await redis.xReadGroup(
    GROUP_NAME,
    CONSUMER_NAME,
    [{ key: STREAM_KEY, id: '>' }],
    { COUNT: BATCH_SIZE, BLOCK: BLOCK_MS }
  );

  if (!response || response.length === 0) return;

  for (const stream of response) {
    for (const { id, message } of stream.messages) {
      try {
        await persistEvent(id, message);
        await redis.xAck(STREAM_KEY, GROUP_NAME, id);
      } catch (err) {
        console.error(`❌ Failed to persist event ${id}: ${err.message}`);
        // Don't ACK — it will be redelivered after visibility timeout
      }
    }
    if (stream.messages.length > 0) {
      console.log(`📥 Persisted ${stream.messages.length} events`);
    }
  }
}

// Re-process pending messages that were delivered but not ACK'd (crash recovery)
async function processPending() {
  const pending = await redis.xAutoClaim(
    STREAM_KEY, GROUP_NAME, CONSUMER_NAME,
    60000, // 60s min idle time before reclaiming
    '0-0',
    { COUNT: 50 }
  );
  if (pending?.messages?.length > 0) {
    console.log(`🔄 Reclaiming ${pending.messages.length} pending events`);
    for (const { id, message } of pending.messages) {
      try {
        await persistEvent(id, message);
        await redis.xAck(STREAM_KEY, GROUP_NAME, id);
      } catch (err) {
        console.error(`❌ Pending event ${id} failed: ${err.message}`);
      }
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n📡 Markova Event Processor starting...');
  await connectDb();
  await connectRedis();

  process.on('SIGTERM', async () => {
    await redis.quit();
    process.exit(0);
  });

  // Run pending recovery once on startup
  await processPending().catch(console.error);

  let errors = 0;
  while (true) {
    try {
      await processMessages();
      errors = 0;
    } catch (err) {
      errors++;
      console.error(`⚠️  Processing error (${errors}): ${err.message}`);
      await sleep(Math.min(errors * 1000, 15000));
    }
  }
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
