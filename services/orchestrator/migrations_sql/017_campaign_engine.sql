-- 017_campaign_engine.sql

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    agent_id UUID NOT NULL, -- references the AI agent to use
    phone_number_id UUID NOT NULL, -- the Twilio number to call from
    prompt_template TEXT, -- Optional contextual prompt to prepend for this campaign
    status VARCHAR(50) DEFAULT 'draft', -- draft, running, completed, paused
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    phone_number VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb, -- extra context like name, invoice amount, etc.
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed, dnc_skipped
    call_id UUID, -- If completed/failed, the call ID associated
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dnc_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    phone_number VARCHAR(50) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, phone_number)
);

-- RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dnc_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_campaigns ON campaigns
    FOR ALL USING (company_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_campaign_contacts ON campaign_contacts
    FOR ALL USING (campaign_id IN (SELECT id FROM campaigns WHERE company_id = current_setting('app.current_tenant')::uuid));

CREATE POLICY tenant_isolation_dnc_list ON dnc_list
    FOR ALL USING (company_id = current_setting('app.current_tenant')::uuid);
