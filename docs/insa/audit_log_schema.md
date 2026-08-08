# Audit Log Schema & Retention

**Reference:** INSA Information Systems Audit Logging Requirements

## Schema Definition
The Markova platform utilizes `structlog` for structured JSON logging across all backend services.
Fields:
- `timestamp`: ISO-8606 UTC timestamp
- `level`: Log severity (INFO, WARNING, ERROR, CRITICAL)
- `event`: Event identifier (e.g. `call_initiated`, `auth_failed`, `data_residency_violation`)
- `company_id`: Tenant UUID
- `call_sid`: Unique session identifier
- `ip_address`: Source IP (hashed if PII rules apply)
- `user_id`: Authenticated user UUID

## Retention Policy
1. **Active Storage**: Elasticsearch/OpenSearch for 90 days.
2. **Cold Storage**: AWS S3 (or domestic INSA compliant object storage) for 5 years.
3. **Immutability**: Audit logs are written asynchronously using WORM (Write-Once-Read-Many) policies.
