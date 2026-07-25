const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Pool } = require('pg');
const EventBus = require('../../kernel/events/bus');
const { EventTypes } = require('../../kernel/events/registry');
const { LLMAdapter } = require('../../kernel/ai'); // Would export an embedding method
const TenantGuard = require('../../kernel/identity/tenant-guard');
const TenantDb = require('../../kernel/identity/tenant-db');
const requestLogger = require('../../kernel/identity/request-logger');

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestLogger);

const upload = multer({ dest: '/tmp/knowledge_uploads' });
const PORT = process.env.PORT || 6007;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/markova' });
const eventBus = new EventBus(process.env.REDIS_URL || 'redis://redis:6379');
const tenantDb = new TenantDb(pool);

app.use('/api', TenantGuard);

// Upload document -> trigger chunking
app.post('/api/knowledge/upload', upload.single('file'), async (req, res) => {
  const ctx = req.securityContext;
  const { sourceId } = req.body;
  const file = req.file;
  
  if (!file || !sourceId) return res.status(400).json({ error: 'File and sourceId required' });

  try {
    const result = await tenantDb.query(
      ctx,
      'INSERT INTO knowledge_documents (source_id, file_name, file_path, file_size) VALUES ($1, $2, $3, $4) RETURNING id',
      [sourceId, file.originalname, file.path, file.size]
    );
    const docId = result.rows[0].id;

    await eventBus.publish(EventTypes.KNOWLEDGE_UPDATED, {
      documentId: docId,
      sourceId,
      filePath: file.path,
      action: 'process_document'
    }, { source: 'knowledge-runtime' });

    res.json({ success: true, documentId: docId });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Search knowledge base (RAG)
app.post('/api/knowledge/search', async (req, res) => {
  const ctx = req.securityContext;
  const { query, sourceIds } = req.body;
  
  if (!query) return res.status(400).json({ error: 'Query required' });

  try {
    // Note: LLMAdapter would need an embedding method. Mocking embedding generation here.
    // const embedding = await LLMAdapter.embed('openai', 'text-embedding-ada-002', query, apiKey);
    const mockEmbedding = `[${new Array(1536).fill(0.01).join(',')}]`;

    // Perform vector similarity search
    const result = await tenantDb.query(
      ctx,
      `SELECT c.content, 1 - (c.embedding <=> $1::vector) as similarity
       FROM knowledge_chunks c
       JOIN knowledge_documents d ON d.id = c.document_id
       WHERE d.source_id = ANY($2::uuid[])
       ORDER BY c.embedding <=> $1::vector
       LIMIT 5`,
      [mockEmbedding, sourceIds || []]
    );

    res.json({ results: result.rows });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'knowledge-runtime' });
});

app.listen(PORT, () => {
  console.log(`🚀 Knowledge Runtime listening on port ${PORT}`);
});
