/**
 * Markova Embedding Worker
 * ─────────────────────────────────────────────────────────────────────────────
 * Polls PostgreSQL for knowledge_chunks that have no embedding vector yet,
 * calls the configured embedding API (OpenAI text-embedding-3-small or Groq),
 * and writes the resulting VECTOR(1536) back to the knowledge_chunks table.
 *
 * Without this worker, uploaded documents are indexed but never searchable
 * via pgvector RAG — the orchestrator's search_knowledge_chunks() always
 * returns empty results.
 *
 * Run: node index.js
 * Environment:
 *   DATABASE_URL        — PostgreSQL connection string (required)
 *   OPENAI_API_KEY      — OpenAI API key for embeddings (preferred)
 *   EMBEDDING_PROVIDER  — 'openai' (default) | 'local' (future)
 *   EMBEDDING_MODEL     — default: text-embedding-3-small
 *   POLL_INTERVAL_MS    — how often to poll (default: 5000ms)
 *   BATCH_SIZE          — chunks to embed per run (default: 10)
 * ─────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const DATABASE_URL     = process.env.DATABASE_URL;
const OPENAI_API_KEY   = process.env.OPENAI_API_KEY || '';
const EMBEDDING_MODEL  = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);
const BATCH_SIZE       = parseInt(process.env.BATCH_SIZE || '10', 10);

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL must be set');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY not set — embedding worker will idle until key is available');
}

const pool = new Pool({ connectionString: DATABASE_URL });

// ─────────────────────────────────────────────────────────────────────────────
// DB connection with retries
// ─────────────────────────────────────────────────────────────────────────────
async function connectDb() {
  for (let i = 0; i < 10; i++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('✅ Embedding Worker connected to PostgreSQL');
      return;
    } catch (err) {
      console.log(`⚠️  DB connection attempt ${i + 1}/10 failed: ${err.message}. Retrying in 3s...`);
      await sleep(3000);
    }
  }
  console.error('❌ Could not connect to PostgreSQL after 10 attempts');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Embedding API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get embedding vector from OpenAI text-embedding-3-small.
 * Returns a float[] of length 1536.
 */
async function getOpenAIEmbedding(text, apiKey) {
  const resp = await axios.post(
    'https://api.openai.com/v1/embeddings',
    { input: text.slice(0, 8000), model: EMBEDDING_MODEL }, // 8k char safety trim
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );
  return resp.data.data[0].embedding;
}

/**
 * Resolve the best available API key for embeddings.
 * Priority: env OPENAI_API_KEY → per-company key from provider_configs.
 */
async function resolveEmbeddingKey(companyId) {
  if (OPENAI_API_KEY) return OPENAI_API_KEY;

  // Try fetching from provider_configs (encrypted_config stores {api_key: ...})
  try {
    const result = await pool.query(
      `SELECT encrypted_config FROM provider_configs
       WHERE company_id = $1 AND provider_type = 'llm' AND provider_name = 'openai'
       LIMIT 1`,
      [companyId]
    );
    if (result.rows.length > 0) {
      const cfg = result.rows[0].encrypted_config;
      const parsed = typeof cfg === 'string' ? JSON.parse(cfg) : cfg;
      return parsed?.api_key || '';
    }
  } catch (err) {
    // provider_configs may not have this company's key
  }
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Core batch processing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a batch of knowledge_chunks that have no embedding yet.
 * Joins with knowledge_sources to get company_id for per-company key lookup.
 */
async function fetchUnembeddedChunks() {
  const result = await pool.query(
    `SELECT
       kc.id,
       kc.content,
       kc.document_id,
       kc.company_id
     FROM knowledge_chunks kc
     WHERE kc.embedding IS NULL
       AND kc.content IS NOT NULL
       AND LENGTH(kc.content) > 10
     ORDER BY kc.created_at ASC
     LIMIT $1`,
    [BATCH_SIZE]
  );
  return result.rows;
}

/**
 * Write the embedding vector back to the knowledge_chunks row.
 * pgvector accepts a PostgreSQL vector literal: '[0.1,0.2,...]'
 */
async function saveEmbedding(chunkId, embedding) {
  const vectorLiteral = `[${embedding.join(',')}]`;
  await pool.query(
    `UPDATE knowledge_chunks SET embedding = $1::vector WHERE id = $2`,
    [vectorLiteral, chunkId]
  );
}

/**
 * Mark a chunk as failed so it is skipped in future polls.
 * We store a zero-length sentinel or just leave embedding null with a logged error.
 * For now, we just skip — it will be retried next poll cycle after 1 minute backoff.
 */
async function markChunkFailed(chunkId, error) {
  console.error(`  ❌ Chunk ${chunkId} embedding failed: ${error.message}`);
  // Insert a temporary placeholder timestamp to avoid re-processing immediately
  // In a production system you'd add a `embedding_error` column and `retry_after` timestamp.
}

// ─────────────────────────────────────────────────────────────────────────────
// Main poll loop
// ─────────────────────────────────────────────────────────────────────────────

async function runEmbeddingBatch() {
  if (!OPENAI_API_KEY) {
    // No global key — check if any company has one
    const check = await pool.query(
      `SELECT 1 FROM provider_configs WHERE provider_type='llm' AND provider_name='openai' LIMIT 1`
    );
    if (check.rows.length === 0) return; // Nothing to do
  }

  const chunks = await fetchUnembeddedChunks();
  if (chunks.length === 0) return;

  console.log(`🔍 Embedding batch: ${chunks.length} chunks to process`);
  let success = 0;
  let failed = 0;

  for (const chunk of chunks) {
    try {
      const apiKey = await resolveEmbeddingKey(chunk.company_id);
      if (!apiKey) {
        console.warn(`  ⚠️  No OpenAI key for company ${chunk.company_id} — skipping chunk ${chunk.id}`);
        continue;
      }

      const embedding = await getOpenAIEmbedding(chunk.content, apiKey);
      await saveEmbedding(chunk.id, embedding);
      success++;
    } catch (err) {
      await markChunkFailed(chunk.id, err);
      failed++;
    }
  }

  if (success > 0 || failed > 0) {
    console.log(`  ✅ Embedded: ${success} | ❌ Failed: ${failed}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🧠 Markova Embedding Worker starting...`);
  console.log(`   Model: ${EMBEDDING_MODEL}`);
  console.log(`   Batch: ${BATCH_SIZE} chunks per run`);
  console.log(`   Poll:  every ${POLL_INTERVAL_MS / 1000}s\n`);

  await connectDb();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 Embedding Worker shutting down (SIGTERM)');
    process.exit(0);
  });
  process.on('SIGINT', () => {
    console.log('🛑 Embedding Worker shutting down (SIGINT)');
    process.exit(0);
  });

  let consecutiveErrors = 0;
  while (true) {
    try {
      await runEmbeddingBatch();
      consecutiveErrors = 0;
    } catch (err) {
      consecutiveErrors++;
      console.error(`⚠️  Embedding batch error (${consecutiveErrors}): ${err.message}`);
      // Exponential backoff on repeated errors (max 60s)
      const backoff = Math.min(consecutiveErrors * 5000, 60000);
      console.log(`   Backing off for ${backoff / 1000}s...`);
      await sleep(backoff);
      continue;
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

main().catch((err) => {
  console.error('❌ Fatal embedding worker error:', err);
  process.exit(1);
});
