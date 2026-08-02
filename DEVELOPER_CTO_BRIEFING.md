# Markova AI Call Center — Full Builder Briefing

> For a New Developer or CTO — Written As If You Built It

---

## The One-Line Mission

Build the most accurate, natural, low-latency Amharic (Ethiopian language) AI voice agent on the market, packaged as a production-grade, multi-tenant SaaS call center platform that Ethiopian businesses can subscribe to and deploy without touching a line of code.

---

## Mental Model: The Two-World Strategy

This repo has a deliberate dual-environment architecture that is the key to understanding everything:

```
d:\Projects\Markova Projects\Markova Ai Call Center\
|
+-- ai call center/           <- PLAYGROUND (Experiment here first)
|   +-- main_natural_voice.py   (The real, running, proven Amharic AI)
|
+-- services/orchestrator/    <- PRODUCTION (Only battle-tested code lands here)
|   +-- main.py
|
+-- services/api-gateway/     <- Gateway (NestJS/Node -- routes all traffic)
+-- services/auth-service/    <- Auth (Node.js/Express -- JWT)
+-- services/tenant-service/  <- Tenant mgmt
+-- services/agent-builder/   <- Agent config CRUD
+-- services/tool-engine/     <- Webhook tool executor
+-- services/connector-hub/   <- External integration connectors
+-- services/knowledge-service/ <- RAG/KB document store
|
+-- apps/client-dashboard/    <- Tenant-facing React UI (Vite)
+-- apps/admin-dashboard/     <- Super-admin React UI (Vite + Tailwind)
|
+-- workers/                  <- Background async workers
+-- kernel/                   <- Shared AI adapter layer (Node)
+-- packages/                 <- Shared npm packages
+-- infrastructure/postgres/  <- PostgreSQL schema
+-- docker-compose.yml        <- Full stack orchestration
```

Rule 1: Features are proven in `ai call center/` first. Once stable, they are promoted to `services/orchestrator/main.py`. Never experiment in production.

---

## The Core Product: Almaz -- The Amharic AI Voice Agent

The original system was built for GM Furniture (Ethiopian furniture company). The AI agent is named Almaz, a female Amharic-speaking customer service agent.

### What Almaz Does on a Real Phone Call

```
Ethiopian Customer Dials Number
  |
  v
[Twilio / FreeSWITCH SIP]  <- Carrier-level telephony
  |
  v
[Audio Pre-processing -- ffmpeg]  <- Noise gate, AGC, silence trim
  |
  v
[STT -- Groq Whisper-large-v3 / OpenAI Whisper]
  + Amharic-specific prompt engineering
  + Ethiopian product/place vocabulary biasing
  |
  v
[Garbage Detection]  <- Is this real speech or hallucination?
  + Unicode char analysis (Amharic 0x1200-0x139F)
  + Detects Georgian, Thai, Cyrillic, Arabic (wrong scripts)
  + Detects repetitive chars, YouTube hallucinations
  |
  v (if garbage -> polite retry in Amharic)
  |
  v
[Amharic Normalizer]  <- Homophone character mapping (30+ mappings)
  |
  v
[LLM Phonetic Repair -- Groq llama-3.1-8b-instant, 5s timeout]
  |
  v
[RAG Knowledge Base]  <- GM Furniture product catalog (JSON)
  |
  v
[LLM Response -- Groq LLaMA 3.3 70B / Gemini Flash / OpenAI GPT-4o-mini]
  + System prompt: Almaz persona, Amharic-first, brief answers
  |
  v
[TTS -- Edge TTS (am-ET-MekdesNeural)]
  + Fallback chain: Edge TTS -> Google TTS -> OpenAI TTS -> Twilio
  + MD5 hash caching: same text = same file, no re-synthesis
  + ffmpeg converts to 16kHz WAV for telephony compatibility
  |
  v
[TwiML Response]  <- Play URL + Gather for next speech input
  |
  v
Customer hears natural Amharic voice, barge-in supported
```

---

## Detailed File Map

### Playground: ai call center/

| File | Role |
|------|------|
| main_natural_voice.py | The entire 3000+ line monolith. THE source of truth for Amharic AI logic |
| barge_in_manager.py | FreeSWITCH ESL + VMD barge-in detection |
| database.py | SQLite route manager, health monitor, call logs |
| knowledge_base.json | GM Furniture product catalog (~800 lines, prices in Birr) |
| freeswitch_config/ | FreeSWITCH XML dialplan + gateway configs |
| external.xml/public.xml/default.xml | FreeSWITCH dialplan files |
| install_freeswitch.sh | Auto-installer for Ubuntu 22.04 |
| setup_firewall.sh | UFW rules for SIP (5060) and RTP (10000-20000) |
| system.db | SQLite: route state, health, failover events |
| IMPLEMENTATION_PLAN.md | 2326-line SIP bridge + Twilio failover plan |
| CHANGELOG.md | Full dev history Phase 1-8 |
| test_stt_comparison.py | WER benchmark harness: ElevenLabs/Gladia/Groq |
| test_form.html | Browser test interface (no real call needed) |

### Production Orchestrator: services/orchestrator/main.py

1182-line FastAPI app (Python). Key design decisions:
- Multi-tenant by database -- phone_number -> agent -> company lookup
- Provider-agnostic adapters -- LLM/STT/TTS each pick adapter by string
- Per-company API key storage in provider_configs table (JSONB)
- Redis for conversation state: call:{CallSid}:state with 1hr TTL
- Redis Stream markova_events for call.started / call.ended events
- Redis Pub/Sub logs:{company_id} -> WebSocket broadcast

Production call flow:
1. POST /incoming-call -- Twilio inbound call webhook
2. DB lookup: phone_numbers -> agents for this company
3. Create calls record in PostgreSQL
4. Save state in Redis, publish call.started event
5. Serve welcome audio (TTS cached WAV) via Play TwiML
6. POST /twilio/respond -- Twilio sends SpeechResult
7. Normalize Amharic -> garbage check -> phonetic repair
8. Call LLM with full conversation history
9. Save transcript, track usage metrics
10. Synthesize TTS, cache audio, return Play TwiML
11. On goodbye or >20 turns -> Hangup, end call record

Internal API (for dashboard):
- GET /api/calls -- list calls (header: x-company-id)
- GET /api/calls/{id}/transcript -- full transcript
- GET /api/stats -- totals: calls, tokens, minutes
- WS /ws/flow-monitor/{company_id} -- real-time log stream

### Auth Service: services/auth-service/server.js

Node.js/Express on port 5001.
- POST /api/auth/register -- atomic: company + user + seed data + audit log
- POST /api/auth/login -- bcrypt verify + JWT sign (24hr)
- POST /api/auth/verify-token -- validates JWT for API Gateway

### API Gateway: services/api-gateway/src/

NestJS TypeScript on port 8000. Single entry point for all frontend requests.
Validates JWT via auth-service, routes to internal services.

---

## Database Schema: infrastructure/postgres/schema.sql

PostgreSQL 15 with pgvector extension.

| Table | Purpose |
|-------|---------|
| companies | Multi-tenant root entity |
| users | Per-company users with RBAC roles |
| agents | AI agents: prompt, voice_provider, voice_id, model_provider, model_id |
| agent_versions | Full version history for rollback |
| phone_numbers | Maps numbers to agents |
| provider_configs | Per-company API keys (JSONB -- needs encryption) |
| calls | Call records: start_time, end_time, turn_count, status |
| transcripts | Turn-by-turn conversation logs |
| usage_metrics | llm_tokens, stt_seconds, tts_characters, call_minutes |
| knowledge_sources | RAG data sources (upload, website, notion, sheets) |
| knowledge_documents | Uploaded files |
| knowledge_chunks | Text chunks with VECTOR(1536) for pgvector RAG |
| tools | Webhook-based agent actions |
| agent_tools | Many-to-many: agent <-> tools |
| integrations | Google Sheets, Excel, n8n, Telegram, WhatsApp configs |
| teams | Multi-agent groups (Commander pattern) |
| crm_contacts/leads/opportunities/appointments | Built-in CRM |
| memory_entries | Key-value persistent memory per entity |
| policies | Guardrail rules (JSONB) |
| audit_logs | Every destructive action logged |
| events | Persisted Redis Stream event log |
| subscriptions | Billing state |

Note: schema.sql has duplicate table definitions (tables appear twice). This needs a dedup migration.

---

## Client Dashboard: apps/client-dashboard/

React + Vite (port 5173). Tenant-facing UI.

Pages:
- AgentStudio -- Create/edit AI agents
- FlowBuilder -- Visual node-based conversation flow designer
- PhoneChannels -- Configure Twilio numbers, link to agents
- KnowledgeCenter -- Upload PDFs/URLs to knowledge base
- IntegrationHub -- Connect Google Sheets, Excel, n8n, Telegram
- CallCenter -- Live call monitoring
- CommandCenter -- Multi-agent team management
- AnalyticsCenter -- Charts, usage metrics, call trends
- CRM -- Contacts, leads, opportunities, appointments
- OnboardingCenter -- First-time setup wizard
- Settings -- Company profile, team, billing, API keys

Components: Header, Sidebar, OnboardingModal, AmharicVoiceAgent, ErrorBoundary

---

## Admin Dashboard: apps/admin-dashboard/

React + Vite + Tailwind CSS. Super-admin UI (Markova team only).
Manages all companies, platform health, audit logs, global billing.

---

## Workers: workers/

| Worker | Role |
|--------|------|
| connector-worker | Queued connector sync jobs |
| embedding-worker | Vector embeddings for knowledge chunks |
| event-processor | Redis Streams -> events table |
| reporting-worker | Async analytics report generation |
| rpa-agent | Robotic Process Automation tasks |
| sync-worker | Cron-based external data sync |

---

## Kernel: kernel/

Shared adapter layer used by Node.js services:
- kernel/ai/ -- LLMAdapter, STTAdapter, TTSAdapter
- kernel/channel/ -- voice, chat channel abstractions
- kernel/connector/ -- external integration connectors
- kernel/memory/ -- memory management
- kernel/tool/ -- tool execution
- kernel/workflow/ -- workflow runtime
- kernel/policy/ -- policy enforcement
- kernel/events/ -- event bus helpers

---

## Infrastructure and Deployment

### Docker Compose Stack

| Service | Port | Stack |
|---------|------|-------|
| postgres | 5432 | postgres:15-alpine |
| redis | 6379 | redis:7-alpine |
| auth-service | 5001 | Node.js |
| tenant-service | 5002 | Node.js |
| agent-builder | 5003 | Node.js |
| tool-engine | 5004 | Node.js |
| connector-hub | 5005 | Node.js |
| knowledge-service | 5006 | Node.js |
| orchestrator | 6000 | Python/FastAPI |
| api-gateway | 8000 | NestJS |
| workers (4) | -- | Node.js |

Start: docker-compose up (or npm run dev from root)

---

## Telephony Architecture

### Plan A (Primary): Ethio Telecom -> FreeSWITCH

Ethiopian Caller -> Ethio Telecom SIP Trunk -> FreeSWITCH (VPS in Ethiopia)
  -> mod_curl HTTP POST -> FastAPI -> Almaz AI

Cost: ~$20-40/month (VPS only, FreeSWITCH is free/MPL 2.0)

### Plan B (Fallback): Twilio SIP Domain

Ethiopian Caller -> Ethio Telecom -> Twilio SIP Domain (cloud) -> FastAPI -> Almaz AI

Failover detection: HealthMonitor pings FreeSWITCH. On failure, RouteManager switches,
AlertManager sends email to 2 admins via aiosmtplib.
Manual failover: POST /api/dashboard/failover

### Barge-In

barge_in_manager.py uses FreeSWITCH ESL. Listens for DETECTED_SPEECH events from VMD.
When caller speaks mid-playback, kills audio and processes new speech.
Twilio path: no barge-in support.

---

## AI Provider Strategy

### LLM Providers
1. Groq (llama-3.3-70b-versatile) -- Primary, ultra-fast
2. OpenAI (gpt-4o-mini) -- Fallback
3. Gemini Flash (gemini-1.5-flash) -- Being evaluated

Phonetic repair: llama-3.1-8b-instant on Groq (5s timeout, used every turn)

### STT Providers (being benchmarked)
1. Groq Whisper (whisper-large-v3-turbo) -- Current default
2. OpenAI Whisper (whisper-1) -- Comparable
3. ElevenLabs Scribe -- Being benchmarked
4. Gladia -- Being benchmarked
5. Deepgram Nova-2 -- Being evaluated

Whisper needs carefully engineered Amharic prompts with product/place vocabulary.

### TTS Providers (cascade fallback)
1. Edge TTS (am-ET-MekdesNeural / am-ET-AmehaNeural) -- Free, primary
2. Google Translate TTS -- Free fallback
3. OpenAI TTS (tts-1) -- Quality fallback
4. Azure Speech (am-ET-MekdesNeural) -- Premium fallback
5. ElevenLabs (multilingual v2) -- Non-Amharic premium

Caching: MD5({provider}_{voice_id}_{text}) -> filename. Zero re-synthesis for repeated text.

---

## Amharic-Specific Engineering (The Hard Problems)

### 1. Homophone Normalization
Ethiopian script has multiple glyphs for identical sounds.
30+ character mappings applied before all text comparisons and KB lookups.

### 2. Garbage/Hallucination Detection
Whisper hallucinates on Amharic silence -- outputs Georgian, Arabic, Thai, CJK.
Custom detector checks: wrong Unicode scripts, 4+ repeated chars,
YouTube phrases (subscribe/thank you for watching), >70% numeric words.

### 3. Polite Retry System
6 rotating Amharic apology phrases when garbage detected.

### 4. STT Prompt Engineering
Whisper prompted with: furniture vocabulary (sofa, bed, wardrobe in Amharic),
Ethiopian place names (Bole, Piassa, Qera), price terms (Birr, payment),
mixed Amharic+English phrases (how much, discount, delivery free?).

---

## Current Development Status

| Feature | Playground | Orchestrator |
|---------|------------|--------------|
| Twilio inbound webhook | DONE | DONE |
| Audio pre-processing (ffmpeg) | DONE | NOT PORTED |
| Whisper STT (file upload) | DONE | NOT PORTED (uses Twilio Gather) |
| Garbage detection | DONE | DONE |
| Amharic normalization | DONE | DONE |
| LLM phonetic repair | DONE | DONE |
| RAG knowledge base | DONE (keyword) | NOT WIRED |
| TTS multi-provider fallback | DONE | DONE |
| TTS audio caching (MD5) | DONE | DONE |
| Barge-in (ESL/VMD) | DONE | N/A (Twilio only) |
| Sentence-by-sentence streaming | DONE | NOT PORTED |
| FreeSWITCH SIP bridge | Config ready | N/A |
| Dashboard (React UI) | N/A | DONE |
| Auth service (JWT) | N/A | DONE |
| Docker multi-service | N/A | DONE |
| WebSocket flow monitor | N/A | DONE |
| Vector RAG (pgvector) | PLANNED | Schema ready |
| Tool engine integration | PLANNED | Service ready |
| STT comparison benchmark | IN PROGRESS | N/A |

Active work (July 2026):
- STT benchmarking: test_stt_comparison.py comparing ElevenLabs/Gladia/Groq WER
- Git sync: ai call center/ folder added to GitHub repo

---

## Known Issues and Technical Debt

1. provider_configs stores API keys as plain JSONB -- needs AES-256 encryption
2. Orchestrator uses Twilio Gather STT (not Whisper) -- major Amharic quality gap
3. RAG knowledge base not wired into orchestrator LLM calls
4. schema.sql has duplicate table definitions for 17+ tables -- needs dedup migration
5. /app/audio/ TTS cache grows indefinitely -- needs cron cleanup
6. Barge-in only works on FreeSWITCH path, not Twilio path
7. Sentence-by-sentence streaming not ported to orchestrator (increases perceived latency)

---

## Promotion Checklist (playground -> orchestrator)

- [ ] Feature stable with zero regressions in playground
- [ ] Code refactored for multi-tenancy (no hardcoded company IDs)
- [ ] Credentials from provider_configs DB (not just .env)
- [ ] Robust error handling (no silent async failures)
- [ ] Usage tracking wired (tokens/STT/TTS -> usage_metrics)
- [ ] Unit test written
- [ ] CHANGELOG.md updated

---

## Next Immediate Steps (from PLAN.md)

1. Wire RAG into orchestrator -- inject knowledge context into LLM prompt every turn
2. Port direct Whisper STT -- /handle-input-audio endpoint (raw WAV -> Whisper)
3. Evaluate Gemini Flash TTS for Amharic quality vs Edge TTS
4. Port audio pre-processing (ffmpeg noise gate/AGC) into orchestrator
5. Profile and optimize playground latency (LLM + TTS parallelism)
6. Choose STT winner from benchmark results

---

## How to Run

### Full Docker Stack (Production)
docker-compose up
Access: API Gateway :8000, Orchestrator :6000, Auth :5001

### Playground (Amharic AI only)
cd "ai call center"
activate.bat
run_app.bat
# + ngrok for Twilio webhook

### Client Dashboard (dev)
npm run dev:client  -> http://localhost:5173

---

## Business Context

What Markova is selling:
White-label SaaS where Ethiopian businesses (banks, retail, hospitals) can:
1. Sign up -> get company account
2. Create AI agent with custom persona and knowledge base
3. Link to phone number (Twilio or Ethio Telecom direct)
4. Callers hear Almaz in Amharic, get intelligent responses
5. Business sees logs, transcripts, analytics in dashboard

Why it is technically hard:
- Amharic is massively underserved by AI
- Ethiopian telephony requires custom SIP bridge work
- Real-time voice AI needs <500ms first-audio latency
- Ethiopic script homophone complexity makes STT messy

Why it is a strong market position:
- First mover in Amharic AI voice agents
- Direct Ethio Telecom SIP = lower cost than pure Twilio
- Multi-tenant SaaS = scalable and defensible

---

## Conversation History Summary

The AI assistant (Antigravity) has been primary co-developer across all sessions.

July 24, 2026 (Session 1 -- 02:15 AM):
- Developer asked AI to pull project history and understand fully
- Git sync: synced ai call center/ folder to GitHub (was missing)
- Added gitignore for secrets and venv

July 24, 2026 (Session 2 -- 03:xx-06:xx AM):
- Deep dive into full parent folder architecture
- Developer shared STT research (ElevenLabs Scribe, Gladia, Groq)
- AI built test_stt_comparison.py -- WER benchmark harness
- Developer set up API keys and ran benchmark

Earlier sessions (June 2026 -- pre-architecture):
- Original ai call center/ was at C:\Users\zelal\OneDrive\Documents\Try\amharic-ai-call-demo\
- CHANGELOG Phase 1-8: basic Twilio -> natural Amharic TTS -> FreeSWITCH SIP bridge
- FreeSWITCH chosen over Asterisk (better HTTP/webhook, lower latency, modern SIP)
- SQLite added for route management and health monitoring

---

## Key File Reference

| File | Description |
|------|-------------|
| PLAN.md | Master dev plan + feature tracker |
| docker-compose.yml | Full stack orchestration |
| infrastructure/postgres/schema.sql | Complete PostgreSQL schema |
| services/orchestrator/main.py | Production voice AI engine (1182 lines) |
| ai call center/main_natural_voice.py | Playground Amharic AI (3000+ lines) |
| ai call center/CHANGELOG.md | Full dev history Phase 1-8 |
| ai call center/IMPLEMENTATION_PLAN.md | 2326-line SIP bridge plan |
| services/auth-service/server.js | JWT auth + multi-tenant registration |
| apps/client-dashboard/src/pages/ | All tenant dashboard pages |
| ai call center/barge_in_manager.py | FreeSWITCH ESL barge-in |
| ai call center/knowledge_base.json | GM Furniture RAG catalog |

August 1, 2026 (Session 3 & 4 -- Supabase Auth Migration & Render Deployment):
- Integrated native Supabase Auth across Frontend Dashboard and Backend API Gateway (HS256 secret verification).
- Configured PostgreSQL database provisioning triggers (`handle_new_user()`) to automatically create records in `public.companies` and `public.users` upon registration.
- Resolved Render deployment build failures around SQLite-to-PostgreSQL syntax translation in `ai call center/commerce.py` (`.executescript()` and `.executemany(...)`).
- Fully verified database tables dynamically deployed and created in cloud Supabase without errors.
- Added workspace automation rule `.agents/AGENTS.md` to permanently anchor conversation context to the IDE so history never gets lost.

August 2, 2026 (Session 5 — Context Anchor & Permanent Memory Setup):
- Developer requested permanent conversation history be tied to the "markova ai call center" workspace.
- AI read full `DEVELOPER_CTO_BRIEFING.md` and `.agents/AGENTS.md` to load all context.
- Created a persistent Knowledge Item (`markova_ai_call_center_context`) in the global KI store to auto-surface this briefing at every session start.
- Updated this briefing log to include this session entry.
- Active context: Supabase Auth integrated, Render deployment live, schema.sql dedup migration still pending, RAG not yet wired into orchestrator.

August 2, 2026 (Session 6 — Conversation History Tag Investigation):
- Developer noticed the conversation history panel did NOT show the "Markova Ai Call Center" folder tag next to the current conversation (unlike other conversations which correctly show their project folder).
- Root cause investigated: The workspace folder tag in the IDE history panel is stored as a binary protobuf field (Field 1 of trajectory_metadata_blob in the conversation's SQLite .db file). This field is set automatically when a conversation is FIRST STARTED from within an open workspace.
- The current conversation (b642e5d2) was started before the workspace was properly associated, so Field 1 has a complex nested structure with git repo data but the IDE cannot parse a clean label from it.
- Fix: Close this conversation → reopen Markova Ai Call Center folder fresh in IDE → start a NEW conversation (which will correctly auto-tag to the folder) → load context from this briefing.
- This session ends here. Next session (Session 7) should start fresh with the folder properly open.

Last updated: August 2, 2026
Generated from: full codebase walkthrough + conversation history analysis + Supabase migration logs + session 6 investigation

