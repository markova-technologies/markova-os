# Markova AI Call Center — Master Development Plan

## Overview

This repo contains two distinct environments that work **together** toward one goal:
building the most accurate, natural, low-latency Amharic AI voice agent on the market,
packaged as a production-grade multi-tenant SaaS platform.

Authoritative product/engineering scope: `docs/ssd/IMPLEMENTATION_PLAN.md` (v3 Final — Domain 2).

---

## Canonical Voice Stack Decision (Phase 0 — 2026-07-26)

**Orchestrator is canonical.** Phase 1/2 will port STT/TTS/RAG maturity from the playground into it. The playground remains running only as a reference/fallback until parity is reached, **not developed further**.

| | Canonical target | Reference / fallback |
|---|---|---|
| Path | `services/orchestrator/` | `ai call center/` |
| Role | Multi-tenant production voice runtime (`x-company-id`, DB-backed agents) | Battle-tested Amharic pipeline (Whisper/ffmpeg, RAG, streaming) to **port from**, not extend |
| Why | Already has tenant-scoping hooks the API-first model depends on | Single-tenant monolith hardcoded around one client ("Almaz" / GM Furniture) — promoting it would mean bolting multi-tenancy onto something never designed for it |

**Rule going forward:** do not add new features in the playground. Port proven playground pieces into the orchestrator. Once parity is reached, playground can be retired or kept read-only for regression demos.

---

## The Two-Environment Strategy (historical — superseded by decision above)

### Environment 1 — The Playground (`ai call center/`) — REFERENCE ONLY

> **Status:** Frozen for new feature work. Use only as a reference implementation while porting into the orchestrator.

Original Amharic AI demo — a single-file FastAPI Python app (`main_natural_voice.py`) that handles the full voice loop:

```
Inbound Call (Twilio / FreeSWITCH SIP)
    → Audio Pre-processing (ffmpeg)
    → STT (Groq Whisper / OpenAI Whisper)
    → Garbage Detection + Amharic Normalization + LLM Repair
    → LLM (Groq / OpenAI / Gemini) + RAG Knowledge Base
    → TTS (Edge TTS → Google TTS → OpenAI TTS)
    → Audio Response (streamed sentence-by-sentence)
    → Barge-in (ESL/VMD via barge_in_manager.py)
```

### Environment 2 — Production Architecture (`services/`, `apps/`, `workers/`)

> **Purpose:** The multi-tenant microservices platform that ships to customers.

The core runtime is `services/orchestrator/main.py` — provider-agnostic, multi-tenant, backed by PostgreSQL + Redis, deployed via Docker.

---

## Porting Checklist (playground → orchestrator)

When porting a proven playground capability into `services/orchestrator/main.py`:

```
[ ] Behavior matches playground on representative Amharic calls
[ ] Multi-tenant (agent config from DB, not hardcoded client prompts)
[ ] Provider credentials from provider_configs / vault (not .env only)
[ ] Error handling is robust (no silent failures in async paths)
[ ] Usage tracking wired (tokens, STT seconds, TTS chars → usage_metrics)
[ ] Verification script or integration test written
```

Priority ports for Phase 1/2:

1. Direct Whisper STT (file upload) + ffmpeg pre-processing
2. Wire RAG into the conversation loop
3. Sentence-by-sentence streaming TTS
4. Call recording parity

---

## Current Status

| Area | Playground Status | Orchestrator Status |
|---|---|---|
| Twilio inbound webhook | ✅ Done | ✅ Done |
| Audio pre-processing (ffmpeg) | ✅ Done | ❌ Not ported |
| Direct Whisper STT (file upload) | ✅ Done | ❌ Missing (uses Twilio Gather STT) |
| Garbage detection | ✅ Done | ✅ Ported |
| Amharic normalization | ✅ Done | ✅ Ported |
| LLM phonetic repair | ✅ Done | ✅ Ported |
| RAG knowledge base | ✅ Done (keyword) | ❌ Not wired into conversation loop |
| TTS with multi-provider fallback | ✅ Done | ✅ Ported |
| TTS audio caching | ✅ Done (MD5) | ✅ Ported |
| Barge-in (ESL/VMD) | ✅ Done | ❌ Not applicable (Twilio only) |
| Sentence-by-sentence streaming | ✅ Done | ❌ Not ported |
| Tool engine integration | ❌ Not in playground | ❌ Not wired |
| Vector RAG (pgvector) | ✅ Done (keyword) | ✅ Cosine search + local/OpenAI embeddings |
| Call recording | ✅ Basic | ✅ Toggle via number settings + Twilio callback |

---

## Phase 4 Notes (2026-07-26)

- Numbers: search/provision/assign + `/v1/numbers/{id}/routing-rules`; settings for IVR/recording/voicemail
- Transfer: `POST /v1/calls/{id}/transfer` returns full `context` (transcript + summary); stored on `calls.transfer_context`
- IVR DTMF (`/twilio/ivr`), recording toggle, voicemail-to-email queue (`voicemail:email:queue`)
- Knowledge: real vector search (`embedding <=> query`); isolation test `tests/knowledge_isolation_test.py`
- Tools: Pro/Plus execute with audit_logs; below-threshold → `approval_queue`; Basic proposes only
- Migration: `infrastructure/migrations/008_phase4_parity.sql`

## Phase 3 Notes (2026-07-26)

- Usage is a ledger in `usage_metrics`; `GET /v1/usage` returns SUM; history lists events
- Orchestrator records usage on sandbox/live call activity and Twilio status callbacks
- Billing webhooks require `BILLING_WEBHOOK_SECRET` + HMAC (`x-billing-signature`)
- Public pricing (no login): HTML `/pricing`, JSON `/v1/pricing` (ETB per-minute Basic/Pro/Plus)

## Phase 2 Notes (2026-07-26)

- Contract source of truth: repo-root `openapi.yaml` (served at `GET /openapi.yaml`, UI at `GET /docs`)
- Sandbox vs live: `tenant_api_keys.environment` + gateway `x-markova-env` (not prefix-only)
- Minimal SDK: `packages/sdk` (`@markova/sdk`) — auth, keys, agents, calls, numbers
- Onboarding chat: `POST /v1/onboarding/integration/chat`, `POST /v1/onboarding/training/chat`

## Phase 1 API Path Decision (2026-07-26)

**Transition window (not hard cutover):** keep `/api/auth/*` and add canonical `/v1/auth/*`. Also mount legacy `/api/clients/login|register` on auth-service so the frozen client-dashboard keeps working without frontend edits. Prefer `/v1/*` for new clients and docs (Phase 2 OpenAPI).

---

## Phase 0 Triage Notes

- Stale docs archived under `docs/archive/`
- Stub/unwired services and workers moved to `_quarantine/` (see `_quarantine/README.md`)
- SSO/SCIM mock routes removed from auth-service; mock modules under `_quarantine/kernel/identity/`
- Hardcoded secret defaults removed (`default-secret-key`, `ClueCon`, compose `markova_pass`)
- Kept Node services declare kernel transitive deps (`jsonwebtoken`, `axios`, `uuid`) so monorepo Docker images start
- Knowledge-service Dockerfile listens on `PORT` (default 5006) to match gateway/compose
- `apps/admin-dashboard` left untouched (frontend-freeze; separate later work)
- Verified 2026-07-26: `docker compose up` kept-set only; all `/health` endpoints return OK

---

*This plan records the voice-stack decision and porting priorities.
Product scope and phased API work live in `docs/ssd/IMPLEMENTATION_PLAN.md`.*
