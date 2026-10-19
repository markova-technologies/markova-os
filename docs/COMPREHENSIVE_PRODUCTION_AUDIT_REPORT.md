# Markova AI Call Center: Comprehensive Production Audit & Bug Report

**Audit Date**: October 2026  
**Auditor**: Antigravity Autonomous Pair Programmer  
**Scope**: Complete Codebase (`kernel/`, `services/`, `workers/`, `infrastructure/`, `packages/`, `apps/`, `ai call center/`)  
**Methodology**: Static AST analysis, syntax compilation checks, pattern-based vulnerability discovery, cross-service flow tracing, and automated test execution across 501 source files.

---

## Executive Summary

| Category | Total Discovered | Critical | High | Medium | Low |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Security & Authentication** | 9 | 2 | 5 | 2 | 0 |
| **Logic Bugs & Crashes** | 8 | 1 | 3 | 4 | 0 |
| **Infrastructure & Deployment** | 2 | 0 | 1 | 1 | 0 |
| **Total Findings** | **19** | **3** | **9** | **7** | **0** |

All 54 existing Python unit tests in `pytest` currently pass, but this static and architectural audit revealed **19 production-blocking defects and security risks** that affect multi-tenancy, platform administration, document ingestion, and microservice compilation.

---

## 1. Security & Authentication Vulnerabilities

### 🚨 VULN-01: Critical Authentication Bypass via `authenticateUser` Mock Tokens in `auth-service`
- **Location**: [services/auth-service/server.js:1386-1399](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/auth-service/server.js#L1386-L1399)
- **Severity**: **CRITICAL**
- **Impact**: Complete multi-tenant compromise and account takeover.
- **Root Cause**:
  ```javascript
  // Line 1386:
  if (token.startsWith('demo-token') || token.startsWith('test-token')) {
    const headerCompanyId = req.headers['x-company-id'] || req.headers['x-tenant-id'];
    if (headerCompanyId) {
      req.user = {
        userId: '00000000-0000-0000-0000-000000000001',
        companyId: headerCompanyId,
        name: 'Demo Admin',
        role: 'owner',
        permissions: ['*']
      };
      return next();
    }
  }
  ```
  While `api-gateway` and `tenant-guard` were hardened, `services/auth-service/server.js` maintains an ungated check where any caller sending `Authorization: Bearer demo-token` with `X-Company-ID: <target_company_id>` is granted `role: 'owner'` and wildcard `['*']` permissions over any tenant.
- **Remediation**: Wrap the mock token check inside `if (process.env.NODE_ENV !== 'production' && (token.startsWith('demo-token') || ...))`.

---

### 🚨 VULN-02: Critical Privilege Escalation & Unauthenticated Admin Bypass in `tenant-service`
- **Location**: [services/tenant-service/server.js:268-278](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/tenant-service/server.js#L268-L278) & [services/api-gateway/src/proxy.util.ts:50-52](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/api-gateway/src/proxy.util.ts#L50-L52)
- **Severity**: **CRITICAL**
- **Impact**: Unauthorized platform administration, company deletion, and data leakage.
- **Root Cause**:
  In `services/tenant-service/server.js`:
  ```javascript
  const ADMIN_ROLES = new Set(['admin', 'superadmin', 'SUPER_ADMIN', 'PLATFORM_ADMIN', 'BILLING_ADMIN', 'SUPPORT_ADMIN', 'DEVELOPER']);

  function adminGuard(req, res, next) {
    const role = (req.headers['x-role'] || '').trim();
    if (!role || !ADMIN_ROLES.has(role)) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
  }
  ```
  `adminGuard` does not verify JWT signatures, HMAC gateway signatures, or session tokens. In `proxy.util.ts`, the API Gateway blindly forwards incoming client `x-role` headers. Consequently, an external caller providing `x-role: admin` gains access to `/api/admin/companies` and `DELETE /api/admin/companies/:id`, allowing them to delete companies in Postgres.
- **Remediation**: `adminGuard` must verify JWT tokens (ensuring `decoded.role === 'superadmin'` or `aud === 'admin'`) or validate HMAC gateway signatures (`req.headers['x-gateway-sig']`). Furthermore, `proxy.util.ts` must never forward raw, unvalidated client `x-role` headers.

---

### 🚨 VULN-03: Critical SQL Injection in Dynamic Connector Tables (`connector-hub` & `connector-worker`)
- **Location**: [services/connector-hub/server.js:287-289,357,1050,1115](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/connector-hub/server.js#L287-L289) and [workers/connector-worker/worker.js:321,326,337](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/workers/connector-worker/worker.js#L321)
- **Severity**: **HIGH**
- **Impact**: Arbitrary SQL execution and database table manipulation.
- **Root Cause**:
  ```javascript
  function safeTableName(connectorId) {
    return `conn_${connectorId.replace(/-/g, '_')}`;
  }
  // Later in queries:
  await client.query(`DELETE FROM "${tableName}"`);
  await pool.query(`CREATE TABLE IF NOT EXISTS "${tableName}" (...)`);
  ```
  `.replace(/-/g, '_')` only replaces dashes. If `connectorId` contains quotes, semicolons, or comments, it directly breaks out of the SQL identifier.
- **Remediation**: Enforce strict alphanumeric sanitation:
  ```javascript
  function safeTableName(connectorId) {
    const sanitized = String(connectorId).replace(/[^a-zA-Z0-9_]/g, '');
    return `conn_${sanitized}`;
  }
  ```

---

### 🚨 VULN-04: High Business Logic Flaw — Unrestricted Self-Upgrade / Billing Bypass
- **Location**: [services/tenant-service/server.js:497-515](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/tenant-service/server.js#L497-L515)
- **Severity**: **HIGH**
- **Impact**: Tenants can bypass payment subscriptions and elevate their plan limits for free.
- **Root Cause**:
  ```javascript
  app.put('/api/tenant/company', async (req, res) => {
    const { name, plan, max_agents } = req.body;
    const result = await tenantDb.query(ctx, 
      `UPDATE companies 
       SET name = COALESCE($1, name), plan = COALESCE($2, plan), max_agents = COALESCE($3, max_agents), updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING id, name, plan, status, max_agents`,
      [name, plan, max_agents, ctx.tenantId]
    );
  ```
  Any authenticated tenant can invoke `PUT /api/tenant/company` with `{ "plan": "enterprise", "max_agents": 10000 }` and immediately receive unmetered access without billing webhooks or admin approval.
- **Remediation**: Disallow modifying `plan` and `max_agents` via the public `/api/tenant/company` endpoint. Restrict plan updates exclusively to verified billing webhooks (Stripe / Chapa) or platform superadmin endpoints.

---

### 🚨 VULN-05: High Server-Side Request Forgery (SSRF) in `tool-engine` & `capability-registry`
- **Location**: [services/tool-engine/server.js:90-105](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/tool-engine/server.js#L90-L105) & [services/capability-registry/src/server.ts:147-156](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/capability-registry/src/server.ts#L147-L156)
- **Severity**: **HIGH**
- **Impact**: Internal network scanning, cloud metadata extraction (`169.254.169.254`), and unauthorized internal service execution.
- **Root Cause**:
  User-configured webhook tools are executed via `axios({ url: tool.webhook_url, ... })` without destination IP/host validation.
- **Remediation**: Validate webhook URLs before execution: reject localhost, `127.0.0.1`, private IP blocks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and link-local metadata addresses (`169.254.169.254`).

---

### 🚨 VULN-06: High Insecure Direct Object Reference (IDOR) in `planner-service`
- **Location**: [services/planner-service/src/server.ts:94-145,148-158](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/planner-service/src/server.ts#L94-L145)
- **Severity**: **HIGH**
- **Impact**: Unauthorized cross-tenant plan disclosure and unauthorized plan execution.
- **Root Cause**:
  ```typescript
  app.post('/v1/plan/:planId/execute', async (req: Request, res: Response) => {
    const { planId } = req.params;
    const result = await pool.query('SELECT * FROM agent_plans WHERE id = $1', [planId]);
  ```
  The endpoint never verifies whether `result.rows[0].company_id` matches the requester's `x-company-id`. Any tenant can inspect or trigger another tenant's agent execution plans.
- **Remediation**: Scope all plan lookups by tenant ID: `WHERE id = $1 AND company_id = $2`.

---

### 🚨 VULN-07: High Insecure Default Service Auth Secret in `orchestrator` & `tenant-guard`
- **Location**: [services/orchestrator/main.py:365](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/orchestrator/main.py#L365) and [kernel/identity/tenant-guard.js:31](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/kernel/identity/tenant-guard.js#L31)
- **Severity**: **HIGH**
- **Impact**: Spoofing of internal service-to-service requests and signature forgery if env var is missing.
- **Root Cause**:
  Both components fall back to the known string `"markova-service-auth-secret-change-in-prod"` when `SERVICE_AUTH_SECRET` is unset.
- **Remediation**: If `NODE_ENV === 'production'`, throw a startup error if `SERVICE_AUTH_SECRET` is unset or matches the default placeholder.

---

### 🚨 VULN-08: High TwiML XML Injection in Voice Channel Adapter & IVR Prompt
- **Location**: [kernel/channel/adapters/voice.js:18-22](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/kernel/channel/adapters/voice.js#L18-L22) and [services/orchestrator/main.py:2246-2250](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/orchestrator/main.py#L2246-L2250)
- **Severity**: **HIGH**
- **Impact**: Twilio XML parsing failure leading to dropped calls, or TwiML verb hijacking.
- **Root Cause**:
  ```python
  twiml = f"""<Response><Gather><Say>{prompt}</Say></Gather></Response>"""
  ```
  `prompt` and `internalMsg.text` are interpolated without XML entity escaping. Special characters (`&`, `<`, `>`, `"`) invalidate XML syntax.
- **Remediation**: Pass all user-supplied text through `_xml_escape()` (or `html.escape()` in Python / XML escaping in Node).

---

### 🚨 VULN-09: Medium Algorithm Confusion in JWT Verification
- **Location**: [services/auth-service/server.js:722,1353](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/auth-service/server.js#L722) and [packages/shared-auth/src/index.ts:14](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/packages/shared-auth/src/index.ts#L14)
- **Severity**: **MEDIUM**
- **Impact**: Potential signature bypass via algorithm switching (`none` or RSA/HMAC confusion).
- **Root Cause**:
  `jwt.verify(token, secret)` is called without specifying `{ algorithms: ['HS256'] }`.
- **Remediation**: Explicitly pass `{ algorithms: ['HS256'] }` on symmetric JWT verifications.

---

## 2. Logic Bugs & Compilation Failures

### 🐛 BUG-01: Critical Go Syntax Error in `media-server-go`
- **Location**: [services/media-server-go/main.go:90-93](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/media-server-go/main.go#L90-L93)
- **Severity**: **CRITICAL**
- **Impact**: Service fails to compile (`gofmt -e` reports syntax error on line 93; `go build` fails).
- **Root Cause**:
  An import block was accidentally embedded into `func runRTPServer(port string)`:
  ```go
  func runRTPServer(port string) {
  	"sync/atomic"
  	"time"
  )
  ```
  Furthermore, line 227 declares a second `func main()`, colliding with line 307. Line 227 is the real body of `runRTPServer(port string)`.
- **Remediation**: Move `"sync/atomic"` and `"time"` to top-level imports, remove the broken block at line 90, and rename line 227 to `func runRTPServer(port string)`.

---

### 🐛 BUG-02: High Binary Document Ingestion Corrupts Vectors in `knowledge-service`
- **Location**: [services/knowledge-service/main.py:218,258-262](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/knowledge-service/main.py#L218)
- **Severity**: **HIGH**
- **Impact**: Uploading `.pdf`, `.docx`, or `.xlsx` files populates `knowledge_chunks` with unreadable binary characters and generates nonsensical embeddings.
- **Root Cause**:
  `ALLOWED_EXTENSIONS` permits PDF and Office documents, but the file parser executes:
  ```python
  try:
      text = content.decode("utf-8", errors="ignore")
  except Exception:
      text = ""
  ```
  No document extraction library (`pypdf`, `python-docx`, `openpyxl`) is installed or invoked.
- **Remediation**: Add `pypdf` and `python-docx` to `requirements.txt` and branch extraction logic based on file extension before chunking.

---

### 🐛 BUG-03: High Provider Credential Decryption Failure in `embedding-worker`
- **Location**: [workers/embedding-worker/index.js:105-108](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/workers/embedding-worker/index.js#L105-L108)
- **Severity**: **HIGH**
- **Impact**: Worker fails to load tenant OpenAI keys from `provider_configs`, halting vector generation when global `OPENAI_API_KEY` is unset.
- **Root Cause**:
  ```javascript
  const cfg = result.rows[0].encrypted_config;
  const parsed = typeof cfg === 'string' ? JSON.parse(cfg) : cfg;
  return parsed?.api_key || '';
  ```
  `provider_configs.encrypted_config` contains AES-256-GCM ciphertexts (`MARK_ENC_v1$...`). `JSON.parse` fails with a syntax error, causing the key resolution function to return `''`.
- **Remediation**: Decrypt ciphertext using `packages/shared-auth/src/crypto.ts` (`decryptConfig()`) before parsing.

---

### 🐛 BUG-04: High WebSocket Origin Rejection in `voice-runtime-go`
- **Location**: [services/voice-runtime-go/main.go:24,32-36](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/voice-runtime-go/main.go#L24)
- **Severity**: **HIGH**
- **Impact**: All browser WebSocket connections are rejected if `ALLOWED_ORIGINS` is not explicitly defined in the container environment.
- **Root Cause**:
  `allowedOrigins` is initialized at package load time without default fallback origins (`https://app.markova.tech`, `http://localhost:5173`).
- **Remediation**: Provide default fallback origins if `os.Getenv("ALLOWED_ORIGINS")` is empty.

---

### 🐛 BUG-05: Medium Dangling Edge Crash in Workflow Compiler
- **Location**: [kernel/workflow/compiler.js:22-25](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/kernel/workflow/compiler.js#L22-L25)
- **Severity**: **MEDIUM**
- **Impact**: Workflow compilation crashes with unhandled `TypeError` when an edge has a missing source node.
- **Root Cause**:
  `adjList.get(edge.source).push(...)` assumes `edge.source` exists in `adjList`. If an edge is orphaned, `adjList.get(...)` returns `undefined`.
- **Remediation**: Safely check `if (adjList.has(edge.source)) adjList.get(edge.source).push(edge.target)`.

---

### 🐛 BUG-06: Medium EventBus Poison Message Deadlock on Redis Streams
- **Location**: [kernel/events/bus.js:83-91](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/kernel/events/bus.js#L83-L91)
- **Severity**: **MEDIUM**
- **Impact**: Stream consumer gets stuck in an infinite retry loop without acking corrupt messages.
- **Root Cause**:
  `JSON.parse(message.message.payload)` runs before the processing block. If payload is corrupted, it throws directly into the outer `catch` block without acknowledging the message, reprocessing the poison message indefinitely.
- **Remediation**: Wrap payload parsing in a per-message try/catch; if corrupt, send to Dead Letter Queue (DLQ) and acknowledge (`xAck`).

---

### 🐛 BUG-07: Medium Duplicate `/health` Route Overwrite in `orchestrator`
- **Location**: [services/orchestrator/main.py:1957](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/orchestrator/main.py#L1957)
- **Severity**: **MEDIUM**
- **Impact**: Real database and Redis liveness probes are hidden from cloud monitoring.
- **Root Cause**:
  Line 1957 re-registers `@app.get("/health")` with a static mock dictionary, overwriting the comprehensive DB and Redis ping route at line 567.
- **Remediation**: Remove the duplicate handler at line 1957.

---

### 🐛 BUG-08: Medium Concurrency Race Condition in Metering Engine
- **Location**: [kernel/billing/metering.js:9-25](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/kernel/billing/metering.js#L9-L25)
- **Severity**: **MEDIUM**
- **Impact**: `unique_violation` DB errors during simultaneous first-time resource usage recording.
- **Root Cause**:
  `UPDATE ...` followed by `if (result.rows.length === 0) INSERT ...` without an `ON CONFLICT` clause causes race conditions under concurrent calls.
- **Remediation**: Use atomic `INSERT ... ON CONFLICT (company_id, resource_type) DO UPDATE SET current_usage = usage_limits.current_usage + EXCLUDED.current_usage`.

---

## 3. Infrastructure & Deployment Discrepancies

### ⚙️ DEPLOY-01: Outdated `ALLOWED_ORIGINS` in `render.yaml`
- **Location**: [render.yaml:40-41](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/render.yaml#L40-L41)
- **Severity**: **HIGH**
- **Impact**: Production deployments via Render reject requests from `https://app.markova.tech` and `https://admin.markova.tech` due to CORS.
- **Remediation**: Add `https://app.markova.tech` and `https://admin.markova.tech` to `ALLOWED_ORIGINS` in `render.yaml`.

---

### ⚙️ DEPLOY-02: Missing PDF / DOCX Parser Dependencies in `knowledge-service`
- **Location**: [services/knowledge-service/requirements.txt](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/knowledge-service/requirements.txt)
- **Severity**: **MEDIUM**
- **Impact**: `knowledge-service` container lacks extraction tools for non-plaintext uploads.
- **Remediation**: Add `pypdf>=4.0.0` and `python-docx>=1.1.0` to `requirements.txt`.

---

## Prioritized Remediation Roadmap

1. **Immediate Multi-Tenant Security Patching**:
   - Patch `auth-service` [server.js](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/auth-service/server.js#L1386) to gate mock tokens behind `NODE_ENV !== 'production'`.
   - Patch `tenant-service` [server.js](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/tenant-service/server.js#L268) and API gateway [proxy.util.ts](file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center/services/api-gateway/src/proxy.util.ts#L50) to prevent unauthenticated `x-role` escalation and sanitize incoming headers.
   - Restrict `PUT /api/tenant/company` so tenants cannot unilaterally alter `plan` or `max_agents`.
2. **Database & SQL Sanitation**:
   - Sanitize connector table identifiers with alphanumeric regex in `connector-hub` and `connector-worker`.
   - Enforce tenant isolation in `planner-service` (`WHERE id = $1 AND company_id = $2`).
3. **Core Compilation & Runtime Fixes**:
   - Fix Go syntax and dual `main()` declarations in `services/media-server-go/main.go`.
   - Fix duplicate `/health` route in `services/orchestrator/main.py`.
   - Add XML escaping to Twilio IVR prompts in `orchestrator` and voice channel adapter.
   - Implement AES-256-GCM decryption in `workers/embedding-worker/index.js`.
