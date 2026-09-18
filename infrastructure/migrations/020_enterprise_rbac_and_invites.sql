-- Migration 020: Enterprise Multi-User RBAC, Invitations, Sessions & Departments

-- Departments
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    parent_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

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
    email VARCHAR(255) NOT NULL,
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

-- Admin: all permissions except billing:write
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
