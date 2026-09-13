/**
 * Markova AI Microservice Keep-Warm Worker
 * ─────────────────────────────────────────────────────────────────────────────
 * Prevents cloud services (Render, Railway, Fly) from cold-starting by issuing
 * lightweight periodic HTTP GET/HEAD requests to keep dynos and DB pools active.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DEFAULT_TARGETS = [
  'https://markova-orchestrator.onrender.com/health',
  'https://markova-orchestrator.onrender.com/',
  'https://markova-ai-backend.onrender.com/',
];

const TARGETS = process.env.TARGET_URLS
  ? process.env.TARGET_URLS.split(',').map((url) => url.trim())
  : DEFAULT_TARGETS;

// 4 minutes = 240,000 ms (Render free tier sleeps after 15 minutes of idle)
const INTERVAL_MS = parseInt(process.env.PING_INTERVAL_MS || '240000', 10);

async function pingEndpoint(url) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Markova-KeepWarm-Pinger/1.0',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const duration = Date.now() - start;
    console.log(`[Keep-Warm] ✓ ${url} -> Status ${response.status} (${duration}ms)`);
    return { url, status: response.status, duration, ok: response.ok };
  } catch (error) {
    const duration = Date.now() - start;
    console.warn(`[Keep-Warm] ✗ ${url} -> Failed: ${error.message} (${duration}ms)`);
    return { url, status: 0, duration, ok: false, error: error.message };
  }
}

async function pingAll() {
  console.log(`\n[Keep-Warm] [${new Date().toISOString()}] Pinging ${TARGETS.length} endpoints...`);
  const results = await Promise.allSettled(TARGETS.map(pingEndpoint));
  const successCount = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
  console.log(`[Keep-Warm] Completed ping cycle: ${successCount}/${TARGETS.length} responsive.`);
}

console.log('====================================================');
console.log(' Markova Microservice Keep-Warm Worker Initialized');
console.log(` Targets: ${TARGETS.join(', ')}`);
console.log(` Interval: ${INTERVAL_MS / 1000}s`);
console.log('====================================================');

// Run immediately on boot
pingAll();

// Schedule recurring pings
setInterval(pingAll, INTERVAL_MS);
