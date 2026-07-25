const Redis = require('ioredis');
const { Pool } = require('pg');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const dbUrl = process.env.DATABASE_URL || 'postgresql://markova:markova_pass@localhost:5432/markova_db';

const redis = new Redis(redisUrl);
const pool = new Pool({ connectionString: dbUrl });

const QUEUE_NAME = 'markova:reports:jobs';

console.log('📊 Reporting Worker Starting up...');
console.log(`Connecting to Redis: ${redisUrl}`);
console.log(`Connecting to DB: ${dbUrl}`);

// Mock processing function
async function generateReport(jobData) {
  const { tenantId, reportType, dateRange } = jobData;
  console.log(`Generating [${reportType}] report for Tenant [${tenantId}] (${dateRange.start} - ${dateRange.end})...`);
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // In a real app, this would execute complex aggregations against the DB
  // and store the result in a reports table or cloud storage.
  
  console.log(`✅ Successfully generated [${reportType}] report for Tenant [${tenantId}]`);
  return {
    status: 'completed',
    url: `https://storage.markova.tech/reports/${tenantId}/${reportType}-${Date.now()}.pdf`,
    generatedAt: new Date().toISOString()
  };
}

async function processQueue() {
  console.log(`🎧 Listening for jobs on queue: ${QUEUE_NAME}`);
  
  while (true) {
    try {
      // BRPOP blocks until an item is available in the list
      const result = await redis.brpop(QUEUE_NAME, 0);
      
      if (result) {
        const [queue, message] = result;
        const job = JSON.parse(message);
        
        console.log(`\n📥 Received Job [${job.id}]`);
        
        try {
          const reportResult = await generateReport(job.data);
          
          // Publish result back to a completed topic or update job status
          await redis.publish(`markova:reports:completed:${job.id}`, JSON.stringify(reportResult));
          
        } catch (jobError) {
          console.error(`❌ Error processing job [${job.id}]:`, jobError.message);
          // In real app, might push to dead-letter queue or retry
        }
      }
    } catch (err) {
      console.error('Redis error:', err);
      // Wait a bit before retrying on connection errors
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Ensure DB connection works
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Database connected successfully');
    processQueue();
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  redis.quit();
  pool.end();
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  redis.quit();
  pool.end();
  process.exit(0);
});
