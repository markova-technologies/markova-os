# Encryption Specification

**Reference:** INSA Cryptographic Standards and Algorithms

## Data at Rest
- **Database**: PostgreSQL TDE (Transparent Data Encryption) using AES-256-XTS.
- **Application Level**: Sensitive provider API keys (OpenAI, Twilio, Deepgram) are encrypted using `AES-256-GCM` before being stored in the `provider_configs` table.

## Key Management
- **Master Key (`ENCRYPTION_KEY`)**: A 32-byte (256-bit) cryptographically secure hex string.
- **Storage**: Keys are stored in secure environment variables or a KMS (Key Management Service). They are NEVER committed to version control.
- **Rotation**: Keys must be rotated every 90 days. The platform supports active and legacy decryption keys for zero-downtime rotation.

## Data in Transit
- All internal and external traffic is secured via TLS 1.3.
- Internal service-to-service communication is authenticated using HMAC-SHA256 signatures (`x-gateway-sig`).
