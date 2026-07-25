const { createClient } = require('redis');
const { Pool } = require('pg');
const { EventTypes } = require('../../kernel/events/registry');
const fs = require('fs').promises;

const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/markova' });

const GROUP_NAME = 'embedding_workers';
const CONSUMER_NAME = `worker_${process.pid}`;

async function processDocument(docId, filePath) {
  console.log(`Processing document ${docId} at ${filePath}`);
  
  // 1. Read file
  // const data = await fs.readFile(filePath);
  // const text = await parsePDF(data); // Simplified
  const mockText = "This is a mock extracted text from the document. It contains knowledge about products.";

  // 2. Chunking
  const chunks = [mockText]; // Simple chunking strategy for mock

  // 3. Embed and store
  for (const chunk of chunks) {
    // Generate embedding via AI Runtime (Mocked)
    const mockEmbedding = `[${new Array(1536).fill(0.02).join(',')}]`;

    await pool.query(
      'INSERT INTO knowledge_chunks (document_id, content, embedding) VALUES ($1, $2, $3)',
      [docId, chunk, mockEmbedding]
    );
  }

  await pool.query("UPDATE knowledge_documents SET status = 'processed' WHERE id = $1", [docId]);
  console.log(`Finished processing document ${docId}`);
}

async function startWorker() {
  await redisClient.connect();
  
  try {
    await redisClient.xGroupCreate('markova_events', GROUP_NAME, '0', { MKSTREAM: true });
  } catch (err) {
    if (!err.message.includes('BUSYGROUP')) throw err;
  }

  console.log(`🚀 Embedding Worker listening to Event Bus`);

  while (true) {
    try {
      const response = await redisClient.xReadGroup(
        redisClient.commandOptions({ isolated: true }),
        GROUP_NAME, CONSUMER_NAME,
        [{ key: 'markova_events', id: '>' }],
        { COUNT: 5, BLOCK: 5000 }
      );

      if (response && response.length > 0) {
        for (const message of response[0].messages) {
          const type = message.message.type;
          const payload = JSON.parse(message.message.payload);

          if (type === EventTypes.KNOWLEDGE_UPDATED && payload.action === 'process_document') {
            await processDocument(payload.documentId, payload.filePath);
          }

          // Acknowledge
          await redisClient.xAck('markova_events', GROUP_NAME, message.id);
        }
      }
    } catch (err) {
      console.error('Redis read error:', err);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

startWorker().catch(console.error);
