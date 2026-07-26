# Markova — Software Design Document (SDD) — FINAL, Implementation-Ready
### Domain 2 Only: API-First AI Communications Platform for Businesses with Existing Systems

**Version:** 3.0 (Final — consolidates v1 + v2, scoped down to Domain 2 for execution)
**Date:** 2026-07-26
**Status:** Ready for implementation, phase by phase, starting from current codebase state
**Prior artifacts folded into this document:** `docs/CODEBASE_AUDIT.md` (ground truth for current state), `MARKOVA_OS_SDD.md` v1 (API-first architecture), `MARKOVA_OS_SDD_v2.md` (three-domain vision — Domains 1 and 3 now demoted to Section 10, Future Roadmap, per decision to focus the company and this pitch cycle entirely on Domain 2)

---

## 0. Scope Decision (read this first)

Markova is, for now, **one product**: an API-first platform that lets a business with an existing system (ERP, CRM, or any internal tool) add voice-agent and workflow-agent capability to it — sandbox and live modes, usage-based pricing, built natively for Amharic (and Afaan Oromo / Tigrinya as the platform matures).

The "Founder" agentic co-founder product and the "Business-without-Systems" digitization service are **real future directions**, not abandoned — they're deliberately parked in Section 10 so that no engineering time, pitch-deck space, or team attention is split before this single product actually works end-to-end for real users. This decision was made specifically because breadth-before-depth is what the current codebase audit shows already went wrong once (a sprawling multi-tenant "AI workforce OS" with a dozen half-wired services) — the same mistake at the company-strategy level is avoidable now, before it's made twice.

**Everything below is what to build, in order, starting from the current project stage.**

---

## 1. Product Definition

**One sentence:** Markova is the API a developer or technical team reaches for to add voice-agent and workflow-agent capability to a system they already run — one key, sandbox and live modes, transparent per-minute pricing, native Amharic support — modeled on Chapa's developer experience, applied to voice/communications instead of payments.

**Named ICP (per pitch-guide requirement — be specific, not "every business in Ethiopia"):**
> Ethiopian small-to-mid-size businesses that already run a call center or customer-facing phone line and already use some internal system (a CRM, an ERP module, a booking system, a ticketing tool) — and want to add an AI voice agent to that line without replacing their existing system.

This is deliberately narrower than "any business" — narrow enough to name 5–10 real candidate businesses today and go test with them, which is exactly what the pitch rubric's MVP section demands.

**Competitive wedge (unchanged from prior research):**
| | RingCloud | Lucy AI | Markova |
|---|---|---|---|
| PBX / calling infra | Yes | No | Yes |
| Conversational AI voice agent | No | Yes | Yes |
| Public, self-serve pricing | Per-seat only | None (sales-gated) | Usage-based, public |
| Developer API / SDK, sandbox | Not primary | Not primary | **Primary product surface** |
| Local language (Amharic etc.) | No | Yes | Yes |

---

## 2. Target Architecture

### 2.1 Principles (unchanged from v1, still correct)
1. **The API is the product.** A feature that only exists in a dashboard UI is not done.
2. **One contract, one truth.** A single `openapi.yaml` at repo root is the source of truth — gateway routes, docs, and SDKs are validated against it, never hand-diverged.
3. **Sandbox is not cosmetic.** Test keys route to test infrastructure (no real telephony spend, no real numbers), not just a different key prefix on the same live path.
4. **Consolidate before extending.** No new microservices for concepts that already have a partial home in the current codebase.
5. **Every write is idempotent-safe; every async action fires a webhook.** No silent always-200 stubs (the current billing webhook does this today — banned going forward).

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
                            │   voice orchestrator   │  (Amharic STT→LLM→TTS
                            │   (Twilio/FreeSWITCH)  │   loop — crown jewel,
                            └─────────┬──────────────┘   harden, don't rebuild)
                                      │
                            ┌─────────▼──────────────┐
                            │   knowledge service      │
                            │   (upload + real RAG)    │
                            └──────────────────────────┘
```

**Explicitly not built now (see Section 10):** anything specific to an autonomous "Founder" product (validation agent, build agent, marketing agent), anything specific to a bespoke digitization engagement for businesses without systems, admin super-dashboard, teams/org hierarchy, CRM pipeline, RPA workflows, SSO/SCIM.

### 2.3 Environments
- **Sandbox:** `mk_test_*` keys. Test Twilio subaccount / mock telephony. No real numbers. Generous free limits, no card required to start (mirrors Chapa's and other comparable platforms' "try before you pay" pattern).
- **Live:** `mk_live_*` keys. Requires verified business. Real telephony spend, real billing.
- Same endpoint shapes in both — behavior differs only in side effects underneath.

---

## 3. Data Model

Base this on the existing Postgres schema — it is largely correct in shape. Required fixes, in priority order:

1. `knowledge_chunks` must be created **after** `knowledge_documents` (current FK-before-parent ordering bug).
2. Migration 006's `UPDATE` referencing `kc.source_id` → correct to `kc.document_id`.
3. `audit_logs.ip_address` created directly as `INET` — remove the VARCHAR→ALTER step.
4. Consolidate `infrastructure/migrations/001–006_*.sql` as the single source of schema truth — stop maintaining `schema.sql` in parallel; either generate it from migrations or apply migrations directly in compose.
5. `tenant_api_keys` — add an `environment` column (`live` | `test`), don't rely on prefix parsing alone.

**Core tables to keep and harden:** `companies`, `users`, `sessions`, `roles`/`permissions` (minimal RBAC for now), `tenant_api_keys`, `agents`, `agent_versions`, `phone_numbers`, `calls`, `transcripts`, `usage_metrics`, `knowledge_sources`/`knowledge_documents`/`knowledge_chunks`, `tools`, `agent_tools`, `provider_configs`, `secret_vault`.

**Tables to leave in schema but build zero routes for:** `teams`, `team_agents`, `commander_agents`, `crm_contacts`, `crm_opportunities`, `crm_appointments`, `departments`, `approval_queue`, `agent_hierarchy`, `agent_tasks`, `sso_connections`, `scim_tokens`, `policies`, `feature_flags` (beyond basic plan gating). No destructive migration needed — just don't wire them up.

---

## 4. API Contract — Core Resources

This is the actual public contract. Generate `openapi.yaml` from this section.

### 4.1 Auth
```
POST /v1/auth/register
POST /v1/auth/login          Returns access + refresh JWT
POST /v1/auth/refresh
POST /v1/auth/logout
GET  /v1/auth/me              ← currently MISSING, must exist
```

### 4.2 API Keys
```
GET    /v1/keys               List (prefix only, never full key post-creation)
POST   /v1/keys               { environment: "test"|"live", name }
DELETE /v1/keys/{id}
```
**Fix required:** gateway → tenant-service key verification must send `x-service-auth` — currently missing, which makes all API-key auth silently fail through the gateway. This is the single highest-priority bug in the whole codebase — nothing else matters if a developer's key doesn't work.

### 4.3 Agents
```
POST   /v1/agents                 { name, prompt, voice_config, model_config, language }
GET    /v1/agents
GET    /v1/agents/{id}
PUT    /v1/agents/{id}
DELETE /v1/agents/{id}
GET    /v1/agents/{id}/versions
POST   /v1/agents/{id}/versions/{version_id}/rollback
POST   /v1/agents/{id}/test-call   NEW — sandbox-only, real test call to a dev-supplied number, no billing
```

### 4.4 Calls
```
POST   /v1/calls                      { agent_id, to_number }
GET    /v1/calls                      Filter by agent_id, status, date range
GET    /v1/calls/{id}
GET    /v1/calls/{id}/transcript
GET    /v1/calls/{id}/recording
POST   /v1/calls/{id}/transfer        NEW — transfer to human/queue
```
Webhooks: `call.started`, `call.completed`, `call.transcript.ready`, `call.transferred`.

### 4.5 Numbers
```
POST   /v1/numbers/search
POST   /v1/numbers
GET    /v1/numbers
PUT    /v1/numbers/{id}
DELETE /v1/numbers/{id}
```
Currently zero routes despite a full DB table — build from scratch.

### 4.6 Knowledge (this is the technical spine of the Training/Integration UX)
```
POST   /v1/knowledge/sources
POST   /v1/knowledge/sources/{id}/documents
GET    /v1/knowledge/sources/{id}/documents
POST   /v1/knowledge/search           Real vector search — replace mocked embeddings
```
**Hard requirement, not optional:** tenant-scoped isolation must be architecturally guaranteed and tested — one business's knowledge base must never surface in another's agent responses. Build this in from the start; the embedding pipeline is currently mocked, which is exactly the right moment to get isolation right before real customer data flows through it.

### 4.7 Usage & Billing
```
GET  /v1/usage                 Current period (call_minutes, stt_seconds, tts_characters, llm_tokens)
GET  /v1/usage/history
GET  /v1/billing/invoices
POST /v1/billing/webhooks/{provider}   Real signature verification — no more always-200 stub
```

### 4.8 Tools & Connectors (keep existing, expose cleanly)
```
POST/GET/PUT/DELETE  /v1/tools
POST                  /v1/tools/{id}/execute
GET/POST              /v1/connectors
POST                  /v1/connectors/{id}/upload
```
**Fix required:** gateway path `/api/connectors*` must match service path `/api/connector-hub/*` — currently mismatched.

### 4.9 Sandbox rule
Every endpoint above behaves identically in shape between test and live keys — enforced in gateway/middleware, not left to each service to remember individually.

---

## 5. Onboarding Flow — Integration Agent & Training Agent

Two guided flows sit on top of the API above. These are UX layers over existing endpoints, not new backend infrastructure — build them as thin conversational layers, resist the urge to spin up new services for them.

**Integration Agent:** walks a business's technical contact through connecting Markova to their existing system — inspects their stated system type, generates the specific API calls/webhook config they need, tests the connection live in sandbox mode before going live. Built over `/v1/agents`, `/v1/numbers`.

**Training Agent:** guided intake collecting the business's own knowledge (product info, policies, FAQs, tone/voice preference) to configure their agent. Built over `/v1/knowledge/sources` + `/v1/knowledge/sources/{id}/documents`.

**Consent requirement (non-negotiable, not boilerplate):** the business must be shown, in plain language and in their own language, exactly what data they're providing and how it's used — configuring their own agent only, versus any possibility of informing shared model improvements across tenants. If the latter is ever offered, it must be **opt-in, not opt-out**, and declining must not degrade their own agent's core functionality. Recommendation: **do not offer shared model improvement at all in this version** — simplest, lowest-risk position until you have enough tenants and proven isolation guarantees in production to justify the complexity.

---

## 6. Subscription Tiers

| | **Basic** | **Pro** | **Plus** |
|---|---|---|---|
| Inbound voice agent | Yes | Yes | Yes |
| Inbound call handling | Answers, transcribes, **displays intended action on dashboard only** — no execution | Answers, transcribes, **and executes** the workflow action | Same as Pro, higher priority/SLA |
| Outbound call minutes | Low fixed allotment | Higher allotment | Highest allotment |
| Workflow agents (act on the business's own system, not just report) | Not included | Included | Included, priority execution queue |
| Rate basis | Birr/minute, inbound only | Birr/minute, inbound + outbound | Birr/minute, premium rate |
| Concurrent agents | 1 | Plan limit (e.g., 3) | Higher/negotiable |
| Support | Standard | Priority | Dedicated |

**Suggested additions:**
1. **Overage billing, not hard-stop** — a mid-call hard stop is a reputational risk for the business's own customers; auto-bill overage instead.
2. **Add-on minute packs** within Basic, so a seasonal outbound need doesn't force a full Pro upgrade.
3. **Annual billing discount** — improves cash flow predictability, a real lever worth having at launch.
4. **Honest upsell nudge:** show a Basic customer, on their own dashboard, what a detected action *would have done* on Pro — true, concrete, not manipulative.
5. **Free/sandbox tier, no card required** — near-costless since sandbox never touches real telephony spend, and mirrors the "no credit card to start" pattern used by comparable platforms.
6. **Public pricing page in birr, per-minute + add-ons** — this remains the clearest differentiator versus both RingCloud (per-seat only) and Lucy AI (no public pricing).

---

## 7. Ethical AI Requirements (real product requirements, not marketing copy)

1. **Voice disclosure:** every call handled by a Markova agent must clearly identify itself as an AI agent, early in the call, in the caller's language — default behavior, not a togglable option a business can disable to seem more human.
2. **Tenant data isolation** (Section 4.6) — architectural, tested, non-negotiable before real customer data flows through the knowledge/RAG pipeline.
3. **Workflow-agent actions need an audit trail and a confidence threshold.** Once a Pro/Plus workflow agent can actually execute an action on a business's system (not just report it), every execution needs an immutable audit log entry tied to the triggering call (extend the existing `audit_logs` table's delete-blocking trigger), and a tenant-configurable confidence threshold below which the agent proposes the action for human approval instead of auto-executing — the threshold should differ by action type (updating a customer's address vs. issuing a refund are not the same risk).
4. **Vulnerable-caller fallback:** a tested, hard rule to route to a human or provide emergency guidance if a caller shows evident distress (medical emergency, expressed self-harm risk), rather than continuing a scripted flow. Build and test this before general availability.
5. **Truthful marketing:** describe what's actually automated (inbound answering, transcription, dashboard action display) versus what still requires human approval or a higher tier (execution) — plainly, without overstating autonomy.

---

## 8. Phased Implementation Plan

### Phase 0 — Triage & Cleanup (~2–3 days)
- [ ] Archive `docs/architecture.md`, `docs/api-reference.md`, `docs/deployment.md` → `docs/archive/` (stale/aspirational per audit). Keep `PLAN.md` and `DEVELOPER_CTO_BRIEFING.md` — audit found these most accurate.
- [ ] Move out of active development (don't delete, quarantine): admin-dashboard backend, all `*-runtime` services not in compose, RPA worker, embedding-worker's mock logic, billing-service's Stripe stub, SSO/SCIM mocks.
- [ ] Remove hardcoded secrets: `default-secret-key` (`DASHBOARD_API_KEY`), `ClueCon` (FreeSWITCH ESL), align Postgres password handling.
- [ ] Decide and document in `PLAN.md`: which voice stack is canonical going forward — playground (`ai call center/`) or orchestrator. Stop developing both in parallel.
- **Acceptance:** repo builds and runs via `docker-compose up` with only kept services; `PLAN.md` records the voice-stack decision.

### Phase 1 — Fix Contract-Breaking Bugs (~3–5 days) — highest priority, this is what makes a live demo possible
- [ ] Gateway → tenant-service key verification sends `x-service-auth`.
- [ ] Fix `/api/connectors*` vs `/api/connector-hub/*` path mismatch.
- [ ] Fix frontend login calling nonexistent `/api/clients/*` → real `/v1/auth/*` paths.
- [ ] Fix `knowledge_chunks` FK ordering; fix migration 006's `kc.source_id` → `kc.document_id`.
- [ ] Add `GET /v1/auth/me`.
- [ ] Add missing TenantGuard on CRM leads route (currently unauthenticated read).
- **Acceptance:** a developer can create a company, log in, generate a `mk_test_` key, and successfully call one authenticated endpoint through the gateway end-to-end — this is also, not coincidentally, the minimum bar for a pitch-competition live demo.

### Phase 2 — Publish the Real API Contract (~1–2 weeks)
- [ ] Write `openapi.yaml` covering exactly Section 4's resources — no aspirational endpoints.
- [ ] Real sandbox vs live environments (DB column + middleware branch, not prefix-only).
- [ ] Implement `POST /v1/agents/{id}/test-call`.
- [ ] Consolidate call endpoints currently split across orchestrator and AI-call-center into one `/v1/calls` resource.
- [ ] Minimal JS/Node SDK against the spec (auth, agents, calls, numbers at minimum).
- [ ] Static docs site (Redoc/Swagger UI over `openapi.yaml`) replacing the archived stale docs.
- [ ] **Build the Integration Agent and Training Agent conversational layers (Section 5) in parallel with this phase** — they depend on endpoints this phase is already building, don't sequence them after.
- **Acceptance:** `openapi.yaml` validates with zero errors; every documented endpoint has a working route; a developer unfamiliar with the codebase can create an agent and place a test call using only published docs + SDK.

### Phase 3 — Usage-Based Billing & Public Pricing (~1 week)
- [ ] Wire `usage_metrics` to real call/agent activity.
- [ ] `GET /v1/usage`, `GET /v1/usage/history`.
- [ ] Real webhook signature verification (replace Stripe stub).
- [ ] Publish public pricing page (birr, per-minute, tiers from Section 6).
- **Acceptance:** a live account accumulates real usage matching actual consumption; pricing page is public, no login wall.

### Phase 4 — Feature Parity Fill-Ins (~1–2 weeks)
- [x] Build `/v1/numbers` fully (search, provision, assign, routing rules).
- [x] Call transfer / agent-to-human handoff with full conversation context passed along.
- [x] IVR basics, call recording toggle, voicemail-to-email.
- [x] Real vector search for `/v1/knowledge/search` (replace mocked embeddings) — with tenant isolation verified by test (Section 7.2).
- [x] Workflow-agent audit trail + confidence threshold (Section 7.3) — required before Pro/Plus tiers can safely execute real actions.
- **Acceptance:** a developer can provision a number, attach an agent, receive a real inbound call, optionally transfer to a human with context, pull the recording/transcript, and — for Pro/Plus — have a workflow action actually execute with an audit trail — all via documented API calls.

---

## 9. Security & Testing (apply throughout, not a separate phase)

- No default secrets in code or compose — all required via env, no working fallback.
- All webhooks (inbound and billing) verify signatures — no static success responses.
- WebSocket endpoints (`/ws/flow-monitor/{company_id}`) require company-scoped auth — currently open, fix no later than Phase 2.
- Rate limiting fails closed or logs-and-alerts on Redis failure — currently fails open.
- `tenant_api_keys` never returns the full key after creation, enforced at DB and API layer both.
- CI pipeline (currently absent) runs on every PR: schema migration check, OpenAPI validation, integration tests — a Phase 1 deliverable, not optional polish.
- Sandbox-mode tests run against real sandbox infrastructure (test Twilio subaccount), not mocks.

---

## 10. Future Roadmap (parked, not built now)

Two additional product lines were designed in earlier planning and are deliberately deferred until Domain 2 is proven with real users and real revenue:

- **The Founder** — an agentic co-founder product (idea → working MVP → basic marketing/support) for individuals or teams with no budget or team, modeled on Polsia with corrections for a documented failure pattern in that space: no validation step before building, and insufficient disclosure/human-in-the-loop for high-stakes agent actions (investor communication, commitments). If revisited, these two corrections are non-negotiable starting requirements, not later additions.
- **Business-without-Systems** — the same subscription tiers as Domain 2, preceded by a paid, scoped digitization engagement (standing up a minimal system of record) for businesses that don't yet have an existing system to integrate against. Priced separately as a fixed-fee project, not folded into subscription pricing.

Both reuse the same underlying agent/knowledge/billing kernel being built in Phases 0–4 above — they are new product surfaces on the same foundation, not new infrastructure. Do not begin either until Domain 2's Phase 2 (the real API contract) is stable and in front of real paying or piloting customers.

---

## 11. Open Decisions to Flag for the Team

1. Playground vs orchestrator as the canonical voice stack going forward (Phase 0).
2. `/api/...` → `/v1/...` migration: hard cutover vs transition window (Phase 1).
3. Billing provider: confirm Stripe, or consider Chapa itself given local card-payment friction for Ethiopian businesses.
4. FreeSWITCH/SIP long-term vs Twilio as sole telephony provider — carrying both indefinitely adds maintenance cost the audit already flags as unresolved.
5. Confidence-threshold defaults for workflow-agent execution (Section 7.3) — needs risk/compliance input, not engineering alone.

---

## Appendix — Immediate Next Actions (in order)

1. Run Phase 0 this week.
2. Run Phase 1 immediately after — this alone should make a live, working demo possible for the pitch competition (create company → log in → get sandbox key → agent answers a real test call → transcript shows on dashboard).
3. In parallel with Phase 1/2, start real user testing with 5+ non-founder users from the named ICP (Section 1) — this is required for pitch-rubric Section 3 and is more urgent right now than any remaining engineering phase.
4. Begin Phase 2 once Phase 1's acceptance criteria are met.
