-- 016_caller_memory.sql

-- Enable pgvector if not already enabled (should be from semantic cache, but safe to repeat)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS caller_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    caller_number VARCHAR(20) NOT NULL,
    memory_text TEXT NOT NULL,
    embedding VECTOR(1536), -- Assuming 1536 dims for text-embedding-3-small or equivalent
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for similarity search
CREATE INDEX IF NOT EXISTS idx_caller_memory_embedding
ON caller_memory USING hnsw (embedding vector_cosine_ops);

-- Index for quick lookups by caller number
CREATE INDEX IF NOT EXISTS idx_caller_memory_number
ON caller_memory(company_id, caller_number);

-- RLS
ALTER TABLE caller_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_caller_memory ON caller_memory
    FOR ALL USING (company_id = current_setting('app.current_tenant')::uuid);
