# Markova OS — Software Design Document (SDD)
### Reformation: API-First AI Communications Platform for Ethiopia / East Africa

**Version:** 1.0
**Date:** 2026-07-25
**Status:** Approved for implementation — hand this document to Cursor phase by phase
**Prior artifact:** `docs/CODEBASE_AUDIT.md` (full investigation report) — treat as the ground truth for what exists today; this document is the target state.

---

## 0. How to use this document

This SDD is written to be implemented **phase by phase, in order**. Each phase has:
- A goal
- Explicit scope (what's in, what's deliberately deferred)
- Concrete tasks
- Acceptance criteria (how Cursor / the team knows the phase is done)

Do not start Phase N+1 work before Phase N's acceptance criteria are met. Each phase should end with a working, demoable increment — not a partial rewrite of everything at once.

Cursor should treat this as authoritative over the existing `docs/architecture.md` and `docs/api-reference.md`, which are known to be stale/aspirational per the audit. Those files should be deleted or moved to `docs/archive/` at the start of Phase 1, not edited in place.

---

## 1. Product Vision & Positioning

**One sentence:** Markova is the API a developer reaches for to add voice, calling, and multilingual AI agents to their product — one key, sandbox and live modes, transparent usage-based pricing, built natively for Amharic/Afaan Oromo/Tigrinya markets.

**Model:** Chapa's developer experience (one integration point instead of stitching together multiple vendors) applied to voice/communications instead of payments.

**Competitive wedge vs the two incumbents:**
| | RingCloud | Lucy AI | Markova (target) |
|---|---|---|---|
| PBX / calling infra | Yes | No | Yes |
| Conversational AI voice agent | No | Yes | Yes |
| Public, self-serve pricing | Per-seat only | None (sales-gated) | Usage-based, public |
| Developer API / SDK | Unknown, not primary | Not primary (config-UI led) | **Primary product surface** |
| Sandbox before production | No | No | **Yes** |
| Local language support | No | Yes (Am/Om/Ti) | Yes (Am/Om/Ti, Swahili later) |
| Agent-to-human handoff w/ context | N/A | Unclear | Yes |

**Non-goals for v1:** teams/org hierarchy, RPA workflows, CRM pipeline features, admin super-dashboard, SSO/SCIM. These exist in the current codebase as scaffolding — they are explicitly Phase 5+ and should not consume engineering time before the core API is solid.

---

## 2. Target Architecture

### 2.1 Principles
1. **The API is the product.** Every capability must be reachable via a documented, versioned REST endpoint before it is considered "done" — a feature that only exists in a dashboard UI is not done.
2. **One contract, one truth.** A single OpenAPI 3.1 spec (`openapi.yaml` at repo root) is the source of truth. Gateway routes, service routes, SDKs, and docs are all generated from or validated against it — never hand-diverged.
3. **Sandbox is not cosmetic.** Test-mode API keys must route to test resources (test agents, no real Twilio spend, no real phone numbers touched) — not just a different key prefix on the same live path.
4. **Consolidate before extending.** Do not add new microservices for concepts that already have a partial home (see Phase 0 kill list). Extend the 4 core resources instead.
5. **Every write path is idempotent-safe and every async action fires a webhook.** No silent success responses (the current Stripe-webhook-always-200 pattern is banned going forward).

### 2.2 Target service map

```
                          ┌─────────────────────────┐
                          │   openapi.yaml (spec)   │  ← source of truth
                          └────────────┬────────────┘
                                       │ validates
        ┌──────────────────────────────────────────────────────┐
        │                     API Gateway (:8000)                │
        │        auth (JWT + API key), rate limit, routing        │
        └───┬─────────┬─────────┬─────────┬─────────┬───────────┘
            │         │         │         │         │
       ┌────▼───┐ ┌───▼────┐ ┌──▼─────┐ ┌─▼──────┐ ┌▼──────────┐
       │ auth   │ │ tenant │ │ agents │ │ calls  │ │ numbers   │
       │service │ │service │ │service │ │service │ │service    │
       └────────┘ └────────┘ └───┬────┘ └───┬────┘ └───────────┘
                                  │          │
                            ┌─────▼──────────▼─────┐
                            │   voice orchestrator   │  (the Amharic
                            │   (Twilio/FreeSWITCH,  │   voice loop —
                            │   STT→LLM→TTS loop)    │   crown jewel,
                            └─────────┬──────────────┘   keep as-is,
                                      │                   harden only
                            ┌─────────▼──────────────┐
                            │   knowledge service      │
                            │   (upload + real RAG)    │
                            └──────────────────────────┘
```

Deliberately absent from this diagram (Phase 5+, not built now): admin-dashboard backend, billing microservice beyond usage-metering, connector-hub beyond CSV/Excel, RPA workers, teams/org service, SSO/SCIM.

### 2.3 Environments
- **Sandbox:** `mk_test_*` keys. Routes to test Twilio subaccount / mock telephony. No real numbers provisioned. Free, generous rate limits.
- **Live:** `mk_live_*` keys. Requires verified business + accepted terms. Real telephony spend.
- Both share the same API surface — behavior differs only in what's touched underneath, never in endpoint shape. This is the #1 thing that must not regress into cosmetic-only sandboxing.

---

## 3. Data Model (target state)

Base this on the existing Postgres schema from the audit — it is largely correct in shape. Apply these fixes and prunings:

### 3.1 Fix before anything else
- `knowledge_chunks` must be created **after** `knowledge_documents` (fix FK ordering bug in `schema.sql`).
- Migration 006's `UPDATE` referencing `kc.source_id` must be corrected to `kc.document_id`.
- `audit_logs.ip_address`: create directly as `INET`, remove the VARCHAR→ALTER step.
- Consolidate `infrastructure/migrations/001–006_*.sql` so they are the **only** source of schema truth — `schema.sql` should be generated from migrations, not maintained in parallel, or compose should apply migrations directly instead of a separate inlined file.

### 3.2 Core tables (Phase 1–3 scope — keep, harden)
- `companies`, `users`, `sessions`, `roles`/`permissions`/`role_permissions`/`user_roles` (RBAC — keep minimal for now, don't build out fine-grained enforcement UI yet)
- `tenant_api_keys` — **add** an `environment` column (`live` | `test`) rather than relying on prefix parsing alone; index on `key_hash`
- `agents`, `agent_versions`
- `phone_numbers` — **add real routes**, currently schema-only
- `calls`, `transcripts`
- `usage_metrics` (call_minutes, stt_seconds, tts_characters, llm_tokens) — this table already exists and is exactly what Phase 3 billing needs; do not redesign it, wire it up
- `knowledge_sources`, `knowledge_documents`, `knowledge_chunks` (with real embeddings, not mocked)
- `tools`, `agent_tools` (keep — tool-engine already works)
- `provider_configs`, `secret_vault` (keep — needed for per-tenant Twilio/LLM credentials)

### 3.3 Deferred tables (do not build routes for these until Phase 5)
`teams`, `team_agents`, `commander_agents`, `crm_contacts`, `crm_opportunities`, `crm_appointments`, `departments`, `approval_queue`, `agent_hierarchy`, `agent_tasks`, `sso_connections`, `scim_tokens`, `policies`, `feature_flags` (beyond basic plan gating).

Leave these tables in the schema (no destructive migration needed) but do not expose them via the gateway and do not build service logic against them yet — this avoids the "docs describe APIs that don't exist" problem recurring.

---

## 4. API Contract — Core Resources (Phase 2 deliverable)

This is the actual public contract. Cursor should generate `openapi.yaml` from this section, not the other way around.

### 4.1 Auth
```
POST /v1/auth/register        Create company + admin user
POST /v1/auth/login           Returns access + refresh JWT
POST /v1/auth/refresh
POST /v1/auth/logout
GET  /v1/auth/me               ← currently MISSING, referenced by frontend, must exist
```

### 4.2 API Keys (tenant-scoped, requires JWT session to manage)
```
GET    /v1/keys                List keys (prefix only, never full key after creation)
POST   /v1/keys                 Create key — body: { environment: "test"|"live", name }
DELETE /v1/keys/{id}
```
**Fix required:** the gateway→tenant-service key verification call must send `x-service-auth` — this is currently broken and silently makes all API-key auth fail through the gateway.

### 4.3 Agents
```
POST   /v1/agents                    Create agent (name, prompt, voice config, model config, language)
GET    /v1/agents                    List
GET    /v1/agents/{id}
PUT    /v1/agents/{id}
DELETE /v1/agents/{id}
GET    /v1/agents/{id}/versions
POST   /v1/agents/{id}/versions/{version_id}/rollback
POST   /v1/agents/{id}/test-call      NEW — sandbox-only, triggers a live test call to a dev-supplied number using this agent's config, no billing
```

### 4.4 Calls
```
POST   /v1/calls                      Initiate an outbound call { agent_id, to_number }
GET    /v1/calls                      List (filter by agent_id, status, date range)
GET    /v1/calls/{id}
GET    /v1/calls/{id}/transcript
GET    /v1/calls/{id}/recording
POST   /v1/calls/{id}/transfer        NEW — transfer to human/queue (PBX parity w/ RingCloud)
```
Webhook events: `call.started`, `call.completed`, `call.transcript.ready`, `call.transferred`.

### 4.5 Numbers
```
POST   /v1/numbers/search             Search available numbers by area/country
POST   /v1/numbers                    Provision a number, assign to agent
GET    /v1/numbers
PUT    /v1/numbers/{id}                Reassign agent, update routing rules
DELETE /v1/numbers/{id}
```
This resource currently has zero routes despite a full DB table — build from scratch.

### 4.6 Knowledge
```
POST   /v1/knowledge/sources
POST   /v1/knowledge/sources/{id}/documents     Upload file
GET    /v1/knowledge/sources/{id}/documents
POST   /v1/knowledge/search                     Real vector search — replace mocked embeddings
```

### 4.7 Usage & Billing (Phase 3)
```
GET  /v1/usage                        Current period usage (call_minutes, stt_seconds, tts_characters, llm_tokens)
GET  /v1/usage/history
GET  /v1/billing/invoices
POST /v1/billing/webhooks/{provider}  Must perform real signature verification — no more always-200 stub
```

### 4.8 Tools & Connectors (keep existing, expose cleanly, no redesign needed)
```
POST/GET/PUT/DELETE  /v1/tools
POST                 /v1/tools/{id}/execute
GET/POST             /v1/connectors
POST                 /v1/connectors/{id}/upload
```
**Fix required:** gateway path `/api/connectors*` must match service path — currently proxies to a mismatched prefix.

### 4.9 Sandbox rule (applies to all of the above)
Every endpoint behaves identically in shape between `mk_test_` and `mk_live_` keys. Difference is only in side effects (real telephony vs simulated, real billing vs zero-cost). This must be enforced in the gateway/middleware layer, not left to each service to remember.

---

## 5. Phased Implementation Plan

### Phase 0 — Triage & Cleanup (prerequisite, ~2–3 days)
- [ ] Archive `docs/architecture.md`, `docs/api-reference.md`, `docs/deployment.md` → `docs/archive/`. Do not delete `PLAN.md` or `DEVELOPER_CTO_BRIEFING.md` — audit found these most accurate.
- [ ] Remove from active development (do not delete, move to `_deferred/` or a feature-flagged path): admin-dashboard backend logic, all `*-runtime` services not in compose, RPA worker, embedding-worker's mock logic, billing-service's Stripe stub, SSO/SCIM mock endpoints.
- [ ] Fix hardcoded secrets: remove `default-secret-key` default for `DASHBOARD_API_KEY`, remove `ClueCon` default for FreeSWITCH ESL password, align Postgres password handling (no hardcoded `markova:markova_pass` alongside a required `${POSTGRES_PASSWORD:?}` elsewhere).
- [ ] Decide and document (in `PLAN.md`) which voice stack is canonical going forward: playground (`ai call center/`) or orchestrator. Do not develop both further.
- **Acceptance:** repo builds and runs via `docker-compose up` with only the kept services; no dead service consumes CI time; `PLAN.md` updated with the voice-stack decision.

### Phase 1 — Fix the Contract-Breaking Bugs (prerequisite, ~3–5 days)
- [ ] Gateway → tenant-service key verification sends `x-service-auth` (currently missing — this is why API key auth is fully broken today).
- [ ] Fix `/api/connectors*` vs `/api/connector-hub/*` path mismatch.
- [ ] Fix frontend login calling nonexistent `/api/clients/*` → point at real `/v1/auth/*` paths (see naming migration note below).
- [ ] Fix `knowledge_chunks` FK-before-parent ordering bug in schema.
- [ ] Fix migration 006's `kc.source_id` → `kc.document_id`.
- [ ] Add `GET /v1/auth/me` (referenced by frontend, doesn't exist).
- [ ] Remove CRM leads route's missing TenantGuard (security bug — currently unauthenticated read of leads).
- **Naming migration note:** existing routes are under `/api/...`; new spec uses `/v1/...`. Cursor should decide once whether to rename in place or run both prefixes during a transition window — pick one and note it in `PLAN.md`, don't leave both undocumented.
- **Acceptance:** a developer can create a company, log in, generate a `mk_test_` key, and successfully call one authenticated endpoint through the gateway end-to-end. This did not work before Phase 1 and must work after.

### Phase 2 — Publish the Real API Contract (~1–2 weeks)
- [ ] Write `openapi.yaml` at repo root covering exactly the resources in Section 4 (auth, keys, agents, calls, numbers, knowledge, tools, connectors). No aspirational endpoints.
- [ ] Implement sandbox vs live key environments as a real `environment` column + middleware branch, not just a prefix.
- [ ] Implement `POST /v1/agents/{id}/test-call` sandbox flow.
- [ ] Consolidate call-related endpoints currently split across orchestrator and AI-call-center into the single `/v1/calls` resource.
- [ ] Ship a minimal JS/Node SDK generated or hand-written against `openapi.yaml` (auth, agents, calls, numbers at minimum).
- [ ] Publish a docs site (can be as simple as a static Redoc/Swagger UI render of `openapi.yaml`) — this replaces the archived stale docs.
- **Acceptance:** `openapi.yaml` validates with zero errors; every documented endpoint has a corresponding working route; a developer unfamiliar with the codebase can create an agent and place a test call using only the published docs + SDK, no source-reading required.

### Phase 3 — Usage-Based Billing & Public Pricing (~1 week)
- [ ] Wire `usage_metrics` table to real call/agent activity (it already has the right columns — connect them).
- [ ] Build `GET /v1/usage`, `GET /v1/usage/history`.
- [ ] Real webhook signature verification for billing provider (replace the always-200 Stripe stub).
- [ ] Publish a public pricing page with per-minute / per-agent-minute rates (this is a direct differentiator vs RingCloud's per-seat-only and Lucy's sales-gated pricing).
- **Acceptance:** a live-mode account accumulates real usage numbers viewable via API and matches what was actually consumed; pricing page is public with no login wall.

### Phase 4 — Feature Parity Fill-Ins (PBX basics + Numbers) (~1–2 weeks)
- [ ] Build `/v1/numbers` fully (search, provision, assign, routing rules) — closes the RingCloud parity gap.
- [ ] Build call transfer / agent-to-human handoff with full conversation context passed along (this is a genuine gap neither competitor has cleanly).
- [ ] Add IVR basics, call recording toggle, voicemail-to-email.
- [ ] Real vector search for `/v1/knowledge/search` (replace mocked embeddings in embedding-worker/knowledge-runtime).
- **Acceptance:** a developer can provision a number, attach an agent, receive a real inbound call, have it optionally transfer to a human with context, and pull the recording/transcript — all via documented API calls.

### Phase 5 — Deferred Features (not scheduled yet)
Teams/org hierarchy, CRM pipeline, RPA workflows, SSO/SCIM, admin super-dashboard, WhatsApp channel, Swahili language support, multi-region expansion. Revisit after Phase 4 ships and has real usage data.

---

## 6. Security Requirements (apply throughout, not a separate phase)

- No default secrets in code or compose files — all secrets required via env with no working fallback value.
- All webhook endpoints (inbound and the billing provider) must verify signatures; no endpoint may return a static success without validating the payload.
- WebSocket endpoints (`/ws/flow-monitor/{company_id}`) must require auth scoped to that company — currently open, must be fixed no later than Phase 2.
- Rate limiting must fail **closed** or at minimum log-and-alert on Redis failure, not silently fail open as it does today.
- `tenant_api_keys` must never return the full key after creation — prefix + hash only, enforced at the DB and API layer both.

---

## 7. Testing Requirements

- Every new/fixed endpoint in Phases 1–4 needs at minimum an integration test hitting the real route (auth → create resource → assert response shape matches `openapi.yaml`).
- A CI pipeline (currently absent) should run on every PR: schema migration check, OpenAPI validation, integration test suite. This did not exist before and is a Phase 1 deliverable, not optional polish.
- Sandbox-mode tests must run against real sandbox infrastructure (test Twilio subaccount), not mocks, so that "sandbox works" claims are actually verified.

---

## 8. Open Decisions for the Team (flag, don't silently decide)

1. Playground vs orchestrator as the canonical voice stack going forward (Phase 0).
2. `/api/...` → `/v1/...` migration strategy: hard cutover vs transition period (Phase 1).
3. Which billing provider to integrate for real (Stripe was stubbed — confirm still the choice, and whether local Ethiopian payment rails like Chapa itself should be the primary billing method given the target market, given card payments are a known adoption blocker locally).
4. Whether FreeSWITCH/SIP remains in the stack long-term or Twilio becomes the sole telephony provider — audit shows both partially implemented; carrying both indefinitely adds maintenance cost.

---

## Appendix — Kill List Reference (from audit, do not rebuild these in Phases 0–4)

Admin dashboard backend · `*-runtime` service forest (conversation, voice, planner, memory, workflow, knowledge, connector-runtime as separate services) · RPA worker · reporting-worker's fake PDF · sync-worker's random metrics · SSO/SCIM mocks · Stripe mock webhook · Governance UI · Organization hardcoded pages · duplicate event-processors (consolidate to one) · `@markova/event-schemas` and `@markova/tool-runtime` broken packages (fix if kept, else remove references).
