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
CREATE TABLE IF NOT EXISTS approval_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    requester_id UUID,
    requester_type VARCHAR(50) NOT NULL,
    action VARCHAR(255) NOT NULL,
    context JSONB NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    approver_id UUID REFERENCES users(id),
    decision_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE approval_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_approval_queue ON approval_queue USING (company_id = current_setting('app.current_tenant', true)::uuid);

-- Agent Hierarchy
CREATE TABLE IF NOT EXISTS agent_hierarchy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    parent_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    child_agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    delegation_rules JSONB,
    UNIQUE(parent_agent_id, child_agent_id)
);

ALTER TABLE agent_hierarchy ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_agent_hierarchy ON agent_hierarchy USING (company_id = current_setting('app.current_tenant', true)::uuid);

-- Agent Tasks
CREATE TABLE IF NOT EXISTS agent_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    commander_id UUID REFERENCES agents(id),
    executor_id UUID REFERENCES agents(id),
    task_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'planning',
    input JSONB,
    output JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_agent_tasks ON agent_tasks USING (company_id = current_setting('app.current_tenant', true)::uuid);
