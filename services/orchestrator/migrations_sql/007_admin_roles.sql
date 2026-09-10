-- Migration 007: RBAC Admin Roles & Permissions

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT
);

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
INSERT INTO roles (name, description) VALUES
    ('superadmin', 'Full platform access'),
    ('admin', 'Tenant admin access'),
    ('platform_admin', 'Infrastructure and gateway config'),
    ('support_admin', 'Read-only access to tenant issues'),
    ('billing_admin', 'Access to Stripe/billing metrics'),
    ('developer', 'API key and webhook management')
ON CONFLICT (name) DO NOTHING;
