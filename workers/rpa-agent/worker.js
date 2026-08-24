/**
 * Markova OS — RPA Agent Worker (BullMQ Job Consumer)
 * ─────────────────────────────────────────────────────────────────────────────
 * Processes async report generation and asset conversion tasks.
 */

require('dotenv').config();
const { generateTenantPdfReport } = require('./tasks/report_generator');
const { convertMediaAsset } = require('./tasks/asset_converter');

console.log('🤖 Markova RPA Agent Worker Initializing...');

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

module.exports = { processRpaTask };

if (require.main === module) {
  console.log('✅ RPA Agent Worker ready and listening for jobs.');
}
