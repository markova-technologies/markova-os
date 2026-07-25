const { Pool } = require('pg');
const EventBus = require('../../kernel/events/bus');
const { EventTypes } = require('../../kernel/events/registry');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/markova';

const pool = new Pool({ connectionString: dbUrl });
const bus = new EventBus(redisUrl);

async function start() {
  console.log('🚀 Starting Event Processor Worker...');

  await bus.consumeGroup('event_processor_group', 'worker_1', async (event) => {
    console.log(`[EventProcessor] Consuming ${event.type} (${event.id})`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Persist ALL events to the events log table
      await client.query(
        `INSERT INTO events (id, type, payload, source, trace_id, timestamp)
         VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0))`,
        [event.id, event.type, event.payload, event.source, event.traceId, event.timestamp]
      );

      // 2. Route event to specific handlers
      switch (event.type) {
        case EventTypes.CALL_STARTED:
          console.log(`Call Started: ${event.payload.callId}`);
          break;
        case EventTypes.CALL_ENDED:
          await handleCallEnded(client, event.payload);
          break;
        case EventTypes.TOOL_EXECUTED:
          await handleToolExecuted(client, event.payload);
          break;
        default:
          break; // Ignore other events for now
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Error processing event ${event.id}:`, err);
    } finally {
      client.release();
    }
  });
}

async function handleCallEnded(client, payload) {
  // Example Billing calculation: 10 cents per minute
  const minutes = Math.ceil((payload.durationSeconds || 0) / 60);
  console.log(`Billing ${minutes} minutes for company ${payload.tenantId}`);
  
  await client.query(
    `UPDATE usage_metrics SET call_minutes = call_minutes + $1 WHERE company_id = $2`,
    [minutes, payload.tenantId]
  );
}

async function handleToolExecuted(client, payload) {
  // Create audit log for tool execution
  await client.query(
    `INSERT INTO audit_logs (company_id, action, entity_type, entity_id)
     VALUES ($1, $2, $3, $4)`,
    [payload.tenantId, payload.success ? 'TOOL_SUCCESS' : 'TOOL_FAILED', 'tool', payload.toolId]
  );
}

start().catch(console.error);
