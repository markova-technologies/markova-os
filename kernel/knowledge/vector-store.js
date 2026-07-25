class VectorStore {
  constructor(pool) {
    this.pool = pool;
  }

  async search(companyId, queryVector, limit = 5, minSimilarity = 0.7) {
    // Uses pgvector's cosine distance (<=>)
    // RLS will automatically ensure the query is scoped to the current tenant if TenantGuard is active,
    // but we explicitly pass companyId to guarantee strict isolation even in background tasks.
    const query = `
      SELECT id, source_id, chunk_text, metadata, 
             1 - (embedding <=> $1::vector) as similarity
      FROM knowledge_chunks
      WHERE company_id = $2
        AND 1 - (embedding <=> $1::vector) > $3
      ORDER BY embedding <=> $1::vector
      LIMIT $4;
    `;

    const result = await this.pool.query(query, [
      `[${queryVector.join(',')}]`,
      companyId,
      minSimilarity,
      limit
    ]);

    return result.rows;
  }

  async upsertChunks(companyId, sourceId, chunks) {
    // chunks is an array of { text, embedding, metadata }
    for (const chunk of chunks) {
      await this.pool.query(
        `INSERT INTO knowledge_chunks (company_id, source_id, chunk_text, embedding, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          companyId,
          sourceId,
          chunk.text,
          `[${chunk.embedding.join(',')}]`,
          chunk.metadata || {}
        ]
      );
    }
  }

  async deleteSource(companyId, sourceId) {
    await this.pool.query(
      `DELETE FROM knowledge_chunks WHERE company_id = $1 AND source_id = $2`,
      [companyId, sourceId]
    );
  }
}

module.exports = VectorStore;
