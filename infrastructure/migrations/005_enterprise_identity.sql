-- Migration 005: Enterprise Identity

CREATE TABLE IF NOT EXISTS sso_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    provider VARCHAR(100) NOT NULL,
    idp_entity_id VARCHAR(255),
    sso_url VARCHAR(255),
    certificate TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id)
);

ALTER TABLE sso_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_sso_connections ON sso_connections USING (company_id = current_setting('app.current_tenant', true)::uuid);

CREATE TABLE IF NOT EXISTS scim_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    UNIQUE(company_id)
);

ALTER TABLE scim_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_scim_tokens ON scim_tokens USING (company_id = current_setting('app.current_tenant', true)::uuid);
