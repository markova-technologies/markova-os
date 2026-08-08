# Privacy Impact Assessment

**Reference:** Ethiopian Data Protection Proclamation / INSA Privacy Framework

## Data Collection
Markova AI Call Center collects:
- **Audio Recordings**: Inbound/Outbound voice calls in Amharic/English.
- **Transcripts**: STT generated text of the conversations.
- **Metadata**: Phone numbers, timestamps, duration, call status.

## Purpose of Processing
To provide automated customer support, QA analysis, and business intelligence for the tenant.

## Data Retention and Deletion
- **Recordings**: Automatically expunged after 30 days unless explicitly pinned by the tenant.
- **Transcripts**: Anonymized (PII scrubbing) after 90 days.
- **Right to Erasure**: Tenants and end-users can request data deletion via the `/api/privacy/delete` endpoint, executing a hard delete across PostgreSQL and S3.
