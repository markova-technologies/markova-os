# Markova — Full UI & Developer Docs Brief (Final, Consolidated)
### Domain 2 Only — API-First Business Voice/Workflow-Agent Platform
### Inspired by chapa.co's developer experience, given a visual identity of its own

**For:** Lovable build
**Replaces:** `MARKOVA_UI_SPEC.md` and `MARKOVA_UI_DESIGN_BRIEF_v2.md` — this single file is now the authoritative build brief. Everything from both prior documents is folded in here.

---

## 0. What this product actually is, and who it's for

Markova is the API a technical or semi-technical person at an Ethiopian SME reaches for to add an AI voice agent to a phone line they already run — sandbox-tested, transparently priced, in Amharic. The audience is dual: a **developer/technical setup person** wiring the API in, and a **business owner/manager** who lives in the dashboard day-to-day watching calls happen and results roll in. The product has to satisfy both without feeling split in two — Chapa manages this by keeping its main dashboard warm and simple while giving developers a genuinely excellent, separate docs experience. Do the same here.

**What we're taking from chapa.co, specifically:**
- A developer docs site that feels personally written, not auto-generated — Chapa's own docs open with *"Selam! This is Chapa's Developer Documentation. Master the art of building payment methods here, with Chapa's API."* That's warm, specific, and locally grounded, in a product category (payments infra) that most companies write about in the coldest possible language. Markova's docs should have the same quality: technically excellent *and* recognizably written by people, not a template.
- A quickstart that gets a developer to their first successful API call in minutes, not after reading five pages of concepts first.
- Transparent, public pricing sitting right next to the docs — no wall between "read about the product" and "see what it costs."

---

## 1. Visual Identity

### The core idea
Markova's subject is a phone call happening between a business and its customer, mediated by an AI that's usually invisible until it needs to act. That's where the visual identity comes from — not from generic "AI dashboard" defaults (warm cream/terracotta, near-black/neon-green, or hairline-broadsheet layouts, which are the three looks most AI-generated products cluster around regardless of what they actually do).

**Signature element:** a live waveform/pulse line, used consistently across the whole product — idle in quiet states ("something is listening"), active during a real call ("something is happening"), and reused as the visual grammar for the usage/billing chart ("here's what that activity added up to"). One motif, three jobs, so it becomes recognizably *Markova's* the way a heartbeat monitor is recognizably a hospital's.

### Color — 5 named values

| Name | Hex | Use |
|---|---|---|
| **Signal Ink** | `#12172B` | Primary dark background — deep navy-ink, not pure black or warm cream. Reads as "always-on operations center." |
| **Wire White** | `#F5F6F3` | Primary text on dark; background for light-surface cards/panels |
| **Live Amber** | `#E8A33D` | "Agent is speaking / call is active" signal — warm, used sparingly, only for genuinely live moments |
| **Coral Pulse** | `#E85C4A` | Reserved exclusively for Live-mode (real money, real calls) indicators and destructive/alert actions |
| **Slate Wire** | `#5B6478` | Secondary text, borders, sandbox-mode neutral tone, inactive waveform states |

Sandbox mode = Slate Wire-dominant (calm, low-stakes). Live mode = Coral Pulse-accented (this is the one place a slightly alarming color is correct — going live should feel like crossing a threshold, not flipping a switch).

### Typography — three roles

- **Display:** a geometric sans with real presence at large sizes (e.g., Space Grotesk or General Sans) — hero numbers, page titles, the waveform's numeric readouts. Tight tracking at display sizes.
- **Body:** a humanist sans built for small-size legibility (e.g., Inter or IBM Plex Sans) — transcripts, labels, tables, docs prose.
- **Utility/data (monospace):** e.g., IBM Plex Mono or JetBrains Mono — API keys, webhook payloads, phone numbers, call IDs, and every code block in the docs. Monospace signals "this is exact/copyable," not decoration.

### Layout concept

```
┌─────────────────────────────────────────────────┐
│  [waveform strip — ambient, always present]       │  ← signature element
├──────────┬──────────────────────────────────────┤
│  nav     │        main content                     │
│  (icon+  │        (cards, tables, forms)            │
│  label)  │                                          │
└──────────┴──────────────────────────────────────┘
```

Left-rail nav, icon+label (not a hamburger). Calm grid, generous whitespace, soft elevation over hard borders. The waveform strip runs across the top of every authenticated dashboard page.

### Motion
One orchestrated moment gets real attention: the sandbox→live transition (Section 3) and the waveform's idle→active shift during a real call. Everywhere else, fast and quiet — 150–200ms fades/slides, no bouncing, no scattered decorative micro-interactions. Respect reduced-motion settings; the waveform degrades to a static line rather than forcing animation.

### Why not the defaults
Cream/terracotta reads as editorial/wellness, wrong for infrastructure handling real customer calls and money. Near-black/acid-green undersells that a non-technical business owner also lives in this dashboard daily, not just an engineer. Hairline-broadsheet is too static for a product whose entire value is *live, ongoing activity*.

---

## 2. Copy Voice

- Name things by what the business controls: "your agent," "the call," "this number" — never "the orchestrator instance" or "the tenant record."
- Buttons say exactly what happens, and the confirmation echoes the same word: "Place test call" → toast says "Call placed," not "Success!"
- Empty states invite action: "No calls yet — create an agent and place a test call to see it here," with the button right there.
- Errors state what happened and what to do, plainly, in the product's own voice — no "Oops!", no raw stack traces, no faux apology.
- Sandbox language feels genuinely lower-stakes: "Try a test call," not "Place a call."
- **Docs and onboarding get the one deliberate warm touch, Chapa-style:** a plain-language, locally-grounded greeting at the top of the developer docs and first-run onboarding — written like a person wrote it, not generated. Don't literally copy "Selam" verbatim as a borrowed catchphrase; write Markova's own equivalent, in your own words, that carries the same spirit — warm, local, and specific to introducing *this* product.

---

## 3. Sandbox vs Live — a design decision, not just a badge

- **Persistent environment indicator**, top nav, always visible — never a place a user can lose track of which mode they're in.
- Sandbox mode: Slate Wire-dominant palette throughout, calm and safe to explore.
- Live mode: waveform strip and key action buttons (place call, provision number, confirm billing) shift to Coral Pulse.
- Switching modes includes a brief, deliberate transition (not an instant flip) — the one other justified animation moment in the product, because it's a genuine safety signal: crossing into real telephony spend and real customer calls.
- API Keys page visually separates sandbox and live keys — never in the same list without a clear divider/label.
- Every screen with real-world consequence (numbers, outbound calls, billing) reflects current mode in its own content, not just the global badge.

---

## 4. Information Architecture (dashboard app)

```
/login  /register  /forgot-password

/dashboard                      (home/overview)
/agents  /agents/new  /agents/:id
/numbers  /numbers/new
/calls  /calls/:id
/knowledge  /knowledge/:sourceId
/tools  /tools/new
/integrations
/usage
/billing
/keys
/settings/company
/settings/team
/onboarding
```

**Out of scope for this build:** admin/internal ops dashboard, CRM pipeline views, team org-hierarchy trees, RPA workflow canvas, SSO/SCIM config, any UI implying multi-company/"Founder"-style autonomous operation. Redirect back to this list if a design suggestion drifts toward any of these.

---

## 5. Page-by-Page Detail

**Global (every authenticated page):** environment badge (Section 3), a small persistent usage-meter glimpse ("1,240 / 5,000 minutes used"), plan/tier badge (Basic/Pro/Plus) near company name, standard left-rail nav.

**`/dashboard`:** active agents count, calls this period, usage-vs-limit, recent calls (last 5, linked to transcript), quick actions (create agent, provision number, view keys). If Basic tier: an honest, non-nagging note showing recent calls where a workflow action was *detected but not executed* because they're not on Pro — real information, framed informatively, not as a hard sell.

**`/agents`, `/agents/new`, `/agents/:id`:** list (name, language, status, last modified). Create/edit: name, prompt, language (Amharic/Afaan Oromo/Tigrinya/English), voice, model config (hidden behind an "advanced" toggle for most users). A non-editable confirmation line stating the agent will identify itself as AI at the start of every call — a platform guarantee, not a togglable setting. Detail page tabs: Configuration, Versions (with rollback), **Test Call** (sandbox-only, real call to a dev-supplied number, no billing).

**`/numbers`, `/numbers/new`:** list (number, assigned agent, status). Search by area/pattern, then provision + assign. Sandbox numbers clearly marked as test, not real lines.

**`/calls`, `/calls/:id`:** filterable list (agent, status, date range, sandbox/live). Detail: speaker-labeled transcript, recording playback, metadata, transfer log with context if handed to a human. If a workflow action was taken (Pro/Plus): a distinct, clearly labeled entry — what happened, what confidence score triggered it, link to the audit entry. This is a trust-building screen — treat it carefully.

**`/knowledge`, `/knowledge/:sourceId`:** the Training Agent flow. Guided intake by category (business info, policies/FAQs, tone, sample scripts), not a blank upload box. **Mandatory consent screen before first upload** — plain-language explanation of data use, explicit confirmation it isn't used for shared model improvement unless separately opted in (recommend not offering that option at all in this version). Document list with status. A "test search" box so a business can preview what their agent would retrieve.

**`/tools`, `/tools/new`, `/integrations`:** simple CRUD for tools; the Integration Agent flow lives here — present as guided setup ("What system do you use? Let's connect it") over a raw credentials form, even though it calls the same underlying endpoints.

**`/usage`, `/billing`:** current-period breakdown reusing the waveform's visual grammar as a usage-over-time chart; plan comparison, invoices, upgrade/downgrade CTA. Confirm with the team whether public pricing (pre-login) lives in this app or a separate marketing site — either way it should sit as close to the docs as Chapa keeps its own pricing next to its API reference.

**`/keys`:** sandbox and live keys in clearly separated sections. Full key shown exactly once at creation with a strong "copy now" warning; prefix-only afterward. Delete/revoke with confirmation.

**`/settings/company`, `/settings/team`:** company profile; simple invite/remove user list, admin/member roles only — no org hierarchy.

---

## 6. Empty, Loading, Error States

Every list/detail page needs all three, per Section 2's copy voice:
- **Empty:** never blank — short explanation + a clear primary action.
- **Loading:** skeleton loaders, not spinner-only.
- **Error:** plain-language, never a raw API dump; explicit that a sandbox failure is a sandbox issue, not a real-world one.

---

## 7. Onboarding Flow (`/onboarding`)

Linear, guided, not a dashboard a new user has to figure out alone:
1. Welcome (this is where the one warm, written-by-a-person greeting lives — see Section 2)
2. Create first agent (simplified form, editable starter prompt template)
3. Auto-provisioned sandbox test number
4. Live test call to their own phone — hear the agent respond
5. Upload first knowledge item (Training Agent consent screen appears here first)
6. Explicit prompt to review pricing and go live — never automatic

This sequence should be demoable start-to-finish in a few minutes — treat that as a real design constraint, not just a nice-to-have.

---

## 8. Developer Docs Site (separate surface, Chapa-inspired — build this with real care)

This is its own information architecture, likely its own subdomain or `/docs` route, distinct from the dashboard app above but sharing the visual identity (Signal Ink, same type system, waveform motif used sparingly as a docs-nav accent rather than a live element here).

**Structure, modeled on developer.chapa.co's actual shape:**

1. **Landing/welcome page** — one warm, specific, human-written paragraph introducing what Markova's API does (see Section 2's guidance — write Markova's own version of this, don't borrow Chapa's literal wording), followed immediately by a **Quickstart**.
2. **Quickstart** — get a developer to their first successful sandbox API call in minutes: create account → generate sandbox key → one code sample (curl + at least one SDK language) that creates an agent and places a test call → see the result. Chapa's own strength is exactly this — don't make someone read five conceptual pages before they can try anything.
3. **Core concepts** — short, plain-language pages: Agents, Calls, Numbers, Knowledge, Sandbox vs Live, Webhooks. Each page: what it is, why it matters, one code sample, link to the full API reference entry.
4. **API Reference** — generated from `openapi.yaml` (the backend team's source of truth per the SDD) — every endpoint, parameters, response shapes, and a live "try it" panel if feasible.
5. **Webhooks guide** — events, payload shapes, signature verification example (this matters given the SDD's explicit requirement that no webhook silently returns success without real verification).
6. **SDKs** — installation and basic usage for each published SDK language.
7. **Pricing** — sits directly linked from the docs nav, not buried in a separate marketing site, mirroring how closely Chapa keeps pricing next to its developer docs.
8. **Changelog** — dated, human-written entries (Chapa runs a "Developer Collection" style update series) — even a simple version of this builds trust that the API is actively maintained, not abandoned scaffolding.

**Code samples:** every sample should be copy-pasteable and actually runnable against sandbox — no placeholder pseudocode. Use the monospace utility face; include a visible "copy" affordance on every code block.

**Tone:** technically precise first, warm second — the docs should read like a real engineer who's also a decent writer wrote them, the same balance Chapa strikes. Avoid corporate boilerplate ("Welcome to our comprehensive API documentation suite") in favor of direct, specific language.

---

## 9. Build Process for Lovable

1. Produce the token system (Section 1) as an actual style-guide artifact first — get it approved before generating populated pages.
2. Critique every generated screen against the three AI-default clusters (Section 1) — if anything drifts toward cream-warm, black-neon, or broadsheet-hairline, revise back toward Signal Ink/Live Amber/Coral Pulse.
3. Build the waveform component once, reuse everywhere (top strip, test-call screen, usage chart, docs-nav accent) — don't let it get reinvented three different ways across the dashboard and docs.
4. Build the docs site with the same rigor as the dashboard — this is not an afterthought template; it's a primary differentiator versus Lucy AI and RingCloud, neither of which offer a real self-serve developer experience.
5. Self-critique before presenting: does sandbox vs. live feel different to be *inside*, not just labeled differently? Does the docs quickstart actually get someone to a working call fast, the way Chapa's does for a payment? Cut anything decorative that isn't the waveform doing real work.
6. Quality floor regardless of visual ambition: responsive to mobile, visible keyboard focus states, reduced motion respected throughout, in both the dashboard and the docs site.
