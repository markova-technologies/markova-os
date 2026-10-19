/**
 * Markova OS — RPA Agent Worker (BullMQ Job Consumer)
 * ─────────────────────────────────────────────────────────────────────────────
 * Processes async report generation and asset conversion tasks.
 */

require('dotenv').config();
const { Worker } = require('bullmq');
const { generateTenantPdfReport } = require('./tasks/report_generator');
const { convertMediaAsset } = require('./tasks/asset_converter');

const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const QUEUE_NAME = process.env.RPA_QUEUE_NAME || 'rpa_tasks_queue';

// Worker processing lifecycle
async function processRpaTask(taskType, payload) {
  console.log(`[RPA Worker] Processing task '${taskType}' for tenant: ${payload.tenantId}`);
  
  if (taskType === 'GENERATE_REPORT') {
    return await generateTenantPdfReport(payload.tenantId, payload.data, payload.outputDir);
  } else if (taskType === 'CONVERT_ASSET') {
    return await convertMediaAsset(payload.inputPath, payload.targetFormat);
  }
  
  throw new Error(`Unknown RPA task type: ${taskType}`);
}

if (require.main === module) {
  console.log(`🤖 Markova RPA Agent Worker starting on queue: '${QUEUE_NAME}'...`);

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      console.log(`[RPA Worker] Picked up Job ID ${job.id} (${job.name})`);
      const { taskType, payload } = job.data;
      return await processRpaTask(taskType || job.name, payload || {});
    },
    {
      connection: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        password: process.env.REDIS_PASSWORD || undefined,
      },
      concurrency: parseInt(process.env.RPA_CONCURRENCY || '2', 10),
    }
  );

  worker.on('ready', () => {
    console.log(`✅ [RPA Worker] Connected to Redis and actively listening for jobs on '${QUEUE_NAME}'.`);
  });

  worker.on('completed', (job) => {
    console.log(`✅ [RPA Worker] Job ${job.id} completed successfully.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ [RPA Worker] Job ${job?.id} failed:`, err.message);
  });

  const shutdown = async () => {
    console.log('\n[RPA Worker] Gracefully shutting down worker...');
    try {
      await worker.close();
      console.log('[RPA Worker] Worker closed cleanly.');
      process.exit(0);
    } catch (e) {
      console.error('[RPA Worker] Error during shutdown:', e);
      process.exit(1);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = { processRpaTask };
