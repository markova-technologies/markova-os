-- Phase 2: persist sandbox vs live on API keys (not prefix-only)
ALTER TABLE tenant_api_keys
  ADD COLUMN IF NOT EXISTS environment VARCHAR(10) NOT NULL DEFAULT 'test'
  CHECK (environment IN ('test', 'live'));

-- Backfill from key_prefix where possible
UPDATE tenant_api_keys
SET environment = 'live'
WHERE key_prefix LIKE 'mk_live_%' AND environment = 'test';

CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_environment
  ON tenant_api_keys (company_id, environment);
