const assert = require('assert');
const crypto = require('crypto');
const { Markova, MarkovaError, verifyWebhookSignature } = require('./index');

console.log('Testing @markova/sdk...');

// Test 1: Webhook signature verification
const secret = 'whsec_test_secret_98765';
const payload = {
  event: 'call.completed',
  call_id: 'call_12345678-abcd-ef01-2345-6789abcdef01',
  timestamp: 1727870400,
  data: {
    duration_seconds: 42,
    caller: '+251911223344',
    status: 'completed',
  },
};
const rawJson = JSON.stringify(payload);
const hmacDigest = crypto.createHmac('sha256', secret).update(rawJson).digest('hex');
const validSigHeader = `sha256=${hmacDigest}`;

// Valid signature passes
assert.strictEqual(verifyWebhookSignature(rawJson, validSigHeader, secret), true);
assert.strictEqual(Markova.verifyWebhookSignature(payload, validSigHeader, secret), true);
assert.strictEqual(verifyWebhookSignature(Buffer.from(rawJson), validSigHeader, secret), true);

// Invalid signature fails
assert.strictEqual(verifyWebhookSignature(rawJson, 'sha256=invalidhex12345', secret), false);
assert.strictEqual(verifyWebhookSignature('tampered payload', validSigHeader, secret), false);
assert.strictEqual(verifyWebhookSignature(rawJson, validSigHeader, 'wrong_secret'), false);
assert.strictEqual(verifyWebhookSignature(null, validSigHeader, secret), false);

// Test 2: Client initialization & request formatting
const client = new Markova({
  baseUrl: 'https://api.markova.et/v1',
  apiKey: 'mk_live_secret123',
});

assert.strictEqual(client.baseUrl, 'https://api.markova.et/v1');
assert.strictEqual(client.apiKey, 'mk_live_secret123');

// Test 3: Idempotency-Key passing in createCall
let capturedRequest = null;
client.request = async (method, path, options) => {
  capturedRequest = { method, path, options };
  return { id: 'call_mocked_123', status: 'initiated' };
};

(async () => {
  const resp = await client.createCall({
    agent_id: 'agent_abc',
    to: '+251911000000',
    idempotency_key: 'idemp_key_999',
    webhook_url: 'https://client.org/webhook',
  });

  assert.strictEqual(resp.id, 'call_mocked_123');
  assert.strictEqual(capturedRequest.method, 'POST');
  assert.strictEqual(capturedRequest.path, '/v1/calls');
  assert.strictEqual(capturedRequest.options.headers['Idempotency-Key'], 'idemp_key_999');
  assert.strictEqual(capturedRequest.options.body.to_number, '+251911000000');
  assert.strictEqual(capturedRequest.options.body.webhook_url, 'https://client.org/webhook');

  // Test 4: Provider CRUD
  await client.listProviders();
  assert.strictEqual(capturedRequest.method, 'GET');
  assert.strictEqual(capturedRequest.path, '/v1/providers');

  await client.setProvider('llm', 'groq', { api_key: 'gsk_test' });
  assert.strictEqual(capturedRequest.method, 'PUT');
  assert.strictEqual(capturedRequest.path, '/v1/providers/llm/groq');
  assert.deepStrictEqual(capturedRequest.options.body, { api_key: 'gsk_test' });

  await client.deleteProvider('llm', 'groq');
  assert.strictEqual(capturedRequest.method, 'DELETE');
  assert.strictEqual(capturedRequest.path, '/v1/providers/llm/groq');

  console.log('All @markova/sdk tests PASSED successfully!');
})();
