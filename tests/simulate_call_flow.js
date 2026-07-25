const EventBus = require('../kernel/events/bus');
const { EventTypes } = require('../kernel/events/registry');
const crypto = require('crypto');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const bus = new EventBus(redisUrl);

async function runSimulation() {
  console.log('🚀 Starting Event Bus End-to-End Simulation...');

  const tenantId = crypto.randomUUID();
  const callId = crypto.randomUUID();
  const agentId = crypto.randomUUID();
  const toolId = crypto.randomUUID();

  console.log(`[Context] Tenant: ${tenantId}`);
  console.log(`[Context] Call: ${callId}`);

  // 1. Simulate Call Started
  console.log('\n--> Publishing CALL_STARTED');
  await bus.publish(EventTypes.CALL_STARTED, {
    tenantId,
    callId,
    callerNumber: '+1234567890',
    agentId
  }, { source: 'simulator' });

  // 2. Simulate Tool Execution
  setTimeout(async () => {
    console.log('--> Publishing TOOL_EXECUTED');
    await bus.publish(EventTypes.TOOL_EXECUTED, {
      tenantId,
      toolId,
      agentId,
      success: true,
      executionTimeMs: 150
    }, { source: 'simulator' });
  }, 1000);

  // 3. Simulate Knowledge Updated
  setTimeout(async () => {
    console.log('--> Publishing KNOWLEDGE_UPDATED');
    await bus.publish(EventTypes.KNOWLEDGE_UPDATED, {
      documentId: crypto.randomUUID(),
      sourceId: crypto.randomUUID(),
      filePath: '/tmp/test.pdf',
      action: 'process_document'
    }, { source: 'simulator' });
  }, 2000);

  // 4. Simulate Call Ended
  setTimeout(async () => {
    console.log('--> Publishing CALL_ENDED');
    await bus.publish(EventTypes.CALL_ENDED, {
      tenantId,
      callId,
      durationSeconds: 120,
      status: 'completed'
    }, { source: 'simulator' });
  }, 3000);

  // 5. Simulate Workflow Finished
  setTimeout(async () => {
    console.log('--> Publishing WORKFLOW_FINISHED');
    await bus.publish(EventTypes.WORKFLOW_FINISHED, {
      tenantId,
      workflowId: 'wf_test_123',
      success: true,
      result: { ok: true }
    }, { source: 'simulator' });
    
    console.log('\n✅ Simulation events fired! Check event-processor logs or database for results.');
    setTimeout(() => process.exit(0), 1000);
  }, 4000);
}

runSimulation().catch(console.error);
