# Markova OS — Definitive AI Master Knowledge & Architecture Transfer Document

> **DOCUMENT PURPOSE**: This file is the authoritative, unvarnished, deep-context transfer document for AI systems (Claude, ChatGPT, Gemini, Copilot, etc.) and senior systems architects. When ingesting this document, an AI should possess 100% full context of what Markova OS is, its real-world implementation state, its technical pipeline, its strategic roadmap, its solved traps, and its exact operating conventions.

---

## 1. Ground-Truth Executive Summary: What Markova OS Actually Is

**Markova OS** (`markova-platform@2.0.0`) is a multi-tenant AI voice call center and digital workforce operating system engineered specifically for emerging markets and African languages—with production-grade **Amharic (Ethiopian language)** as its flagship core.

### The Real-World Reality of the Codebase
Historically evolved from an experimental project named `amharic-ai-call-demo`, the codebase is organized as a monorepo with a deliberate **dual-environment architecture**:
1. **The Voice Playground (`ai call center/main_natural_voice.py`)**: A battle-tested, 3000+ line Python/FastAPI monolith. It is the real, running, proven Amharic voice agent ("Almaz", originally built for GM Furniture in Ethiopia). It handles carrier-level SIP trunks, real-time audio pre-processing, Amharic speech-to-text, Ethiopic homophone normalization, RAG product catalogs, fast LLM phonetic repair, neural Amharic TTS, and barge-in (interruption) detection.
2. **The Production Platform (`services/`, `apps/`, `infrastructure/`)**: A multi-tenant Docker Compose microservice mesh:
   - **Production Voice Orchestrator** (`services/orchestrator/main.py`): The clean, provider-agnostic FastAPI engine where battle-tested voice logic is migrated.
   - **API Gateway** (`services/api-gateway/`): A NestJS TypeScript perimeter proxy handling authentication, rate limiting, and routing.
   - **Auth Service** (`services/auth-service/`): A Node.js/Express identity microservice with asymmetric RS256 JWT key generation, organization workspace slug management, and enterprise RBAC.
   - **Client Dashboard** (`apps/client-dashboard/`): A React 18 / Vite single-page application featuring real-time call center HUDs, visual agent builders, RAG document management, and organization workspace portals (`/workspace/:slug`).
   - **Persistence**: PostgreSQL 15 with `pgvector` for RAG vector search, plus Redis 7 for live call session states and event streams.

---

## 2. Core Operational Law: The Two-World Rule

In this repository, you must follow the absolute iron rule:
> **"Features are proven in the Playground (`ai call center/`) first. Once verified under real telephony conditions, they are promoted into the Production Orchestrator (`services/orchestrator/main.py`). Never experiment directly in production."**

```
┌────────────────────────────────────────────────────────┐
│              ai call center/ (PLAYGROUND)              │
│  - main_natural_voice.py (Monolith source of truth)    │
│  - FreeSWITCH SIP configurations & dialplans           │
│  - Real telephony call experiments (Twilio/FreeSWITCH) │
│  - STT/TTS benchmark harnesses & WER tests             │
└───────────────────────────┬────────────────────────────┘
                            │ (Once battle-tested & proven)
                            ▼
┌────────────────────────────────────────────────────────┐
│           services/orchestrator/ (PRODUCTION)          │
│  - main.py (FastAPI microservice, multi-tenant DB)     │
│  - Provider-agnostic adapters (LLM, STT, TTS)          │
│  - Redis call state machine & event streams            │
└────────────────────────────────────────────────────────┘
```

---

## 3. High-Level Strategy: The Three-Domain Architecture (SDD v2)

Markova OS is architected around a unified core kernel supporting three commercial domains:

```
                         ┌─────────────────────────────┐
                         │         MARKOVA OS          │
                         │   Shared Kernel Primitives: │
                         │   Auth, Agents, Billing,    │
                         │   Knowledge/RAG, Voice      │
                         └───────┬──────────┬──────────┘
                                 │          │
        ┌────────────────────────┘          └────────────────────────┐
        │                                                             │
┌───────▼────────┐                                    ┌───────────────▼───────────────┐
│   DOMAIN 1     │                                    │         DOMAIN 2 & 3          │
│  "THE FOUNDER" │                                    │     BUSINESS API PLATFORM     │
│  (Agentic      │                                    │  (Chapa-style, Voice & Work)  │
│   co-founder   │                                    │                               │
│   Polsia-style)│                                    │  Domain 2: Has existing ERP   │
│                │                                    │  Domain 3: Needs digitization │
└────────────────┘                                    └───────────────────────────────┘
```

1. **Domain 1 — "The Founder"**: An agentic system for solo entrepreneurs with an idea but no budget. Includes mandatory idea-validation gates, disclosure-by-default (no silent emails/calls), and regulated-industry safety gates.
2. **Domain 2 — Business-with-Systems**: The core B2B API platform. Businesses with existing ERPs/CRMs connect via guided integration agents to deploy voice agents.
3. **Domain 3 — Business-without-Systems**: For businesses with zero digital infrastructure. Markova digitizes their records into its database, immediately graduating them into Domain 2 subscribers.

---

## 4. The Complete Amharic Voice & Telephony Pipeline

Western platforms (Bland AI, Vapi, Retell, ElevenLabs) fail in Ethiopia due to high latency, inability to handle Ethiopic Unicode, and lack of support for local telecom infrastructure. Markova OS solves this with a dedicated 10-step audio pipeline:

```
  [ Caller on Mobile PSTN (Ethio Telecom / Safaricom) ]
                            │
                            ▼
  [ Telephony Gateway: FreeSWITCH SIP Trunk / Twilio Inbound ]
                            │ RTP Telephony Audio
                            ▼
  [ Step 1: Audio Conditioning (ffmpeg) ]
    - High-pass filter (cutoff 300Hz)
    - Automatic Gain Control (AGC)
    - Silence trimming & dynamic noise gating
                            │ Clean 16kHz Mono Audio
                            ▼
  [ Step 2: Speech-to-Text (STT) ]
    - Groq Whisper-large-v3 / OpenAI Whisper
    - Ethiopian vocabulary prompt biasing (local place names, product names)
                            │ Raw Amharic String
                            ▼
  [ Step 3: Unicode Validation & Anti-Hallucination Gate ]
    - Inspects Unicode range (Ethiopic: U+1200 - U+139F)
    - Detects & discards foreign leaks (Cyrillic, Georgian, Thai, Arabic)
    - Detects Whisper hallucination loops (e.g. YouTube outro phrases)
    - If unusable: Triggers courteous Amharic re-prompt:
      "ይቅርታ፣ ድምፅዎ አልተሰማኝም። እባክዎ በድጋሚ ይንገሩኝ?"
                            │
                            ▼
  [ Step 4: Ethiopic Homophone Normalization ]
    - Canonicalizes 30+ interchangeable phonetic characters:
      • ሀ, ሐ, ኀ (Ha)  ->  ሀ
      • ሠ, ሰ (Se)     ->  ሰ
      • ዐ, አ (A)      ->  አ
      • ጸ, ፀ (Tse)    ->  ጸ
                            │ Normalized Text
                            ▼
  [ Step 5: Ultra-Fast Phonetic Repair (Groq LLaMA 3.1 8B) ]
    - Sub-100ms LLM pass fixes garbled transcriptions of Ethiopian landmarks
      (Bole, Merkato, Kazanchis, Piassa) and currency values in Birr.
                            │ Corrected Query
                            ▼
  [ Step 6: RAG Knowledge Retrieval ]
    - Queries PostgreSQL `knowledge_chunks` using `pgvector` cosine similarity
    - Retrieves business catalog, pricing in ETB, policies, and FAQs
                            │ Context + Transcript
                            ▼
  [ Step 7: Core Orchestrator Reasoning ]
    - Groq LLaMA 3.3 70B / Gemini Flash / OpenAI GPT-4o-mini
    - Persona prompt: "Almaz" (respectful, brief, Amharic-first)
    - Session memory loaded from Redis (`call:{CallSid}:state`)
                            │ Generated Response Text + Tool Actions
                            ▼
  [ Step 8: Action & Tool Dispatch ]
    - Asynchronously triggers webhooks: SMS receipt, Telegram alert, CRM update
                            │
                            ▼
  [ Step 9: Low-Latency Neural Text-to-Speech (TTS) ]
    - Primary: Edge TTS (`am-ET-MekdesNeural` female voice)
    - Fallback Chain: Google TTS -> OpenAI TTS -> Twilio Say
    - MD5 Audio Caching: Identical phrases serve pre-synthesized WAV from disk
    - ffmpeg converts output to 16kHz telephony-compliant WAV
                            │ Streamed Audio
                            ▼
  [ Step 10: Telephony Playback & Barge-In ]
    - Plays audio to caller over TwiML / FreeSWITCH RTP stream
    - Real-Time Barge-In: Monitored via FreeSWITCH ESL Voice Motion Detection.
      If caller speaks mid-response, playback cuts off instantly.
```

---

## 5. Repository Topology & Microservice Map

The monorepo contains the following exact structure:

```
d:\Projects\Markova Projects\Markova Ai Call Center\
├── ai call center/           # THE PLAYGROUND (FastAPI, FreeSWITCH, tests, Almaz voice)
│   ├── main_natural_voice.py # 3000+ line monolith source of truth
│   ├── barge_in_manager.py   # FreeSWITCH ESL + VMD barge-in handler
│   ├── database.py           # SQLite local route manager & health monitor
│   ├── knowledge_base.json   # GM Furniture product catalog (ETB pricing)
│   └── freeswitch_config/    # XML dialplans and SIP gateway definitions
│
├── services/                 # BACKEND MICROSERVICES
│   ├── orchestrator/         # Production voice engine (Python FastAPI, Port 6000)
│   ├── api-gateway/          # Unified perimeter edge proxy (NestJS, Port 8000)
│   ├── auth-service/         # Identity, RBAC, RS256 JWT, workspace (Node, Port 5001)
│   ├── tenant-service/       # Company management & API keys (Node/Express, Port 5002)
│   ├── agent-builder/        # Agent CRUD & versioning (Node/Express, Port 5003)
│   ├── tool-engine/          # Webhook execution engine (Node/Express, Port 5004)
│   ├── connector-hub/        # Integrations (Sheets, CSV, n8n) (Node, Port 5005)
│   └── knowledge-service/    # Document parser & vector ingestion (Python, Port 5006)
│
├── apps/                     # FRONTEND APPLICATIONS
│   ├── client-dashboard/     # Tenant UI (React 18 + Vite, Port 3001/5173)
│   └── admin-dashboard/      # Superadmin platform UI (React + Tailwind, Port 3000)
│
├── infrastructure/           # PERSISTENCE & DEPLOYMENT
│   ├── postgres/             # Canonical schema.sql
│   └── migrations/           # Versioned SQL migrations (001_... to 021_...)
│
├── .agents/                  # AGENT PERSISTENT MEMORY
│   ├── AGENTS.md             # Workspace operational rules
│   └── errors_and_learnings.md # Log of bugs, root causes, and prevention rules
│
├── docker-compose.yml        # Multi-service local stack
└── DEVELOPER_CTO_BRIEFING.md # Ground-truth developer briefing
```

---

## 6. Authentication & Organization Workspace System

### Dual-Token JWT Architecture
The platform operates on a hybrid authentication architecture:
- **Auth Service (`auth-service`)**: Generates an asymmetric RSA key pair on startup and issues **RS256** signed JWTs containing `user_id`, `company_id`, `company_slug`, and RBAC permissions.
- **Supabase Auth**: Issues symmetric **HS256** signed JWTs using `SUPABASE_JWT_SECRET`.
- **API Gateway Verification Bridge (`auth.middleware.ts`)**: The gateway inspects the token header algorithm dynamically:
  - If `alg === 'RS256'`, it verifies the token against `auth-service`'s public key.
  - If `alg === 'HS256'`, it verifies using `SUPABASE_JWT_SECRET`.
  - Whitelists public workspace resolution and scoped login routes.

### Organization Workspace Isolation (`/workspace/:slug`)
- **Auto-Generated Slugs**: On registration, `slugify(companyName)` assigns a URL-safe slug to `companies.slug` with collision deduplication (e.g. `acme-logistics`, `acme-logistics-2`).
- **Scoped Portal**: Employees sign in at `https://app.markova.ai/workspace/{slug}`.
- **Cross-Org Denial (HTTP 403)**: If an authenticated user belongs to Company A but attempts to log into Company B's workspace, the endpoint rejects the session with `CROSS_ORG_ACCESS_DENIED`.
- **Brand Hierarchy**: On all workspace portals, **Markova OS** is anchored at the top as the primary hero platform brand (Apple-style), with the client's company name, logo, and slug displayed secondarily.
- **Owner Dual Access**: Company owners can authenticate via both their branded workspace URL and the master `/login` route.

---

## 7. Database Schema & Vector Data Model

Database: **PostgreSQL 15** with the **`pgvector`** extension.

### Core Tables
- `companies`: Multi-tenant root. Contains `id`, `name`, `slug VARCHAR(63) UNIQUE`, `logo_url`, `plan`, `created_at`.
- `users`: User accounts scoped by `company_id`. Contains `role` (`owner`, `admin`, `supervisor`, `agent`), password hash, `status`.
- `agents`: Voice bot configurations. Contains `prompt`, `voice_provider`, `voice_id`, `model_provider`, `model_id`, `temperature`.
- `agent_versions`: Version history enabling instant rollbacks.
- `phone_numbers`: Binds telephony phone numbers to specific `agent_id`s and `company_id`s.
- `calls`: Historical call records containing `start_time`, `end_time`, `duration_seconds`, `turn_count`, `cost_birr`, `status`.
- `transcripts`: Turn-by-turn conversational exchanges with speaker tagging (`caller` vs `agent`) and sentiment tags.
- `usage_metrics`: Granular consumption metering (`llm_tokens`, `stt_seconds`, `tts_characters`, `call_minutes`).
- `knowledge_sources`, `knowledge_documents`, `knowledge_chunks`: Document text segments vectorized using `VECTOR(1536)` for RAG cosine-similarity queries.
- `tools` & `agent_tools`: Webhook-based actions executed during calls.
- `invitations`: Pending employee invitations containing `token`, `role_id`, `company_id`, and `expires_at`.

---

## 8. Hard-Won Technical Learnings & Solved Gotchas

> **DO NOT REPEAT THESE MISTAKES.** These are documented failure modes extracted from `.agents/errors_and_learnings.md`:

1. **PostgreSQL SSL Rejections on Cloud Databases (Supabase / Render)**:
   - Node.js 18+ treats `prefer` and `require` as `verify-full`.
   - **Solution**: Always initialize `pg.Pool` with:
     ```javascript
     ssl: (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost'))
       ? false
       : { rejectUnauthorized: false }
     ```
   - On Render, cloud databases must connect via the Supabase Transaction Pooler on port **6543** (IPv4 compatible), not direct port 5432.
2. **API Gateway Proxy Crashes (`next is not a function`)**:
   - `express-http-proxy` crashes the NestJS gateway with Exit 1 if an upstream microservice fails and `proxyTo()` lacks a fallback callback.
   - **Solution**: Always provide both a `proxyErrorHandler` and an inline error callback `(err) => { if (!res.headersSent) res.status(502).json(...) }`.
3. **Render Reverse Proxy & `trust proxy`**:
   - Render forwards `X-Forwarded-For` headers. Without `expressApp.set('trust proxy', 1)`, rate limiters throw fatal validation errors.
4. **Instant Logout After Invitation Acceptance**:
   - `auth-service` tokens are RS256; gateway was hardcoded to HS256. API calls returned 401, clearing local tokens.
   - **Solution**: Dynamic algorithm checking in `auth.middleware.ts` + setting `localStorage.setItem('onboardingComplete', 'true')` during invite acceptance so users are not trapped in company onboarding loops.
5. **Raw SQL Template Literals vs JS `await`**:
   - Never embed JS async calls (`await pool.query(...)`) inside multi-statement SQL strings; PostgreSQL will fail with `syntax error at or near "await"`.

---

## 9. Environment & Deployment Configuration

The production architecture is deployed on **Render** with a **Supabase** backend:

| Service Name | Environment Type | Primary Role | Key Environment Variables |
|---|---|---|---|
| `markova-api-gateway` | Node.js (NestJS) | Public entry edge | `PORT=8000`, `AUTH_SERVICE_URL`, `SUPABASE_JWT_SECRET`, `CORS_ORIGINS` |
| `markova-auth-service` | Node.js (Express) | Auth & Workspaces | `PORT=5001`, `DATABASE_URL`, `RESEND_API_KEY`, `FRONTEND_URL` |
| `markova-orchestrator`| Python (FastAPI)  | Voice runtime | `PORT=6000`, `DATABASE_URL`, `REDIS_URL`, `GROQ_API_KEY`, `OPENAI_API_KEY` |
| `client-dashboard`    | Static / Vite SPA | SaaS Dashboard | `VITE_API_URL` (Points to gateway), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

---

## 10. Summary Checklist for Any AI Modifying This Project

When prompting or working with this codebase:
- [ ] Check `DEVELOPER_CTO_BRIEFING.md` before making architectural assumptions.
- [ ] Maintain the Playground (`ai call center/`) vs Production (`services/orchestrator/`) separation.
- [ ] Respect the Markova OS hero brand hierarchy on all workspace interfaces.
- [ ] Verify that all gateway proxies support both `RS256` and `HS256` tokens.
- [ ] Check `.agents/errors_and_learnings.md` and append any new resolved issues upon completion.
