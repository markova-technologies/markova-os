-- Phase 0: Security Hardening - Role Definitions

-- Markova Admin Role (Used for migrations and schema updates)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'markova_admin') THEN
    CREATE ROLE markova_admin WITH LOGIN PASSWORD 'markova_admin_pass' SUPERUSER;
  END IF;
END
$$;

-- Markova App Role (Used by the application services, subject to RLS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'markova_app') THEN
    CREATE ROLE markova_app WITH LOGIN PASSWORD 'markova_app_pass';
  END IF;
END
$$;

-- Grant usage on the public schema
GRANT USAGE ON SCHEMA public TO markova_app;

-- Grant DML (SELECT, INSERT, UPDATE, DELETE) on all existing tables to markova_app
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO markova_app;

-- Grant usage on all sequences (needed for auto-incrementing columns if any)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO markova_app;

-- Ensure future tables and sequences also grant these privileges automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO markova_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO markova_app;

-- IMPORTANT: markova_app should NOT have CREATE, DROP, or ALTER privileges.
-- Migrations must be run as markova_admin or the original superuser.
