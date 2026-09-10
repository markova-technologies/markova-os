const https = require('https');

const services = [
  { name: 'markova-api-gateway', url: 'https://markova-api-gateway.onrender.com/health' },
  { name: 'markova-tenant-service', url: 'https://markova-tenant-service.onrender.com/health' },
  { name: 'markova-agent-builder', url: 'https://markova-agent-builder.onrender.com/health' },
  { name: 'markova-tool-engine', url: 'https://markova-tool-engine.onrender.com/health' },
  { name: 'markova-knowledge-service', url: 'https://markova-knowledge-service.onrender.com/health' },
  { name: 'markova-ai-backend-us', url: 'https://markova-ai-backend-us.onrender.com/' }
];

async function pingService(service) {
  return new Promise(resolve => {
    const start = Date.now();
    const req = https.get(service.url, { timeout: 60000 }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          Service: service.name,
          Status: res.statusCode === 200 ? '🟢 200 OK' : `🔴 ${res.statusCode}`,
          Latency: `${Date.now() - start}ms`,
          URL: service.url
        });
      });
    });

    req.on('error', err => {
      resolve({
        Service: service.name,
        Status: '❌ Error',
        Latency: `${Date.now() - start}ms`,
        URL: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        Service: service.name,
        Status: '⏱️ Timeout (>60s)',
        Latency: `${Date.now() - start}ms`,
        URL: service.url
      });
    });
  });
}

async function main() {
  console.log('🚀 Waking up all 6 Render services in parallel...');
  console.log('⏳ Please wait (cold starts on free tier take ~20-45 seconds)...\n');

  const results = await Promise.all(services.map(pingService));
  console.table(results);

  const allHealthy = results.every(r => r.Status.includes('200'));
  if (allHealthy) {
    console.log('🎉 All services are warm, active, and ready for phone calls & dashboard testing!\n');
  } else {
    console.log('⚠️ Some services did not return 200. Check the table above for details.\n');
  }
}

main();
