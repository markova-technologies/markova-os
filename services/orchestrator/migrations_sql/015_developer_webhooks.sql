-- 015_developer_webhooks.sql

CREATE TABLE IF NOT EXISTS developer_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    environment VARCHAR(50) NOT NULL DEFAULT 'test', -- 'test' or 'live'
    webhook_url TEXT NOT NULL,
    secret_key VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, environment)
);

CREATE INDEX IF NOT EXISTS idx_developer_webhooks_company_id ON developer_webhooks(company_id);
