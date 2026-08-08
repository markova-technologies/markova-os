/**
 * Markova Voicemail Worker
 * ─────────────────────────────────────────────────────────────────────────────
 * Dequeues voicemail delivery tasks from the `voicemail:email:queue` Redis list
 * and sends email notifications via SendGrid (preferred) or SMTP fallback.
 *
 * The orchestrator pushes tasks here after Twilio records a voicemail via
 * the /twilio/voicemail webhook. Without this worker, voicemails are received
 * but never delivered to the company's configured email address.
 *
 * Email includes:
 *   - Caller number
 *   - Call duration
 *   - Direct playback link to Twilio recording URL
 *   - Timestamp
 * ─────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const { createClient } = require('redis');
const nodemailer = require('nodemailer');

const REDIS_URL        = process.env.REDIS_URL || 'redis://redis:6379';
const QUEUE_KEY        = 'voicemail:email:queue';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const SMTP_HOST        = process.env.SMTP_HOST || '';
const SMTP_PORT        = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER        = process.env.SMTP_USER || '';
const SMTP_PASS        = process.env.SMTP_PASS || '';
const FROM_EMAIL       = process.env.FROM_EMAIL || 'voicemail@markova.ai';
const BLOCK_TIMEOUT_S  = 5;

let redis;
let mailer;

// ─────────────────────────────────────────────────────────────────────────────
// Transport setup
// ─────────────────────────────────────────────────────────────────────────────

function buildMailer() {
  if (SENDGRID_API_KEY) {
    // SendGrid via SMTP relay
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: { user: 'apikey', pass: SENDGRID_API_KEY },
    });
  }
  if (SMTP_HOST && SMTP_USER) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  // No transport configured — log only
  console.warn('⚠️  No email transport configured (SENDGRID_API_KEY or SMTP_*). Voicemails will be logged only.');
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Email builder
// ─────────────────────────────────────────────────────────────────────────────

function buildEmail(task) {
  const { to, caller, duration, recording_url, call_id, company_id } = task;
  const ts = new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' });
  const durationFmt = duration ? `${Math.ceil(parseInt(duration, 10))}s` : 'unknown';

  const html = `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a2e25; margin: 0; padding: 0; background: #f3f6f2; }
  .container { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
  .header { background: linear-gradient(135deg, #0f6b4c, #14a06b); padding: 28px 32px; }
  .header h1 { margin: 0; color: #fff; font-size: 22px; font-weight: 600; }
  .header p { margin: 4px 0 0; color: rgba(255,255,255,.75); font-size: 14px; }
  .body { padding: 28px 32px; }
  .meta { background: #f3f6f2; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; }
  .meta p { margin: 6px 0; font-size: 14px; color: #4a5c52; }
  .meta strong { color: #1a2e25; }
  .btn { display: inline-block; background: #0f6b4c; color: #fff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; margin-top: 8px; }
  .footer { padding: 16px 32px; border-top: 1px solid #e5ece8; font-size: 12px; color: #7a9080; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🎙 New Voicemail</h1>
    <p>Markova AI Call Center</p>
  </div>
  <div class="body">
    <div class="meta">
      <p>📞 <strong>Caller:</strong> ${caller || 'Unknown'}</p>
      <p>⏱ <strong>Duration:</strong> ${durationFmt}</p>
      <p>🕐 <strong>Received:</strong> ${ts} (EAT)</p>
      <p>🔖 <strong>Call ID:</strong> ${call_id || '—'}</p>
    </div>
    ${recording_url
      ? `<p style="margin-bottom:8px;color:#4a5c52;">Click below to listen to the voicemail recording:</p>
         <a class="btn" href="${recording_url}" target="_blank">▶ Play Voicemail</a>`
      : '<p style="color:#c0392b;">⚠️ No recording URL available.</p>'
    }
  </div>
  <div class="footer">Sent by Markova AI · Company ID: ${company_id || '—'}</div>
</div>
</body>
</html>`;

  return {
    from: `Markova Voicemail <${FROM_EMAIL}>`,
    to,
    subject: `📞 New Voicemail from ${caller || 'Unknown caller'} (${durationFmt})`,
    html,
    text: `New voicemail from ${caller}. Duration: ${durationFmt}. Listen: ${recording_url || 'N/A'}. Received: ${ts}.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main loop
// ─────────────────────────────────────────────────────────────────────────────

async function processNext() {
  // BRPOP blocks up to BLOCK_TIMEOUT_S seconds waiting for an item
  const result = await redis.brPop(QUEUE_KEY, BLOCK_TIMEOUT_S);
  if (!result) return;

  let task;
  try {
    task = JSON.parse(result.element);
  } catch {
    console.error('⚠️  Invalid voicemail task JSON, skipping');
    return;
  }

  const { to, caller, duration, recording_url, call_id } = task;
  console.log(`📧 Voicemail delivery: to=${to} caller=${caller} duration=${duration}s`);

  if (!to) {
    console.warn('⚠️  No email address configured for voicemail — logging only');
    console.log('   Task:', JSON.stringify(task));
    return;
  }

  if (!mailer) {
    console.warn(`⚠️  No email transport — would have sent voicemail from ${caller} to ${to}`);
    return;
  }

  try {
    const mail = buildEmail(task);
    const info = await mailer.sendMail(mail);
    console.log(`✅ Voicemail email sent: ${info.messageId} → ${to}`);
  } catch (err) {
    console.error(`❌ Failed to send voicemail email to ${to}: ${err.message}`);
    // Re-queue with a small delay to avoid tight retry loops
    await new Promise((r) => setTimeout(r, 5000));
    await redis.lPush(QUEUE_KEY, JSON.stringify(task));
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('\n📬 Markova Voicemail Worker starting...');
  console.log(`   From: ${FROM_EMAIL}`);
  console.log(`   Transport: ${SENDGRID_API_KEY ? 'SendGrid' : SMTP_HOST ? 'SMTP' : 'LOG ONLY'}\n`);

  redis = createClient({ url: REDIS_URL });
  redis.on('error', (err) => console.error('Redis error:', err));
  await redis.connect();
  console.log('✅ Connected to Redis');

  mailer = buildMailer();

  process.on('SIGTERM', async () => {
    await redis.quit();
    process.exit(0);
  });

  let errors = 0;
  while (true) {
    try {
      await processNext();
      errors = 0;
    } catch (err) {
      errors++;
      console.error(`⚠️  Worker error (${errors}): ${err.message}`);
      await sleep(Math.min(errors * 2000, 30000));
    }
  }
}

main().catch((err) => {
  console.error('❌ Fatal voicemail worker error:', err);
  process.exit(1);
});
