-- Migration 011: Add cleanup function for semantic_response_cache
-- Called hourly by orchestrator background task

CREATE OR REPLACE FUNCTION cleanup_semantic_cache()
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM semantic_response_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
