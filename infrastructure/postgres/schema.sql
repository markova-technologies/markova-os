-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Companies (Tenants)
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(50) DEFAULT 'starter',
    status VARCHAR(50) DEFAULT 'active',
    max_agents INT DEFAULT 5,
    workflow_settings JSONB NOT NULL DEFAULT '{
      "confidence_thresholds": {
        "default": 0.85,
        "refund": 0.95,
        "update_address": 0.70,
        "update_contact": 0.75
      }
    }'::jsonb,
    slug VARCHAR(63) UNIQUE,
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tenant API Keys
CREATE TABLE IF NOT EXISTS tenant_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100),
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    key_prefix VARCHAR(12) NOT NULL, -- e.g., mk_test_ / mk_live_
    environment VARCHAR(10) NOT NULL DEFAULT 'test' CHECK (environment IN ('test', 'live')),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Provider Configs
CREATE TABLE IF NOT EXISTS provider_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    provider_type VARCHAR(50) NOT NULL, -- llm, voice, stt
    provider_name VARCHAR(100) NOT NULL, -- openai, elevenlabs, azure
    encrypted_config JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) DEFAULT 'supabase-auth-argon2-hash',
    role VARCHAR(50) DEFAULT 'member',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agents
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    prompt TEXT NOT NULL,
    voice_provider VARCHAR(100) NOT NULL,
    voice_id VARCHAR(100) NOT NULL,
    model_provider VARCHAR(100) NOT NULL,
    model_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent Versions (Rollback Control)
CREATE TABLE IF NOT EXISTS agent_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    prompt TEXT NOT NULL,
    model_provider VARCHAR(100) NOT NULL,
    model_id VARCHAR(100) NOT NULL,
    voice_provider VARCHAR(100) NOT NULL,
    voice_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Phone Numbers
CREATE TABLE IF NOT EXISTS phone_numbers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    provider VARCHAR(50) NOT NULL,
    phone_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhook Tools (Actions)
CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    webhook_url TEXT NOT NULL,
    method VARCHAR(10) DEFAULT 'POST',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent-Tool Mapping
CREATE TABLE IF NOT EXISTS agent_tools (
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_id, tool_id)
);

-- Integrations (Connector Hub configurations)
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- excel, google_sheet, telegram, whatsapp, rpa, etc.
    name VARCHAR(255) NOT NULL,
    config JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Connector Sync Activity Runs
CREATE TABLE IF NOT EXISTS connector_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    connector_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'completed', -- running, completed, failed
    records_processed INT DEFAULT 0,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP,
    error_message TEXT
);

-- Connector Onboarding Blueprints
CREATE TABLE IF NOT EXISTS connector_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    schema JSONB NOT NULL
);

-- Decoupled Knowledge Sources
CREATE TABLE IF NOT EXISTS knowledge_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- upload, website, notion, sheets
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Base Documents
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES knowledge_sources(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INT NOT NULL,
    status VARCHAR(50) DEFAULT 'uploaded',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Chunks (after documents — FK dependency)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Calls
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    phone_number_id UUID REFERENCES phone_numbers(id) ON DELETE SET NULL,
    caller_number VARCHAR(50) NOT NULL,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',
    turn_count INT DEFAULT 0,
    recording_url TEXT,
    transfer_context JSONB
);

-- Call Transcripts
CREATE TABLE IF NOT EXISTS transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs (Immutable, Tenant-Aware)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    ip_address VARCHAR(45),
    device_info JSONB,
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    correlation_id UUID,
    trace_id UUID,
    immutable BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prevent deletion of immutable audit logs
CREATE OR REPLACE FUNCTION prevent_audit_log_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.immutable = true THEN
    RAISE EXCEPTION 'Cannot delete immutable audit log records';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_audit_log_immutability ON audit_logs;
CREATE TRIGGER enforce_audit_log_immutability
BEFORE DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_deletion();


-- Usage Metrics
CREATE TABLE IF NOT EXISTS usage_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    call_minutes INT DEFAULT 0,
    stt_seconds INT DEFAULT 0,
    tts_characters INT DEFAULT 0,
    llm_tokens BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CRM Leads
CREATE TABLE IF NOT EXISTS crm_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(255),
    role VARCHAR(255),
    service_interest VARCHAR(255),
    message TEXT,
    source VARCHAR(50) DEFAULT 'voiceflow_amharic',
    status VARCHAR(50) DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Teams
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team Agents Join Table
CREATE TABLE IF NOT EXISTS team_agents (
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    role VARCHAR(100) DEFAULT 'member',
    PRIMARY KEY (team_id, agent_id)
);

-- Commander Agents
CREATE TABLE IF NOT EXISTS commander_agents (
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    routing_rules JSONB,
    PRIMARY KEY (team_id, agent_id)
);

-- Add type to tools if not exists
ALTER TABLE tools ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'webhook';

-- Routing Rules
CREATE TABLE IF NOT EXISTS routing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    phone_number_id UUID REFERENCES phone_numbers(id) ON DELETE CASCADE,
    rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CRM Contacts
CREATE TABLE IF NOT EXISTS crm_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    company_name VARCHAR(255),
    tags TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CRM Opportunities
CREATE TABLE IF NOT EXISTS crm_opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    value DECIMAL(12,2) DEFAULT 0,
    stage VARCHAR(50) DEFAULT 'prospecting',
    expected_close_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CRM Appointments
CREATE TABLE IF NOT EXISTS crm_appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    description TEXT,
    webhook_url TEXT NOT NULL,
    method VARCHAR(10) DEFAULT 'POST',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events Log
CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    source VARCHAR(100),
    trace_id VARCHAR(100),
    timestamp TIMESTAMP NOT NULL
);

-- Memory Entries
CREATE TABLE IF NOT EXISTS memory_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- user, conversation, team
    entity_id UUID NOT NULL,
    key VARCHAR(255) NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, entity_type, entity_id, key)
);

-- Policies
CREATE TABLE IF NOT EXISTS policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    rules JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    plan_id VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    current_period_end TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Departments
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    parent_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Roles & Permissions
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100),
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_system_name ON roles(name) WHERE company_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_company_name ON roles(company_id, name) WHERE company_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    action VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, role_id)
);

-- Invitations
CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    email VARCHAR(255),
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    role_name VARCHAR(50) NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_company ON invitations(company_id);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    token TEXT,
    refresh_token TEXT,
    device_info JSONB,
    ip_address VARCHAR(100),
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_company ON sessions(company_id);

-- Secrets Vault

-- Enable RLS on all tenant tables
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_agents ON agents USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_users ON users USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_calls ON calls USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_tools ON tools USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_integrations ON integrations USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE tenant_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_tenant_api_keys ON tenant_api_keys USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE provider_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_provider_configs ON provider_configs USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_phone_numbers ON phone_numbers USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_teams ON teams USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE routing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_routing_rules ON routing_rules USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_crm_contacts ON crm_contacts USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE crm_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_crm_opportunities ON crm_opportunities USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE crm_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_crm_appointments ON crm_appointments USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE connector_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_connector_runs ON connector_runs USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_knowledge_sources ON knowledge_sources USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_audit_logs ON audit_logs USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_usage_metrics ON usage_metrics USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_crm_leads ON crm_leads USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE memory_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_memory_entries ON memory_entries USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policies ON policies USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_subscriptions ON subscriptions USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE secret_vault ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_secret_vault ON secret_vault USING (company_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE agent_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_agent_versions ON agent_versions USING (
  agent_id IN (SELECT id FROM agents WHERE company_id = current_setting('app.current_tenant', true)::uuid)
);

ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_knowledge_documents ON knowledge_documents USING (
  source_id IN (SELECT id FROM knowledge_sources WHERE company_id = current_setting('app.current_tenant', true)::uuid)
);
-- Migration 002: Organization Hierarchy

-- Departments

-- Add department_id to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

-- Add department_id to teams (AI Teams)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

-- Add department_id to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

-- Enable RLS on departments
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_departments ON departments USING (company_id = current_setting('app.current_tenant', true)::uuid);
-- Migration 003: AI Governance

-- Upgrade audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS device_info JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_value JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_value JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS correlation_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS affected_resources UUID[];
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS trace_id VARCHAR(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS session_id UUID;

-- Approval Queue

ALTER TABLE approval_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_approval_queue ON approval_queue USING (company_id = current_setting('app.current_tenant', true)::uuid);

-- Agent Hierarchy

ALTER TABLE agent_hierarchy ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_agent_hierarchy ON agent_hierarchy USING (company_id = current_setting('app.current_tenant', true)::uuid);

-- Agent Tasks

ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_agent_tasks ON agent_tasks USING (company_id = current_setting('app.current_tenant', true)::uuid);
-- Migration 004: Revenue & Billing Engine


ALTER TABLE ai_cost_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ai_cost_logs ON ai_cost_logs USING (company_id = current_setting('app.current_tenant', true)::uuid);


ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_feature_flags ON feature_flags USING (company_id = current_setting('app.current_tenant', true)::uuid);


ALTER TABLE usage_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_usage_limits ON usage_limits USING (company_id = current_setting('app.current_tenant', true)::uuid);


ALTER TABLE billing_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_billing_line_items ON billing_line_items USING (company_id = current_setting('app.current_tenant', true)::uuid);
-- Migration 005: Enterprise Identity


ALTER TABLE sso_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_sso_connections ON sso_connections USING (company_id = current_setting('app.current_tenant', true)::uuid);


ALTER TABLE scim_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_scim_tokens ON scim_tokens USING (company_id = current_setting('app.current_tenant', true)::uuid);
-- Migration 006: Knowledge Platform Upgrade (Vector Partitioning)

-- Ensure knowledge_chunks has company_id for RLS and Partitioning
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- If data exists, we'd need to migrate it by joining with knowledge_sources. 
-- Assuming for now we can backfill:
UPDATE knowledge_chunks kc
SET company_id = ks.company_id
FROM knowledge_documents kd
JOIN knowledge_sources ks ON kd.source_id = ks.id
WHERE kc.document_id = kd.id AND kc.company_id IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE knowledge_chunks ALTER COLUMN company_id SET NOT NULL;

-- Enable RLS
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_knowledge_chunks ON knowledge_chunks USING (company_id = current_setting('app.current_tenant', true)::uuid);

-- Create a composite index for faster tenant-scoped vector search (HNSW index with company_id)
-- Note: Requires pgvector 0.5.0+ for HNSW, falling back to IVFFlat if needed.
-- We'll just create a standard index on company_id to speed up the pre-filter.
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_company ON knowledge_chunks (company_id);

-- Migration 007: RBAC Admin Roles & Permissions
-- NOTE: roles/permissions/role_permissions/user_roles tables created in base schema.

-- Seed all permissions
INSERT INTO permissions (name, action, resource, description)
SELECT p.name, p.action, p.resource, p.description
FROM (VALUES
    ('View Agents', 'agents:read', 'agents', 'View agent profiles and configurations'),
    ('Create Agents', 'agents:create', 'agents', 'Create new voice and chat agents'),
    ('Update Agents', 'agents:update', 'agents', 'Modify existing agent instructions and prompts'),
    ('Delete Agents', 'agents:delete', 'agents', 'Delete agents'),
    ('View Knowledge', 'knowledge:read', 'knowledge', 'View documents and RAG sources'),
    ('Create Knowledge', 'knowledge:create', 'knowledge', 'Upload documents and web crawlers'),
    ('Update Knowledge', 'knowledge:update', 'knowledge', 'Sync or modify knowledge bases'),
    ('Delete Knowledge', 'knowledge:delete', 'knowledge', 'Remove knowledge documents and sources'),
    ('View Calls', 'calls:read', 'calls', 'View call logs, metrics, and transcripts'),
    ('Listen Live', 'calls:listen', 'calls', 'Listen to live calls in real time'),
    ('Barge Call', 'calls:barge', 'calls', 'Take over or inject supervisor audio into calls'),
    ('Download Recordings', 'calls:download', 'calls', 'Download audio recordings of calls'),
    ('View Analytics', 'analytics:read', 'analytics', 'Access analytics dashboards and reports'),
    ('View CRM', 'crm:read', 'crm', 'Access CRM contacts and customer records'),
    ('Edit CRM', 'crm:write', 'crm', 'Create or update contacts, notes, and tasks'),
    ('Delete CRM', 'crm:delete', 'crm', 'Delete customer records'),
    ('View Integrations', 'integrations:read', 'integrations', 'View connected tools and webhooks'),
    ('Create Integrations', 'integrations:create', 'integrations', 'Connect new integrations and APIs'),
    ('Delete Integrations', 'integrations:delete', 'integrations', 'Disconnect integrations'),
    ('View API Keys', 'keys:read', 'keys', 'View tenant API keys and tokens'),
    ('Create API Keys', 'keys:create', 'keys', 'Generate new API keys'),
    ('Delete API Keys', 'keys:delete', 'keys', 'Revoke API keys'),
    ('View Settings', 'settings:read', 'settings', 'View organization profile and preferences'),
    ('Edit Settings', 'settings:write', 'settings', 'Modify organization settings and provider credentials'),
    ('View Billing', 'billing:read', 'billing', 'View subscription, invoices, and token usage'),
    ('Manage Billing', 'billing:write', 'billing', 'Change plans, update payment methods, buy credits'),
    ('View Team', 'users:read', 'users', 'View team members, roles, and pending invites'),
    ('Invite Members', 'users:invite', 'users', 'Invite new team members to organization'),
    ('Manage Roles', 'users:manage_roles', 'users', 'Assign, change, or create custom team roles'),
    ('Deactivate Users', 'users:deactivate', 'users', 'Deactivate or remove team members'),
    ('View Governance', 'governance:read', 'governance', 'View AI guardrails, audit trails, and approvals'),
    ('Manage Governance', 'governance:write', 'governance', 'Configure guardrails and compliance rules'),
    ('View Audit Logs', 'audit:read', 'audit', 'Access immutable audit log records'),
    ('View Phone Numbers', 'phone:read', 'phone', 'View provisioned telephony lines and SIP trunks'),
    ('Manage Phone Numbers', 'phone:create', 'phone', 'Purchase or configure phone numbers'),
    ('Delete Phone Numbers', 'phone:delete', 'phone', 'Release phone numbers')
) AS p(name, action, resource, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permissions.action = p.action);

-- Seed system roles
INSERT INTO roles (name, display_name, description, is_system)
SELECT r.name, r.display_name, r.description, true
FROM (VALUES
    ('owner', 'Owner', 'Full control over company account, billing, ownership, and all features', true),
    ('admin', 'Administrator', 'Full system management and configuration, restricted from billing ownership changes', true),
    ('supervisor', 'Supervisor', 'Call center oversight, live listening, barge-in, quality monitoring, and CRM access', true),
    ('agent', 'Call Agent', 'Handles customer calls, call history, and CRM notes', true),
    ('analyst', 'Data Analyst', 'Performance analytics, call metrics, BI dashboards, and reporting data', true),
    ('viewer', 'Viewer', 'Read-only visibility into call center summaries and public reports', true),
    ('superadmin', 'Super Admin', 'Platform operator access across all tenants', true),
    ('developer', 'Developer', 'API key, webhook, and technical configuration management', true)
) AS r(name, display_name, description, is_system)
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE roles.name = r.name AND roles.company_id IS NULL);

-- Seed role_permissions mappings
-- Owner: gets ALL permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'owner' AND r.company_id IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Admin: all permissions except billing:write and settings:write (owner-reserved)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin' AND r.company_id IS NULL
  AND p.action NOT IN ('billing:write')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Supervisor: calls (read, listen, barge, download), analytics:read, crm (read, write), governance:read, audit:read, users:read
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'supervisor' AND r.company_id IS NULL
  AND p.action IN ('calls:read', 'calls:listen', 'calls:barge', 'calls:download', 'analytics:read', 'crm:read', 'crm:write', 'governance:read', 'audit:read', 'users:read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Agent: calls:read, calls:listen, crm:read, crm:write
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'agent' AND r.company_id IS NULL
  AND p.action IN ('calls:read', 'calls:listen', 'crm:read', 'crm:write')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Analyst: analytics:read, calls:read, crm:read, audit:read
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'analyst' AND r.company_id IS NULL
  AND p.action IN ('analytics:read', 'calls:read', 'crm:read', 'audit:read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Viewer: agents:read, knowledge:read, calls:read, analytics:read, crm:read
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'viewer' AND r.company_id IS NULL
  AND p.action IN ('agents:read', 'knowledge:read', 'calls:read', 'analytics:read', 'crm:read')
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- Migration 008: Planner Service — Agent Plans

ALTER TABLE agent_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_agent_plans ON agent_plans
    USING (company_id = current_setting('app.current_tenant', true)::uuid);

CREATE INDEX IF NOT EXISTS idx_agent_plans_company ON agent_plans (company_id, created_at DESC);

-- Migration 009: Performance Indexes
-- Calls: tenant-scoped analytics queries
CREATE INDEX IF NOT EXISTS idx_calls_company_start ON calls (company_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls (company_id, status);

-- Transcripts: transcript fetch by call is a very frequent operation
CREATE INDEX IF NOT EXISTS idx_transcripts_call ON transcripts (call_id, created_at ASC);

-- Usage metrics: billing period aggregation
CREATE INDEX IF NOT EXISTS idx_usage_metrics_company_time ON usage_metrics (company_id, created_at DESC);

-- Knowledge chunks: vector search pre-filter by company
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON knowledge_chunks (document_id);

