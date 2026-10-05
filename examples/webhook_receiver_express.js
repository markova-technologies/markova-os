/**
 * Markova AI Call Center — Webhook Receiver Recipe (Express.js)
 * Demonstrates:
 * - Capturing raw request bytes for accurate HMAC-SHA256 verification
 * - Verifying signatures with @markova/sdk `verifyWebhookSignature`
 * - Handling call.completed, call.started, and recording.ready events
 */

const express = require('express');
const { verifyWebhookSignature } = require('../packages/sdk');

const app = express();
const PORT = process.env.PORT || 9000;
const WEBHOOK_SECRET = process.env.MARKOVA_WEBHOOK_SECRET || 'whsec_sample_secret_key_12345';

// Crucial: preserve raw body bytes for cryptographic signature verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.post('/webhooks/markova', (req, res) => {
  const signatureHeader = req.headers['x-markova-signature'];

  if (!signatureHeader) {
    return res.status(401).json({ error: 'Missing X-Markova-Signature header' });
  }

  // Verify HMAC-SHA256 signature using raw body buffer
  const isValid = verifyWebhookSignature(req.rawBody, signatureHeader, WEBHOOK_SECRET);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const { event, call_id, timestamp, data } = req.body;
  console.log(`[Markova Webhook] Received ${event} for call ${call_id} at ${new Date(timestamp * 1000).toISOString()}`);

  switch (event) {
    case 'call.completed':
      console.log(`Call completed. Duration: ${data.duration_seconds}s. Turns: ${data.turn_count}`);
      // Business logic: update database, update CRM status
      break;

    case 'call.failed':
      console.error(`Call failed for customer ${data.caller}: ${data.error}`);
      break;

    case 'recording.ready':
      console.log(`Audio recording ready: ${data.recording_url}`);
      break;

    default:
      console.log(`Unhandled event type: ${event}`);
  }

  // Always return 200 OK promptly
  return res.status(200).json({ status: 'received', event });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Webhook receiver listening on http://localhost:${PORT}/webhooks/markova`);
  });
}

module.exports = app;
