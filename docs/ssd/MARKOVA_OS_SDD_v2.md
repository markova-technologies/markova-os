# Markova OS — Software Design Document (SDD) v2
### Three-Domain Platform: The Founder · Business-with-Systems · Business-without-Systems

**Version:** 2.0
**Date:** 2026-07-25
**Supersedes:** `MARKOVA_OS_SDD.md` v1.0 — v1 is not discarded, it is **folded in as the technical foundation** for Domain 2 below. Read this as v1 + two new domains + ethics + subscription design.
**Prior artifacts:** `docs/CODEBASE_AUDIT.md` (ground truth for current code state), `MARKOVA_OS_SDD.md` v1 (API-first platform design — still the correct target for Domain 2's engineering).

---

## 0. What changed from v1

v1 assumed Markova was a single product: an API-first voice/agent platform for businesses that already have their own systems (Chapa-for-voice). That is now **Domain 2** of a three-domain company. This version adds:

- **Domain 1 — The Founder:** an agentic build-your-startup product (Polsia-style) for individuals/teams with an idea and no team or budget.
- **Domain 3 — Business-without-Systems:** same subscription product as Domain 2, plus a paid digitization/build-out engagement, for businesses that don't have an existing system to integrate against.
- **Ethical AI requirements** that apply across all three domains (Section 6) — this is a real requirement, not boilerplate, and is informed directly by a documented failure mode in the closest competitor to Domain 1.
- **A full subscription/pricing model** for Domain 2 & 3 (Section 5), with concrete tier definitions and suggested additions.

All of v1's Phase 0–4 engineering work remains the correct build order for Domain 2's core. Nothing in v1 is wasted — this document tells you what wraps around it.

---

## 1. Company Structure — Three Domains, One Platform

```
                         ┌─────────────────────────────┐
                         │        MARKOVA OS             │
                         │   (shared: auth, agents,       │
                         │   billing, knowledge, voice)    │
                         └───────┬──────────┬────────────┘
                                 │          │
        ┌────────────────────────┘          └────────────────────────┐
        │                                                             │
┌───────▼────────┐                                    ┌───────────────▼───────────────┐
│  DOMAIN 1        │                                    │  DOMAIN 2 & 3                  │
│  THE FOUNDER      │                                    │  BUSINESS API PLATFORM         │
│  (agentic          │                                    │  (Chapa-style, sandbox/live)    │
│  co-founder,        │                                    │                                 │
│  Polsia-style)       │                                    │  Domain 2: has existing system │
│                       │                                    │  Domain 3: no system — Markova │
│  For: individuals/     │                                    │  builds + digitizes it first   │
│  teams with an idea      │                                    │                                 │
│  only, no budget/team      │                                    │  Both: same subscription tiers │
└─────────────────────────┘                                    └────────────────────────────────┘
```

**Why share a platform underneath:** all three domains ultimately need the same primitives — agents, calls, knowledge/RAG, billing, usage metering. Domain 1 is these primitives pointed at *building and running a company*; Domains 2/3 are these primitives sold *as an API* to a company someone else is running. Building one shared kernel avoids the current codebase's mistake (parallel unwired service forests) recurring at the company-strategy level.

---

## 2. Domain 1 — "The Founder"

### 2.1 What it is
An agentic system that takes a business idea from an individual or small team who cannot afford a workspace, developers, or a marketing team, and builds and (optionally) runs the resulting company's early operations: planning, a working product/MVP, basic marketing, and customer support — modeled on Polsia, with deliberate corrections.

### 2.2 What we're taking from Polsia, and what we are correcting

Polsia (launched late 2025, ~$30M raised, positions itself as a 9-agent stack — orchestrator/CEO, social, email outreach, support, ads, finance, business planning, competitor research, code generation) is real and has real traction. But independent review of its public feedback found a specific, recurring failure: **it builds fast but does not validate the idea first**, and a large share of negative user feedback traces back to that single gap — spending agentic effort building something nobody asked for. Separately, its own founder has publicly described the AI misrepresenting his availability to a VC without his knowledge.

Markova's Founder product should treat these as design requirements, not case studies to observe from a distance:

| Polsia gap | Markova requirement |
|---|---|
| No validation step before building | **Mandatory validation gate** before any build agent runs: market-signal check, minimum competitor scan, and a plain-language "here's what we found, do you still want to proceed" confirmation from the founder |
| Agents can speak/act on the founder's behalf without the founder knowing what was said | **Disclosure-by-default**: any agent-initiated external communication (email, call, social post) is logged verbatim and surfaced to the founder before or immediately after send, never silently |
| No compliance/guardrail toggle for regulated spaces | **Regulated-industry gate at onboarding**: if the founder's idea touches health, finance, legal, or anything requiring licensing, the build agent restricts itself to non-regulated scaffolding and flags that a human professional is needed for the regulated parts — it does not attempt to route around this |
| High-stakes decisions (investor calls, pivots) handled autonomously by default | **Human-in-the-loop by default for high-stakes categories**: investor communication, legal commitments, pricing changes, and anything representing the founder's availability or intent requires explicit founder approval before the agent acts, not after |

### 2.3 Founder-product agent stack (initial scope)
- **Orchestrator agent** — turns the idea into a plan, checks in with the founder daily/weekly (founder-configurable cadence, not silent 24/7 autonomy by default)
- **Validation agent** — runs before build: basic market/competitor signal check, presents findings, requires founder go-ahead
- **Build agent** — scaffolds the actual product (reuses Domain 2's agent/API infrastructure where the idea itself needs voice/calling capability — natural synergy, don't duplicate)
- **Marketing agent** — drafts (not auto-publishes without opt-in) social/ad copy
- **Support agent** — handles routine customer support once the product is live, escalates to founder for anything outside a defined confidence threshold

### 2.4 Explicit non-goals for v1 of this domain
- No autonomous financial commitments (no agent-negotiated term sheets, no agent-signed contracts) — Polsia's own founder has described this going wrong; Markova should not replicate it.
- No fully autonomous multi-company fleet management at launch — start with one idea per founder account, expand later once trust and audit tooling are proven.

---

## 3. Domain 2 — Business-with-Systems (API-first platform)

This is exactly the platform designed in `MARKOVA_OS_SDD.md` v1 — architecture, data model, and Phases 0–4 all still apply. What's new here is the **onboarding flow** (below), which was previously undefined.

### 3.1 Two-phase business lifecycle

**Phase A — Onboarding (one-time per business):**

1. **Integration Agent** — an agent (not a static docs page) that walks the business's technical team through connecting Markova's API to their existing system (ERP, CRM, whatever they run). Concretely: it inspects their stated system type, generates the specific API calls/webhook config they need, and can test the connection live in sandbox mode before going live. This turns "read our API docs" into a guided, conversational setup — a real differentiator over both RingCloud and Lucy AI, neither of which offer this.
2. **Training Agent** — a guided intake flow that collects the business's own knowledge (product info, policies, FAQs, call scripts, tone/voice preference) to configure their voice/workflow agents. Critically, this is where **consent and data terms must be explicit** (see Section 6.2) — the business is told exactly what data is used to configure their agent, whether/how it may inform shared model improvements, and given a real opt-out that doesn't degrade core functionality.

**Phase B — Usage (ongoing, subscription-based):** see Section 5.

### 3.2 Engineering notes tying back to v1
- The Integration Agent should be built as a thin conversational layer over the existing `/v1/agents`, `/v1/numbers`, `/v1/knowledge` endpoints from v1 Section 4 — it is a UX layer, not a reason to add new backend services.
- The Training Agent maps directly onto the existing `/v1/knowledge/sources` + `/v1/knowledge/sources/{id}/documents` endpoints — the gap today is only the guided intake experience and the consent/ToS capture, both of which are new but small additions to the existing knowledge service, not a new domain of infrastructure.

---

## 4. Domain 3 — Business-without-Systems

Same subscription product as Domain 2 (Section 5), plus a paid, scoped **digitization engagement** before onboarding, since there's no existing system to integrate against.

### 4.1 What "digitize" means here, concretely
- Stand up a minimal system of record for the business (customer records, call/interaction history, basic workflow state) — this can reuse Markova's own tenant/agent/knowledge data model rather than building a bespoke system per client, which keeps this profitable rather than becoming a custom-dev shop.
- Once that minimal system exists, the business effectively becomes a Domain 2 customer — same Integration Agent, same Training Agent, same subscription tiers.

### 4.2 Pricing implication
This engagement is priced **separately and upfront** (project fee, not subscription) — the subscription pricing in Section 5 assumes a business's system already exists (their own, or the one Markova just built them). Don't fold digitization cost into subscription pricing; that will make Domain 2 customers' pricing model look inconsistent with Domain 3's, and undersells the actual cost of a real digitization project. Suggested structure: fixed-fee tiers based on business complexity (e.g., "single-location retail" vs "multi-branch service business") rather than open-ended hourly billing — sends a clearer signal and is easier for the sales/founder-facing team to quote consistently.

---

## 5. Subscription Tiers (Domains 2 & 3, shared)

Your proposed structure (Basic = voice-only/notify, Pro = + workflow agents/more outbound, Plus = premium/most outbound) is the right shape. Below is a fleshed-out version plus suggested additions.

| | **Basic** | **Pro** | **Plus** |
|---|---|---|---|
| Inbound voice agent | Yes | Yes | Yes |
| Call handling on inbound | Answers, transcribes, **displays intended action on dashboard only** — no execution | Answers, transcribes, **and executes** the requested workflow action | Same as Pro, higher priority/SLA |
| Outbound call minutes | Low fixed allotment | Higher allotment | Highest allotment |
| Workflow agents (act on CRM/ERP, not just report) | **Not included** | Included | Included, with priority execution queue |
| Rate basis | Birr per minute, inbound only | Birr per minute, inbound + outbound, blended or tiered rate | Birr per minute, premium rate reflecting priority infra |
| Number of concurrent agents | 1 | Up to plan limit (e.g., 3) | Higher / negotiable |
| Knowledge base size | Capped | Larger cap | Largest / negotiable |
| Support | Standard | Priority | Dedicated |

### 5.1 Suggested additions worth deciding on now, before launch

1. **Overage handling** — decide explicitly whether exceeding included minutes auto-bills at a per-minute overage rate (recommended) or hard-stops the agent (bad customer experience, avoid if possible — a hard stop mid-conversation with a customer's customer is a reputational risk).
2. **Add-on packs** rather than forcing a full tier upgrade — e.g., an "extra outbound minutes" pack purchasable within Basic, so a Basic customer with a seasonal outbound campaign doesn't have to commit to Pro's ongoing workflow-agent cost just for a temporary minutes bump.
3. **Annual vs monthly billing discount** — standard SaaS lever, worth having at launch since it improves cash flow predictability, which matters more for a young company than optimizing tier design perfectly.
4. **A visible "what would Pro do differently for this exact call" nudge on the Basic dashboard** — when a Basic customer's dashboard shows an action that wasn't executed because they're not on Pro, show them concretely what would have happened. This is a strong, honest upsell mechanism that doesn't feel manipulative because it's simply showing them the truth about the tier gap.
5. **Language-tier consideration** — Amharic-only might be Basic-tier-inclusive, while Afaan Oromo/Tigrinya/Swahili support could reasonably be a Pro/Plus differentiator if quality/training cost differs meaningfully across languages — worth confirming based on actual model performance before locking this in.
6. **A published, public pricing page in birr** (per-minute + per-agent add-ons) — this remains your core Chapa-style differentiator versus both RingCloud (per-seat only) and Lucy AI (no public pricing at all). Don't let Domain 1 or 3's more bespoke/project-based pricing bleed into muddying this clarity for Domain 2.
7. **A free/sandbox tier with no card required** for developers to try the API before subscribing — mirrors both Chapa's and (per its own marketing) Polsia's "no credit card to start" pattern, and is close to costless for you since sandbox mode per v1 doesn't touch real telephony spend.

---

## 6. Ethical AI Requirements (applies across all three domains)

This section is not boilerplate — it responds directly to documented failure patterns in the closest comparable products and is a real engineering/policy requirement, not marketing copy.

### 6.1 Disclosure in live voice interactions
Every inbound/outbound call handled by a Markova voice agent must **clearly identify itself as an AI agent** to the person on the other end of the call, early in the interaction, in the caller's language. This is both an ethical baseline and, in many jurisdictions, becoming a legal requirement for AI voice calling — build it in as a default agent behavior, not an optional toggle a business can turn off to seem more human.

### 6.2 Data used to train/configure agents (Training Agent, Section 3.1)
- Businesses must be shown, in plain language and in their own language, exactly what data they're providing and how it will be used: (a) to configure their own agent only, versus (b) potentially informing shared model improvements across tenants.
- If (b) is ever offered, it must be **opt-in, not opt-out**, and declining it must not degrade the business's own agent's core functionality.
- No cross-tenant data leakage: one business's proprietary knowledge base must never surface in another business's agent responses — this needs to be a hard architectural guarantee (tenant-scoped RAG, verified by test), not a policy statement alone, especially since the current codebase's knowledge/embedding pipeline is still mocked per the audit and needs to be built with this isolation as a first-class requirement, not retrofitted later.

### 6.3 Human-in-the-loop for high-stakes actions (all domains, especially Domain 1)
As detailed in Section 2.2 — investor communications, legal/financial commitments, pricing changes, and anything representing a founder's or business's availability/intent to a third party requires human approval before an agent acts autonomously. This is the single most important lesson available from the closest competitor's public track record, and should be treated as a hard product constraint, not a "phase 2" nice-to-have.

### 6.4 Workflow agents acting on real business systems (Domain 2/3 Pro & Plus tiers)
Once a workflow agent can actually execute an action in a customer's ERP/CRM (not just report it, per the Basic/Pro distinction in Section 5), that action needs:
- An audit log entry, immutable, tied to the specific call/interaction that triggered it (the existing `audit_logs` table with delete-blocking trigger from v1's schema is the right foundation — extend it to cover workflow-agent actions specifically).
- A defined confidence threshold below which the agent proposes the action for human approval rather than executing it automatically — this threshold should be tenant-configurable, since risk tolerance will vary by business and by action type (e.g., "update customer address" vs "issue a refund" should not share the same threshold).

### 6.5 Vulnerable-caller handling
Voice agents handling inbound calls (Domains 2/3) should have a defined, tested fallback for callers in evident distress (medical emergency, expressed self-harm risk, or similar) — a hard rule to immediately route to a human or provide emergency guidance rather than continuing a scripted workflow. This should be built and tested before general availability, not treated as an edge case to patch later.

### 6.6 Truthful marketing
Given that Polsia's own review coverage flags a significant gap between "runs your company autonomously" marketing and "still requires human review for most consequential decisions" reality, Markova's own marketing for Domain 1 in particular should be careful not to overstate autonomy in ways that set customers up for the same disappointment — describe what's actually automated versus what still requires the founder's approval, plainly.

---

## 7. Relationship to v1's Engineering Phases

No change to v1 Phases 0–4 (Domain 2's technical build order) — they remain correct and should proceed as planned. This document adds:

- **A new Phase, run in parallel with v1 Phase 2–3:** build the Integration Agent and Training Agent conversational layers described in Section 3.1, and the consent/data-terms capture described in Section 6.2. These depend on the same `/v1/agents` and `/v1/knowledge` endpoints v1 Phase 2 is already building, so they should be staffed as a parallel workstream, not sequenced after Domain 2 is "done."
- **Domain 1 (The Founder) and Domain 3's digitization engagement are new product lines**, not extensions of v1's phases — recommend treating them as separate roadmap tracks that consume the same underlying agent/knowledge/billing kernel once Domain 2's Phase 2 (the real API contract) is stable, rather than starting them before that foundation exists. Building Domain 1 on top of today's broken/unwired API surface would just reproduce the current codebase's core problem in a new place.

---

## 8. Open Decisions to Flag for the Team

1. Whether Domain 1 (The Founder) launches as its own branded product or under the Markova name — Polsia's model suggests strong standalone brand identity matters for this kind of product; worth a deliberate choice rather than defaulting to "same brand, new page."
2. Confidence-threshold defaults for workflow-agent autonomous execution (Section 6.4) — needs input from whoever owns risk/compliance, not just engineering.
3. Whether shared model improvement from tenant training data (Section 6.2) is offered at all in v1 — simplest and lowest-risk starting position is **not to offer it at launch**, and revisit once you have enough tenants that the value case is clear and the isolation guarantees are proven in production.
4. Confirm Domain 3's digitization pricing model (Section 4.2) with real cost data from your first 2–3 pilot customers before publishing fixed tiers — don't publish speculative fixed pricing for a services engagement before you've actually run one.
