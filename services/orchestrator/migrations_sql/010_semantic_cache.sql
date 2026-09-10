-- Semantic response cache with pgvector similarity search
CREATE TABLE IF NOT EXISTS semantic_response_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,  -- Tenant-scoped: never share cache across companies
    prompt_hash TEXT NOT NULL,  -- MD5 of normalized prompt for exact Redis lookup
    embedding VECTOR(1536) NOT NULL,  -- OpenAI text-embedding-3-small dimension
    response_text TEXT NOT NULL,
    hit_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS semantic_cache_embedding_idx
    ON semantic_response_cache USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS semantic_cache_company_idx
    ON semantic_response_cache (company_id, expires_at);

-- Auto-delete expired entries
CREATE OR REPLACE FUNCTION cleanup_semantic_cache() RETURNS void AS $$
    DELETE FROM semantic_response_cache WHERE expires_at < NOW();
$$ LANGUAGE sql;
