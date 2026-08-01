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
