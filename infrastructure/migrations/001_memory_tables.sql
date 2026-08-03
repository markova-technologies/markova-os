-- Migration 001: 6-Layer Memory Tables & Semantic Indexes

CREATE TABLE IF NOT EXISTS memory_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    layer VARCHAR(50) NOT NULL, -- working, conversation, long_term, business, semantic, shared_team
    entity_id VARCHAR(255),
    memory_key VARCHAR(255) NOT NULL,
    memory_value JSONB NOT NULL,
    embedding VECTOR(1536),
    ttl INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memory_records_company_layer ON memory_records (company_id, layer);
CREATE INDEX IF NOT EXISTS idx_memory_records_key ON memory_records (memory_key);
