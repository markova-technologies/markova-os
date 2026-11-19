# Markova OS — Platform Architecture, Technology Stack & Design System

> **Document Type:** Executive Technical Architecture & Platform Overview  
> **Audience:** Technical Leadership, Enterprise Partners, Solutions Architects, and Development Teams  
> **Security Classification:** Enterprise Public / Safe Overview *(Proprietary secrets, private API keys, and internal credentials strictly omitted)*  
> **Version:** 2.0.0 (Production Release)

---

## 1. Executive Summary

**Markova OS** is an enterprise-grade AI Workforce and Voice Call Center Operating System designed to deploy autonomous conversational agents across inbound/outbound telephony, CRM ecosystems, and enterprise digital workflows.

While conventional voice AI platforms struggle in emerging markets due to network latency, acoustic noise on mobile PSTN networks, and poor support for low-resource languages, Markova OS provides an end-to-end, sub-second conversational voice pipeline tailored for African languages—with **Amharic (Ethiopian language)** as its flagship production deployment alongside international languages.

The platform provides enterprises with:
1. **Autonomous Conversational Telephony:** Human-grade, natural-sounding voice agents capable of handling complex customer service, product ordering, appointment scheduling, and inquiries with dynamic barge-in (interruption) detection.
2. **Multi-Tenant Contact Center HUD:** A unified, real-time command center for monitoring live calls, agent interactions, sentiment metrics, and queue telemetry.
3. **No-Code / Low-Code Agent Studio:** An intuitive interface for defining agent personas, behavioral guardrails, custom voice selection, and knowledge base integration.
4. **Enterprise RAG & Integration Mesh:** Retrieval-Augmented Generation tied to business product catalogs and knowledge docs, connected to external ERPs, CRMs, and payment gateways.

---

## 2. Technology Stack

The Markova OS platform is engineered as a modern, decoupled microservices mesh combining high-performance backend engines with a responsive, obsidian-themed frontend client.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT APPLICATION LAYER                        │
│   React 18  │  Vite  │  Framer Motion  │  Lucide Icons  │  Recharts   │
│   Obsidian Dark Glassmorphism  │  Vanilla CSS Tokens  │  Tailwind     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / WSS
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       API GATEWAY & PERIMETER                          │
│   NestJS / TypeScript  │  Perimeter Auth Proxy  │  Rate Limiting       │
│   Multi-Tenant Header Routing  │  Cryptographic HMAC Verification      │
└──────────────┬────────────────────┬────────────────────┬───────────────┘
               │                    │                    │
        ┌──────▼──────┐      ┌──────▼──────┐      ┌──────▼──────┐
        │  Auth &     │      │   Tenant    │      │    Agent    │
        │  Identity   │      │   Service   │      │   Builder   │
        │  (Node.js)  │      │  (Node.js)  │      │  (Node.js)  │
        └─────────────┘      └─────────────┘      └─────────────┘
               │                    │                    │
┌──────────────▼────────────────────▼────────────────────▼───────────────┐
│                    REAL-TIME VOICE ORCHESTRATOR                        │
│   Python / FastAPI  │  Async Event Loop  │  Provider Abstraction Layer │
│   Audio Pre-conditioning  │  Linguistic Normalizer (Rust / WASM / Go)  │
│   Streaming LLM Brain     │  Neural TTS Engine  │  VAD Barge-in Engine │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    DATA PERSISTENCE & EVENT STREAMS                    │
│   PostgreSQL 15 + pgvector (Multi-tenant RLS, Embeddings, Indexes)    │
│   Redis 7 (Live Call State Machine, Pub/Sub, Telemetry Event Streams) │
│   Carrier Telephony Bridges (SIP Trunks, WebRTC, Twilio / FreeSWITCH) │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Frontend & Client Dashboard (`apps/client-dashboard`)
- **Core Framework:** React 18 with Vite for ultra-fast HMR and optimized production asset chunking.
- **Motion & Micro-interactions:** Framer Motion powering physics-based spring animations, drawer expansions, and fluid tab transitions.
- **Visual Telemetry & Data Visualization:** Recharts for responsive time-series charts, sentiment breakdowns, call duration distributions, and usage curves.
- **Iconography & Visual Assets:** Lucide React for consistent, crisp, vector-based interface controls.
- **Design System:** Custom Obsidian Glassmorphism built with CSS design tokens, offering high contrast, zero-latency rendering, and deep slate/black palettes.
- **Resilience:** React Error Boundaries isolating individual page routes, paired with bespoke zero-layout-shift Skeleton loaders across all data tables and dashboards.

### 2.2. API Gateway & Microservices Perimeter (`services/api-gateway`)
- **Framework:** NestJS (TypeScript) running behind high-performance reverse proxies.
- **Security & Perimeter:**
  - Stateless JSON Web Token (JWT) validation with tenant claim extraction.
  - Organization workspace slug routing (`/workspace/:slug`).
  - Zero-trust internal HMAC cryptographic signature headers ensuring only validated gateway traffic reaches downstream workers.
  - Per-tenant rate limiting and circuit breakers preventing noisy-neighbor degradation.

### 2.3. Voice Orchestrator & Audio Pipeline (`services/orchestrator`)
- **Framework:** Python 3.11+ asynchronous engine built on FastAPI and Uvicorn.
- **Telephony Interfaces:** Full SIP trunk integration, FreeSWITCH media server control, and WebRTC / WebSocket audio bi-directional streaming.
- **Linguistic Engine:** Custom Ethiopic Unicode normalizer (implemented in Rust/WASM and Go) handling homophone consolidation, phonetic repair, and vocabulary biasing.
- **Speech Processing Stack:**
  - **Speech-to-Text (STT):** High-speed Whisper models optimized with domain-specific lexical prompting for African place names, local businesses, and products.
  - **Conversational Brain:** Provider-agnostic LLM adapters orchestrating fast contextual responses with streaming inference.
  - **Neural Speech Synthesis (TTS):** Low-latency neural voices producing expressive, natural Amharic and multilingual output with sub-second time-to-first-byte (TTFB).
  - **Barge-in / Voice Activity Detection (VAD):** Continuous Silero VAD running over input RTP streams, immediately halting outbound TTS audio whenever the caller speaks.

### 2.4. Data Persistence & Messaging
- **Relational & Vector Database:** PostgreSQL 15 utilizing `pgvector` for semantic document embeddings, combined with composite indexes optimized for high-volume multi-tenant call telemetry.
- **Real-Time Cache & Messaging:** Redis 7 handling live call session locks, agent state machines, and pub/sub event streams that feed the frontend real-time dashboard.
- **Object Storage:** Secure media vaults for call audio recordings and customer interaction transcripts.

---

## 3. How It Works: The End-to-End Workflow

### 3.1. The 7-Step Conversational Audio Lifecycle
When a user calls an enterprise phone number provisioned on Markova OS, the conversation flows through a coordinated, low-latency audio pipeline:

```
[ Inbound Caller on Mobile PSTN / SIP ]
                   │
                   ▼
  1. Audio Conditioning & Dynamic Gating
     Filters 50/60Hz hum, trims silence, applies Automatic Gain Control (AGC).
                   │
                   ▼
  2. Acoustic Speech-to-Text (STT)
     Streams conditioned audio into high-speed STT with localized prompt biasing.
                   │
                   ▼
  3. Ethiopic Linguistic Normalizer
     Harmonizes vowel orders and consonant homophones into canonical script.
                   │
                   ▼
  4. Context Assembly & Enterprise RAG
     Queries pgvector for relevant product data, policies, and caller history.
                   │
                   ▼
  5. Fast LLM Cognitive Inference
     Generates conversational response using system guardrails and persona tone.
                   │
                   ▼
  6. Neural Speech Synthesis (TTS)
     Converts streamed text tokens into high-fidelity neural audio chunks.
                   │
                   ▼
  7. Telephony Playback & Barge-in Monitor
     Plays audio back to caller while monitoring VAD; instantly cancels if caller interrupts.
```

1. **Audio Ingestion & Conditioning:** The telephony gateway receives audio via SIP/RTP. An audio processing filter removes line noise, normalizes volume spikes, and standardizes sample rates to 16kHz mono.
2. **Biased Speech Recognition:** Audio chunks pass to the STT layer. To prevent transcription failures on local names (e.g., Ethiopian banking terms, Addis Ababa sub-cities, or company names), vocabulary bias lists are injected dynamically.
3. **Linguistic Normalization:** In Amharic, multiple Ethiopic characters produce identical phonetic sounds (e.g., three forms of 'h' and two forms of 's'). The normalization engine maps these variants into a canonical representation so downstream vector search and intent classification never miss matches.
4. **Knowledge Retrieval (RAG):** If the customer asks about specific products, balances, or store locations, the orchestrator retrieves matching chunks from the company's indexed documents via cosine similarity in `pgvector`.
5. **Streaming Reasoning:** The LLM receives the system persona prompt, relevant RAG context, and conversation history. Tokens stream back asynchronously to minimize perceived latency.
6. **Neural Voice Synthesis:** Text chunks are streamed directly into neural voice synthesizers, delivering smooth, human-like cadence and intonation.
7. **Playback & Barge-in:** The synthesized audio streams back to the caller. Concurrently, Voice Activity Detection (VAD) monitors the caller's microphone channel; if the caller speaks during playback, synthesis cancels instantly, allowing the agent to listen without talking over the user.

---

### 3.2. Dual-Environment Architecture: The Two-World Rule
Markova OS maintains a disciplined architectural separation between experimentation and production:

- **The Voice Playground (`ai call center/`):** A dedicated testing environment where telecom carrier trunking, new neural speech models, raw SIP signaling, and phonetic repair routines are tested under real-world network packet loss and jitter before deployment.
- **The Production Cloud Mesh (`services/` & `apps/`):** Clean, modular, containerized microservices adhering strictly to multi-tenancy, rate limits, enterprise security controls, and healthcheck monitors. Code only enters production once validated in the playground.

---

## 4. Design Aesthetics & User Experience (UX/UI)

Markova OS was crafted around a premium **Obsidian Dark** design philosophy, rejecting generic templates in favor of a sleek, purpose-built contact center console.

### 4.1. Visual Design Language
- **Palette:** Curated obsidian slate surfaces (`#0b0f17`, `#121722`, `#1a202c`) accented with subtle neon signals—emerald for live active agents, electric cyan for data streams, and amber for alerts.
- **Materials:** Frosted glass panels (`backdrop-filter: blur(12px)`) with subtle 1px translucent borders, giving depth and spatial structure without visual clutter.
- **Typography:** Modern geometric sans-serif (Inter & Outfit) with distinct tabular numeric formatting for call timers, financial metrics, and latency counters.
- **Micro-Animations:** Micro-spring transitions on buttons, smooth drawer expansions for deep inspection panels, and pulsing live-status badges that signal system heartbeat.

### 4.2. Zero-Layout-Shift Loading Architecture
Contact centers cannot afford jumping layouts while data loads. Every major module features custom-proportioned obsidian skeleton screens:
- **Call Center Skeletons:** Mirroring the three-column layout (active queue, conversation HUD, and metadata panel).
- **Metric Card Skeletons:** Shimmering placeholders matching real-time KPI cards.
- **Analytics & Table Skeletons:** Pre-allocated row heights and column spans preventing Cumulative Layout Shift (CLS) when network queries resolve.

---

## 5. Key Platform Modules & Functional Centers

Markova OS organizes enterprise operations into focused functional Centers:

| Center Module | Core Capabilities |
| :--- | :--- |
| **Command Center** | High-level executive overview of tenant health, total handling minutes, concurrent calls, active agents, and rapid action triggers. |
| **Call Center HUD** | Real-time supervisor console: live call waveform display, caller sentiment tracking, live transcription feed, supervisor takeover, and full call history. |
| **Agent Studio** | Visual persona builder: custom prompt instructions, voice pitch/speed modulation, knowledge base association, and instant web-based voice testing sandbox. |
| **Analytics Center** | Multi-dimensional analytics tabs: Executive summary, Agent performance metrics, Cost & token attribution, and Customer sentiment distribution. |
| **CRM & Contact Hub** | Complete customer directory: call interaction histories, sentiment trends, enterprise company accounts, deal status, and notes. |
| **Phone & Channels** | Inbound/outbound phone number provisioning, carrier SIP trunk status, channel routing rules, and multi-channel configuration. |
| **Knowledge Center** | Enterprise RAG document uploader: PDF, doc, and catalog vectorization with automatic chunking and semantic search testing. |
| **Integration Hub** | Webhook configuration, third-party ERP/CRM connectors, secure API key generation, and automated event triggers. |
| **Governance & Team** | Role-based access control (RBAC), multi-user organization invites, audit logging, and billing plan management. |

---

## 6. Enterprise Security, Privacy & Safety Guardrails

Markova OS is built with safety, privacy, and regulatory compliance as foundational requirements:

1. **Strict Multi-Tenant Isolation:**
   - Every database query is strictly partitioned by `company_id`.
   - Redis keys and cache namespaces are tenant-scoped to prevent cross-tenant data leakage.
2. **Statutory Call Recording Disclosure:**
   - Automatic pre-call audio disclosures (`"This call may be monitored or recorded for quality and security"`) are enforced at the telephony gateway level before audio recording begins.
3. **Data Protection & Secret Handling:**
   - Cryptographic hashing and salting for all stored credentials and API keys.
   - Zero-trust inter-service headers requiring HMAC signatures for internal API requests.
   - PII masking options for call transcripts and automated scrubbing of sensitive credentials.
4. **Resilient Error Containment:**
   - Independent service healthchecks across all Docker containers.
   - Graceful fallback responses in voice agents if external upstream providers experience transient latency or downtime.
   - Client-side error boundaries preventing single-route glitches from affecting the broader application session.

---

## 7. Summary & Architectural Evolution

Markova OS represents a complete transformation from an early voice prototype into an enterprise-ready digital workforce operating system. Through a robust multi-tier microservice architecture, specialized low-resource language processing, and an intuitive obsidian interface, the platform bridges the gap between state-of-the-art voice AI and the operational realities of enterprise contact centers.
