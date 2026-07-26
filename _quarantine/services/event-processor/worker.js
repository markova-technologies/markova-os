const EventBus = require('../../kernel/events/bus');
const { Pool } = require('pg');
const TenantDb = require('../../kernel/identity/tenant-db');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
const tenantDb = new TenantDb(pool);

const eventBus = new EventBus(process.env.REDIS_URL || 'redis://redis:6379');

async function handleTenantCreated(event) {
  console.log(`[EventProcessor] Handling tenant.created for company ${event.payload.companyId}`);
  // E.g., provision default agents, create billing account, send welcome email
  const ctx = { tenantId: event.payload.companyId, isServiceAccount: true };
  await tenantDb.query(
    ctx,
    `INSERT INTO feature_flags (company_id, feature_name, is_enabled) VALUES ($1, 'basic_rag', true) ON CONFLICT DO NOTHING`,
    [event.payload.companyId]
  );
  console.log(`[EventProcessor] Provisioned default feature flags for company ${event.payload.companyId}`);
}

async function start() {
  console.log('[EventProcessor] Starting...');
  
  await eventBus.consumeGroup('event_processor_group', 'worker_1', async (event) => {
    try {
      if (event.type === 'tenant.created') {
        await handleTenantCreated(event);
      }
      // Handle other events...
    } catch (err) {
      console.error(`[EventProcessor] Error processing event ${event.id}:`, err);
    }
  });
}

start().catch(console.error);
