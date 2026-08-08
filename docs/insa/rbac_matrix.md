# Role-Based Access Control (RBAC) Matrix

**Reference:** INSA Identity and Access Management Guidelines

## Roles
- **Owner**: Full access to all tenant resources, billing, and destructive actions (e.g., deleting the company).
- **Admin**: Can manage agents, routing rules, tools, and view all call logs. Cannot manage billing or delete the company.
- **Member**: Can view call logs, transcripts, and analytics. Can initiate outbound calls. Cannot modify agent configurations or tools.
- **Viewer**: Read-only access to analytics and call logs. Cannot hear audio recordings.

## Enforcement
The `api-gateway` enforces RBAC via the `TenantGuard` middleware. Permissions are encoded in the RS256 signed JWTs and validated against the `role_permissions` database table.
