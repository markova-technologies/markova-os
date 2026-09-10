-- Migration 004: Revenue & Billing Engine

CREATE TABLE IF NOT EXISTS ai_cost_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    trace_id VARCHAR(100),
    model_name VARCHAR(100) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost_usd NUMERIC(10, 6) DEFAULT 0,
    markup_usd NUMERIC(10, 6) DEFAULT 0,
    final_billed_usd NUMERIC(10, 6) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ai_cost_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ai_cost_logs ON ai_cost_logs USING (company_id = current_setting('app.current_tenant', true)::uuid);

CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    UNIQUE(company_id, feature_name)
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_feature_flags ON feature_flags USING (company_id = current_setting('app.current_tenant', true)::uuid);

CREATE TABLE IF NOT EXISTS usage_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    resource_type VARCHAR(100) NOT NULL,
    current_usage NUMERIC(15, 4) DEFAULT 0,
    max_limit NUMERIC(15, 4) DEFAULT 0,
    reset_date TIMESTAMP,
    UNIQUE(company_id, resource_type)
);

ALTER TABLE usage_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_usage_limits ON usage_limits USING (company_id = current_setting('app.current_tenant', true)::uuid);

CREATE TABLE IF NOT EXISTS billing_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    amount_usd NUMERIC(10, 4) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'unbilled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE billing_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_billing_line_items ON billing_line_items USING (company_id = current_setting('app.current_tenant', true)::uuid);
