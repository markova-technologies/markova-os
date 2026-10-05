/**
 * Markova AI Call Center — Outbound Call Dispatch Recipe (Node.js)
 * Demonstrates dispatching an outbound AI voice call with:
 * - Idempotency-Key protection (safe retry without duplicate calls / billing)
 * - Dedicated webhook_url for call lifecycle events
 * - Error handling using @markova/sdk
 */

const { Markova, MarkovaError } = require('../packages/sdk');

const client = new Markova({
  apiKey: process.env.MARKOVA_API_KEY || 'mk_test_sandbox_secret',
  baseUrl: process.env.MARKOVA_BASE_URL || 'https://api.markova.tech',
});

async function initiateCustomerDeliveryCall(customerPhone, orderId) {
  const idempotencyKey = `delivery-notification-${orderId}`;

  try {
    const call = await client.createCall({
      agent_id: '00000000-0000-0000-0000-000000000001',
      to: customerPhone,
      webhook_url: 'https://api.logistics.et/webhooks/voice',
      idempotency_key: idempotencyKey,
      sandbox: true,
    });

    console.log(`Call successfully dispatched: ID ${call.id} (Status: ${call.status})`);
    return call;
  } catch (err) {
    if (err instanceof MarkovaError) {
      if (err.status === 409) {
        console.warn(`Idempotency conflict: Call for order ${orderId} is currently being processed.`);
      } else {
        console.error(`Markova API Error: ${err.message} (HTTP ${err.status})`);
      }
    } else {
      console.error('Unexpected error:', err);
    }
  }
}

if (require.main === module) {
  initiateCustomerDeliveryCall('+251911223344', 'order_4920');
}
