# Markova

**The API for adding an AI voice agent to a phone line you already run — in Amharic, Afaan Oromo, Tigrinya, or English.**

Markova is an API-first platform that lets a business with an existing system — a CRM, an ERP module, a booking tool, a call center — give it a voice. One key, sandbox and live environments, transparent usage-based pricing in Ethiopian Birr, and voice agents built natively for local languages instead of bolted on as an afterthought.

## Why

Most Ethiopian SMBs that run a customer-facing phone line already have some system of record behind it. What they don't have is a way to answer that line with an AI agent that speaks the languages their customers actually call in, without replacing the system they already trust. Markova is that layer: a developer-first API, not a walled-garden call-center product, so it plugs into what a business already runs instead of asking them to start over.

## What it does today

- **Multi-language voice agents** — create an agent with a prompt, a voice, and a language (`am`, `om`, `ti`, `en`); every call opens with a mandatory, non-optional AI disclosure to the caller.
- **Sandbox and live environments** — `mk_test_*` keys run real calls against sandbox infrastructure with nothing billed; `mk_live_*` keys carry real telephony spend. Same API shapes in both.
- **Phone numbers, IVR, and call handling** — search and provision numbers, configure routing rules and IVR, toggle call recording, route unanswered calls to voicemail-by-email, and transfer a live call to a human with the full conversation context attached.
- **Knowledge base with real vector search** — upload source documents, query them with pgvector-backed similarity search, and get tenant isolation that's architecturally enforced and covered by an isolation test — not a shared index with a filter bolted on.
- **Workflow and tool execution with an audit trail** — Pro/Plus tiers let an agent actually execute an action against your system (not just report it), gated by a per-action confidence threshold; anything below threshold routes to an approval queue instead of auto-executing, and every execution is written to an immutable audit log.
- **Usage-based billing, in Birr** — a real usage ledger (call minutes, STT seconds, TTS characters, LLM tokens) backs `GET /v1/usage`, invoices, and signature-verified billing webhooks. Public, no-login pricing.
- **Developer-first** — a single `openapi.yaml` at the repo root is the source of truth for the API, a minimal Node SDK (`@markova/sdk`) is generated against it, and a documentation site walks through auth, agents, calls, numbers, knowledge, and webhooks.

## Architecture, at a glance

```
                     openapi.yaml  ← source of truth
                          │
                 API Gateway (:8000)
      auth, tenant, agent-builder, tool-engine,
      connector-hub, knowledge-service
                          │
              voice orchestrator (:6000)
        Amharic-first STT → LLM → TTS call loop,
     RAG-backed knowledge, tenant-scoped, Twilio-driven
                          │
              PostgreSQL + pgvector · Redis
```

The voice orchestrator is the production runtime; an earlier single-tenant playground (`ai call center/`) remains as a frozen reference for the Amharic STT/TTS pipeline it was built and proven in, and is being ported into the orchestrator rather than extended further.

## Quickstart

```bash
# Register (returns a JWT you use to mint API keys)
curl -X POST http://localhost:8000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Selam Bekele", "companyName": "Bekele Dental", "email": "selam@example.com", "password": "a-long-passphrase"}'

# Create a sandbox key with the JWT from the response
curl -X POST http://localhost:8000/v1/keys \
  -H "Authorization: Bearer YOUR_JWT" -H "Content-Type: application/json" \
  -d '{"name": "local dev", "environment": "test"}'

# Create an agent
curl -X POST http://localhost:8000/v1/agents \
  -H "x-api-key: mk_test_YOUR_KEY" -H "Content-Type: application/json" \
  -d '{"name": "Reception", "language": "am", "prompt": "You answer the phone for Bekele Dental..."}'

# Place a sandbox test call — nothing billed
curl -X POST http://localhost:8000/v1/agents/AGENT_ID/test-call \
  -H "x-api-key: mk_test_YOUR_KEY" -H "Content-Type: application/json" \
  -d '{"to_number": "+251911000000"}'
```

Your phone rings. Answer it and talk to the agent. Full walkthrough and API reference live in the developer docs (`apps/docs`).

## Tech stack

- **API Gateway** — NestJS, auth/rate-limit/routing
- **Core services** — Node.js/Express (auth, tenant, agent-builder, tool-engine, connector-hub)
- **Knowledge service** — Python/FastAPI
- **Voice orchestrator** — Python/FastAPI, Twilio, Whisper-class STT, edge/neural TTS, RAG
- **Data** — PostgreSQL 15 + pgvector, Redis 7
- **Frontend** — React + Vite (client dashboard)
- **Contract** — OpenAPI 3.0 (`openapi.yaml`) + generated Node SDK

## Project status

Backend Phases 0–4 of the implementation plan are complete: contract-breaking bugs fixed, the real `openapi.yaml` contract published, usage-based billing wired to real activity, and phone numbers/IVR/recording/voicemail/transfer, real vector search with tenant isolation, and workflow audit trails/confidence thresholds all shipped and covered by tests. Details and phase-by-phase acceptance criteria: [`docs/ssd/IMPLEMENTATION_PLAN.md`](docs/ssd/IMPLEMENTATION_PLAN.md) (authoritative scope) and [`PLAN.md`](PLAN.md) (voice-stack decisions, porting notes).

The client dashboard is being wired from a design-complete UI to the real API surface above — treat the backend and its API contract as the stable, load-bearing layer right now.

## Links

- **API reference & developer docs:** `apps/docs` (Quickstart, concepts, OpenAPI reference, SDK, webhooks)
- **API contract:** [`openapi.yaml`](openapi.yaml)
- **Pricing:** public, no login required — served by the API gateway (`/pricing`, `/v1/pricing`)
- **Implementation plan:** [`docs/ssd/IMPLEMENTATION_PLAN.md`](docs/ssd/IMPLEMENTATION_PLAN.md)
