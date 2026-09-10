BEGIN;

-- Add consent fields to calls table
ALTER TABLE calls
    ADD COLUMN IF NOT EXISTS recording_consent BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS consent_captured_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS recording_encrypted BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS encryption_key_id TEXT;  -- references key rotation system

-- Encrypt existing recording_url fields at rest using pgcrypto
-- (After adding the column, application layer must encrypt on write)
COMMENT ON COLUMN calls.encryption_key_id IS 
    'References the key version used to encrypt recording_url. Format: YYYYMM (monthly rotation)';

COMMIT;
