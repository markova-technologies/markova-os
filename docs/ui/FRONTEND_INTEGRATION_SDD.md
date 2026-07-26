# Markova — Frontend Integration & Docs SDD (for Claude Code)
**Scope: frontend only. Backend is done — do not modify backend services except to report mismatches.**

## Context (read once, don't re-read repeatedly)
- Backend: complete, per `docs/ssd/IMPLEMENTATION_PLAN.md` (Phases 0–4) and `openapi.yaml` at repo root — this is the source of truth for every request/response shape.
- UI: pre-built in Lovable, dropped in as its own folder (locate it — likely `apps/client-ui-v2` or similar, confirm path first, don't assume).
- Design brief: `docs/ui/MARKOVA_UI_FULL_BRIEF.md` — token system (Signal Ink #12172B, Wire White #F5F6F3, Live Amber #E8A33D, Coral Pulse #E85C4A, Slate Wire #5B6478), signature waveform element, sandbox/live distinction, copy voice, docs-site structure. Treat this as the design contract.

## Task, in order

### A. Integration (wire Lovable UI to real backend)
1. Confirm the dropped-in UI folder location and its current API base URL / env config.
2. Point it at the real gateway (`:8000` or deployed URL) — no mock/hardcoded data paths remaining.
3. Implement auth flow against real endpoints: `/v1/auth/register`, `/v1/auth/login`, `/v1/auth/refresh`, `/v1/auth/me`. Store/refresh JWT correctly.
4. Wire every page in `MARKOVA_UI_FULL_BRIEF.md` Section 4–5 to its real endpoint (agents, calls, numbers, knowledge, tools, usage, billing, keys).
5. Sandbox/live key handling: real `environment` field from backend, not a cosmetic prefix check.
6. If UI expects a response shape the API doesn't provide: **stop, report the mismatch, don't invent a workaround.** Backend is done — mismatches likely mean UI assumption is wrong, confirm against `openapi.yaml` before changing anything.
7. CORS/env config only — do not redesign components in this step.

### B. Visual refinement (avoid generic AI-UI look)
1. Audit current UI against `MARKOVA_UI_FULL_BRIEF.md` Section 1 (tokens) and Section 1's "why not the defaults" — flag and fix any screen that drifted into cream/terracotta, near-black/neon, or hairline-broadsheet defaults.
2. Implement/verify the signature waveform element (Section 1) is one shared component reused in: top nav strip (idle/active states), agent test-call screen, usage chart. Not three separate implementations.
3. Verify sandbox vs live is a real palette shift (Slate Wire ↔ Coral Pulse), not just a badge — Section 3 of the brief.
4. Copy pass: buttons/labels/errors/empty-states match Section 2's voice rules (active voice, no "Oops!", no raw errors, name things by what the user controls).
5. Confirm mandatory consent screen exists before first knowledge upload, and the non-editable AI-disclosure line on agent config (ethics requirements — do not remove or make optional).

### C. Developer docs site (new build — this is a first-class deliverable, not an afterthought)
Build per `MARKOVA_UI_FULL_BRIEF.md` Section 8:
1. Landing/welcome — one short, specific, human-written intro paragraph (write original copy; do not reference or name any other company/product as inspiration anywhere in the site).
2. Quickstart — sandbox key → one working code sample (curl + 1 SDK language) → real result, in minutes.
3. Core concept pages: Agents, Calls, Numbers, Knowledge, Sandbox vs Live, Webhooks — short, one code sample each.
4. API Reference — generate from `openapi.yaml` directly (use a generator if available; don't hand-write what can be generated).
5. Webhooks guide with signature-verification example.
6. SDK usage pages.
7. Pricing — linked directly in docs nav.
8. Changelog — dated, plain entries.
Visual identity: same token system as dashboard, waveform used sparingly as a nav accent only (not a live element here).

## Efficiency instructions for this session
- Work in small, targeted diffs per file. Don't paste full file contents back into chat when a summary of the change suffices.
- Batch related edits (e.g., all API base URL changes) in one pass rather than one file at a time with commentary between each.
- Don't re-explain the design brief back to me — just apply it and flag deviations only.
- Report progress in short checklists, not prose paragraphs.
- If blocked or ambiguous, ask one specific question rather than generating speculative alternatives.
- Stop after each section (A, B, C) for a go-ahead before continuing to the next.

Start with Section A. Confirm UI folder location first, then proceed task-by-task.
