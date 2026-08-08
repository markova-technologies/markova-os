# Incident Response Runbook

**Reference:** INSA Cyber Security Incident Handling Procedures

## Scenario 1: Data Breach (Unauthorized Access)
1. **Detect**: Alert triggered by `api-gateway` rate-limiting or anomalous `auth_failed` spikes.
2. **Contain**: Revoke all active JWT sessions via Redis `jwt_blacklist`. Rotate `ENCRYPTION_KEY`.
3. **Eradicate**: Patch vulnerability, isolate compromised containers.
4. **Report**: Notify INSA within 24 hours of confirmation.

## Scenario 2: Service Outage (DDoS)
1. **Detect**: Cloudflare or domestic WAF alerts on volumetric traffic.
2. **Contain**: Enable "Under Attack" mode, tightening rate limits on `api-gateway` (max 10 req/sec per IP).
3. **Eradicate**: Filter malicious IPs, scale up orchestrator replicas via Kubernetes HPA.

## Scenario 3: Data Residency Violation
1. **Detect**: `DATA_RESIDENCY_VIOLATION` log fired when traffic attempts to route to external STT/LLM during strict mode.
2. **Contain**: Traffic is automatically aborted by the platform.
3. **Eradicate**: Audit source code and configuration for misconfigured provider routing rules.
