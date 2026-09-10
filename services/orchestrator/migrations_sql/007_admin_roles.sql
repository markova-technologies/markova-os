-- Migration 007: RBAC Admin Roles & Permissions

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, name)
);

ALTER TABLE roles ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(100) UNIQUE NOT NULL,
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

-- Seed default admin roles
INSERT INTO roles (name, description)
SELECT r.name, r.description
FROM (VALUES
    ('superadmin', 'Full platform access'),
    ('admin', 'Tenant admin access'),
    ('platform_admin', 'Infrastructure and gateway config'),
    ('support_admin', 'Read-only access to tenant issues'),
    ('billing_admin', 'Access to Stripe/billing metrics'),
    ('developer', 'API key and webhook management')
) AS r(name, description)
WHERE NOT EXISTS (
    SELECT 1 FROM roles WHERE roles.name = r.name AND roles.company_id IS NULL
);
