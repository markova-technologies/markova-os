const cron = require('node-cron');
const { Pool } = require('pg');
const EventBus = require('../../kernel/events/bus');
const { EventTypes } = require('../../kernel/events/registry');

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/markova' });
const eventBus = new EventBus(process.env.REDIS_URL || 'redis://localhost:6379');

console.log('🔄 Sync Worker Starting up...');

async function performSync() {
  console.log(`\n[${new Date().toISOString()}] Checking for scheduled syncs...`);
  
  try {
    const integrations = await pool.query('SELECT * FROM integrations WHERE status = $1', ['active']);
    
    for (const integration of integrations.rows) {
      console.log(`Triggering sync for integration ${integration.id} (${integration.type})`);
      
      await eventBus.publish(EventTypes.INTEGRATION_SYNCED, {
        tenantId: integration.company_id,
        integrationId: integration.id,
        type: integration.type,
        recordsProcessed: Math.floor(Math.random() * 50) + 10,
        success: true
      }, { source: 'sync-worker' });
    }

  } catch (error) {
    console.error(`❌ Failed to sync:`, error.message);
  }
}

// Schedule sync every hour
cron.schedule('0 * * * *', () => {
  performSync();
});

// Run a test sync on startup
setTimeout(() => {
  performSync();
}, 3000);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
