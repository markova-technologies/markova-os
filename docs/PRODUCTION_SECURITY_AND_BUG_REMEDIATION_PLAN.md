# Markova AI Call Center — Production Security & Bug Remediation Blueprint
> **Classification:** Engineering & Security Architecture Document  
> **Status:** Approved Remediation Plan  
> **Target Scope:** Production Readiness & Telecom Grade Hardening (`kernel/`, `infrastructure/`, `packages/`, `services/`, `workers/`, `apps/`)  
> **Audience:** Lead Systems Architect, Security Engineers, Backend & Telephony Developers

---

## Executive Summary

During a deep code audit across the Markova OS codebase, critical security vulnerabilities, linguistic/algorithmic defects, process lifecycle bugs, and orchestration gaps were identified. While all 35+ automated unit tests and both Vite SPA production builds compile and pass, several latent code paths represent immediate security risks or production outages if left unaddressed in live customer deployments.

This document details the root causes, exploit vectors, production-grade architectures, concrete drop-in code fixes, and automated test protocols for all 10 identified issues.

---

## Table of Contents
1. [Security Vulnerability 1: Hardcoded API Key Backdoor in API Gateway](#1-security-vulnerability-1-hardcoded-api-key-backdoor-in-api-gateway)
2. [Security Vulnerability 2: Hardcoded `demo-token` Authentication Bypass](#2-security-vulnerability-2-hardcoded-demo-token-authentication-bypass)
3. [Security Vulnerability 3: Permissive CORS Regex with `credentials: true`](#3-security-vulnerability-3-permissive-cors-regex-with-credentials-true)
4. [Bug 1: Amharic Phonetic Corruption in Rust WASM Normalizer](#4-bug-1-amharic-phonetic-corruption-in-rust-wasm-normalizer)
5. [Bug 2: Standalone Process Termination in RPA Agent Worker](#5-bug-2-standalone-process-termination-in-rpa-agent-worker)
6. [Bug 3: Dropped Redis Stream Events in Event Processor Boot](#6-bug-3-dropped-redis-stream-events-in-event-processor-boot)
7. [Bug 4: Header Inconsistency in Outbound Campaigns Router](#7-bug-4-header-inconsistency-in-outbound-campaigns-router)
8. [Reliability Gap 1: Missing `/health` Endpoints on Internal Node Microservices](#8-reliability-gap-1-missing-health-endpoints-on-internal-node-microservices)
9. [Reliability Gap 2: Runtime Silero VAD ONNX Download Latency](#9-reliability-gap-2-runtime-silero-vad-onnx-download-latency)
10. [Reliability Gap 3: SQL Migration Numbering Collisions & Ordering Ambiguity](#10-reliability-gap-3-sql-migration-numbering-collisions--ordering-ambiguity)
11. [Reliability Gap 4: Missing Groq & Whisper Pricing in Kernel Cost Engine](#11-reliability-gap-4-missing-groq--whisper-pricing-in-kernel-cost-engine)
12. [Master Production Rollout & Verification Checklist](#12-master-production-rollout--verification-checklist)

---

## 1. Security Vulnerability 1: Hardcoded API Key Backdoor in API Gateway

### Location
[`services/api-gateway/src/auth.middleware.ts:167-176`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/api-gateway/src/auth.middleware.ts#L167-L176)

### Root Cause & Exploit Analysis
The API Gateway middleware contains a hardcoded fast-path designed for early mock testing:
```typescript
if (apiKey.startsWith('mk_test_demo') || apiKey === 'mk_test_a1b2' || apiKey === 'mk_live_c3d4') {
  const companyId = (req.headers['x-company-id'] as string) || (req.headers['x-tenant-id'] as string) || '00000000-0000-0000-0000-000000000000';
  tenantContext = {
    tenantId: companyId,
    userId: 'api-key-auth',
    role: 'api',
    permissions: ['*'],
    subscriptionPlan: 'enterprise',
    environment: apiKey.startsWith('mk_live_') ? 'live' : 'test',
  };
}
```

#### Exploit Vector
1. An attacker sends any request to `https://api.markova.tech/v1/agents` or `https://api.markova.tech/v1/calls`.
2. The attacker passes the header:
   ```http
   x-api-key: mk_live_c3d4
   x-company-id: <VICTIM_TENANT_UUID>
   ```
3. Because there is no check verifying `process.env.NODE_ENV !== 'production'`, the gateway bypasses database verification against `tenant_api_keys`, binds the context directly to the victim tenant, grants `permissions: ['*']`, and sets `subscriptionPlan: 'enterprise'`.
4. The attacker can download call recordings, eavesdrop on live calls, delete agents, or trigger unmetered calls on the victim's account.

### Production-Grade Architecture
1. **Zero Hardcoded Keys in Production:** All API keys (`mk_test_*`, `mk_live_*`) must be verified via HMAC-SHA256 hash lookup against `tenant_api_keys` in PostgreSQL.
2. **Environment Isolation Guard:** If mock keys are required for automated CI unit tests, they must be strictly gated by `process.env.NODE_ENV === 'test'` AND an explicit environment variable `ALLOW_MOCK_API_KEYS=true`.
3. **Automatic Constant-Time Lookup:** In-memory or database hash checks must be constant-time to prevent timing attacks.

### Concrete Drop-In Remediation
Update [`services/api-gateway/src/auth.middleware.ts`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/api-gateway/src/auth.middleware.ts#L167-L205):

```typescript
// Replace lines 167-205 with:
const isTestEnv = process.env.NODE_ENV === 'test' && process.env.ALLOW_MOCK_API_KEYS === 'true';

if (isTestEnv && (apiKey.startsWith('mk_test_demo') || apiKey === 'mk_test_a1b2')) {
  // STRICTLY ALLOWED IN LOCAL CI UNIT TESTS ONLY
  const companyId = (req.headers['x-company-id'] as string) || (req.headers['x-tenant-id'] as string) || '00000000-0000-0000-0000-000000000001';
  tenantContext = {
    tenantId: companyId,
    userId: 'mock-ci-user',
    role: 'api',
    permissions: ['*'],
    subscriptionPlan: 'enterprise',
    environment: 'test',
  };
} else {
  // Canonical Production Path: Mandatory Database Hash Verification
  try {
    const response = await axios.post(
      `${this.TENANT_SERVICE_URL}/api/tenant/keys/verify`,
      { apiKey },
      {
        headers: {
          'x-service-auth': generateServiceAuthHeader('api-gateway'),
          'content-type': 'application/json',
        },
        timeout: 4000,
      },
    );

    if (response.data && response.data.valid) {
      tenantContext = {
        tenantId: response.data.companyId,
        userId: 'api-key-auth',
        role: 'api',
        permissions: response.data.permissions || ['*'],
        subscriptionPlan: response.data.plan || 'starter',
        environment: response.data.environment || (apiKey.startsWith('mk_live_') ? 'live' : 'test'),
      };
    } else {
      return res.status(HttpStatus.FORBIDDEN).json({
        error: 'Invalid or revoked API Key',
        requestId,
      });
    }
  } catch (err: any) {
    console.error('Failed to communicate with tenant-service for API key validation:', err.message);
    return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      error: 'Authentication service temporarily unavailable',
      requestId,
    });
  }
}
```

### Verification & Testing Protocol
```bash
# Test 1: In production mode, ensure mock key is REJECTED
curl -i -X GET https://api.markova.tech/v1/agents \
  -H "x-api-key: mk_live_c3d4" \
  -H "x-company-id: 00000000-0000-0000-0000-000000000001"
# Expected response: 403 Forbidden ("Invalid or revoked API Key")

# Test 2: Ensure valid generated key from database continues to succeed
curl -i -X GET https://api.markova.tech/v1/agents \
  -H "x-api-key: mk_live_real_key_here..."
# Expected response: 200 OK
```

---

## 2. Security Vulnerability 2: Hardcoded `demo-token` Authentication Bypass

### Locations
* [`services/api-gateway/src/auth.middleware.ts:208-219`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/api-gateway/src/auth.middleware.ts#L208-L219)
* [`kernel/identity/tenant-guard.js:68-76`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/kernel/identity/tenant-guard.js#L68-L76)

### Root Cause & Exploit Analysis
Both the API Gateway and the shared `TenantGuard` middleware allow `Authorization: Bearer demo-token` to authenticate as an owner without verifying any cryptographic signature:
```javascript
if (token === 'demo-token') {
  const tenantId = req.headers['x-tenant-id'] || req.headers['x-company-id'] || '00000000-0000-0000-0000-000000000000';
  context = new SecurityContext({
    tenantId,
    userId: 'demo-user',
    role: 'owner',
    permissions: ['*'],
  });
}
```

#### Exploit Vector
An unauthenticated caller can forge any company ID in `x-company-id`, pass `Authorization: Bearer demo-token`, and execute administrative actions against all backend microservices (e.g. `POST /v1/users/invite`, `DELETE /v1/agents/:id`, `GET /v1/billing`).

### Production-Grade Architecture
1. **Strict Cryptographic Enforcement:** Every Bearer token must be an RS256 token signed by the Auth Service's private key or an HS256 JWT signed by Supabase Auth (`SUPABASE_JWT_SECRET`).
2. **Elimination of Magic Strings in Production:** Magic tokens like `demo-token` must be rejected immediately in `production` and `staging` environments.
3. **Fail-Closed Principle:** If a token string does not conform to the JWT 3-part header.payload.signature structure, the gateway must return `401 Unauthorized` without evaluating string equality shortcuts.

### Concrete Drop-In Remediation

#### In [`services/api-gateway/src/auth.middleware.ts:206-220`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/api-gateway/src/auth.middleware.ts#L206-L220):
```typescript
} else if (bearerToken) {
  // 2. Authenticate via JWT (Authorization: Bearer <jwt>)
  const isTestRunner = process.env.NODE_ENV === 'test' && process.env.ALLOW_DEMO_TOKEN === 'true';

  if (isTestRunner && bearerToken === 'demo-token') {
    // STRICTLY ALLOWED IN LOCAL TEST HARNESSES
    const companyId = (req.headers['x-company-id'] as string) || (req.headers['x-tenant-id'] as string) || '00000000-0000-0000-0000-000000000001';
    tenantContext = {
      tenantId: companyId,
      userId: 'test-harness-user',
      role: 'owner',
      permissions: ['*'],
      subscriptionPlan: 'enterprise',
      environment: 'test',
      aud: 'authenticated',
    };
  } else {
    // Canonical Path: RS256 / HS256 Cryptographic Verification
    try {
      // Decode and verify as standard JWT...
```

#### In [`kernel/identity/tenant-guard.js:66-86`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/kernel/identity/tenant-guard.js#L66-L86):
```javascript
    else if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const isTestEnv = process.env.NODE_ENV === 'test' && process.env.ALLOW_DEMO_TOKEN === 'true';

      if (isTestEnv && token === 'demo-token') {
        const tenantId = req.headers['x-tenant-id'] || req.headers['x-company-id'] || '00000000-0000-0000-0000-000000000001';
        context = new SecurityContext({
          tenantId,
          userId: 'test-demo-user',
          role: 'owner',
          permissions: ['*'],
        });
      } else {
        try {
          const publicKey = await getPublicKey();
          const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
          context = SecurityContext.fromJWT(decoded, req);
        } catch (jwtErr) {
          console.warn('TenantGuard RS256 token verification failed:', jwtErr.message);
          return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }
      }
    }
```

### Verification & Testing Protocol
```bash
# Verify demo-token is blocked on live gateway:
curl -i -X GET https://api.markova.tech/v1/agents \
  -H "Authorization: Bearer demo-token" \
  -H "x-company-id: 00000000-0000-0000-0000-000000000001"
# Expected response: 401 Unauthorized ("Token invalid or expired")
```

---

## 3. Security Vulnerability 3: Permissive CORS Regex with `credentials: true`

### Locations
* [`services/orchestrator/main.py:481-489`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/orchestrator/main.py#L481-L489)
* [`services/knowledge-service/main.py:29-36`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/knowledge-service/main.py#L29-L36)
* [`services/api-gateway/src/main.ts:23-29`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/api-gateway/src/main.ts#L23-L29)

### Root Cause & Exploit Analysis
In all three services, CORS configuration was relaxed during development:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
```
In NestJS Gateway:
```typescript
app.enableCors({
  origin: true, // Reflects request Origin header verbatim!
  credentials: true,
  ...
});
```

#### Exploit Vector (Cross-Site Credential Harvesting)
1. A legitimate tenant admin logs into `https://app.markova.tech`.
2. The user visits an attacker's website `https://malicious-site.com`.
3. JavaScript on `malicious-site.com` executes a `fetch('https://api.markova.tech/v1/tenant/keys', { credentials: 'include' })`.
4. Because `allow_origin_regex` accepts `https://malicious-site.com` and sets `Access-Control-Allow-Credentials: true`, the victim's browser hands the full response body containing confidential API keys, customer call logs, and PII to the malicious website.

### Production-Grade Architecture
1. **Explicit Whitelist of Production Domains:** Only approved customer dashboard domains and local development origins may be granted CORS headers.
2. **Environment Configuration:** `ALLOWED_ORIGINS` must be configurable via environment variable with safe enterprise defaults.
3. **No Wildcard Regex with Credentials:** Never use `allow_origin_regex=r"^https?://.*"` when `allow_credentials=True`.

### Concrete Drop-In Remediation

#### In [`services/orchestrator/main.py`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/orchestrator/main.py#L481-L490) and [`services/knowledge-service/main.py`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/knowledge-service/main.py#L29-L36):
```python
from fastapi.middleware.cors import CORSMiddleware

default_origins = [
    "https://app.markova.tech",
    "https://markova.tech",
    "https://admin.markova.tech",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8000",
]
env_origins = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [o.strip() for o in env_origins.split(",") if o.strip()] if env_origins else default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type", "Authorization", "x-company-id", "x-tenant-id",
        "x-markova-env", "x-service-auth", "x-request-id", "Accept", "Origin",
        "Idempotency-Key", "X-Twilio-Signature"
    ],
    expose_headers=["x-request-id", "Idempotency-Key"],
)
```

#### In [`services/api-gateway/src/main.ts:22-30`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/api-gateway/src/main.ts#L22-L30):
```typescript
const defaultOrigins = [
  'https://app.markova.tech',
  'https://markova.tech',
  'https://admin.markova.tech',
  'http://localhost:5173',
  'http://localhost:3000',
];
const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : defaultOrigins;

app.enableCors({
  origin: (origin, callback) => {
    if (!origin || envOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
  allowedHeaders: [
    'Content-Type', 'Authorization', 'x-company-id', 'x-tenant-id',
    'x-markova-env', 'Accept', 'Origin', 'Idempotency-Key', 'x-api-key'
  ],
  exposedHeaders: ['x-request-id', 'Idempotency-Key'],
});
```

### Verification Protocol
```bash
# 1. Verify unapproved origin is rejected:
curl -i -X OPTIONS https://api.markova.tech/v1/agents \
  -H "Origin: https://evil-attacker.com" \
  -H "Access-Control-Request-Method: GET"
# Expected response: No Access-Control-Allow-Origin: https://evil-attacker.com

# 2. Verify approved origin succeeds:
curl -i -X OPTIONS https://api.markova.tech/v1/agents \
  -H "Origin: https://app.markova.tech" \
  -H "Access-Control-Request-Method: GET"
# Expected response: Access-Control-Allow-Origin: https://app.markova.tech
```

---

## 4. Bug 1: Amharic Phonetic Corruption in Rust WASM Normalizer

### Location
[`kernel/wasm/normalizer.rs:8-10`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/kernel/wasm/normalizer.rs#L8-L10)

### The Bug & Linguistic Impact
The Rust WASM normalizer module had a logic bug in its character mapping pattern:
```rust
// BUGGY IMPLEMENTATION:
for ch in input.chars() {
    match ch {
        'ሐ' | 'ሑ' | 'ሒ' | 'ሓ' | 'ሔ' | 'ሕ' | 'ሖ' => normalized.push('ሀ'),
        'ሠ' | 'ሡ' | 'ሢ' | 'ሣ' | 'ሤ' | 'ሥ' | 'ሦ' => normalized.push('ሰ'),
        'ዐ' | 'ዑ' | 'ዒ' | 'ዓ' | 'ዔ' | 'ዕ' | 'ዖ' => normalized.push('አ'),
        _ => normalized.push(ch),
    }
}
```
In Ethiopic Ge'ez script, every consonant row has 7 distinct vowel modifications (orders 1 through 7):
* 1st (Ge'ez): `ä`
* 2nd (Ka'ib): `u`
* 3rd (Salis): `i`
* 4th (Rabi): `a`
* 5th (Hamis): `e`
* 6th (Sadis): consonant alone / `ə`
* 7th (Sabi): `o`

By mapping `'ሐ' | 'ሑ' | 'ሒ' | 'ሓ' | 'ሔ' | 'ሕ' | 'ሖ'` all to `'ሀ'` (the 1st form), **all vowel information is lost**.
* `ሕይወት` (*hiywet*, "life") becomes `ሀይወት` (*heywet*, nonsensical).
* `ሥራ` (*səra*, "work") becomes `ሰራ` (*sära*, "he worked").
* `ዒላማ` (*ilama*, "target") becomes `አላማ` (*alama*, "purpose").

This breaks intent classification, RAG similarity search, and entity extraction when processed through Edge Workers.

### Concrete Drop-In Remediation
Update [`kernel/wasm/normalizer.rs`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/kernel/wasm/normalizer.rs):

```rust
// Rust WebAssembly (WASM) Amharic Canonical Homophone Normalizer
// Matches the exact canonical linguistic mapping in services/orchestrator/fast_voice_loop.py

pub fn normalize_amharic_text(input: &str) -> String {
    let mut normalized = String::with_capacity(input.len());
    
    for ch in input.chars() {
        let mapped = match ch {
            // ሐ (Hameru Ha) -> ሀ
            'ሐ' => 'ሀ', 'ሑ' => 'ሁ', 'ሒ' => 'ሂ', 'ሓ' => 'ሃ', 'ሔ' => 'ሄ', 'ሕ' => 'ህ', 'ሖ' => 'ሆ',
            // ኀ (Buzu Ha) -> ሀ
            'ኀ' => 'ሀ', 'ኁ' => 'ሁ', 'ኂ' => 'ሂ', 'ኃ' => 'ሃ', 'ኄ' => 'ሄ', 'ኅ' => 'ህ', 'ኆ' => 'ሆ',
            // ሠ (Nigus Se) -> ሰ
            'ሠ' => 'ሰ', 'ሡ' => 'ሱ', 'ሢ' => 'ሲ', 'ሣ' => 'ሳ', 'ሤ' => 'ሴ', 'ሥ' => 'ስ', 'ሦ' => 'ሶ',
            // ዐ (Aynu A) -> አ
            'ዐ' => 'አ', 'ዑ' => 'ኡ', 'ዒ' => 'ኢ', 'ዓ' => 'ኣ', 'ዔ' => 'ኤ', 'ዕ' => 'እ', 'ዖ' => 'ኦ',
            // ጸ (Tsehay Tse) -> ፀ
            'ጸ' => 'ፀ', 'ጹ' => 'ፁ', 'ጺ' => 'ፂ', 'ጻ' => 'ፃ', 'ጼ' => 'ፄ', 'ጽ' => 'ፅ', 'ጾ' => 'ፆ',
            other => other,
        };
        normalized.push(mapped);
    }
    
    normalized
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalization_preserves_vowel_orders() {
        assert_eq!(normalize_amharic_text("ሐኪም"), "ሀኪም");      // 1st order
        assert_eq!(normalize_amharic_text("ሕይወት"), "ህይወት");    // 6th order preserved!
        assert_eq!(normalize_amharic_text("ሥራ"), "ስራ");        // 6th order preserved!
        assert_eq!(normalize_amharic_text("ዓለም"), "ኣለም");      // 4th order preserved!
        assert_eq!(normalize_amharic_text("ጸሀይ"), "ፀሀይ");      // 1st order preserved!
    }
}
```

---

## 5. Bug 2: Standalone Process Termination in RPA Agent Worker

### Location
[`workers/rpa-agent/worker.js:28-30`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/workers/rpa-agent/worker.js#L28-L30)

### The Bug & Production Impact
In `workers/rpa-agent/package.json`, the start script is `"start": "node worker.js"`.
However, `worker.js` contained:
```javascript
module.exports = { processRpaTask };

if (require.main === module) {
  console.log('✅ RPA Agent Worker ready and listening for jobs.');
}
```
When launched in Docker or background process management, Node runs `worker.js`, prints the log line, encounters the end of the script with no active event loop timers or socket listeners, and **exits immediately with code 0**. In Docker Compose / Kubernetes, the container enters a crash-restart loop (`CrashLoopBackOff`).

### Concrete Drop-In Remediation
Wire up the BullMQ `Worker` listener using `ioredis` to consume from `rpa_tasks_queue`.

Update [`workers/rpa-agent/worker.js`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/workers/rpa-agent/worker.js):

```javascript
require('dotenv').config();
const { Worker } = require('bullmq');
const { generateTenantPdfReport } = require('./tasks/report_generator');
const { convertMediaAsset } = require('./tasks/asset_converter');

const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const QUEUE_NAME = process.env.RPA_QUEUE_NAME || 'rpa_tasks_queue';

async function processRpaTask(taskType, payload) {
  console.log(`[RPA Worker] Processing task '${taskType}' for tenant: ${payload.tenantId}`);
  
  if (taskType === 'GENERATE_REPORT') {
    return await generateTenantPdfReport(payload.tenantId, payload.data, payload.outputDir);
  } else if (taskType === 'CONVERT_ASSET') {
    return await convertMediaAsset(payload.inputPath, payload.targetFormat);
  }
  
  throw new Error(`Unknown RPA task type: ${taskType}`);
}

if (require.main === module) {
  console.log(`🤖 Markova RPA Agent Worker starting on queue: '${QUEUE_NAME}'...`);

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      console.log(`[RPA Worker] Picked up Job ID ${job.id} (${job.name})`);
      const { taskType, payload } = job.data;
      return await processRpaTask(taskType || job.name, payload);
    },
    {
      connection: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        password: process.env.REDIS_PASSWORD || undefined,
      },
      concurrency: parseInt(process.env.RPA_CONCURRENCY || '2', 10),
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ [RPA Worker] Job ${job.id} completed successfully.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ [RPA Worker] Job ${job?.id} failed:`, err.message);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down RPA worker...');
    await worker.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = { processRpaTask };
```

---

## 6. Bug 3: Dropped Redis Stream Events in Event Processor Boot

### Location
[`workers/event-processor/index.js:63`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/workers/event-processor/index.js#L63) vs [`kernel/events/bus.js:59`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/kernel/events/bus.js#L59)

### The Bug & Production Impact
In `workers/event-processor/index.js`:
```javascript
await redis.xGroupCreate(STREAM_KEY, GROUP_NAME, '$', { MKSTREAM: true });
```
In Redis Streams:
* `$` means "only deliver messages arriving *after* group creation".
* `'0'` means "deliver all messages from the beginning of the stream".

When Markova orchestrator is running and calls occur, `call.started`, `call.ended`, and `turn.completed` events are written to `markova_events`. If `event-processor` starts 10 seconds later, or restarts during a rolling deployment, **all existing events in the stream are permanently skipped**. Consequently, dashboard metrics and audit log tables are missing call records.

### Concrete Drop-In Remediation
Update [`workers/event-processor/index.js:61-70`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/workers/event-processor/index.js#L61-L70):

```javascript
  // Create consumer group if it doesn't exist, starting from '0' (catch up on unprocessed events)
  try {
    await redis.xGroupCreate(STREAM_KEY, GROUP_NAME, '0', { MKSTREAM: true });
    console.log(`✅ Consumer group '${GROUP_NAME}' created (reading from beginning of stream)`);
  } catch (err) {
    if (!err.message.includes('BUSYGROUP')) {
      throw err; // Only ignore BUSYGROUP (group already exists)
    }
  }
```

---

## 7. Bug 4: Header Inconsistency in Outbound Campaigns Router

### Location
[`services/orchestrator/campaigns.py:17-22`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/orchestrator/campaigns.py#L17-L22)

### The Bug & Production Impact
The campaign engine looks strictly for `X-Company-ID`:
```python
def get_tenant_id(request: Request) -> str:
    company_id = request.headers.get("X-Company-ID")
    if not company_id:
        raise HTTPException(status_code=401, detail="Unauthorized: Missing X-Company-ID")
    return company_id
```
Throughout the platform (`api-gateway`, `TenantGuard`, `main.py`), tenant identity is propagated via both `x-tenant-id` and `x-company-id`. Internal services and SDK clients passing `x-tenant-id` receive `401 Unauthorized` when interacting with `/v1/campaigns`.

### Concrete Drop-In Remediation
Update [`services/orchestrator/campaigns.py:17-23`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/orchestrator/campaigns.py#L17-L23):

```python
def get_tenant_id(request: Request) -> str:
    # Parity with main.py: resolve either x-company-id or x-tenant-id
    company_id = (
        request.headers.get("x-company-id") or
        request.headers.get("x-tenant-id") or
        request.headers.get("X-Company-ID") or
        request.headers.get("X-Tenant-ID")
    )
    if not company_id:
        raise HTTPException(status_code=401, detail="Unauthorized: Missing x-company-id / x-tenant-id header")
    return company_id.strip()
```

---

## 8. Reliability Gap 1: Missing `/health` Endpoints on Internal Node Microservices

### Locations
* `services/agent-builder/server.js` (Port 5003)
* `services/tool-engine/server.js` (Port 5004)
* `services/connector-hub/server.js` (Port 5005)
* `services/tenant-service/server.js` (Port 5002)

### Root Cause & Impact
In all four services, `app.use('/api', TenantGuard)` was mounted before any unauthenticated `/health` route was registered.
* In Docker Compose: healthcheck probes fail.
* In Kubernetes: `livenessProbe` and `readinessProbe` receive `404 Not Found` or `401 Unauthorized` and terminate the pod repeatedly.
* In Render/Cloud deployments: zero-downtime rolling deploys fail because the deployment controller cannot verify that the container is healthy.

### Concrete Drop-In Remediation
Add a standard, lightweight health check before `TenantGuard` in all 4 services:

```javascript
// Add before app.use('/api', TenantGuard) in server.js:
app.get(['/health', '/api/health', '/v1/health'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: process.env.SERVICE_NAME || 'markova-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

---

## 9. Reliability Gap 2: Runtime Silero VAD ONNX Download Latency

### Location
[`services/orchestrator/vad.py:38-41`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/orchestrator/vad.py#L38-L41) & [`services/orchestrator/Dockerfile`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/orchestrator/Dockerfile)

### Root Cause & Telecom Impact
`vad.py` attempts to fetch the 2MB model from GitHub during the first audio turn:
```python
if not os.path.exists(model_path):
    logger.info("downloading_silero_vad_model")
    import urllib.request
    urllib.request.urlretrieve(
        "https://github.com/snakers4/silero-vad/raw/master/files/silero_vad.onnx",
        model_path
    )
```
On a live phone call:
1. Downloading 2MB over public internet introduces a 1.5s–4s delay on the first caller turn, violating the platform's <500ms TTFA (Time-to-First-Audio) target.
2. In locked-down VPCs or enterprise hosting without outbound internet access, this fails completely and falls back to CPU-heavy, less accurate energy VAD.

### Concrete Drop-In Remediation
Pre-download and bake `silero_vad.onnx` into the Docker image during the build phase.

Update [`services/orchestrator/Dockerfile:4-15`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/orchestrator/Dockerfile#L4-L15):
```dockerfile
# Install ffmpeg for real-time audio transcoding, curl, and download silero_vad.onnx at build time
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pre-fetch Silero VAD model into container image
RUN curl -L -o /app/silero_vad.onnx "https://github.com/snakers4/silero-vad/raw/master/files/silero_vad.onnx" || true

# Copy requirements and install dependencies
COPY services/orchestrator/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
```

---

## 10. Reliability Gap 3: SQL Migration Numbering Collisions & Ordering Ambiguity

### Location
`infrastructure/migrations/`

### Root Cause & Impact
The migrations folder contains duplicate numeric prefixes:
* `001_enterprise_security.sql` vs `001_memory_tables.sql`
* `002_capabilities_table.sql` vs `002_org_hierarchy.sql`
* `007_admin_roles.sql` vs `007_api_key_environment.sql`
* `015_billing_integration.sql` vs `015_developer_webhooks.sql`

In [`services/orchestrator/migrations.py`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/orchestrator/migrations.py#L27):
```python
files = sorted(glob.glob(os.path.join(migrations_dir, "*.sql")))
```
Because sorting relies on string comparison, file execution depends purely on alphabetical suffix order. If `001_memory_tables.sql` relies on foreign keys or extensions declared in `001_enterprise_security.sql`, any rename or system difference will break clean database bootstrapping.

### Concrete Drop-In Remediation
Renumber migration files sequentially to establish an unambiguous, deterministic execution order:
* `000_base_schema.sql`
* `001_enterprise_security.sql`
* `002_memory_tables.sql`
* `003_capabilities_table.sql`
* `004_org_hierarchy.sql`
* `005_ai_governance.sql`
* `006_billing_engine.sql`
* `007_enterprise_identity.sql`
* `008_knowledge_upgrade.sql`
* `009_admin_roles.sql`
* `010_api_key_environment.sql`
* `011_phase4_parity.sql`
* `012_agent_plans.sql`
* `013_semantic_cache.sql`
* `014_semantic_cache_cleanup_fn.sql`
* `015_dedup_schema_cleanup.sql`
* `016_immutable_audit_log.sql`
* `017_call_encryption.sql`
* `018_billing_integration.sql`
* `019_developer_webhooks.sql`
* `020_caller_memory.sql`
* `021_campaign_engine.sql`
* `022_white_labeling.sql`
* `023_agent_knowledge_and_teams.sql`
* `024_enterprise_rbac_and_invites.sql`
* `025_company_workspace_slug.sql`
* `026_user_profile_and_verification.sql`

---

## 11. Reliability Gap 4: Missing Groq & Whisper Pricing in Kernel Cost Engine

### Location
[`kernel/billing/cost-engine.js:5-12`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/kernel/billing/cost-engine.js#L5-L12)

### Root Cause & Financial Impact
The cost engine only had hardcoded rates for OpenAI and Google Gemini models:
```javascript
this.PRICING = {
  'gpt-4o': { prompt: 0.005, completion: 0.015 },
  'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
  'gemini-1.5-pro': { prompt: 0.0035, completion: 0.0105 }
};
```
Because the production orchestrator runs on **Groq LLaMA 3.3 70B** (`llama-3.3-70b-versatile`) and **Groq Whisper** (`whisper-large-v3`), line 15:
```javascript
const rates = this.PRICING[modelName] || { prompt: 0.0, completion: 0.0 };
```
computes all inference usage as **$0.00**, resulting in unbilled LLM usage and inaccurate tenant billing dashboards.

### Concrete Drop-In Remediation
Update [`kernel/billing/cost-engine.js:5-13`](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/kernel/billing/cost-engine.js#L5-L13):

```javascript
this.PRICING = {
  // Groq Production Voice Engine
  'llama-3.3-70b-versatile': { prompt: 0.00059, completion: 0.00079 },
  'llama-3.1-8b-instant':     { prompt: 0.00005, completion: 0.00008 },
  'whisper-large-v3':         { prompt: 0.00010, completion: 0.00010 },
  'whisper-large-v3-turbo':   { prompt: 0.00004, completion: 0.00004 },
  
  // OpenAI & Gemini Fallbacks
  'gpt-4o':                   { prompt: 0.00500, completion: 0.01500 },
  'gpt-4o-mini':              { prompt: 0.00015, completion: 0.00060 },
  'gpt-3.5-turbo':            { prompt: 0.00050, completion: 0.00150 },
  'gemini-1.5-flash':         { prompt: 0.000075, completion: 0.00030 },
  'gemini-1.5-pro':           { prompt: 0.00350, completion: 0.01050 }
};
```

---

## 12. Master Production Rollout & Verification Checklist

To apply these remediations to production with zero downtime, execute the following phased deployment:

### Phase 1: Security & Auth Hardening (Immediate)
- [ ] Remove hardcoded `demo-token` and mock `mk_*` keys from `services/api-gateway/src/auth.middleware.ts` and `kernel/identity/tenant-guard.js`.
- [ ] Restrict CORS to `ALLOWED_ORIGINS` in `services/orchestrator/main.py`, `services/knowledge-service/main.py`, and `services/api-gateway/src/main.ts`.
- [ ] Run `npm run build --workspace=services/api-gateway` to ensure clean TypeScript compilation.

### Phase 2: Algorithm & Worker Lifecycle Patches
- [ ] Replace `kernel/wasm/normalizer.rs` with order-preserving vowel normalization.
- [ ] Attach the BullMQ worker event loop in `workers/rpa-agent/worker.js`.
- [ ] Change `xGroupCreate` in `workers/event-processor/index.js` to start from `'0'`.
- [ ] Update `services/orchestrator/campaigns.py` to accept `x-tenant-id` alongside `x-company-id`.

### Phase 3: Reliability & Monitoring Infrastructure
- [ ] Mount `/health` routes in `agent-builder`, `tool-engine`, `connector-hub`, and `tenant-service`.
- [ ] Update `services/orchestrator/Dockerfile` to bake `silero_vad.onnx` into the container image.
- [ ] Expand `kernel/billing/cost-engine.js` with Groq pricing models.

### Phase 4: Automated Verification Suite
Run the test battery to ensure 100% test pass rate across all services:
```bash
# Python Core & Telephony Test Suite
python -m pytest tests/ packages/markova-python-sdk/tests/ test_phase6_imports.py -v

# Node Integration & SDK Suite
node packages/sdk/test.js
node tests/system_integration_test.js

# Frontend Client & Admin Production Builds
npm run build:client
npm run build:admin
```
