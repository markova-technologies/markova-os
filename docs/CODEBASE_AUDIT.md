# Markova OS — Full Codebase Investigation Report

**Scope:** `/home/naod/Documents/MARKOVA-OS/markova-os/` (the only project under the workspace root)
**Date:** 2026-07-25
**Verdict for reformers:** This is a dual-environment product (Amharic voice playground + aspirational multi-tenant microservice platform). The voice pipeline is the only substantially battle-tested capability. Much of the "platform" is scaffolding, mock UI, broken wiring between frontend and backend, and docs that describe APIs that do not exist. It is **not** currently an API-first developer platform.

---

## 1. Project Overview

### What it currently does (plain terms)
Markova is an **AI voice call-center / "AI workforce OS"** aimed at Ethiopian (especially Amharic) businesses. In practice today it does two things:

1. **Playground voice agent** (`ai call center/`): A runnable FastAPI monolith that answers phone calls (Twilio / FreeSWITCH), transcribes speech, runs an Amharic-aware LLM loop with a furniture RAG KB ("Almaz" for GM Furniture), synthesizes TTS, and returns TwiML / streamed audio.
2. **Platform shell** (`services/`, `apps/`, `workers/`): A Docker Compose microservices monorepo intended as multi-tenant SaaS (auth, tenants, agents, tools, connectors, knowledge, billing, dashboards). Large parts are thin stubs, mocks, or disconnected from the UIs that call them.

### Tech stack (exact where pinned)

| Layer | Stack | Versions |
|-------|--------|----------|
| Root monorepo | npm workspaces | `markova-platform@2.0.0` |
| Frontend | React + Vite | Admin: React 18.2, Vite 7.2, Tailwind 3.4; Client: React 18.2, Vite ~6.4 |
| API Gateway | NestJS | `@nestjs/* ^10.3.8` |
| Most Node services | Express | `express ^4.19.2`, `pg ^8.11.5`, `jsonwebtoken ^9.0.2`, `bcrypt ^5.1.1`, `redis ^4.6.13` |
| Orchestrator | FastAPI (Python) | fastapi 0.111.0, uvicorn 0.29.0, asyncpg 0.29.0, twilio 9.0.4, openai 1.30.1, edge-tts 6.1.9 |
| Knowledge service | FastAPI | unpinned / light requirements |
| AI call center | FastAPI | **all deps unpinned** in `requirements.txt` |
| RPA worker | Python + Playwright | in `workers/rpa-agent/requirements.txt` |
| DB | PostgreSQL 15 + pgvector | `postgres:15-alpine` |
| Cache/queues | Redis 7 | `redis:7-alpine` |
| Runtime expectation | Node 18+ (docs) | not enforced via engines field |

### Monorepo or single app?
**Monorepo** (`npm` workspaces). Packages/apps:

| Path | Purpose |
|------|---------|
| `apps/admin-dashboard` | Super-admin React UI (mostly mock) |
| `apps/client-dashboard` | Tenant React UI (auth + many mock fallbacks) |
| `services/api-gateway` | NestJS edge proxy + JWT/API-key middleware |
| `services/auth-service` | Register/login/JWT/sessions |
| `services/tenant-service` | Company, API keys, usage, CRM leads, org tree |
| `services/agent-builder` | Agent CRUD + versions |
| `services/tool-engine` | Tool CRUD + webhook/RPA execute |
| `services/connector-hub` | Excel/CSV/webhook connectors |
| `services/knowledge-service` | Knowledge source/doc upload (Python) |
| `services/orchestrator` | Production voice runtime (Python) |
| `services/{conversation,voice,planner,memory,workflow,knowledge,connector}-runtime` | Thin/stub "runtime" services |
| `services/approval-service`, `billing-service`, `event-processor` | Partial / incomplete |
| `kernel/*` | Shared adapters (AI, identity, events, billing, etc.) |
| `packages/*` | shared-auth, shared-types, event-schemas, observability, shared-validation |
| `workers/*` | connector, rpa, reporting, sync, embedding, event-processor |
| `ai call center/` | Experimental voice monolith (outside npm workspaces) |
| `infrastructure/` | Postgres schema + SQL migrations |
| `docs/`, `tests/` | Docs + one simulator script |

---

## 2. Architecture

### High-level
**Documented as:** multi-tenant microservices behind an API gateway.
**Actually:** hybrid of (a) a working Python voice monolith and (b) a partially implemented microservice mesh. Many "runtime" services exist as parallel experiments and are **not** in `docker-compose.yml`. No gRPC. Async via Redis lists/streams. WebSockets only for orchestrator flow-monitor (+ client Socket.IO expectations that don't match).

```
[Client Dashboard :3001] ─┐
[Admin Dashboard :3000]  ─┼──► [API Gateway :8000] ──► auth:5001, tenant:5002,
                          │                           builder:5003, tools:5004,
                          │                           connectors:5005, knowledge:5006,
[Twilio/FreeSWITCH] ──────┼──► [Orchestrator :6000]   orchestrator:6000
                          │
[AI Call Center :8001] ◄──┘   (separate; not in compose; playground)
```

### Top-level directories (one line each)

| Dir | Purpose |
|-----|---------|
| `apps/` | React dashboards |
| `services/` | Backend microservices |
| `kernel/` | Shared domain libraries (AI, identity, events, …) |
| `packages/` | npm shared packages |
| `workers/` | Background job consumers |
| `infrastructure/` | Postgres init SQL + migrations |
| `ai call center/` | Amharic voice playground |
| `docs/` | Architecture / API / deployment docs (stale) |
| `tests/` | Manual event-bus simulator only |
| Root | `docker-compose.yml`, `.env.example`, `PLAN.md`, `DEVELOPER_CTO_BRIEFING.md`, `README.md` |

### Entry points

| Component | Entry |
|-----------|--------|
| API Gateway | `services/api-gateway/src/main.ts` |
| Auth / Tenant / Builder / Tools / Connector Hub | `services/*/server.js` |
| Orchestrator | `services/orchestrator/main.py` (uvicorn :6000) |
| Knowledge service | `services/knowledge-service/main.py` |
| AI Call Center | `ai call center/main_natural_voice.py` (:8001 local / :10000 Docker) |
| Dashboards | Vite `index.html` → `src/main.jsx` / `App.jsx` |
| Compose | `docker-compose up` |

### Frontend ↔ backend
- Dashboards proxy `/api` → `localhost:8000` (gateway).
- Client uses Axios `baseURL: '/api'` + Bearer from `localStorage`.
- **Critical mismatch:** Login/Signup pages call `VITE_SYSTEM_DASHBOARD_URL/api/clients/*` — **no such routes** on auth-service (`/api/auth/*` exists instead).
- `api/client.js` calls many routes that **backend never implements** (teams, pipelines, phone-numbers, channels, CRM contacts, `/orchestrator/calls`, `/connectors/*` vs hub's `/connector-hub/*`).

### Background jobs / queues / workers

| Worker | Queue / trigger | Status |
|--------|-----------------|--------|
| `connector-worker` | Redis `connector_sync_queue` + 60s DB poll | **Real** |
| `rpa-agent` | Redis `rpa_task_queue` / FastAPI :7000 | **Real (scaffolded)** |
| `reporting-worker` | Redis `markova:reports:jobs` | **Stub** (sleep + fake PDF) |
| `sync-worker` | Hourly cron | **Stub** (random metrics) |
| `embedding-worker` | Redis stream `markova_events` | **Stub** (mock embeddings) |
| `workers/event-processor` | EventBus consumer | **Partial**; not in compose |
| `services/event-processor` | Duplicate concept | Minimal |
| Tool-engine | Internal Redis retry queue | Real |

---

## 3. API Surface (exhaustive)

**Format:** REST/JSON (and Twilio form posts → TwiML XML). No OpenAPI/Swagger checked-in. No public SDK. No GraphQL/gRPC.

### 3.1 API Gateway (`:8000`) — proxy map

| Gateway path | Upstream | Auth at gateway |
|--------------|----------|-----------------|
| `ALL /api/auth*` | auth-service:5001 | Public only for `/register`, `/login`; else JWT/API key |
| `ALL /api/tenant*` | tenant:5002 | JWT/API key |
| `ALL /api/contact` | tenant:5002 | Public |
| `ALL /api/crm*` | tenant:5002 | JWT/API key |
| `ALL /api/builder*` | agent-builder:5003 | JWT/API key |
| `ALL /api/tools*` | tool-engine:5004 | JWT/API key |
| `ALL /api/connectors*` | connector-hub:5005 | JWT/API key (**path mismatch** — hub listens on `/api/connector-hub/*`) |
| `ALL /api/knowledge*` | knowledge:5006 | JWT/API key |
| `ALL /incoming-call`, `/handle-input`, `/stream-response` | orchestrator:6000 | Public |
| `GET /health` | local | Public |
| WS `/ws` | orchestrator (main.ts) | Subject to middleware |

**Not proxied (exist as services but unreachable via gateway):** billing, approval, memory, workflow, conversation, voice-runtime, planner, connector-runtime, knowledge-runtime, orchestrator `/api/calls`, `/api/stats`.

### 3.2 Auth Service (`:5001`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/auth/public-key` | RSA public PEM | None |
| POST | `/api/auth/register` | Create company + admin | None |
| POST | `/api/auth/login` | bcrypt + JWT (1h) + refresh | None |
| POST | `/api/auth/verify-token` | Validate JWT/session | Body token |
| POST | `/api/auth/refresh-token` | New access token | Refresh |
| POST | `/api/auth/logout` | Revoke session | Bearer |
| GET | `/api/auth/sso/login/:companyId` | Mock SAML request | None |
| POST | `/api/auth/sso/callback/:companyId` | Mock SAML — **no real JWT** | None |
| POST | `/api/scim/v2/Users` | SCIM create | Bearer (**verify always mock-valid**) |
| GET | `/health` | Health | None |

**Missing vs docs/UI:** `GET /me`, `/api/clients/*`, password-reset endpoints.

### 3.3 Tenant Service (`:5002`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/tenant/keys/verify` | Hash-verify API key | **serviceAuth HMAC** |
| GET/PUT | `/api/tenant/company` | Company | TenantGuard |
| GET/POST | `/api/tenant/keys` | List/create `mk_live_*` | TenantGuard |
| GET | `/api/tenant/usage` | Usage | TenantGuard |
| POST | `/api/tenant/usage/increment` | Increment | serviceAuth |
| GET | `/api/tenant/stats` | Dashboard counts | TenantGuard |
| POST/GET | `/api/tenant/departments` | Depts | TenantGuard |
| GET | `/api/tenant/org-tree` | Org tree | TenantGuard |
| POST | `/api/contact` | Public lead capture | None |
| GET | `/api/crm/leads` | List leads | **No TenantGuard** (bug) |
| GET | `/health` | Health | None |

**Missing vs client `api/client.js` / docs:** phone-numbers, channels, providers, analytics/*, activity, CRM contacts/opportunities/appointments.

### 3.4 Agent Builder (`:5003`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST/GET | `/api/builder/agents` | Create/list | TenantGuard |
| GET/PUT/DELETE | `/api/builder/agents/:id` | CRUD | TenantGuard |
| GET | `/api/builder/agents/:id/versions` | Versions | TenantGuard |
| POST | `/api/builder/agents/:id/versions/:versionId/rollback` | Rollback | TenantGuard |
| GET | `/health` | Health | None |

**Missing:** teams, flows, pipelines (docs + UI expect them).

### 3.5 Tool Engine (`:5004`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/tools/execute` | Run webhook/n8n/RPA | TenantGuard |
| GET/POST | `/api/tools` | List/create | TenantGuard |
| PUT/DELETE | `/api/tools/:id` | Update/delete | TenantGuard |
| GET | `/health` | Health | None |

### 3.6 Connector Hub (`:5005`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/connector-hub/types` | Catalog | Public on that mount |
| GET | `/api/connector-hub/types/:type/schema` | Config schema | |
| GET/POST | `/api/connector-hub/integrations` | List/create | TenantGuard |
| GET/DELETE | `/api/connector-hub/integrations/:id` | Get/delete | TenantGuard |
| POST | `.../upload` | Excel/CSV → dynamic table | TenantGuard |
| POST | `.../query` | Query data | TenantGuard |
| GET | `.../runs`, `.../preview` | History / preview | TenantGuard |
| POST | `/api/connector-hub/webhook/:connectorId` | Ingest JSON | Optional secret |
| GET | `/health` | Health | None |

### 3.7 Knowledge Service (`:5006`, Python)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST/GET | `/api/knowledge/sources` | Sources | `X-Company-ID` header |
| POST | `/api/knowledge/upload` | File + metadata | header |
| GET | `/api/knowledge/sources/{id}/documents` | Docs | header |
| GET | `/health` | Health | None |

No chunking/embeddings here.

### 3.8 Orchestrator (`:6000`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| WS | `/ws/flow-monitor/{company_id}` | Live logs | **None** (IDOR risk) |
| GET | `/health` | Health | None |
| POST | `/incoming-call`, `/twilio/voice` | Inbound TwiML | Public (Twilio) |
| POST | `/handle-input`, `/twilio/respond` | Turn loop | Public |
| POST | `/twilio/status` | Call status | Public |
| GET | `/api/calls` | List calls | `x-company-id` |
| GET | `/api/calls/{id}/transcript` | Transcript | `x-company-id` |
| GET | `/api/stats` | Stats | `x-company-id` |
| static | `/audio/*` | TTS files | None |

### 3.9 Other services (not in gateway / compose)

| Service | Routes | Notes |
|---------|--------|-------|
| conversation-runtime | `POST /api/conversation/turn` | No tenant auth; mock prompt; `sk-mock-key` fallback |
| voice-runtime | `/twilio/voice|respond|status` | Thin Twilio → conversation-runtime |
| planner-runtime | `POST /api/planner/route` | No auth |
| memory-runtime | `GET/POST /api/memory/:entityType/:entityId/:key` | TenantGuard |
| workflow-runtime | `POST /api/workflow/execute` | Fake steps; header-only company |
| knowledge-runtime | upload + search | Mock embedding |
| connector-runtime | register/sync google_sheet | Mock rows |
| approval-service | `POST /api/approval/evaluate` | **Broken arity** vs PolicyEvaluator |
| billing-service | invoice, log-cost, Stripe webhook | Stripe is no-op ack |

### 3.10 AI Call Center (`:8001`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/` | Status | None |
| POST | `/incoming-call` | Welcome TwiML | None |
| POST | `/handle-input` | Speech→AI→TwiML | None |
| POST | `/stream-response` | Streaming TTS URLs | None |
| GET | `/api/dashboard/status` | Route health | `X-API-Key` |
| POST | `/api/dashboard/failover` | sip↔twilio | `X-API-Key` |
| GET | `/api/dashboard/metrics` | Call counts | `X-API-Key` |
| POST | `/api/dashboard/test-alert` | Email test | `X-API-Key` |
| GET | `/api/calls` | Transcript files | `X-API-Key` |
| GET | `/api/calls/{id}/recording` | Download txt | **None** |
| GET | `/api/agent/info` | Discovery | None |
| GET | `/api/agent/details` | Config | `X-API-Key` |
| GET | `/api/agent/conversations` | Recent calls | `X-API-Key` |
| GET | `/api/agent/metrics` | Metrics | `X-API-Key` (**queries missing `transfer_count`**) |

Default API key: `DASHBOARD_API_KEY` or **`default-secret-key`**.

### Auth tokens / API keys

| Mechanism | Generation | Storage | Validation |
|-----------|------------|---------|------------|
| JWT (RS256) | auth-service after login; RSA keys in `services/auth-service/keys/` | Client `localStorage`; sessions in Postgres + Redis revoke flags | Gateway fetches public key; verifies RS256 + session not revoked |
| Refresh token | On login | `sessions.refresh_token` | `/refresh-token` |
| Tenant API keys | `mk_live_` + 32 hex chars | SHA-256 `key_hash` in `tenant_api_keys`; prefix only listed | Gateway → POST verify — **but verify requires `x-service-auth` and gateway does not send it → API-key auth via gateway is broken** |
| Service auth | HMAC-SHA256 of service name | `SERVICE_AUTH_SECRET` env | `x-service-auth` header |
| Playground dashboard key | env / default | env | Header equality |

### Sandbox vs live
**No real sandbox mode.** Keys are always prefixed `mk_live_`. No `mk_test_`, no Stripe test/live split beyond a mock webhook, no environment-scoped API surface.

### SDKs / OpenAPI
**None.** No OpenAPI/Swagger artifacts. No client SDK package. `packages/event-schemas` has TypeScript types only; **`index.js` missing** (broken package).

### Webhooks
| Direction | What |
|-----------|------|
| Inbound telephony | Twilio → `/incoming-call`, `/handle-input`, `/twilio/*` |
| Inbound connector | `POST /api/connector-hub/webhook/:connectorId` |
| Outbound tools | Tool engine POSTs to customer `webhook_url` |
| Stripe | `POST /api/billing/webhooks/stripe` — **always `{received:true}`** |
| Dashboard push (playground) | `dashboard_reporter.py` → `/api/agents/report` & heartbeat on a "MARKOVA backend" that doesn't match current route map |

---

## 4. Data Layer

### Databases
| Store | Why / use |
|-------|-----------|
| **PostgreSQL 15 + pgvector** | Multi-tenant platform: companies, users, agents, calls, CRM, billing, knowledge vectors |
| **Redis 7** | Sessions revoke, rate limits, conversation state, job queues, event streams |
| **SQLite (`system.db`)** | AI call center only: routes, call_logs, conversation_sessions |

No ORM in Node (raw `pg`). Knowledge-service lists SQLAlchemy but doesn't meaningfully use it. Orchestrator uses `asyncpg`.

### Full Postgres schema (tables + key fields)

**Ordering bug:** `knowledge_chunks` is `CREATE`d **before** `knowledge_documents` but FKs to it — fresh `schema.sql` init can fail.

| Table | Fields (summary) | Relationships |
|-------|------------------|---------------|
| `companies` | id, name, plan, status, max_agents, timestamps | Root tenant |
| `tenant_api_keys` | company_id, name, key_hash, key_prefix, status | → companies |
| `provider_configs` | company_id, provider_type, provider_name, encrypted_config | → companies |
| `users` | company_id, name, email, password_hash, role, status, department_id | → companies, departments |
| `agents` | company_id, name, prompt, voice_*, model_*, department_id | → companies |
| `agent_versions` | agent_id, version_number, prompt, model_*, voice_* | → agents |
| `phone_numbers` | company_id, agent_id, provider, phone_number, status | → companies, agents |
| `tools` | company_id, name, description, webhook_url, method, type | → companies |
| `agent_tools` | agent_id, tool_id | M2M |
| `integrations` | company_id, type, name, config, status | → companies |
| `connector_runs` | company_id, connector_id, status, records_processed, … | → integrations |
| `connector_templates` | name, type, schema | Global templates |
| `knowledge_sources` | company_id, type, name, status, config | → companies |
| `knowledge_documents` | source_id, file_name, file_path, file_size, status | → sources |
| `knowledge_chunks` | document_id, content, embedding VECTOR(1536), company_id | → documents |
| `calls` | company_id, agent_id, caller_number, times, status, turn_count, recording_url | → companies |
| `transcripts` | call_id, role, content | → calls |
| `audit_logs` | company_id, user_id, action, entity_*, old/new_value, immutable, … | Trigger blocks delete |
| `usage_metrics` | company_id, call_minutes, stt_seconds, tts_characters, llm_tokens | → companies |
| `crm_leads` | contact fields, source, status | → companies |
| `crm_contacts`, `crm_opportunities`, `crm_appointments` | CRM entities | → companies / contacts |
| `teams`, `team_agents`, `commander_agents` | Team model | → companies/agents |
| `routing_rules` | company_id, phone_number_id, rules JSONB | → phones |
| `events` | id, type, payload, source, trace_id, timestamp | Event log |
| `memory_entries` | company_id, entity_type/id, key, value JSONB | Unique per key |
| `policies` | company_id, name, rules JSONB | → companies |
| `subscriptions` | company_id, plan_id, status, period_end | → companies |
| `roles`, `permissions`, `role_permissions`, `user_roles` | RBAC | |
| `sessions` | user_id, company_id, device, refresh_token, revoked_at, … | |
| `secret_vault` | company_id, key_name, encrypted_value, iv | |
| `departments` | company_id, parent_department_id, name | Org tree |
| `approval_queue` | HITL approvals | |
| `agent_hierarchy`, `agent_tasks` | Commander/worker model | |
| `ai_cost_logs`, `feature_flags`, `usage_limits`, `billing_line_items` | Billing | |
| `sso_connections`, `scim_tokens` | Enterprise identity | |

RLS enabled on most tenant tables via `app.current_tenant` (set by `TenantDb`).

### Migrations
Present under `infrastructure/migrations/001–006_*.sql`. Content is **also inlined into** `schema.sql`. Compose mounts **only** `schema.sql` + `init-roles.sql` — migrations are **not auto-applied** as a separate pipeline. Risk of drift if someone runs migrations alone vs fresh compose.

### AI Call Center SQLite
- Sync: `system_config`, `route_health`, `call_logs`, `failover_events`, `alert_recipients`
- Async (`database.py`): `conversation_sessions`, `conversation_messages`, `call_analytics`

---

## 5. Auth & Security

### Authentication
- **Primary:** JWT RS256 (user sessions) + intended **tenant API keys** (`x-api-key`).
- **Internal:** HMAC `x-service-auth`.
- **SSO/SCIM:** Mock only.
- **Admin dashboard:** No auth at all.
- **Client dashboard:** Intended JWT, but login hits wrong URL (`/api/clients/login`).

### Authorization / roles
- Users have `role` string (`member` default) + tables for roles/permissions.
- Gateway injects `x-role`, `x-permissions`.
- API keys get `permissions: ['*']`.
- Fine-grained PermissionEngine exists in kernel; **not consistently enforced** on routes.

### Secrets
| Location | Notes |
|----------|-------|
| `.env.example` | Templates for DB, Redis, vault, service auth, LLM/voice/Twilio keys |
| `VAULT_MASTER_KEY`, `SERVICE_AUTH_SECRET` | Required conceptually; LocalVault AES-GCM real; AWS/Azure vaults TODO stubs |
| RSA keys | Auto-generated under auth-service `keys/` |
| Hardcoded risks | `DASHBOARD_API_KEY` default `default-secret-key`; FreeSWITCH ESL password default `ClueCon`; compose hardcodes `markova:markova_pass` for most services while postgres password is `${POSTGRES_PASSWORD:?…}`; `sk-mock-key` LLM fallbacks; SCIM mock company UUID |

### Rate limiting
- Gateway: Redis per-tenant RPM — starter 60 / growth 200 / enterprise 1000; **fails open** if Redis errors.
- Auth login: Redis lockout (auth-service).
- IP rate limit also referenced in gateway bootstrap (helmet + express-rate-limit).

---

## 6. Third-Party Integrations

| Provider | Where | Version / SDK | Used for |
|----------|-------|---------------|----------|
| Twilio | orchestrator, voice-runtime, ai call center | `twilio==9.0.4` (orchestrator); unpinned in playground | Voice webhooks / TwiML (playground often hand-builds XML) |
| FreeSWITCH + ESL | `ai call center/freeswitch_config/`, `barge_in_manager.py` | `greenswitch` | SIP bridge, barge-in VMD |
| OpenAI | kernel/ai, orchestrator, playground | openai 1.30.1 / unpinned | LLM, Whisper, TTS |
| Groq | same | via OpenAI-compatible clients | Default LLM + Whisper |
| Google Gemini | orchestrator / playground | HTTP OpenAI-compatible | LLM option |
| ElevenLabs | playground STT; kernel TTS | API HTTP / elevenlabs pkg | STT Scribe; TTS adapter |
| Edge TTS | orchestrator + playground | edge-tts 6.1.9 | Amharic neural TTS |
| Addis AI TTS | playground | HTTP | Primary Amharic TTS |
| Google Translate TTS | playground | scrape | TTS fallback |
| Deepgram | mentioned in PLAN / orchestrator adapters | — | Planned / partial |
| Azure Speech | `.env.example` | — | Documented; not primary path |
| Stripe | billing-service | none real | Mock webhook |
| n8n | tool-engine | via webhook plugin | Tool type alias |
| Playwright | rpa-agent | playwright | Browser RPA |
| SMTP | playground AlertManager | aiosmtplib | Email alerts |
| HubSpot/Zendesk/Telegram/WhatsApp | catalog / docs | — | **Catalog stubs only** in connector-hub |

---

## 7. Core Feature Inventory

| Feature | Implementation | Status |
|---------|----------------|--------|
| Amharic voice call loop (playground) | `ai call center/main_natural_voice.py` | **Fully working** (with env keys) |
| Amharic voice call loop (orchestrator) | `services/orchestrator/main.py` | **Partially working** — Twilio path; PLAN says Whisper/ffmpeg/RAG/streaming not fully ported |
| Multi-tenant register/login | auth-service | **Working** (if UI pointed at correct paths) |
| Tenant API keys | tenant-service | **Broken via gateway** (serviceAuth missing) |
| Agent CRUD + versions | agent-builder | **Working** |
| Tool webhook execute | tool-engine | **Working** |
| Excel/CSV connector + dynamic tables | connector-hub + connector-worker | **Working** |
| Google Sheets / Telegram / WhatsApp connectors | catalog + connector-runtime mock | **Stubbed** |
| Knowledge upload | knowledge-service | **Working** (metadata only) |
| Vector RAG search | knowledge-runtime + embedding-worker | **Stubbed** (mock embeddings) |
| Teams / commander / flows / pipelines | schema + UI; **no agent-builder routes** | **Stubbed / broken** |
| Phone numbers / SIP channels | schema + UI; **no tenant routes** | **Stubbed / broken** |
| CRM contacts/opps/appointments | schema + UI; only `crm_leads` + public contact | **Partial** |
| HITL approvals / governance UI | approval-service + client Governance page | **Stubbed / broken** |
| Billing invoice | billing-service | **Partial**; Stripe stub |
| SSO / SCIM | auth-service | **Stubbed** |
| Admin tenant/revenue/health/tickets | admin-dashboard pages | **Stubbed** (hardcoded/mock) |
| Client command center / call center UI | client-dashboard | **Partial** (API + mock fallback) |
| RPA scrape/form fill | rpa-agent | **Partially working** |
| Reporting PDFs | reporting-worker | **Stubbed** |
| Workflow engine | workflow-runtime + kernel | **Stubbed** |
| Memory KV API | memory-runtime | **Working** (service); kernel interface throws |
| Feature flags table | seeded on `tenant.created` by event-processor | **Partial** |

No formal feature-flag system driving UI; `feature_flags` table exists for billing/enterprise gating conceptually.

---

## 8. Frontend

### Admin Dashboard (`apps/admin-dashboard`)
- React 18 + Vite 7 + Tailwind + Socket.IO client + Recharts.
- **No authentication.**
- Routes: `/` Dashboard (partial live), `/companies`, `/revenue`, `/calls`, `/health`, `/usage`, `/tickets`, `/audit` (all mock/stub), `/settings` (theme works; rest "Coming Soon").
- Proxies to `:8000`; many pages hardcode `:8000` / `:5000`.

### Client Dashboard (`apps/client-dashboard`)
- React 18 + Vite 6 + custom CSS + React Flow + Chart.js/Recharts.
- Auth shell intended; login/signup/reset call **nonexistent** `/api/clients/*`.
- Pages: CommandCenter, Onboarding, AgentStudio, FlowBuilder, Knowledge, Integrations, PhoneChannels, CallCenter, Analytics, CRM, Settings, Billing, Governance (mock), Organization (hardcoded).
- Dual data path: `unifiedDataService` → real AI server `:8001` or **mock Amharic call demos**.
- Capabilities today: rich UI mockups; unreliable against real gateway.

---

## 9. Infrastructure & Deployment

| Item | Reality |
|------|---------|
| Local orchestration | `docker-compose.yml` — postgres, redis, auth, tenant, agent-builder, tool-engine, knowledge, connector-hub, orchestrator, api-gateway, 4 workers |
| Not in compose | Most `*-runtime` services, billing, approval, embedding-worker, event-processor, dashboards, ai call center |
| IaC | **None** (no Terraform/k8s). SQL only under `infrastructure/` |
| AI call center deploy | `Dockerfile` + `render.yaml` (Render free, Frankfurt, port 10000) |
| CI/CD | **None** found (no GitHub Actions) |
| Env configs | Single `.env.example`; no staging/prod overlays |
| Docs claim K8s/EKS | Aspirational; not in repo |
| Compose health sequencing | Docs claim service_healthy on apps; **only postgres/redis have healthchecks**; app services use plain `depends_on` |

Hardcoded DB password inconsistency: compose postgres uses `${POSTGRES_PASSWORD}`; most services hardcode `markova:markova_pass`.

---

## 10. Known Issues & Technical Debt

### Structural / architectural
1. **Two voice stacks** (playground vs orchestrator) with incomplete promotion (see `PLAN.md` matrix).
2. **Many parallel "runtime" services** not wired into gateway or compose — half-migrated architecture.
3. **Docs invent APIs** (`/api/admin/*`, teams, phone-numbers, `/me`, Markova Demo Site) that code lacks.
4. **Frontend ↔ backend contract is fiction** for large parts of client `api/client.js`.
5. **Gateway `api/connectors*` → hub `/api/connector-hub*`** path mismatch.
6. **API key verify broken** (gateway missing serviceAuth).
7. **Duplicate event-processors** under `services/` and `workers/`.
8. **Broken packages:** `@markova/event-schemas` (no `index.js`), `@markova/tool-runtime` (no `index.js`), `@markova/memory-runtime` throws, shared-auth HS256 vs RS256 divergence.

### Schema / correctness bugs
- `knowledge_chunks` FK before parent table create.
- Migration 006 UPDATE references `kc.source_id` but chunks table has `document_id`.
- `audit_logs.ip_address` created as VARCHAR then ALTER to INET (conflict risk).
- CRM leads route without TenantGuard.
- Playground `/api/agent/metrics` references nonexistent `transfer_count`.
- Approval evaluator wrong function arity.

### Security debt
- Admin UI open; WS flow-monitor unauthenticated; recording download unauthenticated in playground; default API keys; fail-open rate limits; mock SCIM accepts any bearer.

### TODOs / stubs (non-exhaustive)
SSO mock, SCIM mock, Stripe mock, Google Sheets mock, embedding zeros, reporting fake PDF, sync random counts, AWS/Azure vault TODO, Coqui TTS unused, SIP health monitor commented out, client Governance in-memory, admin "Coming Soon".

### Dependencies
- Playground requirements **unpinned** (reproducibility risk; Coqui TTS historically broken on modern Python).
- No automated vulnerability audit in repo; Nest/Express/React versions are mid-2024–2025 era but not locked at root with audit CI.

---

## 11. Testing

| What exists | Detail |
|-------------|--------|
| Framework | **No Jest/Vitest/pytest suite wired** in root `package.json` |
| Platform | `tests/simulate_call_flow.js` — manual Redis EventBus publish sequence |
| Playground | `test_cli_chat.py`, `test_sip_integration.py`, `test_stt_comparison.py`, `verify_*.py` (session isolation, DB, async, metrics) — ad hoc scripts |
| How to run | `node tests/simulate_call_flow.js`; `python verify_*.py` in ai call center — **not** `npm test` |

**Coverage gap:** ~near-zero automated coverage for gateway auth, tenant isolation, agent CRUD, connector sync, orchestrator turns, dashboards. No e2e CI.

---

## 12. Documentation

| Doc | Claims | Code reality |
|-----|--------|--------------|
| `README.md` | Full microservice AI workforce OS | Overstates completeness; ignores playground dual-world |
| `docs/architecture.md` | Demo site, HubSpot/Zendesk OAuth, Twilio Media Streams WS, chunking RAG | Demo site absent; OAuth stubs; orchestrator is Gather/TwiML not Media Streams as primary; RAG not production-complete |
| `docs/api-reference.md` | `/me`, phone-numbers, teams, flows, `/api/admin/*`, `/api/orchestrator`, connectors under `/api/connectors` | **Mostly wrong** vs implemented routes |
| `docs/deployment.md` | Mentions `JWT_SECRET`; K8s production; healthcheck sequencing | JWT is RS256 (no JWT_SECRET); no K8s; healthchecks incomplete |
| `PLAN.md` | Honest dual-env strategy + promotion gaps | **Most accurate doc** — treat as source of truth for voice maturity |
| `DEVELOPER_CTO_BRIEFING.md` | Strong product narrative + file map | Useful; Windows paths; some sizes/claims stale |
| AI call center guides | Many (Twilio, Ethio Telecom, STT research, deployment) | Useful for playground; some endpoints/docs mismatch (`/handle-speech` etc.) |

---

## Reformer-facing summary (precision bullets)

1. **Keep as product core:** Amharic STT→repair→LLM→TTS call loop (`ai call center/` + partial orchestrator).
2. **Treat as salvageable platform spine:** auth (register/login/JWT), tenant company/keys/usage, agent CRUD, tool webhooks, Excel/CSV connectors, Postgres schema + RLS idea, gateway rate-limit idea.
3. **Treat as throwaway or rewrite for API-first platform:** admin dashboard, most client pages' mock layers, `*-runtime` forest, broken packages, invented API docs, billing/SSO/SCIM stubs, embedding/RAG pipeline.
4. **Must fix before any external API product:** single OpenAPI contract; fix login path + API key serviceAuth; expose calls/stats/billing through gateway; sandbox vs live keys; remove hardcoded secrets; migration tooling that matches schema; delete or quarantine dead routes/services.
5. **For API-first developer platform:** today's surface is a gateway proxy to a handful of CRUD services — **not** a versioned public API with SDKs, webhooks-out, idempotency, or sandbox. That layer must be designed, not discovered.
