# Markova AI Call Center — Master Development Plan

## Overview

This repo contains two distinct environments that work **together** toward one goal:
building the most accurate, natural, low-latency Amharic AI voice agent on the market,
packaged as a production-grade multi-tenant SaaS platform.

---

## The Two-Environment Strategy

### 🧪 Environment 1 — The Playground (`ai call center/`)

> **Purpose:** A live, runnable test bench where we perfect the AI pipeline without
> risk of breaking the production architecture.

This is the original Amharic AI demo — a **single-file FastAPI Python app**
(`main_natural_voice.py`) that handles the full voice loop:

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

**Rules for the Playground:**
- All experimental changes happen here first.
- This environment runs locally against real Twilio/FreeSWITCH.
- No changes go to the production services until they are **proven and stable** here.
- Keep the `.venv` and `.env` local — never commit real secrets.

---

### 🏭 Environment 2 — Production Architecture (`services/`, `apps/`, `workers/`)

> **Purpose:** The full multi-tenant microservices platform. This is what will ship
> to real customers.

The core runtime is `services/orchestrator/main.py`. It is the **production version**
of the playground's `main_natural_voice.py` — provider-agnostic, multi-tenant,
backed by PostgreSQL + Redis, and deployed via Docker.

**Rule:** The orchestrator only receives **battle-tested** code that was first
proven in the playground. We never experiment directly in the orchestrator.

---

## Playground Improvement Goals

These are the things we want to perfect in `ai call center/` before promotion.
Each one will be tracked as a task.

### 1. STT Pipeline
- [ ] Evaluate and tune Whisper prompt engineering for better Amharic word recall
- [ ] Test Groq `whisper-large-v3` vs `whisper-large-v3-turbo` accuracy trade-off
- [ ] Improve audio pre-processing chain (noise gate, AGC, silence trimming)
- [ ] Tune garbage detection thresholds to reduce false positives on short valid phrases
- [ ] Evaluate Deepgram Nova-2 for Amharic as an alternative STT

### 2. LLM & Prompt Engineering
- [ ] Refine the core system prompt for Almaz (tone, brevity, Amharic-first)
- [ ] Add phonetic repair fine-tuning examples to the repair prompt
- [ ] Test Gemini Flash vs Groq LLaMA 3.3 70B for Amharic response quality
- [ ] Evaluate Gemini Flash TTS for native Amharic voice quality
- [ ] Add hard stop / guardrail for off-topic questions

### 3. RAG (Knowledge Base)
- [ ] Expand `knowledge_base.json` with more GM Furniture product variants
- [ ] Test vector-based RAG (pgvector / ChromaDB) as replacement for keyword matching
- [ ] Add confidence scoring so weak KB matches are flagged to LLM as "uncertain"
- [ ] Build a tool to hot-reload the KB without restarting the server

### 4. TTS Pipeline
- [ ] A/B test Edge TTS `am-ET-MekdesNeural` vs `am-ET-AmehaNeural` for naturalness
- [ ] Evaluate Gemini Flash TTS for Amharic
- [ ] Tune sentence-splitting logic in `/stream-response` for better prosody
- [ ] Add SSML pauses at punctuation to improve naturalness
- [ ] Cache TTS outputs by MD5 hash to eliminate repeat synthesis latency

### 5. Barge-In & Latency
- [ ] Profile end-to-end latency per turn (STT + LLM + TTS)
- [ ] Reduce time-to-first-audio by parallelizing LLM generation and TTS synthesis
- [ ] Test VMD sensitivity tuning in FreeSWITCH for faster barge-in detection
- [ ] Evaluate streaming LLM output → streaming TTS for sub-500ms first-audio

### 6. Robustness & Edge Cases
- [ ] Handle very long user utterances gracefully (truncate + acknowledge)
- [ ] Add a max-retries circuit breaker (after 3 garbage inputs, transfer to human)
- [ ] Improve handling of mixed Amharic+English phone conversations
- [ ] Add timeout handling when STT/LLM/TTS providers are slow or down

---

## Promotion Checklist

When a feature is proven in the playground, use this checklist to promote it to
`services/orchestrator/main.py`:

```
[ ] Feature is stable with zero regressions in the playground
[ ] Code is refactored to be multi-tenant (uses agent config from DB, not hardcoded)
[ ] Provider credentials come from provider_configs DB table (not .env only)
[ ] Error handling is robust (no silent failures in async paths)
[ ] Usage tracking is wired (tokens, STT seconds, TTS chars → usage_metrics)
[ ] Unit test or verification script is written
[ ] CHANGELOG.md in the orchestrator is updated
```

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
| Vector RAG (pgvector) | ❌ Not yet | ❌ Not yet |
| Gemini Flash TTS | ❌ To evaluate | ❌ Not yet |
| Call recording | ✅ Basic | ❌ Not in orchestrator |

---

## Next Steps (Immediate)

> User will define the next step. Candidates:

1. **Evaluate Gemini Flash TTS** in the playground — is the Amharic quality better than Edge TTS?
2. **Port direct Whisper STT** — add a `/handle-input-audio` endpoint to orchestrator that accepts raw audio and uses Whisper directly instead of Twilio Gather
3. **Wire RAG into the orchestrator** — inject knowledge context into the LLM prompt on every turn
4. **Improve playground latency** — profile and optimize the full pipeline

---

*This plan is the source of truth for development priorities.
Update it as features are completed and new goals are identified.*
