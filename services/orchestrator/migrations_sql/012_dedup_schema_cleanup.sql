-- Migration 012: Schema Deduplication
-- 17 duplicate tables (roles, permissions, etc.) have been removed from schema.sql 
-- as they are already managed by their respective migration files (001, 007, etc.)
-- No database action is required here, this migration serves as a checkpoint.

SELECT 1;
