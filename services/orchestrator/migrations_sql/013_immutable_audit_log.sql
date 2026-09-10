-- 013_immutable_audit_log.sql
-- Makes audit_logs table immutable: INSERT ONLY, with SHA-256 chain hash.
-- Required for INSA compliance in Ethiopia.

BEGIN;

-- 1. Add chain hash column (links each entry to the previous)
ALTER TABLE audit_logs 
    ADD COLUMN IF NOT EXISTS chain_hash TEXT,
    ADD COLUMN IF NOT EXISTS prev_entry_id UUID REFERENCES audit_logs(id);

-- 2. Trigger function: compute SHA-256 chain hash on INSERT
CREATE OR REPLACE FUNCTION fn_audit_log_chain_hash()
RETURNS TRIGGER AS $$
DECLARE
    prev_hash TEXT;
    entry_data TEXT;
BEGIN
    -- Get the previous entry's hash (NULL for first entry)
    SELECT chain_hash INTO prev_hash
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Build deterministic string of this row's data
    entry_data := CONCAT(
        NEW.id::TEXT, '|',
        NEW.company_id::TEXT, '|',
        COALESCE(NEW.call_id::TEXT, ''), '|',
        NEW.event_type, '|',
        COALESCE(NEW.metadata::TEXT, ''), '|',
        NEW.created_at::TEXT, '|',
        COALESCE(prev_hash, 'genesis')  -- Chain: hash of previous entry
    );
    
    -- SHA-256 via pgcrypto
    NEW.chain_hash := encode(digest(entry_data, 'sha256'), 'hex');
    NEW.prev_entry_id := (
        SELECT id FROM audit_logs ORDER BY created_at DESC LIMIT 1
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_chain_hash ON audit_logs;
CREATE TRIGGER trg_audit_log_chain_hash
    BEFORE INSERT ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log_chain_hash();

-- 3. Prevent UPDATE and DELETE on audit_logs
CREATE OR REPLACE FUNCTION fn_audit_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is immutable — UPDATE and DELETE are forbidden';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_no_update ON audit_logs;
CREATE TRIGGER trg_audit_log_no_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log_immutable();

DROP TRIGGER IF EXISTS trg_audit_log_no_delete ON audit_logs;
CREATE TRIGGER trg_audit_log_no_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log_immutable();

-- 4. Index for chain verification queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_chain
    ON audit_logs (created_at, chain_hash);

COMMIT;
