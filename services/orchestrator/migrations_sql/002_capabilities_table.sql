-- Migration 002: Capability Registry Table

CREATE TABLE IF NOT EXISTS capabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL, -- tool, integration, workflow, api, rpa
    version VARCHAR(20) DEFAULT '1.0.0',
    schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    permissions TEXT[] DEFAULT ARRAY['*'],
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_capabilities_company ON capabilities (company_id);
