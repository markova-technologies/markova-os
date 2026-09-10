-- Migration 002: Organization Hierarchy

-- Departments
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    parent_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add department_id to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

-- Add department_id to teams (AI Teams)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

-- Add department_id to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

-- Enable RLS on departments
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_departments ON departments USING (company_id = current_setting('app.current_tenant', true)::uuid);
