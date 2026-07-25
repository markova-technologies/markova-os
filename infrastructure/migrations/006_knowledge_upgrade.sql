-- Migration 006: Knowledge Platform Upgrade (Vector Partitioning)

-- Ensure knowledge_chunks has company_id for RLS and Partitioning
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Backfill company_id
UPDATE knowledge_chunks kc 
SET company_id = ks.company_id 
FROM knowledge_sources ks 
WHERE kc.source_id = ks.id AND kc.company_id IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE knowledge_chunks ALTER COLUMN company_id SET NOT NULL;

-- Enable RLS
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_knowledge_chunks ON knowledge_chunks USING (company_id = current_setting('app.current_tenant', true)::uuid);

-- Create a composite index for faster tenant-scoped vector search
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_company ON knowledge_chunks (company_id);
