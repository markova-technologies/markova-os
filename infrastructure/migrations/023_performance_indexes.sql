-- Migration 023: Performance Indexes
-- Ensures high-throughput multi-tenant queries on calls, plans, transcripts, and usage are indexed.

CREATE INDEX IF NOT EXISTS idx_agent_plans_company ON agent_plans (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_company_start ON calls (company_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls (company_id, status);
CREATE INDEX IF NOT EXISTS idx_transcripts_call ON transcripts (call_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_company_time ON usage_metrics (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON knowledge_chunks (document_id);
