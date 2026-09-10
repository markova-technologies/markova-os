-- Migration 001: Enterprise Security & RLS

-- Roles & Permissions
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(255) NOT NULL UNIQUE, -- e.g. 'billing:read', 'agents:write'
    description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    device_info JSONB, -- { browser, os, device_type }
    ip_address INET,
    is_trusted BOOLEAN DEFAULT false,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Secrets Vault
CREATE TABLE IF NOT EXISTS secret_vault (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    key_name VARCHAR(255) NOT NULL,
    encrypted_value TEXT NOT NULL,
    iv TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, key_name)
);

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
