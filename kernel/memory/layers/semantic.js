/**
 * Semantic Memory (Vector embeddings of past conversations & unstructured facts)
 */
class SemanticMemory {
  constructor(pgPool) {
    this.pool = pgPool;
  }

  async searchSemanticFacts(companyId, embeddingVector, limit = 3) {
    if (!this.pool || !embeddingVector) return [];
    const vectorStr = `[${embeddingVector.join(',')}]`;
    const res = await this.pool.query(
      `SELECT content, 1 - (embedding <=> $1::vector) AS similarity
       FROM knowledge_chunks
       WHERE company_id = $2
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [vectorStr, companyId, limit]
    );
    return res.rows.filter(r => r.similarity > 0.7);
  }
}

module.exports = SemanticMemory;
