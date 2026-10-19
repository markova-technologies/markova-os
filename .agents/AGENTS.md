# Markova AI Call Center - Workspace AI Agent Rules & Memory Anchor

## 🚨 MANDATORY CONVERSATION INIT RULE (AUTOMATIC LOAD)
At the start of **EVERY** new session or conversation in this workspace, before taking any action or answering architectural questions, you MUST:
1. Treat `DEVELOPER_CTO_BRIEFING.md` in the project root as your absolute ground-truth source of context for the platform.
2. Recognize that this project has already evolved from `amharic-ai-call-demo` into the production multi-tenant Markova AI Call Center platform.
3. Keep the user from EVER having to repeat "pull the latest conversation history" by actively checking this briefing document before claiming lack of context.

## 🏗️ Quick Architectural Snapshot
- **Playground (Experimental AI voice logic)**: `ai call center/main_natural_voice.py`
- **Production Orchestrator**: `services/orchestrator/main.py`
- **Frontend Dashboard**: `apps/client-dashboard/` (React + Vite + Supabase Auth)
- **API Gateway**: `services/api-gateway/` (NestJS TypeScript)
- **Database & Auth**: Supabase Auth (HS256 JWT validation + Postgres database triggers for automatic user provisioning in `public.users` and `public.companies`).
- **Deployment**: Backend services deployed on Render, frontend dashboard connected via `VITE_SUPABASE_URL` and `VITE_API_URL`.

## 📋 Errors, Bugs & Learnings Log
Before starting new work, you MUST review `errors_and_learnings.md` in this directory to learn from previous mistakes and avoid repeating faults, especially performance/INP and React rendering issues.

## 📝 MANDATORY LOGGING RULE
Whenever you resolve any problem, error, bug, or failure (no matter how small), you MUST immediately append a new entry to `errors_and_learnings.md` documenting what went wrong, how it happened, and the lesson learned. Do this before concluding your response.

## 🧠 MANDATORY PERPETUAL CONVERSATION MEMORY RULE (`.agents/skills/Memory/memory.md`)
This rule is absolute, non-negotiable, and MUST be followed on **EVERY SINGLE TURN** without exception:
1. **ANALYZE AT TURN START**:
   Immediately upon receiving ANY user prompt, you MUST inspect and analyze `D:\Projects\Markova Projects\Markova Ai Call Center\.agents\skills\Memory\memory.md` to load the exact, unabridged conversation history, user directives, test states, and architectural context.
2. **STRICT APPEND AT TURN END (ZERO EXCEPTIONS)**:
   Before concluding ANY response (no matter how small, large, or routine the turn), you MUST append the exact user prompt and your full agent response to `D:\Projects\Markova Projects\Markova Ai Call Center\.agents\skills\Memory\memory.md` using the exact format:
   ```markdown
   ### Turn [N]
   #### 👤 User Prompt:
   <exact user prompt text without omissions>

   #### 🤖 Agent Response:
   <full agent response text>
   ---
   ```
3. **NEVER FORGET OR SKIP**:
   This ledger is the ultimate ground-truth conversational memory across IDE crashes, PC reboots, and session resets. Forgetting to read or append to `memory.md` is considered a critical system failure.
