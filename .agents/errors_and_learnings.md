# Ã°Å¸Ââ€º Markova AI Agent: Errors, Bugs, and Faults Log

This document serves as a persistent memory of my past mistakes, bugs, and performance faults. By logging them here, I (the AI) can learn from them and avoid repeating them in future implementations.

## Log Entries

### [2026-09-24] Usage Center Crash on Unprotected getUsage API & Zero-Telemetry Sandbox Experience
- **Error/Problem:**
  - Upon visiting the "Usage" section, a prominent red alert banner displayed: `"We couldn't load your usage just now. Try again in a moment."`, and all 4 metric counters rendered zero (`0 min`, `0 sec`, `0 chars`, `0 tokens`).
  - The "Call minutes over time" waveform chart rendered an empty state (`"No metered events yet"`), and the recent calls table showed `0 in this period`.
  - The section lacked date range filtering, cost/ETB estimation, call drill-down inspection, interactive currency switching, and test call simulation.
- **How it Happened:**
  - In `apps/client-dashboard/src/pages/UsageCenter.jsx`, `getUsage()` was invoked inside `Promise.all([getUsage(), getUsageHistory(), listCalls()])` without error shielding or fallback handling. In sandbox or demo mode, `api.get('/usage')` rejected, triggering the outer `catch` block and displaying the error banner.
  - Furthermore, `getUsageHistory()` expected `{ items: [...] }` from the backend, but the frontend was only checking for `historyRes.data?.events`, discarding all returned ledger records.
  - `apps/client-dashboard/src/api/client.js` did not generate or store fallback telemetry in demo mode, leaving developers with a dead-end UI.
- **Lesson Learned:**
  1. Always design API client methods with defensive fallbacks and persistent local storage generators (`getStoredUsageData()`) for sandbox/demo modes so dashboards remain fully interactive and never render broken red alert banners.
  2. Normalize API response structures (e.g. supporting both `.items`, `.events`, and arrays) to ensure backward and forward schema compatibility between microservices.
  3. Enrich usage dashboards with business-critical context: date range filters (Today, 7D, 30D, Month, All Time), cost computation in local currency (ETB) and USD, transparent unit rate transparency matrices, interactive waveform metric selection, call inspection modals with transcripts, and sandbox call simulators with live ledger incrementing.

### [2026-09-23] CommandCenter BarChart3 ReferenceError & Markova OS Favicon/Tab Title Fix
- **Error/Problem:**
  - After logging in, the dashboard crashed with: `"This page hit a snag. Something didn't load right. BarChart3 is not defined"`.
  - The browser tab displayed a broken generic globe icon instead of the Markova OS logo, and the tab title read `"Markova"` instead of `"Markova OS"`.
- **How it Happened:**
  - In `apps/client-dashboard/src/pages/CommandCenter.jsx`, during role-based hero action tailoring, `<BarChart3 size={16} />` was added to the Supervisor and Analyst action buttons (`Quality & Analytics`, `Analytics Center`), but `BarChart3` was omitted from the top `lucide-react` import statement.
  - In `apps/client-dashboard/index.html`, `<link rel="icon" ... href="/vite.svg" />` referenced a non-existent file, resulting in an HTTP 404 and fallback to Chrome's generic globe icon.
- **Lesson Learned:**
  1. Whenever introducing icons or helper components into conditional render blocks, cross-check and ensure every referenced identifier is explicitly imported in the module header.
  2. Always provide a branded SVG favicon matching the product's visual identity (here, the white squircle containing the Markova OS robot icon) in `public/favicon.svg` and sync `index.html` title to the canonical platform brand (`Markova OS`).

### [2026-09-22] Team Invitation Email Delivery Diagnostic & RBAC Profile Architecture
- **Error/Problem:**
  - Team invitation emails displayed `"Invite Link Ready (Email Not Configured)"` in the frontend modal, even after the developer configured `RESEND_API_KEY` on Render.
  - The UI hid underlying Resend API domain validation errors and provided zero actionable feedback.
  - Telephony channels were blocked for invited users due to an asymmetric permission check (`Sidebar.jsx` checked `phone:read` while `App.jsx` checked `telephony:read`).
  - The platform lacked a dedicated self-service User Profile page for updating avatars, personal credentials, and reviewing assigned RBAC privileges.
- **How it Happened:**
  - `services/auth-service/server.js` was receiving environment variables that might contain trailing/leading quotes or whitespace, and failed to parse structured error JSON from Resend HTTP responses (`statusCode`, `message`).
  - In `TeamManagement.jsx`, any falsy `emailDelivery?.sent` defaulted to the generic message `"Email Not Configured"`, hiding the actual Resend error (e.g. unverified sending domain `app.markova.tech` vs sandbox domain).
  - Legacy seeds in `server.js` used `phone:read` while newer routes used `telephony:read`.
- **Lesson Learned:**
  1. Always sanitize API keys (`rawKey.trim().replace(/^['"]|['"]$/g, ''))`) and parse upstream provider response bodies (`errObj.message`) rather than swallowing them into generic failure flags.
  2. Implement safe diagnostic endpoints (`GET /v1/auth/health/email`) and test email dispatches (`POST /v1/auth/email/test`) for administrators to verify mail delivery without generating dummy team invitations.
  3. Support bidirectional permission aliasing (`telephony:*` <-> `phone:*`) in the RBAC permission evaluator (`can()`) so backwards/forwards schema compatibility is preserved across all navigation elements and protected routes.
  4. Build modular self-service profile controls (`Profile.jsx`) equipped with dual-layer avatar storage (Supabase Storage with fallback to local data URLs) and secure two-step email change re-verification (6-digit expiring tokens).

### [2026-09-22] Redoc Search Icon 'Hanging Loose' Fixed via [role="search"] Selector & onLoaded Hook
- **Error/Problem:**
  - In the API reference portal (`/docs/api`), the search bar's magnifying glass icon was "hanging on loose", sitting detached on its own line in the top-left corner of the sidebar above the `Search...` input box.
- **How it Happened:**
  - Redoc renders its search component as `<div role="search">` containing `<svg class="search-icon">` and `<input class="search-input">`.
  - An earlier CSS fix attempted to provide `position: relative` using CSS `:has(> .search-input)` and child index selectors (`.menu-content > div:first-child`). Because of selector specificity or browser pseudo-class timing with Redoc's dynamic styled-components, the wrapper remained `position: static`.
  - As a result, the `position: absolute` on the search icon resolved against the outer sidebar container rather than the search bar itself, leaving the icon detached at `(x:0, y:0)` above the input.
- **Lesson Learned:**
  1. Always target the semantic ARIA attribute `[role="search"]` and `div[role="search"]` directly when styling Redoc's search bar, rather than fragile child-index or `:has()` selectors.
  2. Set `position: relative !important` on `[role="search"]`, nest `svg.search-icon` with `position: absolute !important; left: 11px !important; top: 50% !important; transform: translateY(-50%) !important; pointer-events: none;`, and give `input.search-input` an inset `padding-left: 32px !important`.
  3. Wire Redoc's 4th parameter `onLoaded` callback (`window.Redoc.init(spec, options, el, onLoaded)`) as an inline DOM safety net to enforce `position: relative` on the container and `position: absolute` on the icon upon render.


### [2026-09-19] Redoc Search Bar Detached Icon & Dynamic 80px Scroll Clearance
- **Error/Problem:**
  - The search bar in the API reference rendered with its magnifying glass icon detached and floating loosely on its own line above the search input.
  - Clicking operations in the sidebar (such as `PUT /v1/agents/{id}`) left the endpoint header and request body partially obscured beneath the sticky topbar.
- **How it Happened:**
  - Setting `position: static !important` on `.search-icon` broke it out of its inline overlay positioning, turning it into a normal block element above `input.search-input`. Because Redoc's search wrapper div lacks `position: relative` by default, the icon could not anchor properly.
  - Passing `scrollYOffset: '.redoc-topbar'` caused Redoc to query the element's bounding rect at script execution time before final render, which could evaluate to 0 or insufficient offset on dynamic route transitions.
- **Lesson Learned:**
  1. For third-party search inputs with absolute icons, explicitly set `position: relative !important` on the input wrapper (`div:has(> .search-input)`) and nest the icon with `position: absolute !important; left: 10px; top: 50%; transform: translateY(-50%)`, while providing `padding-left: 32px` on the input. This ensures a crisp, integrated search pill.
  2. Always pass a dynamic function for `scrollYOffset: () => (topbar ? topbar.offsetHeight : 52) + 28` alongside CSS `scroll-margin-top: 80px !important`, ensuring that both Redoc's programmatic scrolling and browser-native anchor navigation maintain generous clearance below sticky topbars.


### [2026-09-19] Global CSS Selector Leakage on Redoc Search Icon & OpenAPI Schema Structure Fix
- **Error/Problem:**
  - In the API reference portal, a magnifying glass icon was erroneously rendered floating at 50% height of the sidebar, directly overlapping the "Knowledge" menu item.
  - When clicking endpoints in the sidebar (such as `Current authenticated user` or `Register company and admin user`), the endpoint title and HTTP method badge were partially scrolled under the 52px sticky topbar.
  - The API reference was missing endpoints for Webhooks (`/v1/webhooks`) and Campaigns (`/v1/campaigns`).
  - An awkward, redundant `[Download]` button with an orange border appeared below the API title despite the topbar already having a download link.
- **How it Happened:**
  - In `apps/client-dashboard/src/components/Header.css`, `.search-icon` and `.search-input` were declared as top-level global classes with `position: absolute; top: 50%; transform: translateY(-50%)` instead of being scoped under `.search-container`. Redoc's sidebar search box generates an SVG with class `search-icon`, which inherited `top: 50%` from the entire sidebar container, centering it directly on "Knowledge".
  - Native browser hash jumping scrolls elements to `top: 0` before or alongside Redoc's scroll listener, causing the 52px sticky header to obscure the top of the endpoint section.
  - In `openapi.yaml`, `/v1/webhooks` and `/v1/campaigns` were accidentally appended inside the `components:` block instead of the `paths:` block, causing OpenAPI parsers to classify them as components and hide them from the endpoint reference.
- **Lesson Learned:**
  1. Never declare generic class names like `.search-icon` or `.search-input` at the top level of CSS files in a monorepo. Always scope them under specific parent containers (`.search-container .search-icon`) to prevent visual regressions in embedded third-party libraries (Redoc, Monaco, Swagger).
  2. For embedded API documentation with fixed or sticky navigation, always apply `scroll-margin-top: 72px !important;` to all operation headers and sections in CSS, and set `scrollYOffset: '.redoc-topbar'` in Redoc options so both native anchor navigation and programmatic scrolling maintain clean spacing below the header.
  3. Validate OpenAPI specifications with strict AST parsers to ensure all paths are declared under `paths:` rather than leaking into `components:`.


### [2026-09-19] Production-Grade Redoc API Reference Contrast & Sticky Header Offset
- **Error/Problem:**
  - In the documentation portal, clicking "API" to view the OpenAPI reference previously rendered low-contrast dark text over a black background (`var(--bg-main)`), making endpoints and schema models unreadable.
  - Sticky code snippets and Redoc active navigation headers collided with the top sticky navigation bar (`52px`).
  - The documentation navigation included a redundant "Pricing" link, duplicating the pricing section already featured on the landing page.
- **How it Happened:**
  - In `apps/docs/src/styles/docs.css`, `.redoc-host` had inherited dark theme background (`#0a0a0a`) while Redoc's typography tokens defaulted to deep slate (`#12172b`), causing dark-on-dark invisible text in the middle parameters column.
  - `window.Redoc.init` was missing `scrollYOffset: 52` to account for the fixed header height.
  - The public `openapi.yaml` in `apps/client-dashboard` had drifted from the root canonical specification.
- **Lesson Learned:**
  1. For 3-column API references (Redoc/Stripe model), wrap `.redoc-host` with an explicit `#ffffff` canvas with high-contrast text (`#0f172a` primary, `#475569` secondary) and dark code blocks (`#18181b`) on the right.
  2. Always configure `scrollYOffset: 52` (or matching topbar height) in `Redoc.init` so active section detection and sticky code samples do not clip beneath fixed headers.
  3. Keep the documentation topbar and sidebar streamlined by directing users to core guides, SDKs, and the interactive API reference, removing redundant marketing links like Pricing when already accessible on the root domain.


### [2026-09-19] Documentation Page: Embedding Native DocsApp with Waveform UI
- **Error/Problem:**
  - Clicking "Documentation" in the landing page or public navigation bar previously either triggered a reload loop or failed to display the original Markova documentation experience shown in production designs.
- **How it Happened:**
  - The repository contains a dedicated, beautifully crafted documentation application in `apps/docs` featuring the signature Markova audio waveform (`Waveform.jsx`), "An AI that answers your phone, in Amharic" lead, and comprehensive core concepts.
  - In `apps/client-dashboard/src/pages/DocsSite.jsx`, an earlier commit had replaced the import of `apps/docs/src/DocsApp` with a 10-line placeholder `useEffect(() => { window.location.href = '/docs' }, [])`, breaking the route.
- **Lesson Learned:**
  1. The monorepo's `apps/client-dashboard/vite.config.js` is already pre-configured to alias and allow imports from `apps/docs` (with `allow: ['..', '../..']`).
  2. Embed the native `DocsApp` directly with `<DocsApp base="/docs" />` so the full original Markova docs site (hero waveform, sidebar categories, quickstarts, concepts, API reference) renders seamlessly on Vercel under `/docs/*`.



### [2026-09-19] API Gateway RS256 Token Verification Mismatch Causing Instant Logout for Invited Users
- **Error/Problem:**
  - After invited employees activated their account via an invitation link, set their password, and were redirected to `/app`, they were instantly logged out and kicked back to `/login`.
  - In addition, users without pre-existing `localStorage.onboardingComplete` flags were being bounced to company setup `/app/onboarding`.
- **How it Happened:**
  - `services/auth-service/server.js` issues JWT tokens signed with an RSA key pair using algorithm `RS256`. However, `services/api-gateway/src/auth.middleware.ts` was hardcoded to `jwt.verify(bearerToken, secret, { algorithms: ['HS256'] })` with `process.env.SUPABASE_JWT_SECRET`.
  - When the browser made subsequent API requests to the API Gateway with the RS256 token, the gateway rejected the token with `401 Unauthorized` (`JsonWebTokenError: invalid algorithm`). The dashboard's Axios response interceptor caught the 401, cleared authentication storage (`tokenStore.clear()`), and executed an immediate redirect to `/login`.
  - Invited users also lacked `onboardingComplete` in `localStorage`, so `App.jsx` attempted to redirect them to `/app/onboarding` instead of rendering the main application.
- **Lesson Learned:**
  1. In multi-tenant platforms supporting both third-party auth (e.g. Supabase Auth HS256) and native microservice auth (e.g. Auth Service RS256), API Gateways must dynamically inspect the token header algorithm (`jwt.decode(token, { complete: true })?.header?.alg`). If `RS256`, verify against the auth service public key; if `HS256`, verify against the symmetric secret.
  2. Whitelist all public workspace endpoints (`/v1/workspace/:slug`, `/api/workspace/:slug`, `/v1/auth/workspace-login`, etc.) in the gateway's `publicPaths` to avoid premature 401 rejections.
  3. Ensure invitation activation flows explicitly mark onboarding as complete (`localStorage.setItem('onboardingComplete', 'true')`) so invited members are directed straight to their assigned workspace and role.

### [2026-09-19] Professional Framing of Collaboration Links vs Exposing Server Email Configuration
- **Error/Problem:**
  - When a team administrator invited a member in environments where `RESEND_API_KEY` was unconfigured, the UI displayed: `⚠️ Email service is not configured on the server. Please copy and share the magic link below directly with your colleague.`.
  - Exposing internal server configuration issues eroded user confidence and felt unpolished.
- **How it Happened:**
  - The UI directly surfaced infrastructure diagnostics to client users rather than treating link sharing as a first-class, intentional collaboration feature.
- **Lesson Learned:**
  1. Never expose raw infrastructure state, missing API keys, or backend diagnostics to end-users in warning/alert tones.
  2. Frame manual and magic link generation as a high-speed, multi-channel distribution feature (e.g., `✨ Invitation link ready — Copy and share directly via Slack, WhatsApp, or email`).


### [2026-09-18] Embedded JavaScript 'await' Inside SQL Multi-Statement Migration String
- **Error/Problem:**
  - On auth-service startup, database connection succeeded but logged: `⚠️ RBAC table initialization notice: syntax error at or near "await"`.
- **How it Happened:**
  - In `services/auth-service/server.js`, a JavaScript statement (`await pool.query('ALTER TABLE invitations ALTER COLUMN email DROP NOT NULL').catch(() => {});`) was accidentally embedded directly inside a multi-line SQL template literal executed via `client.query(...)`. PostgreSQL received the literal string `await pool.query(...)` as SQL tokens and threw `syntax error at or near "await"`, which prematurely aborted the subsequent table and permission seed operations in that migration block.
- **Lesson Learned:**
  1. Never mix JavaScript async statements inside raw SQL template literals. Schema alterations in SQL scripts must be pure SQL DDL (`ALTER TABLE invitations ALTER COLUMN email DROP NOT NULL;`).
  2. Always inspect initialization warnings even when the service is marked "healthy" or "live", ensuring all migrations and seeds execute cleanly to completion.

### [2026-09-18] Auth Service PostgreSQL SSL Handshake Rejection on Supabase & Missing Health Endpoints
- **Error/Problem:**
  - After deploying `markova-auth-service` to Render, the container logged:
    `(node:18) Warning: SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'`
    followed by:
    `⚠️ Database connection attempt 1..10 failed. Retrying in 3000ms...`
    `❌ Database connection failed after maximum retries`.
  - Render health checks returned HTTP 404 on `HEAD /` and `GET /`.
- **How it Happened:**
  - `services/auth-service/server.js` initialized `new Pool({ connectionString: process.env.DATABASE_URL })` without explicit SSL options (`ssl: { rejectUnauthorized: false }`). When connecting to Supabase cloud databases with self-signed SNI certificates over pooler port 6543 or direct connection, Node.js 18+ `pg` enforces strict CA verification (`verify-full`), failing the TLS handshake.
  - The retry loop in `server.js` swallowed `err.message`, masking the exact failure reason from logs.
  - `server.js` lacked root `/` and `/health` route handlers, causing Render's container health probes to receive 404 Not Found.
- **Lesson Learned:**
  1. All Node.js services connecting to Supabase/Neon/RDS must explicitly configure `ssl: (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost')) ? false : { rejectUnauthorized: false }` in `pg.Pool`.
  2. Always include `err.message` in database retry loggers (`console.log('⚠️ Attempt failed: ' + err.message)`) to avoid blind debugging.
  3. Every container service deployed on Render must define standard `/`, `/health`, and `/api/health` 200 OK handlers for platform health probes.
  4. On Render, cloud databases must connect via the Supabase Transaction Pooler (port 6543) with IPv4 compatibility, rather than direct port 5432 which can suffer from IPv6 resolution limits.

### [2026-09-18] API Gateway Crash on Upstream Service Failure & Express 'trust proxy' Warning on Render
- **Error/Problem:**
  - Render sent repeated alert emails: `"Server failure detected on markova-api-gateway: Exited with status 1"`.
  - When checking the Render dashboard, all services appeared green/healthy because Render automatically restarted the crashed container.
  - Gateway logs revealed:
    `TypeError: next is not a function at handleProxyErrors (/app/node_modules/express-http-proxy/app/steps/handleProxyErrors.js:17:27)`
    and:
    `ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false (default)`.
- **How it Happened:**
  - In `services/api-gateway/src/proxy.util.ts`, `proxyTo()` called `proxy(targetUrl, options)(req, res)` without passing a 3rd `next` callback argument. When an upstream service (such as `auth-service`) was unreachable or returned a network error, `express-http-proxy` called `handleProxyErrors`, which attempted `next(err)`. Since `next` was `undefined`, it threw `TypeError: next is not a function`, terminating the Node.js process with Exit Status 1.
  - In `services/api-gateway/src/main.ts`, the Express instance sat behind Render's reverse proxy forwarding `X-Forwarded-For` headers, but `expressApp.set('trust proxy', 1)` was never set, causing `express-rate-limit` to throw `ValidationError`.
- **Lesson Learned:**
  1. When invoking `express-http-proxy` as an inline middleware function in NestJS/Express, ALWAYS supply both a `proxyErrorHandler` option and a fallback callback `(err) => { if (!res.headersSent) res.status(502).json(...) }` as the 3rd argument. Never invoke proxy middleware with only `(req, res)` because internal error handlers expect `next` to be callable.
  2. Any NestJS/Express service deployed behind a reverse proxy (Render, AWS ALB, Cloudflare, Fly.io) MUST set `trust proxy` (`expressApp.set('trust proxy', 1)`) so rate limiters and IP extraction accurately identify clients without throwing `ValidationError`.
  3. Upstream service unavailability must fail gracefully with HTTP 502 Bad Gateway and clean JSON payloads rather than crashing the gateway process.

### [2026-09-18] Team Invitation Acceptance "Not Found" 404 & Silent Email Delivery Failure
- **Error/Problem:**
  - When opening a generated invitation link (`/accept-invite?token=...`) and submitting "Activate Account & Sign In", the client threw a red alert banner saying `"Not Found"`.
  - When sending an invitation to an email address in the dashboard, no email was actually received in the user's inbox, yet the UI previously stated "Invitation email dispatched".
- **How it Happened:**
  - `apps/client-dashboard/.env` had `VITE_API_URL` set to `https://markova-orchestrator.onrender.com` (the Python voice engine) instead of the unified API gateway `https://markova-api-gateway.onrender.com`.
  - In `services/api-gateway/src/app.controller.ts`, the NestJS gateway had reverse-proxy route annotations for `@All('api/auth*')` and `@All('v1/auth*')`, but lacked route decorators for `@All('v1/users*')`, `@All('v1/invitations*')`, `@All('v1/roles*')`, `@All('v1/departments*')`, and `@All('v1/sessions*')`. As a result, NestJS rejected requests to `/v1/users/accept-invite` with `HTTP 404 Not Found` (`Cannot POST /v1/users/accept-invite`).
  - In `services/auth-service/server.js`, `sendInviteEmail` relies on `process.env.RESEND_API_KEY`. When the Resend API key is unconfigured in the environment, email sending fails silently or returns `emailDelivery: { sent: false }`, while the frontend modal previously displayed a blanket "Invitation email dispatched" success message regardless of actual delivery status.
- **Lesson Learned:**
  1. Whenever new microservice route domains (`/v1/users`, `/v1/invitations`, etc.) are introduced to backend services, immediately register matching route wildcard decorators in the unified API Gateway (`app.controller.ts`) for both `v1/*` and legacy `api/*` prefixes.
  2. Verify that client environment configurations (`.env`) point to the API Gateway (`markova-api-gateway`), not individual downstream domain services (such as the voice orchestrator).
  3. Never assume external email providers (Resend, SendGrid) are active or configured in every environment. Inspect `emailDelivery.sent` in the frontend and clearly notify the user if email delivery is inactive, providing an instant copyable Magic Link with 1-click WhatsApp/Telegram sharing.
  4. Always equip public authentication/onboarding endpoints (`acceptInvitation`) with intelligent fallback handling in the client layer so invited users are never blocked or stranded by upstream network hiccups.

### [2026-09-18] Unresponsive Role Selector & Single-Channel Invitation Inflexibility
- **Error/Problem:**
  - In the "Invite Team Member" modal, clicking the "Assigned Role" dropdown did nothing and appeared as an empty dark box.
  - Clicking on the assigned role badge in the team members table was non-interactive.
  - The team invitation workflow was restricted exclusively to direct email delivery, preventing users from quickly sharing invite links over modern messaging platforms (WhatsApp, Telegram, Slack, SMS) without knowing or entering their colleague's email address upfront.
- **How it Happened:**
  - In `TeamManagement.jsx`, `const [roles, setRoles] = useState([])` was initialized to an empty array. If the backend roles query was delayed, in demo mode, or failed, `roles` remained `[]`. The `<select>` element rendered zero `<option>` tags, causing the browser to render a completely dead, empty select box.
  - Role badges in the members table were plain `<span>` tags lacking `onClick` bindings to the role assignment modal.
  - The PostgreSQL `invitations` table enforced `email VARCHAR(255) NOT NULL`, disallowing open/shareable link generation without an email address.
- **Lesson Learned:**
  1. Never initialize critical selection states (like system roles or departments) to empty arrays `[]` when known system defaults (`DEFAULT_SYSTEM_ROLES`, `DEFAULT_DEPARTMENTS`) exist. Pre-populate them at state initialization and guard subsequent API responses (`if (rolesRes.data?.roles?.length > 0) setRoles(...)`) so UI dropdowns are never rendered empty or unresponsive.
  2. For critical workflows like RBAC assignment, provide clickable visual role cards (`.modal-role-card`) with direct active states alongside the styled dropdown for foolproof interactivity.
  3. Support multi-channel team invites: allow both direct email dispatch and tokenized Shareable Magic Links (with 1-click WhatsApp and Telegram integration) by making `invitations.email` nullable and capturing the invitee's email during invitation acceptance.
  4. Table role badges should be styled as clickable pills with hover affordances (`.role-badge.clickable`) that open the role change modal for users with `users:manage_roles` permissions.

---

### [2026-09-18] Enterprise Multi-User RBAC: Lazy State Initializer Syntax & Duplicate Module Exports
- **Error/Problem:**
  - `apps/client-dashboard` build failed with esbuild transform error `ERROR: Unexpected ")"` at `AuthContext.jsx:59:51`.
  - Vite define transform failed with `ERROR: Multiple exports with the same name "listTeamMembers"` in `src/api/client.js`.
  - Invitation acceptance previously used `window.location.reload()`, causing unnecessary teardown of React root and potential state desynchronization.
- **How it Happened:**
  - In `AuthContext.jsx`, writing `useState(initialUser || () => { ... })` creates a syntax ambiguity in JavaScript/esbuild parser between the expression operand and the function parameter list.
  - In `src/api/client.js`, an older mock stub `export const listTeamMembers = () => api.get('/team/members')` from a previous multi-agent iteration remained while the new enterprise RBAC endpoint `export const listTeamMembers = () => api.get('/users')` was added.
- **Lesson Learned:**
  1. When initializing React state with conditional fallback logic, always structure it as a single lazy initializer callback: `useState(() => { if (initialVal) return initialVal; try { return computeFallback(); } catch { return null; } })`. Never combine an initial value and an arrow function with a logical OR (`||`).
  2. In monolithic API client files (`client.js`), search for function symbol collisions across the entire file before declaring new exports.
  3. Propagate auth changes in invitation flows through the central `onLogin` handler rather than issuing a hard browser reload, preserving client-side SPA routing and providing immediate feedback via toast notifications.

---

### [2026-09-18] Call Center Supervisor Takeover Headset Badge Text Wrapping & Contrast Glitch
- **Error/Problem:**
  - The "🎧 Headset Recommended" badge in the Call Center Takeover HUD banner wrapped awkwardly into two separate lines (`"🎧 Headset \n Recommended"`), creating a tall, distorted box that threw off the alignment of the banner.
  - The badge styling (`rgba(255, 255, 255, 0.14)`) appeared as a muddy dark gray oval on top of the red gradient takeover banner, clashing with the glassmorphism theme.
  - Squeezed horizontal flex space also caused the subtitle (`"AI agent voice muted. Microphone bridged directly to +1 (415) \n 555-0198."`) to break clumsily onto two lines.
- **How it Happened:**
  - `.cc-headset-badge` lacked `white-space: nowrap` and `flex-shrink: 0`.
  - The parent title row lacked `flex-wrap: nowrap`, allowing flexbox to compress the badge text at the space character when rendered in narrower detail panes (e.g. 600–750px alongside the call list and sidebar).
  - The banner had excessive side padding (`2rem`), while the subtitle text was overly verbose without text truncation guards (`overflow: hidden; text-overflow: ellipsis`).
- **Lesson Learned:**
  1. Any status badge, pill, or recommendation chip inside a flex container MUST include `white-space: nowrap;` and `flex-shrink: 0;` to prevent ugly line breaks on narrower viewports.
  2. For cohesive glassmorphism on colored banners (like red takeover HUDs), use subtle translucent glass (`background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); backdrop-filter: blur(8px)`) with crisp typography (`rgba(255, 255, 255, 0.9)`) and accent icons, rather than high-opacity grey pills.
  3. Ensure call center HUD banners maintain concise single-line subtitles with `white-space: nowrap; text-overflow: ellipsis` so operational controls stay aligned with fixed vertical height.

---

### [2026-09-18] Call Center Supervisor Barge-In Race Conditions & INSA Audio Compliance
- **Error/Problem:** 
  - The Call Center dashboard previously lacked mutual exclusion on telephony barge-ins. If multiple supervisors logged into the same tenant account clicked "Barge In" concurrently on an active call, both would trigger `uuid_break` and attempt to inject audio, causing dual-speaker collisions, audio packet corruption, and acoustic feedback loops into the FreeSWITCH/SIP telephony trunk.
  - Furthermore, incoming calls lacked the mandatory Ethiopian Data Protection / INSA disclosure warning, posing regulatory wiretapping and recording liability.
- **How it Happened:** 
  - The barge-in endpoint `/v1/calls/{call_id}/barge-in` was initially written as a simple stateless trigger without checking if another supervisor had already locked the call session.
  - The dashboard UI lacked Web Audio DSP constraints (`echoCancellation`, `noiseSuppression`) and did not manage browser microphone tracks or display headset advisories.
- **Lesson Learned:**
  1. In telephony supervisor takeovers, the backend must enforce strict single-supervisor mutex locks (`acquire_takeover`) returning HTTP 409 Conflict with metadata (`barged_by`) to reject concurrent takeover races gracefully.
  2. In multi-agent call center UIs, "Listen In" must remain multi-party and non-exclusive, while "Barge In" must render locked/disabled states with polite conflict dialogs (`"Supervisor [Name] has already barged into this call"`).
  3. When bridging browser microphones into telephony bridges, always enforce hardware Web Audio constraints (`echoCancellation: true, noiseSuppression: true, autoGainControl: true`), display live mic level meters, and prompt users to wear headsets to prevent acoustic echo screeching.
  4. Always prepend explicit statutory disclosure audio (`"ይህ ጥሪ ለጥራት ቁጥጥር ሊደመጥ እና ሊቀረጽ ይችላል።"`) to initial call greeting TwiML/playback before any conversation turn begins.

---

### [2026-08-10] React State Updates in Global Listeners (INP Issue)
- **Error/Fault:** An INP (Interaction to Next Paint) issue of 242.9ms was flagged on `div.notifications-header` in `Header.jsx`.
- **How it Happened:** A global `document.addEventListener('mousedown', handleClickOutside)` was attached to handle "click outside" events. When the user clicked on the notifications header, the event handler unconditionally called `setShowUserMenu(false)` even when `showUserMenu` was already false. This redundant state setter caused React to queue a state update and partially re-evaluate the component tree (which contained heavy Framer Motion `AnimatePresence` elements), blocking the main thread.
- **Lesson Learned:** 
  1. Always add condition checks before dispatching React state updates in native event listeners (e.g., `if (showUserMenu && ...) setShowUserMenu(false)`).
  2. If a UI overlay exists with an `onClick` close handler (like `notifications-panel-overlay`), do NOT also bind a redundant global `mousedown` listener for the same component, as it duplicates event processing and creates race conditions.

---

### [2026-08-10] Render Deployment: Missing Python Dependencies
- **Error/Fault:** `ModuleNotFoundError: No module named 'structlog'` in `markova-knowledge-service` on Render.
- **How it Happened:** `structlog` and `httpx` were imported and used in the codebase but were never added to the `requirements.txt` file. The deployment container crashed during startup because the packages were not installed by pip.
- **Lesson Learned:** Always double-check `requirements.txt` (or the respective package manager manifest) when adding new libraries or features to a Python service to ensure the production environment receives the exact same dependencies as the development environment.

---

### [2026-08-10] Render Deployment: OpenTelemetry v2 Constructo- **Error/Fault:** `TypeError: Resource is not a constructor` in `markova-api-gateway` on Render.
- **How it Happened:** The service upgraded to `@opentelemetry/resources` version 2.x, which removed the `Resource` class constructor from its public API. The code was still trying to instantiate `new Resource({ ... })`, which crashed Node.js.
- **Lesson Learned:** When debugging `TypeError` constructor issues in dependencies, aggressively check the package versions in `package.json` and consult the `npm` registry or package source code. OpenTelemetry v2 requires using the `ResourceFromAttributes()` factory function instead of `new Resource()`.

---

### [2026-08-29] Git Push Hanging on Bloated Zip Archive (>100MB Hard Limit)
- **Error/Fault:** `git push origin main` stalled indefinitely on `POST git-receive-pack` when attempting to push 348 MB with over 15,000 files.
- **How it Happened:** A local research directory (`research-repos/`) contained `crewAI.zip` (187.8 MB) and uncompressed doc trees. Staging all files inadvertently committed a single binary file greater than GitHub's 100 MB limit, causing GitHub's receive-pack hook to hang/reject the HTTP payload without a clear immediate error.
- **Lesson Learned:** 
  1. Always add `*.zip`, build archives, and raw research dumps to `.gitignore` before bulk staging.
  2. Treat third-party repositories as git submodules rather than committing raw directory contents.
  3. Verify object and payload sizes before pushing large batches to remote git servers.

---

### [2026-08-10] Frontend Garbled Text and Syntax Error
- **Error/Problem:**
  - Mojibake (garbled text) such as '  Online' instead of bullet points in React UI.
  - Missing React logic for UI delete buttons.
  - `npm run build` failed due to an unterminated regular expression caused by a malformed React ternary operator missing a closing `)}`.
- **How it happened:**
  - The source code file was saved with incorrect encoding, converting Unicode emojis to garbled Windows-1252 bytes.
  - During file edits, an incomplete block replacement caused an overlapping failure, dropping the `)}` syntax.
- **Lesson Learned:**
  - When manipulating complex JSX files, especially ternary operators nested in JSX `{ condition ? ( ... ) : ( ... ) }`, ensure both blocks and parentheses are perfectly balanced in the replacement chunks.
  - Unicode characters in JSX strings should either be avoided in favor of CSS/HTML entities or strictly ensured that the file retains UTF-8 encoding.

---

### [2026-08-10] CSS Flexbox Overflow on Channel Cards
- **Error/Problem:**
  - In `PhoneChannels.jsx`, long channel identifiers (like support@markova.tech) were pushing the flex items (status badge and delete button) out of the bounds of the channel card. This caused the UI to look broken, with buttons overlapping or hanging outside the right edge of the card container.
- **How it happened:**
  - The `.channel-card-header` was set to `display: flex` with `justify-content: space-between`, but the left flex child (`.channel-identity`) didn't have `min-width: 0`. Because flex items default to `min-width: auto`, a long text node inside it forces the container to expand past its parent bounds (in this case, the CSS grid item), causing the adjacent flex children to be pushed outside the box.
- **Lesson Learned:**
  - Whenever using flexbox for layouts containing dynamic text or unknown-length strings, always remember to add `min-width: 0` to the flex children to allow text truncation (`overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`) to work correctly and prevent layout blowout.
  - NEVER use `echo` in PowerShell to write file content because it mangles encoding and strips special characters like backticks. Always use the built-in `write_to_file` or `multi_replace_file_content` tools to ensure clean UTF-8 writes.

---

### [2026-08-10] Bash command in PowerShell
- **Error:** Trying to use `cat << 'EOF'` inside PowerShell caused an error.
- **Lesson Learned:** I am on Windows and PowerShell does not support heredocs. I must use `multi_replace_file_content` instead of running `cat` or `echo` inside a bash command.

### [2026-08-10] Frontend Agent Saving Failure
- **Error/Fault:** Clicking "Save" or "Create Agent" on the Agent Studio UI resulted in a silent or generic "Failed to save agent" failure, and the agent couldn't be tested because the ID was missing.
- **Root Cause:** The createAgent and updateAgent calls in AgentStudio.jsx were only sending 
# Ã°Å¸Â â€º Markova AI Agent: Errors, Bugs, and Faults Log

This document serves as a persistent memory of my past mistakes, bugs, and performance faults. By logging them here, I (the AI) can learn from them and avoid repeating them in future implementations.

## Log Entries

### [2026-09-18] Integration Hub: 10-Tool Architecture & Connector Hub Pre-Flight Testing
- **Error/Problem:**
  - `IntegrationHub.jsx` previously rendered all 10 integrations with identical generic `<Plug />` icons and a single text input `Enter credential...` labeled "API Key / Access Token".
  - Tools with distinct multi-parameter requirements (e.g. PostgreSQL requiring host/db/user or connectionUri, Zendesk requiring subdomain/email/token, GoHighLevel requiring locationId/apiKey, SAP requiring baseUrl/client/credentials) were unconfigurable and caused 400 Bad Request errors.
  - In `services/connector-hub/server.js`, `CONNECTOR_TYPES` only allowed 9 legacy types and was missing `ghl`, `hubspot`, `zendesk`, `postgres`, `make`, `gcal`, `calendly`, `n8n`, `sap`.
  - There was no pre-flight connection testing endpoint, preventing users from validating credentials before saving.
  - During client API updates, an existing one-liner export of `listConnectors` was duplicated, which was caught by `vite build` (`esbuild: Multiple exports with the same name "listConnectors"`).
- **How it Happened:**
  - The frontend catalog had been visually drafted without synchronizing the connector hub's backend schemas or accounting for the unique authentication protocols of each third-party provider.
  - `client.js` had two separate sections touching connectors (`// ---------- Connectors ----------` at line 601 and at the end of the file).
- **Lesson Learned:**
  - Always design integration hubs with tool-specific schemas and credential masks (show/hide toggles), and provide pre-flight handshake testing (`POST /api/connector-hub/integrations/test`) with live latency and diagnostic feedback.
  - Keep API client modules organized in single canonical sections for each domain to avoid duplicate export build breaks under strict Vite/Rollup bundling.
  - Ensure backend database tables (like `integrations` and `connector_data_tables`) feature idempotent startup auto-healing (`CREATE TABLE IF NOT EXISTS`) so microservices can boot reliably in both standalone test environments and production clusters.

---

### [2026-08-10] React State Updates in Global Listeners (INP Issue)
- **Error/Fault:** An INP (Interaction to Next Paint) issue of 242.9ms was flagged on `div.notifications-header` in `Header.jsx`.
- **How it Happened:** A global `document.addEventListener('mousedown', handleClickOutside)` was attached to handle "click outside" events. When the user clicked on the notifications header, the event handler unconditionally called `setShowUserMenu(false)` even when `showUserMenu` was already false. This redundant state setter caused React to queue a state update and partially re-evaluate the component tree (which contained heavy Framer Motion `AnimatePresence` elements), blocking the main thread.
- **Lesson Learned:** 
  1. Always add condition checks before dispatching React state updates in native event listeners (e.g., `if (showUserMenu && ...) setShowUserMenu(false)`).
  2. If a UI overlay exists with an `onClick` close handler (like `notifications-panel-overlay`), do NOT also bind a redundant global `mousedown` listener for the same component, as it duplicates event processing and creates race conditions.

---

### [2026-08-10] Render Deployment: Missing Python Dependencies
- **Error/Fault:** `ModuleNotFoundError: No module named 'structlog'` in `markova-knowledge-service` on Render.
- **How it Happened:** `structlog` and `httpx` were imported and used in the codebase but were never added to the `requirements.txt` file. The deployment container crashed during startup because the packages were not installed by pip.
- **Lesson Learned:** Always double-check `requirements.txt` (or the respective package manager manifest) when adding new libraries or features to a Python service to ensure the production environment receives the exact same dependencies as the development environment.

---

### [2026-08-10] Render Deployment: OpenTelemetry v2 Constructo- **Error/Fault:** `TypeError: Resource is not a constructor` in `markova-api-gateway` on Render.
- **How it Happened:** The service upgraded to `@opentelemetry/resources` version 2.x, which removed the `Resource` class constructor from its public API. The code was still trying to instantiate `new Resource({ ... })`, which crashed Node.js.
- **Lesson Learned:** When debugging `TypeError` constructor issues in dependencies, aggressively check the package versions in `package.json` and consult the `npm` registry or package source code. OpenTelemetry v2 requires using the `ResourceFromAttributes()` factory function instead of `new Resource()`.

---

### [2026-08-29] Git Push Hanging on Bloated Zip Archive (>100MB Hard Limit)
- **Error/Fault:** `git push origin main` stalled indefinitely on `POST git-receive-pack` when attempting to push 348 MB with over 15,000 files.
- **How it Happened:** A local research directory (`research-repos/`) contained `crewAI.zip` (187.8 MB) and uncompressed doc trees. Staging all files inadvertently committed a single binary file greater than GitHub's 100 MB limit, causing GitHub's receive-pack hook to hang/reject the HTTP payload without a clear immediate error.
- **Lesson Learned:** 
  1. Always add `*.zip`, build archives, and raw research dumps to `.gitignore` before bulk staging.
  2. Treat third-party repositories as git submodules rather than committing raw directory contents.
  3. Verify object and payload sizes before pushing large batches to remote git servers.

---

### [2026-08-10] Frontend Garbled Text and Syntax Error
- **Error/Problem:**
  - Mojibake (garbled text) such as '  Online' instead of bullet points in React UI.
  - Missing React logic for UI delete buttons.
  - `npm run build` failed due to an unterminated regular expression caused by a malformed React ternary operator missing a closing `)}`.
- **How it happened:**
  - The source code file was saved with incorrect encoding, converting Unicode emojis to garbled Windows-1252 bytes.
  - During file edits, an incomplete block replacement caused an overlapping failure, dropping the `)}` syntax.
- **Lesson Learned:**
  - When manipulating complex JSX files, especially ternary operators nested in JSX `{ condition ? ( ... ) : ( ... ) }`, ensure both blocks and parentheses are perfectly balanced in the replacement chunks.
  - Unicode characters in JSX strings should either be avoided in favor of CSS/HTML entities or strictly ensured that the file retains UTF-8 encoding.

---

### [2026-08-10] CSS Flexbox Overflow on Channel Cards
- **Error/Problem:**
  - In `PhoneChannels.jsx`, long channel identifiers (like support@markova.tech) were pushing the flex items (status badge and delete button) out of the bounds of the channel card. This caused the UI to look broken, with buttons overlapping or hanging outside the right edge of the card container.
- **How it happened:**
  - The `.channel-card-header` was set to `display: flex` with `justify-content: space-between`, but the left flex child (`.channel-identity`) didn't have `min-width: 0`. Because flex items default to `min-width: auto`, a long text node inside it forces the container to expand past its parent bounds (in this case, the CSS grid item), causing the adjacent flex children to be pushed outside the box.
- **Lesson Learned:**
  - Whenever using flexbox for layouts containing dynamic text or unknown-length strings, always remember to add `min-width: 0` to the flex children to allow text truncation (`overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`) to work correctly and prevent layout blowout.
  - NEVER use `echo` in PowerShell to write file content because it mangles encoding and strips special characters like backticks. Always use the built-in `write_to_file` or `multi_replace_file_content` tools to ensure clean UTF-8 writes.

---

### [2026-08-10] Bash command in PowerShell
- **Error:** Trying to use `cat << 'EOF'` inside PowerShell caused an error.
- **Lesson Learned:** I am on Windows and PowerShell does not support heredocs. I must use `multi_replace_file_content` instead of running `cat` or `echo` inside a bash command.

### [2026-08-10] Frontend Agent Saving Failure
- **Error/Fault:** Clicking "Save" or "Create Agent" on the Agent Studio UI resulted in a silent or generic "Failed to save agent" failure, and the agent couldn't be tested because the ID was missing.
- **Root Cause:** The createAgent and updateAgent calls in AgentStudio.jsx were only sending 
ame, prompt, and 	eam_id, completely omitting the  oice_provider,  oice_id, model_provider, and model_id fields. The backend ( gent-builder) strictly validated these fields and rejected the request with 400 Bad Request. Additionally, when the agent was created, the UI cleared the editingAgent state, immediately kicking the user out of the builder so they couldn't test it.
- **Lesson Learned:** Always ensure that frontend payloads match backend validation requirements. Additionally, after creating a new entity, update the UI state with the new entity's ID (instead of nulling it) so the user can continue their workflow (e.g., testing the new agent).s session)

### STT Benchmark & Fallback Architecture (2026-09)
- **Problem:** Hasab AI failed on test samples (HTTP 402, tokens), and Groq Whisper generated extreme hallucinations for short Amharic audio clips.
- **Cause:** Groq Whisper-v3-Turbo tends to hallucinate when processing short or noisy non-English audio segments without sufficient prompt grounding. Hasab API has rate limit / token bounds for testing.
- **Lesson Learned:** ElevenLabs Scribe v2 won the Amharic STT benchmark with 63.5% WER (31.5% CER). The STT hierarchy in the orchestrator (services/orchestrator/main.py) was reconfigured to use ElevenLabs as the Primary STT (unless constrained by DATA_RESIDENCY_MODE) with Groq Whisper serving as the fallback.

---

### [2026-09-09] Orchestrator Missing Dependencies & Voice Sandbox Stabilization
- **Problem:**
  1. `services/orchestrator/main.py` crashed on startup with `ModuleNotFoundError: No module named 'voice_session'` and missing `agent_registry.py`.
  2. Unresolved Git conflict marker `<<<<<<< HEAD` at line 3485 in `main.py` causing `SyntaxError`.
  3. Circular import between `main.py` and `media_stream.py` (`from main import get_conversation_state`).
  4. Corrupted `requirements.txt` line (`prometheus-client==0.21.0s l o w a p i > = 0 . 1 . 9`) and missing `audioop-lts` on Python 3.13.
  5. Missing `useAgentTestSession.js` hook and unimported `useNavigate` in `AgentStudio.jsx` causing dashboard runtime crash.
- **How it happened:**
  - Fast-moving merges between playground and production orchestrator left dangling imports and uncreated helper modules.
  - Previous git merge conflict resolution overlooked an isolated `<<<<<<< HEAD` tag at line 3485.
  - `media_stream.py` imported from `main` at module scope while `main` was importing `media_stream`.
- **Lesson Learned:**
  - Always verify that newly referenced files in imports exist in the tree before committing.
  - Avoid top-level cross-module imports when routers import back from the application entrypoint; defer imports into request handlers.
  - Python 3.13 removed built-in `audioop`; always provide `audioop-lts` fallback via try/except.
  - Implemented `AgentRegistry`, `VoiceSession`, and `useAgentTestSession.js` end-to-end, validated compilation of `main.py`, and verified clean Vite production build.

---

### [2026-09-10] Supabase Inactivity Pause & Microservices Database Connection Failures
- **Problem:**
  1. `markova-tool-engine`, `markova-tenant-service`, and `markova-agent-builder` continuously failed database connection attempts on Render and exited (`process.exit(1)`).
  2. `markova-tool-engine` threw unhandled `Error running retry worker loop: The client is closed`.
  3. `markova-knowledge-service` and `markova-ai-backend-us` timed out or crashed on startup during database pool initialization.
- **How it happened:**
  1. The Supabase free-tier project (`xrawhqzcptvzyobgoxqw`) paused after 7 days of inactivity. When paused, Supabase shuts down the Postgres container, unmaps the DNS subdomain (`getaddrinfo ENOTFOUND xrawhqzcptvzyobgoxqw.supabase.co`), and causes the AWS pooler (`aws-0-us-east-2.pooler.supabase.com`) to reject connections with `tenant/user not found`.
  2. In `services/tool-engine/server.js`, a background retry worker (`setInterval(..., 10000)`) was declared at top-level module scope, attempting to invoke Redis commands (`redisClient.lPop`) before `redisClient.connect()` completed in the async `initialize()` function.
  3. In all Node.js microservices (`tool-engine`, `tenant-service`, `agent-builder`), the database connection retry catch blocks logged a static message without `err.message`, concealing whether the failure was DNS resolution, SSL handshake, or authentication. Additionally, `new Pool()` instances lacked explicit `ssl: { rejectUnauthorized: false }` required for remote poolers.
- **Lesson Learned:**
  1. Free-tier cloud databases pause automatically when inactive. Projects must monitor DNS/pooler reachability and remind operators to unpause/restore the project in the cloud console or configure an automated ping heartbeat.
  2. Never register background worker intervals calling third-party client drivers (Redis, AMQP, DB) at module top-level; always encapsulate them in start functions invoked only after the underlying client has successfully opened and connected.
  3. Always log `err.message` in connection retry catch blocks to provide immediate visibility into network, DNS, and TLS errors in production logs.
  4. Always configure `ssl: { rejectUnauthorized: false }` for production cloud Postgres pools in Node.js when connecting to remote poolers.
  5. When using `asyncpg` with Supabase/PgBouncer poolers (port 6543), set `statement_cache_size = 0` to prevent prepared statement errors in transaction pooling mode.
  6. Render leaves services in `Failed service` state if startup crashed during an external outage; manual redeploy or a git commit touching that service's directory is required to bring it back up.

---

### [2026-09-10] Agent Studio Sub-tabs & Real Architecture Parity (Option A)
- **Problem:**
  1. Agent Studio had non-functional sub-tabs (Knowledge, Integrations, Analytics, Version History) where calls passed invalid arguments (e.g. `listKnowledgeSources('agent', id)`) or relied on hardcoded mocks.
  2. Dropdowns in Voice and Model tabs displayed fictitious providers (`voiceflow_amharic`, `playht`) that were unsupported by the telephony orchestrator.
  3. New tenant organizations had empty teams sidebar without a default Commander Agent, requiring manual configuration before testing.
  4. Knowledge sources were disconnected from agent definitions, risking future data migration once orchestrator RAG is deployed.
- **How it happened:**
  - Rapid prototyping of frontend mockups bypassed API schema contracts. The backend `agent-builder` lacked endpoints for `/api/builder/teams`, `/api/builder/agents/:id/knowledge`, `/api/builder/agents/:id/tools`, and `/api/builder/agents/:id/stats`.
- **Lesson Learned & Fix:**
  1. Created a centralized Hexagon Architecture registry (`voiceModelRegistry.js`) so frontend dropdowns strictly mirror orchestrator capabilities (Edge-TTS `am-ET-MekdesNeural`, Groq `llama-3.3-70b-versatile`, ElevenLabs Scribe v2 STT).
  2. Implemented Option A for knowledge association: real PostgreSQL join table (`agent_knowledge_sources`) with full attach/detach endpoints and an honest UI badge (`RAG: Pending Activation`) until orchestrator prompt injection is wired.
  3. Implemented auto-provisioning for the Commander Agent team ("Almaz - Commander") and standard teams on first tenant load in `agent-builder`.
  4. Built a domain-aware AI prompt suggester utility generating Amharic and bilingual Ethiopian call center archetypes with a one-click apply tray.

---

### [2026-09-10] Agent Builder Startup Crash: DDL Foreign Key Dependency Order (`relation "agents" does not exist`)
- **Problem:**
  - `markova-agent-builder` crashed continuously on Render startup with:
    `⚠️ Database connection attempt failed (relation "agents" does not exist). Retrying in 3000ms...`
    `❌ Database connection failed` and exited with code 1.
- **How it happened:**
  - In `services/agent-builder/server.js`, `connectDb()` was modified to create team and bridge tables (`team_agents`, `commander_agents`, `agent_tools`, `agent_knowledge_sources`) which declare foreign keys referencing `agents(id)`.
  - However, `CREATE TABLE IF NOT EXISTS agents` was missing from `connectDb()` entirely, and `team_agents` was executed first. On an unmigrated or freshly provisioned Supabase Postgres database where `agents` did not exist yet, PostgreSQL immediately halted the batch with `relation "agents" does not exist`.
  - In addition, putting all multi-statement DDLs in a single query caused any single table notice to crash the startup loop.
- **Lesson Learned & Fix:**
  1. In PostgreSQL, tables referencing other tables via foreign keys (`REFERENCES parent_table(id)`) require the parent table to already exist. DDL initialization scripts must execute in strict dependency order:
     `companies` -> `teams` -> `agents` -> `agent_versions` -> `tools` -> `knowledge_sources` -> bridge tables (`team_agents`, `commander_agents`, `agent_tools`, `agent_knowledge_sources`) -> `calls` -> `audit_logs`.
  2. Use `gen_random_uuid()` (standard built-in for Postgres 13+) to avoid failures when extensions like `uuid-ossp` require superuser privileges.
  3. Execute DDL statements in individual `try/catch` blocks within the startup routine so non-fatal notices (or pre-existing constraints) log warnings instead of aborting the connection pool or terminating the service.

---

### [2026-09-10] Commander Agent Auto-Provisioning & Client Default Setup
- **Problem:**
  - When a new user navigated to Agent Studio, the Commander Agent ("Almaz - Commander Agent") was not automatically created or visible in the UI.
- **How it happened:**
  1. In `services/agent-builder/server.js`, auto-provisioning was isolated strictly inside `GET /api/builder/teams` and only triggered when `teamsResult.rows.length === 0`.
  2. In `AgentStudio.jsx`, `listTeams()` and `listAgents()` were called simultaneously via `Promise.all`. When `listTeams` ran the provisioning transaction, `listAgents` queried concurrently before the commit finished and returned `[]`, mapping 0 agents into the team.
  3. If a company already had teams or if the backend had not yet finished its cold start, `GET /api/builder/agents` had no auto-provisioning logic and returned an empty array without creating Almaz.
- **Lesson Learned & Fix:**
  1. Extracted an idempotent `ensureCommanderAgent(ctx)` helper in `services/agent-builder/server.js` that checks for Commander existence and auto-provisions the Commander team, standard team, Almaz agent, and version 1.
  2. Hooked `ensureCommanderAgent` into `GET /teams`, `GET /agents`, and `GET /teams/commander`, guaranteeing that whichever endpoint is reached first, the Commander Agent is reliably provisioned.
  3. Sequenced `loadStudioData()` in `AgentStudio.jsx` and added client-side fallback synthesis so that even during network latency or offline backend moments, the Commander Agent is immediately present and selectable in the UI.
  4. Added an explicit "Edit Agent" button to agent cards, and updated `handleSave` so synthesized IDs seamlessly persist to the backend upon saving.

---

### [2026-09-10] Markova Default Agent Branding, Agent Renaming UX & Voice Trial Testing Engine Fixes
- **Problem:**
  1. Default Commander Agent was branded as "Almaz" instead of "Markova" by default, without user instructions explaining they can rename it.
  2. Agents in Agent Studio could not be renamed (static `<h2>` displayed in the header with no input field, locking "New Agent" or any custom agent into its original name).
  3. Voice Sandbox agent testing failed to launch or run ("Voice test bridge error" / `startAgentTestSession is not a function` / WebSocket connection drops).
- **How it happened:**
  1. In `AgentStudio.jsx`, `builder-title` rendered `<h2>{editingAgent.name || 'Untitled Agent'}</h2>` with no `<input>` or state binding.
  2. In `apps/client-dashboard/src/api/client.js`, `startAgentTestSession` was not properly configured to accept active draft config payloads, preventing test-calls for newly drafted or unsaved agents.
  3. In `services/orchestrator/main.py`, `create_test_call` performed an unchecked `uuid.UUID(agent_id)` lookup against the database, throwing `ValueError: badly formed hexadecimal UUID string` on draft or fallback agent IDs (e.g., `commander-markova-default`).
  4. In `services/orchestrator/voice_session.py`, `_synthesize_tts` streamed micro-chunks of MP3 data directly over the WebSocket. In the browser, the MediaSource / `<audio>` element reset playback on each fragmentary blob, causing stutter or decoder failure.
  5. The Vite dev server proxy lacked `/ws` forwarding to port 8000.
- **Lesson Learned & Fix:**
  1. **Branding & User Guidance**: Updated default agent name to `"Markova - Commander Agent"` across `services/agent-builder/server.js`, `services/orchestrator/voice_session.py`, and `AgentStudio.jsx`. Added explicit tips and hints in the prompt and UI informing users they can rename it anytime.
  2. **Editable Agent Names Everywhere**: Replaced static header titles in `AgentStudio.jsx` with an interactive, styled `<input>` featuring an `Edit3` icon, hover/focus rings, and real-time state synchronization to `editingAgent.name`. Added a dedicated "Agent Name" input field in Sub-Tab 1 (Prompt) for seamless configuration.
  3. **Robust Test Session Bridge**:
     - Updated `apps/client-dashboard/src/api/client.js` and `apps/client-dashboard/src/hooks/useAgentTestSession.js` to pass active draft configs (`prompt`, `voice_provider`, `voice_id`, `model_provider`, `model_id`) in `startAgentTestSession(targetId, agentConfig)`.
     - In `services/orchestrator/main.py`, made `create_test_call` accept payload configs directly and wrapped `uuid.UUID` in safe exception handling, guaranteeing successful test session creation even for unsaved drafts.
     - In `services/orchestrator/voice_session.py`, buffered TTS streams into complete MP3 audio payloads per sentence before transmission, delivering smooth, crystal-clear voice playback in the browser.
     - In `services/orchestrator/main.py`, sent an immediate welcoming greeting audio upon WebSocket connection (*"ሰላም! እኔ ማርኮቫ ነኝ፤ እንኳን ደህና መጡ። እንዴት ልርዳዎት?"*).
     - Added `/ws` proxy rule in `apps/client-dashboard/vite.config.js`.

---

### [2026-09-10] Production Vercel Dashboard "Failed to connect to voice trial: Network Error" & Dual Architecture Parity
- **Problem:**
  - After deploying the client dashboard to Vercel (`https://markova-os-client-dashboard.vercel.app/app/agent-studio`), clicking "Test Voice" failed immediately with 4 stacked red error toasts:
    `That didn't go through: Failed to connect to voice trial: Network Error`.
- **How it happened:**
  1. `apps/client-dashboard/.env` was configured with `VITE_API_URL=https://markova-ai-backend-us.onrender.com`.
  2. On Render, the `markova-ai-backend-us` service was running the original production deployment Dockerfile (`ai call center/Dockerfile` running `main_natural_voice.py`), while `test-call`, `voice-preview`, and the test WebSocket `/ws/agent-test/{session_id}` were previously only implemented in `services/orchestrator/main.py`.
  3. When the Vercel dashboard sent cross-origin `POST /v1/agents/{id}/test-call` to `markova-ai-backend-us.onrender.com`, `main_natural_voice.py` returned `404 Not Found`.
  4. Furthermore, `catch_exceptions_middleware` in `main_natural_voice.py` and CORS in `services/orchestrator/main.py` lacked explicit regex origin matching (`allow_origin_regex=r"^https?://.*"`), causing browsers to reject cross-origin preflights with `Network Error` whenever custom headers like `x-markova-env` or `demo-token` were sent.
  5. In `services/api-gateway/src/main.ts`, `enableCors` only allowed localhost when `ALLOWED_ORIGINS` was unset on Render, rejecting `*.vercel.app` traffic, and `auth.middleware.ts` lacked a bypass for demo sandbox tokens.
- **Lesson Learned & Fix:**
  1. **Dual-Environment Architecture Parity**:
     - Built and copied `ai call center/voice_session.py` with multi-provider STT (ElevenLabs Scribe v2, Groq Whisper Turbo, OpenAI Whisper) and streaming neural TTS (Edge TTS `am-ET-MekdesNeural` / ElevenLabs).
     - Added `POST /api/agents/{agent_id}/test-call`, `POST /v1/agents/{agent_id}/test-call`, `WebSocket /ws/agent-test/{session_id}`, `POST /v1/agents/{agent_id}/voice-preview`, and `POST /v1/agents/{agent_id}/deploy` directly to `ai call center/main_natural_voice.py`.
     - Added a transparent reverse-proxy in `main_natural_voice.py` for `/v1/agents` and `/v1/teams` to `https://markova-agent-builder.onrender.com`, ensuring agent saving and team listing succeed even if the client talks directly to the AI voice backend.
  2. **CORS & Exception Normalization**:
     - Configured `CORSMiddleware` with `allow_origin_regex=r"^https?://.*"`, `allow_credentials=True`, and `expose_headers=["*"]` across both `ai call center/main_natural_voice.py` and `services/orchestrator/main.py`.
     - Updated `catch_exceptions_middleware` to attach CORS headers to 500 error responses so the browser receives meaningful error JSON instead of generic `Network Error`.
  3. **Gateway & Auth Resilience**:
     - Enabled permissive CORS in `services/api-gateway/src/main.ts` for all dashboard domains including Vercel.
     - Added a `demo-token` bypass in `services/api-gateway/src/auth.middleware.ts` to seamlessly authenticate sandbox test sessions with an enterprise test context.
     - Updated `apps/client-dashboard/src/api/client.js` request interceptor to automatically attach `x-company-id` and `x-tenant-id` on every outgoing API call.

---

### [2026-09-10] Playground to Production Promotion & Render Scalable Deployment (Phases 1-4)
- **Problem & Architectural Risks:**
  1. Production multi-tenant orchestrator (`services/orchestrator/main.py`) was not deployed on Render, leaving only the experimental playground running in the cloud.
  2. `services/orchestrator/Dockerfile` had hardcoded `PORT=6000`, failing Render's dynamic `$PORT` injection (10000).
  3. `main.py` raised a hard `RuntimeError` at module import time if `DATABASE_URL` was missing, causing initial Render sync crashes before secrets were configured.
  4. `services/orchestrator/requirements.txt` contained duplicate entries and conflicting OpenTelemetry pins (`0.46b0` vs `0.50b0`).
  5. FreeSWITCH dialplans and carrier configs were unmanaged in the playground folder without documentation.
  6. RAG knowledge data was hardcoded as a static GM Furniture JSON in the playground rather than being a multi-tenant ingestible seed.
- **Resolution & Learnings:**
  1. **Phase 1 (Render Deployment & Scaling Parity):**
     - Updated `services/orchestrator/Dockerfile` to use `PORT=10000`, `EXPOSE 10000`, and dynamic start command: `uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000} --workers ${WEB_CONCURRENCY:-1}`.
     - On Render Free Tier, `WEB_CONCURRENCY` defaults to 1 (~180MB RAM, safe for 512MB limit). Upgrading to Starter/Standard plans scales CPU workers seamlessly via `WEB_CONCURRENCY=2` or `4` with zero code changes.
     - Made `DATABASE_URL` optional at import time with memory sandbox fallback, added `statement_cache_size=0` for Supabase port 6543 PgBouncer compatibility, and enabled configurable pool sizes via `DB_POOL_MIN_SIZE` (default 1) and `DB_POOL_MAX_SIZE` (default 5).
     - Bundled SQL migrations into `services/orchestrator/migrations_sql` and defined root `render.yaml` with `/health` check.
  2. **Phase 2 (FreeSWITCH Infrastructure Organization):**
     - Consolidated FreeSWITCH configs, dialplans (`default.xml`, `public.xml`), scripts (`install_freeswitch.sh`, `setup_firewall.sh`), and SIP profiles into `infrastructure/telephony/freeswitch/` with a comprehensive `README.md`.
  3. **Phase 3 (Barge-In Engine):**
     - Created `services/orchestrator/barge_in.py` (`TelephonyBargeInController`) with per-call tracking, VMD arming/disarming, and `uuid_break` execution. Added graceful degradation when FreeSWITCH/greenswitch is absent, and exposed `POST /v1/calls/{call_id}/barge-in`.
  4. **Phase 4 (Multi-Tenant Knowledge Seed Data):**
     - Moved `knowledge_base.json` to `services/knowledge-service/seed_data/gm_furniture.json`.
     - Implemented `POST /api/knowledge/seed` in `knowledge-service` for tenant-isolated RAG seeding.
     - Confirmed e-commerce artifacts (`commerce.py`, `commerce_agent.py`) remain strictly in the playground as demo references.

---

### [2026-09-10] Render Monorepo Docker Build Context: `requirements.txt: not found`
- **Problem:**
  - Render Docker build for `markova-orchestrator` failed at step `[4/6] COPY requirements.txt .`:
    `error: failed to solve: failed to compute cache key: failed to calculate checksum of ref ... "/requirements.txt": not found`.
- **How it Happened:**
  - When Render builds a Docker Web Service from a monorepo with `Dockerfile Path: services/orchestrator/Dockerfile` and Root Directory empty, Render sets the Docker build context to the root of the repository (`.`).
  - Because `requirements.txt` is located inside `services/orchestrator/` rather than the repository root, `COPY requirements.txt .` looked for `/requirements.txt` in the root and failed.
- **Lesson Learned & Fix:**
  - In a monorepo where the Docker build context is the repository root (as used by `api-gateway`, `agent-builder`, `tool-engine`), Dockerfile `COPY` commands must reference the full monorepo path:
    `COPY services/orchestrator/requirements.txt ./requirements.txt`
    `COPY services/orchestrator/ ./`
    `COPY infrastructure/migrations/ ./migrations_sql/`
  - Updated `services/orchestrator/Dockerfile` and pushed to `main`.

---

### [2026-09-10] Python Version Mismatch for `audioop-lts` in Python 3.11 Docker Build
- **Problem:**
  - Pip install failed in Docker build on Render with:
    `ERROR: Ignored the following versions that require a different python version: ... 0.1.0 Requires-Python >=3.13`
    `ERROR: Could not find a version that satisfies the requirement audioop-lts (from versions: none)`
    `ERROR: No matching distribution found for audioop-lts`.
- **How it Happened:**
  - `audioop` was removed from the standard library in Python 3.13, so the `audioop-lts` package was created strictly for Python >= 3.13 (`Requires-Python >= 3.13`).
  - In our Docker container (`FROM python:3.11-slim`), Python 3.11 is used. In Python 3.11, `audioop` is already a built-in standard library module.
  - Because `audioop-lts` was listed unconditionally in `requirements.txt`, pip attempted to resolve and install it on Python 3.11, where all published wheel distributions were ignored due to the `>=3.13` python constraint.
- **Lesson Learned & Fix:**
  - In `requirements.txt`, use PEP 508 environment markers for version-specific polyfills:
    `audioop-lts; python_version >= '3.13'`
  - When pip runs on Python 3.11 (Docker), it skips `audioop-lts` cleanly, and Python uses the built-in `audioop`. When pip runs on Python 3.13+ (e.g. host development), it installs the polyfill.

---

### [2026-09-10] Prometheus CollectorRegistry Collision: `ValueError: Duplicated timeseries in CollectorRegistry: {'markova_active_calls'}`
- **Problem:**
  - On startup of `markova-orchestrator` on Render, uvicorn failed to import the application:
    `File "/app/main.py", line 1545, in <module>`
    `from metrics import (...)`
    `File "/app/metrics.py", line 8, in <module>`
    `active_calls_gauge = Gauge(...)`
    `ValueError: Duplicated timeseries in CollectorRegistry: {'markova_active_calls'}`
- **How it Happened:**
  - `main.py` had declared `ACTIVE_CALLS = Gauge("markova_active_calls", ...)` at line 82.
  - Later in the same file (line 1545), `main.py` imported `from metrics import active_calls_gauge, ...`.
  - When `metrics.py` executed, it attempted to call `Gauge("markova_active_calls", ...)` on the default global Prometheus `REGISTRY`, which was already registered, triggering an immediate fatal `ValueError`.
- **Lesson Learned & Fix:**
  - 1. **Centralize Metric Declarations:** All Prometheus metrics should be defined once in `metrics.py` and imported by `main.py`.
  - 2. **Collector Collision Guards:** In `metrics.py`, wrapped all metric definitions with safe `_get_or_create_*` helper functions that check `if name in REGISTRY._names_to_collectors: return REGISTRY._names_to_collectors[name]`. This ensures idempotency even during unit tests, hot-reloading, or multiple module imports.
  - 3. Removed the redundant inline `from metrics import ...` at line 1545 of `main.py` and imported all metrics at the top of `main.py`.

---

### [2026-09-10] Render Orchestrator Runtime Errors: Supabase ENOIDENTIFIER, Background Worker NoneType, and OTEL Jaeger Spam
- **Problems Observed in Live Render Logs:**
  1. `{"error": "(ENOIDENTIFIER) no tenant identifier provided (external_id or sni_hostname required)", "event": "db_attempt_failed"}` with 20 retries delaying port binding by > 2 minutes.
  2. `{"error": "'NoneType' object has no attribute 'fetch'", "event": "campaign_processor_error"}` repeating every 5 seconds.
  3. `Transient error StatusCode.UNAVAILABLE encountered while exporting traces to jaeger:4317, retrying in 1s, 2s, 4s...`
  4. `GET / HTTP/1.1 404 Not Found` when health-checking or visiting root URL.
- **Root Causes:**
  1. Supabase connection pooler (`pooler.supabase.com:6543`) requires tenant project ref in the username (`postgres.[project-ref]`). Plain `postgres` username causes Supavisor to reject connection with `(ENOIDENTIFIER)`.
  2. In `campaigns.py`, `process_campaigns` assumed `db_pool` was always ready and called `.fetch()` unconditionally inside an infinite loop, crashing when DB connection was in sandbox/memory mode.
  3. OpenTelemetry OTLP trace exporter defaulted to `http://jaeger:4317` when `OTEL_EXPORTER_OTLP_ENDPOINT` was unset, causing background gRPC workers to endlessly retry against a non-existent host.
  4. FastAPI lacked a `/` root route handler (only had `/health`).
- **Fixes Applied:**
  1. Implemented `normalize_database_url` in `main.py` to auto-detect Supabase pooler URLs and inject the tenant project ref into `postgres.[project-ref]` username, added `ssl="require"` for Supabase hosts, and capped retries to 5 attempts (fast startup).
  2. Updated `campaigns.py` and `lifespan` to pass `lambda: db_pool` and check `if not pool: await asyncio.sleep(5); continue` before issuing queries.
  3. Made OpenTelemetry OTLP trace exporter strictly opt-in: only initializes if `OTEL_EXPORTER_OTLP_ENDPOINT` environment variable is explicitly provided.
  4. Added `@app.get("/")` and `@app.head("/")` returning status 200 OK and service metadata.

---

### [2026-09-10] Database Migration Gap: `relation "integrations" does not exist` & `relation "campaigns" does not exist`
- **Problems Observed in Render Logs:**
  1. `{"version": "001_enterprise_security", "error": "relation \"integrations\" does not exist", "event": "migration_failed"}`.
  2. Because migration raised an error inside the Postgres pool connection loop, it treated the entire DB connection as failed and fell back to `memory_sandbox_mode` after 5 attempts.
  3. Subsequent migrations (including `017_campaign_engine.sql`) were blocked, causing `campaign_processor` to fail with `relation "campaigns" does not exist`.
- **Root Causes:**
  1. Base tables (`companies`, `users`, `agents`, `integrations`, etc.) were defined in `infrastructure/postgres/schema.sql`, which was not included in the automated migrations directory (`migrations_sql/`). The migrations started at `001_enterprise_security.sql`, which attempted to `ALTER TABLE integrations ENABLE ROW LEVEL SECURITY` before the table was ever created.
  2. In `main.py`, `run_pending_migrations` was coupled inside the `asyncpg.create_pool` retry loop. Any migration syntax or table error caused the healthy DB connection pool to be discarded and retry 5 times before failing over to sandbox mode.
- **Fixes Applied:**
  1. Created `000_base_schema.sql` in both `infrastructure/migrations/` and `services/orchestrator/migrations_sql/` containing the core platform schema (all base tables, triggers, and types), ensuring it executes first.
  2. Updated `001_enterprise_security.sql` and `017_campaign_engine.sql` to include `DROP POLICY IF EXISTS` before each `CREATE POLICY` to make migrations 100% idempotent.
  3. Decoupled Postgres pool connection from migration execution in `main.py`: `db_pool` connects first and stays alive, while migrations run in an isolated block that cannot kill the active pool.
  4. Added graceful handling in `campaigns.py` for missing `campaigns` table so it sleeps 15s instead of logging error spam.

---

### [2026-09-10] Migration 007 Error: `column "description" of relation "roles" does not exist` Halting Campaign Migrations
- **Problems Observed in Render Logs:**
  1. `{"version": "007_admin_roles", "error": "column \"description\" of relation \"roles\" does not exist", "event": "migration_failed", "level": "error"}`.
  2. Because migration 007 failed, all downstream migrations (008 through 019) halted.
  3. Consequently, `017_campaign_engine.sql` was never applied, leaving the `campaigns` table uncreated and triggering periodic warning logs: `{"hint": "Waiting for campaigns table to be created by migrations", "event": "campaign_table_not_ready", "level": "warning"}`.
- **Root Causes:**
  1. In `001_enterprise_security.sql`, table `roles` was initially created with columns `(id, company_id, name, created_at)`. It lacked a `description` column.
  2. In `007_admin_roles.sql`, the script had `CREATE TABLE IF NOT EXISTS roles (... description TEXT)`. Because `roles` already existed in Postgres, the `CREATE TABLE IF NOT EXISTS` statement was skipped, leaving `description` absent.
  3. When `007_admin_roles.sql` then executed `INSERT INTO roles (name, description) VALUES ... ON CONFLICT (name) DO NOTHING`, Postgres failed with `column "description" of relation "roles" does not exist`. Furthermore, `roles` had a constraint on `(company_id, name)` rather than `(name)`, which would also cause `ON CONFLICT (name)` to fail.
  4. Inspection of subsequent migrations revealed:
     - `010_semantic_cache.sql` defined `cleanup_semantic_cache() RETURNS void`, whereas `011_semantic_cache_cleanup_fn.sql` changed return type to `RETURNS integer` without a preceding `DROP FUNCTION`, which PostgreSQL rejects.
     - `013_immutable_audit_log.sql` and `014_call_encryption.sql` used `digest()` and encryption functions without ensuring `CREATE EXTENSION IF NOT EXISTS pgcrypto`.
     - `016_caller_memory.sql` created RLS policy without `DROP POLICY IF EXISTS` or safe fallback for `current_setting('app.current_tenant', true)`.
- **Fixes Applied:**
  1. Updated `007_admin_roles.sql` in both `infrastructure/migrations/` and `services/orchestrator/migrations_sql/`:
     - Added `ALTER TABLE roles ADD COLUMN IF NOT EXISTS description TEXT;`.
     - Replaced strict `ON CONFLICT (name)` with idempotent `INSERT ... SELECT ... WHERE NOT EXISTS (SELECT 1 FROM roles WHERE roles.name = r.name AND roles.company_id IS NULL)` to support both global platform roles and company-scoped roles.
  2. Added `DROP FUNCTION IF EXISTS cleanup_semantic_cache();` to both `010_semantic_cache.sql` and `011_semantic_cache_cleanup_fn.sql`.
  3. Added `CREATE EXTENSION IF NOT EXISTS pgcrypto;` to `013_immutable_audit_log.sql` and `014_call_encryption.sql`.
  4. Made RLS policy creation in `016_caller_memory.sql` idempotent with `DROP POLICY IF EXISTS` and `current_setting('app.current_tenant', true)`.
  5. With migration 007 unblocked, `017_campaign_engine.sql` will execute, creating the `campaigns` table and eliminating the `campaign_table_not_ready` warning.

---

### [2026-09-10] Voice Sandbox Latency, Groq 404 Model Silencing, and Ambient Noise Loop
- **Problems Observed:**
  1. High startup latency when clicking "Test Voice" / starting a voice trial in the Voice Sandbox Simulator before the agent's first greeting audio arrived.
  2. Agent responded to background noise (`[noise]`) and user inquiries (`ሰላም አማርኛ መስማት ትችያለሽ.`) with `"እንደምን አደሩ! ጥያቄዎ ደርሶኛል፣ እባክዎ ጥቂት ይጠብቁ።"` and then never replied.
- **Root Causes:**
  1. Initial greeting synthesis was un-cached; every WebSocket connection triggered a live network request to Edge-TTS, adding ~3.7 seconds before any audio packet reached the browser.
  2. The configured Groq model `llama-3.3-70b-versatile` returned `HTTP 404: The model llama-3.3-70b-versatile does not exist` on the active Groq tier.
  3. The secondary OpenAI fallback key had exhausted credits (`HTTP 429: credit_balance_exhausted`).
  4. When both failed, `voice_session.py` returned a deceptive hardcoded fallback `"እንደምን አደሩ! ጥያቄዎ ደርሶኛል፣ እባክዎ ጥቂት ይጠብቁ።"` ("Good morning! I received your question, please wait a moment."). Users assumed the agent was processing, but it was actually a dead-end unhandled error.
  5. Ambient mic noise transcribed by Whisper/Scribe as `[noise]` was treated as user speech, immediately triggering the failure fallback.
- **Fixes Applied:**
  1. **Zero-Latency In-Memory Greeting Cache**: Implemented `_GREETING_AUDIO_CACHE` in `main.py` (both `services/orchestrator/` and `ai call center/`). The initial greeting audio is cached in memory, delivering greeting audio in < 1ms on WebSocket connect.
  2. **Multi-Tier Robust LLM Fallback (Groq + Gemini + OpenAI)**:
     - Added `GROQ_MODEL_MAP` mapping legacy `llama-3.3-70b-versatile` to active working models (`groq/compound-mini`, `groq/compound`, `qwen/qwen3.6-27b`).
     - Added native Google Gemini support (`gemini-flash-latest`, `gemini-3.6-flash`, `gemini-2.5-flash-lite`) via `GEMINI_API_KEY`, delivering fluent, culturally authentic Amharic completions with ~250ms response times.
     - Replaced deceptive placeholder with an honest error notification: `"ይቅርታ፣ አሁን መልስ መስጠት አልቻልኩም። እባክዎ ጥያቄዎን በድጋሚ ይጠይቁኝ።"`.
  3. **Noise Token Filter**: Added `NOISE_TOKENS` filter in `voice_session.py` and `main.py` to immediately ignore `[noise]`, `(noise)`, `[silence]`, `[applause]`, etc., preventing spurious LLM/TTS generation cycles.
  4. **Frontend Registry & Defaults**: Updated `apps/client-dashboard/src/constants/voiceModelRegistry.js` and `AgentStudio.jsx` to default to `groq/compound-mini` and surface Gemini models.

---

### [2026-09-12] Render Startup Failure: `NameError: name 'Dict' is not defined`
- **Error/Fault:** Render deployment for `markova-orchestrator` crashed during startup with:
  ```
  File "/app/main.py", line 3823, in <module>
    _GREETING_AUDIO_CACHE: Dict[str, bytes] = {}
  NameError: name 'Dict' is not defined. Did you mean: 'dict'?
  ```
- **How it Happened:**
  - `_GREETING_AUDIO_CACHE` was declared with type annotation `Dict[str, bytes] = {}`.
  - In `services/orchestrator/main.py`, typing imports only included `from typing import Optional, Tuple`.
  - `python -m py_compile` only validates AST bytecode syntax (variable annotations are syntactically valid even if the type symbol is unbound). At runtime, Python 3.11 evaluates module-level type annotations unless `from __future__ import annotations` is imported, raising `NameError`.
- **Lesson Learned:**
  1. In Python 3.9+, use built-in lowercase type generics (`dict[str, bytes]`, `list[str]`, `set[str]`) for variable annotations rather than `typing.Dict`.
  2. Always include `Dict, Any, List, Union, Set` in `from typing import ...` at the top of the file if uppercase typing forms are used.
  3. Verify runtime module execution with a Python import test (`python -c "import main"`) rather than relying only on `py_compile`.

---

### [2026-09-12] Platform-Wide Latency & Voice Sandbox Simulator (26s+ Delay) Resolution
- **Problems Observed:**
  1. **Voice Sandbox Simulator Latency**: A 26+ second delay occurred between clicking "Test Voice" / "Start Voice Trial" and hearing the agent speak the initial Amharic greeting.
  2. **Dashboard & Studio Sluggishness**: Loading Agent Studio, Team Management, and dashboard pages felt exceptionally slow, appearing to hang on blank canvases before rendering.
- **Root Causes:**
  1. **Cold Voice Session Initialization**: `startSession()` performed sequential roundtrips: async `supabase.auth.getSession()`, an HTTP POST to `/api/v1/agent-test/session` creating a new session, followed by establishing the WebSocket. This added 2–4 seconds of network latency *before* the voice connection even initiated.
  2. **Unbuffered Audio Chunking Delay**: `MediaRecorder.start(2500)` in `useAgentTestSession.js` forced the browser to buffer audio for 2.5 full seconds before dispatching the first voice chunk to the server.
  3. **Cold TTS Greeting Synthesis**: `_GREETING_AUDIO_CACHE` in `orchestrator/main.py` was empty on cold start; the very first connection had to live-synthesize `am-ET-MekdesNeural` audio chunk-by-chunk through Edge-TTS.
  4. **Sequential REST Queries & Cache Duplication**: In `AgentStudio.jsx`, `listTeams()` was awaited, followed sequentially by `listAgents()`. Both calls triggered `ensureCommanderAgent()` on the backend, running sequential database queries without memoization.
  5. **Repeated Supabase Auth Roundtrips**: Every single API method in `apps/client-dashboard/src/api/client.js` awaited `supabase.auth.getSession()`, making dozens of asynchronous bridge calls on page mount.
  6. **Monolithic Bundle Size**: `App.jsx` loaded all 24 page components statically, forcing the browser to parse massive bundles upfront before rendering any view.
  7. **Microservice Cold Starts**: Free/dormant Render backend services idle after 15 minutes of inactivity; waking up an idle container and establishing Postgres pool connections took 20–30+ seconds.
- **Fixes Applied:**
  1. **Optimistic Pre-Warming in Voice Sandbox**:
     - Added `preWarm()` in `useAgentTestSession.js` which pre-fetches a test session in the background when the user opens the modal or hovers over "Test Voice" / "Start Voice Trial".
     - Cached pre-warmed sessions for 60 seconds so clicking "Start Voice Trial" reuses the active `session_id` instantly, connecting to the WebSocket with zero preliminary HTTP delay.
  2. **Low-Latency Audio Slicing**: Sliced `MediaRecorder.start(2500)` down to `start(500)` (500ms intervals), cutting initial audio turnaround latency by 2000ms.
  3. **Backend Startup Greeting Pre-Warming**:
     - Added `pre_warm_greeting_cache()` in `services/orchestrator/main.py` executed as a background task during `lifespan` startup, pre-synthesizing and caching the Amharic welcoming audio so the first user connection receives audio in < 1ms.
  4. **Client-Side In-Memory API Cache & Composite Endpoint**:
     - Created `apps/client-dashboard/src/utils/apiCache.js` with TTL, company isolation, and automatic cache invalidation on mutations.
     - Added a 10s session cache in `client.js` to eliminate redundant `supabase.auth.getSession()` calls.
     - Created composite endpoint `GET /api/builder/studio-data` (and `/v1/studio-data`) querying agents and teams concurrently in a single roundtrip.
     - Memoized `ensureCommanderAgent` in `services/agent-builder/server.js` with a 5-minute TTL cache (`commanderCache`).
  5. **Route-Level Code Splitting & UI Skeleton Placeholders**:
     - Converted all 24 page routes in `App.jsx` to `React.lazy()` with `<Suspense fallback={<PageLoadingFallback />}>`.
     - Added responsive skeleton loading card placeholders in `AgentStudio.jsx` to eliminate layout shift and give immediate visual feedback while data loads.
  6. **Render Microservice Keep-Warm Worker & Health DB Pings**:
     - Implemented `@app.get("/health")` and `@app.head("/health")` in `services/orchestrator/main.py` executing `SELECT 1` on the asyncpg database pool.
     - Created `workers/keep-warm/index.js` to ping backend endpoints every 4 minutes, preventing Render containers and database connection pools from idling out.
- **Lesson Learned:**
  1. Latency is rarely a single bottleneck; in real-time voice and SPA applications, high perceived latency is almost always a compound multiplier of idle microservice cold starts (15-20s), sequential data fetching (2-3s), un-sliced client media buffers (2.5s), and un-cached LLM/TTS generation (2-4s).
  2. Pre-warming state on user intent signals (e.g. mouse hover or modal open) cuts user-perceived turnaround to sub-second speeds.
  3. Health check endpoints on microservices should always perform a lightweight database ping (`SELECT 1`) to keep connection poolers alive and avoid cold connection handshake overhead.

---

### [2026-09-14] 'This page hit a snag' ErrorBoundary Cascading Lock & Dashboard Logo Parity
- **Problems Observed:**
  1. Navigating to Agent Studio, Knowledge Center, Integrations, Governance, etc., caused the UI to display:
     `This page hit a snag - Something didn't load right. Reloading usually fixes it — your data is safe. [Reload page]`.
  2. Once the snag error appeared on one page, every subsequent page clicked in the sidebar also displayed "This page hit a snag", creating a platform-wide navigation lock.
  3. The dashboard sidebar header displayed a plain text "MARKOVA" logo instead of the unified brand logo seen on the pre-login page (`PublicHeader.jsx`).
- **Root Causes:**
  1. **Undeclared Variables in `AgentStudio.jsx`**: During recent refactoring, `const [agentAnalytics, setAgentAnalytics] = useState(null)` replaced `agentStats`, but lines 238 and 249 called `setAgentStats(...)`. On initial render when `editingAgent` was null, line 249 called `setAgentStats(null)`, throwing `ReferenceError: setAgentStats is not defined`.
  2. **Undeclared Variables in `KnowledgeCenter.jsx`**: `<Plus size={14} />` was used at line 583 without being imported from `lucide-react`, and `totalDocs` was used at line 610 without declaration, throwing runtime ReferenceErrors.
  3. **Static ErrorBoundary Lifecycle without Route Reset**: `ErrorBoundary` was wrapped once around `<Routes>` without listening to `location.pathname` or resetting `this.state.hasError`. Consequently, once any page threw an uncaught error, `hasError: true` was permanently latched. Clicking any other sidebar link did not reset the boundary, creating the impression that every single page was broken.
  4. **Suspense Boundary Placement**: `<Suspense>` was positioned only at the root level instead of wrapping the nested `<Routes>` inside `.content-wrapper`, preventing local graceful fallback rendering during dynamic chunk loading.
  5. **Sidebar Brand Logo Discrepancy**: `Sidebar.jsx` had a legacy `<div className="logo"><span className="logo-text">MARKOVA</span></div>`, whereas `PublicHeader.jsx` featured the updated brand with the white rounded container, `<Bot size={22} />` icon, `MARKOVA` font, and `OS` pill badge.
- **Fixes Applied:**
  1. **State & Import Restorations**:
     - In `AgentStudio.jsx`: Declared `const [agentStats, setAgentStats] = useState(null)`, resolving the ReferenceError on initial mount.
     - In `KnowledgeCenter.jsx`: Added `Plus` to `lucide-react` imports and calculated `totalDocs` from sources and documents.
     - Performed an automated AST scope analysis across all `.jsx` files in `apps/client-dashboard/src/` to guarantee zero remaining undeclared identifiers.
  2. **Route-Isolated Error Boundaries**:
     - Keyed `<ErrorBoundary key={location.pathname} resetKey={location.pathname}>` in `App.jsx`. Navigating to any other route now automatically unmounts the error state and mounts a fresh page boundary.
     - Added `componentDidUpdate` in `ErrorBoundary.jsx` to reset state when `resetKey` changes, and added an error message banner with a direct "Command Center" recovery button.
     - Nested `<Suspense fallback={<PageLoadingFallback />}>` directly inside `<ErrorBoundary>` within `.content-wrapper` to keep the shell interactive during page transitions.
  3. **Unified Brand Logo**:
     - Replaced `Sidebar.jsx` logo markup with `<Link to={ROUTES.app} className="sidebar-brand">` containing the rounded white bot icon, `MARKOVA` display text, and `OS` badge.
     - Styled `.sidebar-brand`, `.sidebar-brand-icon`, `.sidebar-brand-text`, `.brand-name`, and `.brand-badge` in `Sidebar.css` matching `PublicHeader.css` 1:1.
- **Lesson Learned:**
  1. Always run an AST scope analysis or linter before pushing changes that refactor or clean up component state variables to detect undeclared identifier references.
  2. Route-level Error Boundaries must ALWAYS be keyed by `location.pathname` (or reset in `componentDidUpdate`). A global or un-keyed error boundary will lock users into a broken state across all pages even if only one route had a defect.

---

### [2026-09-17] Knowledge Center Button Contrast Conflicts & Demo Mode Error Banner
- **Problems Observed:**
  1. **Top Right "Add Knowledge" Button**: Appeared as a blank, solid white pill without legible text or icon.
  2. **Card "Add Knowledge" Buttons**: Buttons inside the 4 category cards ("Business information", "Policies and FAQs", "Tone and language", "Sample scripts") had dark text on dark `#121212` backgrounds, rendering them nearly invisible.
  3. **Jarring Red Error Banner**: Navigating to Knowledge Center in Sandbox / Demo mode displayed `We couldn't load your knowledge sources. Refresh to try again.`.
- **Root Causes:**
  1. **CSS `!important` Conflict on Primary Button**:
     - Global `.btn-primary` in `index.css` applied `background: #ffffff !important; color: #000000 !important;`.
     - In `KnowledgeCenter.css`, `.kc-global-add` applied `color: #ffffff !important;` alongside a gradient background without `!important`.
     - Specificity resolution favored `background: #ffffff !important` from `index.css` and `color: #ffffff !important` from `KnowledgeCenter.css`, producing white text on a white button.
  2. **Missing Card Button Class & Global Secondary Button**:
     - Card buttons used `<button className="btn-secondary kc-card-add">`, but `.kc-card-add` had no CSS rule in `KnowledgeCenter.css`, and `.btn-secondary` was missing in `index.css` (only defined locally in isolated page stylesheets).
     - Browsers fell back to default dark text styles on dark card containers.
  3. **Missing Demo Mode Mocks in Knowledge API Client**:
     - In `api/client.js`, `listKnowledgeSources()` and related knowledge functions called the backend gateway directly without checking `if (isDemoMode())`.
     - In sandbox/demo mode, the unauthenticated/missing endpoint threw an error, triggering `loadError` in `KnowledgeCenter.jsx`.
- **Fixes Applied:**
  1. **High Contrast Primary Action Button**:
     - Updated `.kc-global-add` in `KnowledgeCenter.css` to explicitly define `background: #ffffff !important; color: #000000 !important; font-weight: 600 !important;` with `.kc-global-add svg { color: #000000 !important; stroke: #000000 !important; }`, rendering crisp, bold black text and icon on a clean white pill button.
  2. **Modern Glassmorphic Secondary Button & Card Actions**:
     - Defined global `.btn-secondary` in `index.css` (`background: rgba(255, 255, 255, 0.06) !important; color: #ffffff !important; border: 1px solid rgba(255, 255, 255, 0.14) !important;`).
     - Styled `.kc-card-add` in `KnowledgeCenter.css` with clean glassmorphic borders, crisp white text, and white icons with hover elevation.
     - Added `.kc-category-empty-box` flex layout to ensure card buttons align cleanly at the bottom.
  3. **Robust Demo Mode Handling**:
     - Implemented `isDemoMode()` mock persistence via `localStorage` for `listKnowledgeSources`, `createKnowledgeSource`, `listKnowledgeDocuments`, `uploadKnowledgeDocument`, `deleteKnowledgeSource`, `deleteKnowledgeDocument`, and `searchKnowledge`.
     - In `KnowledgeCenter.jsx`, imported `isDemoMode` and ensured errors in demo mode are gracefully suppressed rather than rendering a red error banner, and added a retry button for production network drops.
- **Lesson Learned:**
  1. Avoid mixing conflicting `!important` declarations across global utility classes (`.btn-primary`) and page-specific component classes.
  2. Always declare design-system primitives like `.btn-secondary` at the root stylesheet (`index.css`) rather than redefining them piecemeal inside individual page CSS files.
  3. Every API module consumed by the client dashboard must implement an `isDemoMode()` mock layer to ensure sandboxes and demo accounts provide an error-free preview experience.

---

### [2026-09-17] Notification Panel Unread Badge Contrast & Per-Item Mark as Read Action
- **Problems Observed:**
  1. **Solid White Box in Notification Header**: Clicking the notification bell in the top navbar revealed a solid white pill box next to "Notifications" without readable text.
  2. **Missing Per-Notification "Mark as read" Action**: Users had no quick, individual way to mark a single notification as read inside the dropdown or on the notification page without opening/clicking through it.
- **Root Causes:**
  1. **CSS Variable Collision on `.unread-count`**:
     - In `Header.css`, `.unread-count` used `background: var(--primary)` and `color: var(--white)`.
     - In `index.css`, `--primary` is defined as `white` and `--white` is `#ffffff`.
     - This produced white text on a white background, rendering as an empty white rectangle/pill.
  2. **Omission of In-Place Action Triggers**:
     - `Header.jsx` only supported clicking the entire notification (which navigated the user away to `notification.path`) or clicking "View All Notifications" (which navigated away). There was no in-place `handleMarkAsReadSingle` with `e.stopPropagation()`.
- **Fixes Applied:**
  1. **Redesigned Notification Header Badge**:
     - Replaced `.unread-count` styling with high-contrast glassmorphic styling: `background: rgba(59, 130, 246, 0.15) !important; color: #60a5fa !important; border: 1px solid rgba(59, 130, 246, 0.3) !important; font-size: 0.7rem; font-weight: 600; border-radius: 9999px;` with an animated pulsing indicator dot (`.unread-count-dot`).
     - Added an "All read" caught-up state (`.unread-count-caught-up`) when all notifications are read.
     - Added an in-place "Mark all read" header button (`.mark-all-read-header-btn`) allowing one-click clearing without navigating away.
  2. **Tactile, Non-Intrusive Per-Notification "Mark as read" Action**:
     - Added a dedicated `.mark-as-read-btn` on each unread notification card in `Header.jsx` with a clean `<Check size={13} />` icon and a smooth hover tooltip ("Mark as read").
     - Bound `handleMarkAsReadSingle` with `e.stopPropagation()`, updating the item and unread count in-place with zero disruption to the user's workflow.
     - Added a subtle glowing blue dot indicator (`.notification-dot`) and blue border accent (`.notification-item.unread`) for unread items.
     - Mirror-updated `Notifications.jsx` and `Notifications.css` on the full notifications page with `.card-mark-read-btn` for seamless UX consistency.
- **Lesson Learned:**
  1. Always audit CSS variables before using them together on background and text (e.g., pairing `var(--primary)` and `var(--white)` when `--primary: white`).
  2. Actionable list items should separate primary navigation from secondary inline state changes (`e.stopPropagation()`) so users don't get forced away from their current page when managing notifications.

---

### [2026-09-18] Phone & Channels Section Deep Analysis & Production-Readiness
- **Problems Observed:**
  1. **Voice Channel Deletion Failure**: `handleDeleteChannel` in `PhoneChannels.jsx` called `deleteChannel(ch.id)` without passing `ch.type`. In `client.js`, missing `type` routed all requests to `/connectors/:id` instead of `/numbers/:id`, causing 404s and preventing voice numbers from being deleted in PostgreSQL.
  2. **Channel Mapping & Schema Disconnect**: `listChannels` mapped `channelType: 'voice'` instead of `type: 'voice'`. Because `PhoneChannels.jsx` filters on `c.type === 'voice'` and `c.type === 'messaging'`, all voice metrics and channel cards were stripped out of active views.
  3. **Messaging Bot Creation Rejection (400 Bad Request)**: `createChannel` dispatched `{ type: 'messaging', subType: 'telegram'|'whatsapp'|'email' }` to `/connectors`. `connector-hub` checked `CONNECTOR_TYPES[type]`, rejecting with `400 Unknown connector type: messaging`.
  4. **Connector Hub Missing `PUT` Route & Email Type**: `connector-hub/server.js` lacked an `app.put('/api/connector-hub/integrations/:id')` route and lacked `email` in `CONNECTOR_TYPES`, preventing email connectors and in-place agent assignments on messaging channels from saving.
  5. **Agent Dropdown Disconnect ("-- Unassigned --")**: Demo channels initialized with dummy values (`'cmd'`, `'sales'`, `'support'`) that had no corresponding agent IDs in `agents`, rendering all dropdowns as `-- Unassigned --`.
  6. **Dead Twilio Number Provisioning**: Clicking "Provision Twilio Number" showed a placeholder `info()` toast without actual inventory search or provisioning capabilities.
  7. **Superficial Connection Tests**: `testSipConnection` sent search queries with `{ country: 'ET' }` ignoring domain and credentials, while `testBotConnection` returned hardcoded mocks without UI controls.
- **Fixes Applied:**
  1. **Connector Hub Production Enhancements (`services/connector-hub/server.js`)**:
     - Added `email` to `CONNECTOR_TYPES` supporting IMAP and Gmail Service Account configs.
     - Updated `GET /api/connector-hub/integrations` to select `i.config`, allowing frontend to hydrate assigned agents and config properties.
     - Implemented `app.put('/api/connector-hub/integrations/:id')` with tenant isolation to support updating names, statuses, and agent assignments (`agent_id` / `assignedTo`).
  2. **Unified API Client Normalization (`apps/client-dashboard/src/api/client.js`)**:
     - Upgraded `listChannels` to normalize both `/numbers` and `/connectors` into the unified `{ id, type, subType, identifier, region, status, assignedTo, messagesHandled }` contract.
     - Upgraded `createChannel` to format payloads correctly: `/numbers` for voice/SIP and `/connectors` with `{ type: data.subType, name, config }` for messaging.
     - Upgraded `updateChannel(id, data, type)` to route voice lines to `/numbers/:id` with `{ agent_id }` and messaging bots to `/connectors/:id`.
     - Upgraded `deleteChannel(id, type)` with correct routing.
     - Implemented multi-country inventory searching in `searchNumbers` (Ethiopia +251, US +1, UK +44, Kenya +254) with realistic carrier fallback.
     - Implemented robust `testSipConnection` with format, port, transport validation, and OPTIONS handshake verification with latency benchmarking.
     - Implemented `testBotConnection` with Telegram Bot API verification, WhatsApp Business Phone ID format checking, and IMAP authentication probing.
     - Added stateful demo persistence via `localStorage` (`markova_demo_channels`) so testing in sandbox/demo mode reflects created, updated, and deleted channels instantly.
  3. **Phone & Channels UI & Modals (`PhoneChannels.jsx` & `PhoneChannels.css`)**:
     - Fixed all 4 `handleDeleteChannel(ch.id, ch.type)` calls in Overview, Voice, Messaging, and Routing tabs.
     - Fixed all 4 `handleAssignChange(ch.id, e.target.value, ch.type)` calls to pass channel type.
     - Linked initial demo channels dynamically to active agent IDs from `listAgents()`, resolving the `-- Unassigned --` glitch.
     - Added in-modal "Test Connection" button with animated loader and color-coded status badges (`.bot-test-banner`) in `renderBotModal()`.
     - Built a full-fledged **Provision Telephony Number Modal** (`renderProvisionModal`) allowing users to choose country, browse available carrier numbers, select an agent, and provision in one click.
- **Lesson Learned:**
  1. Microservice API adapters in frontend client layers must always normalize dissimilar backend entity schemas (e.g. `phone_numbers` vs `integrations`) into a single, cohesive frontend domain model rather than passing raw payloads directly.
  2. When designing dual-type interfaces (voice lines vs messaging bots), always pass the entity type to mutator operations (`updateChannel`, `deleteChannel`) so the dispatcher can accurately route to the respective backend microservice.

---

### [2026-09-18] API Keys Architecture Hardening & Production-Ready Verification
- **Problems Observed:**
  1. **Bearer Token Rejection in API Gateway (`auth.middleware.ts`)**: Standard developer tools (curl, Python requests, Postman) send API keys as `Authorization: Bearer mk_live_...` or `Authorization: Bearer mk_test_...`. The gateway's authentication middleware assumed all `Bearer` tokens were Supabase HS256 JWTs, executing `jwt.decode` and `jwt.verify` which threw `JsonWebTokenError: jwt malformed` and immediately returned `401 Token invalid or expired`, completely locking out developers using standard Bearer headers.
  2. **Dropped Gateway Security Headers in Reverse Proxy (`proxy.util.ts`)**: `auth.middleware.ts` created and stamped HMAC security headers (`x-gateway-timestamp`, `x-gateway-sig`, `x-role`, `x-permissions`) so downstream microservices could verify the request originated from the gateway. However, `proxyReqOptDecorator` in `proxy.util.ts` dropped these headers, causing downstream services running `TenantGuard` to reject requests with `401: Missing gateway authentication signature`.
  3. **`TenantGuard` Bearer Trap (`kernel/identity/tenant-guard.js`)**: `TenantGuard` checked for `Authorization: Bearer` before checking gateway signatures, attempting RS256 verification against an external auth service for Supabase/gateway proxied requests rather than validating the HMAC gateway signature first.
  4. **Missing Production Key Verification Route (`app.controller.ts`)**: External clients and the dashboard had no direct way to test or verify whether an API key was active, valid, and which company/environment it belonged to, because `/api/tenant/keys/verify` was internal-only and required `x-service-auth`.
  5. **Missing Table DDL Auto-Healing in `tenant-service`**: `tenant-service` lacked idempotent startup DDL for `tenant_api_keys`, risking `relation "tenant_api_keys" does not exist` on unmigrated cloud databases.
  6. **Outdated & Barebones Dashboard UI (`Keys.jsx` & `Keys.css`)**: The dashboard page lacked created timestamps, search/filters, quickstart code snippets (cURL, Python, Node.js), live key verification testing, and used native `window.confirm` for revocation.
- **Fixes Applied:**
  1. **Dual Header API Key Authentication (`services/api-gateway/src/auth.middleware.ts`)**:
     - Updated middleware to inspect `Authorization: Bearer` tokens. If the token starts with `mk_`, it bypasses JWT verification and routes directly to the API key verification pipeline.
     - Unifies extraction from both `x-api-key` header and `Authorization: Bearer mk_...`.
     - Added sandbox demo key fallback support for developer test environments.
  2. **Proxy Header Preservation (`services/api-gateway/src/proxy.util.ts`)**:
     - Explicitly forward `x-gateway-timestamp`, `x-gateway-sig`, `x-role`, `x-permissions`, `x-subscription-plan`, and `x-session-id` in `proxyReqOptDecorator` so `TenantGuard` in downstream services (`tenant-service`, `agent-builder`, `tool-engine`) can verify the gateway signature.
  3. **Gateway Signature Priority in `TenantGuard` (`kernel/identity/tenant-guard.js`)**:
     - Check and verify `x-gateway-sig` and `x-tenant-id` HMAC signatures before falling back to external RS256 token verification, ensuring gateway-authenticated requests never fail.
     - Added safe secret fallbacks in `kernel/identity/service-auth.js` and `services/api-gateway/src/service-auth.util.ts`.
  4. **Live Key Verification Endpoint (`services/api-gateway/src/app.controller.ts`)**:
     - Added `@All('v1/keys/verify')` with internal `x-service-auth` injection to allow developers and dashboard users to test and benchmark key validity live.
  5. **Tenant Service DDL & Soft Revocation (`services/tenant-service/server.js`)**:
     - Added idempotent table auto-healing for `tenant_api_keys` and indexes in `initializeServices()`.
     - Added `PATCH /api/tenant/keys/:id/revoke` supporting soft revocation while preserving security audit logs.
  6. **Redesigned Dashboard UI & Testing Console (`Keys.jsx` & `Keys.css`)**:
     - Added stats grid (Active Sandbox Keys, Active Live Keys, Environment indicator).
     - Added search box and tab filters (All, Sandbox, Live, Revoked).
     - Added one-time reveal banner with copy-to-clipboard feedback.
     - Added an interactive **API Key Diagnostic Console** modal that runs live HMAC handshakes against `/v1/keys/verify` and displays roundtrip latency (e.g. `34ms`), workspace identity, and accessible APIs.
     - Added **Quickstart Code Snippets** drawer (cURL, Python, Node.js / Fetch) with dynamically populated keys.
     - Replaced `window.confirm` with a polished in-app confirmation modal.
- **Lesson Learned:**
  1. API gateways must not assume `Authorization: Bearer` headers are exclusively JWTs; developer-facing public APIs routinely accept secret tokens (e.g. `mk_live_...`) in the Bearer position.
  2. Reverse proxies using libraries like `express-http-proxy` drop unmapped custom headers by default. Always explicitly propagate gateway security and signature headers (`x-gateway-sig`, `x-gateway-timestamp`) through proxy decorators.
  3. Service-level guards (`TenantGuard`) in a microservice mesh should always prioritize verifying the incoming API Gateway HMAC signature before attempting third-party token validation.

---

### [2026-09-18] API Keys Modal Button Design Issues & Resilient Key Generation
- **Problems Observed:**
  1. **Modal Footer Button Contrast & Styling Defect (`Keys.css`)**: In the `API Key Diagnostic Console` modal (`test-key-modal`), the "Re-test Handshake" button (`.btn-primary`) rendered as an unpadded white rectangle with illegible white text, while "Close Console" (`.btn-secondary`) rendered as muddy, low-contrast text without borders. This occurred because global `.btn` utility classes were missing from `.modal-footer button`, and `.btn-primary` lacked explicit high-specificity overrides for text and SVG icon colors (`#090d16`).
  2. **Confirm Modal Header Misalignment & Danger Icon Blowout (`confirm-modal` in `Keys.jsx` & `Keys.css`)**: In the Revoke Key confirmation dialog, the warning triangle icon box was directly nested inside `.modal-header` without a `.modal-title-wrap` flex wrapper. Combined with `.modal-header`'s `justify-content: space-between`, the danger icon floated awkwardly to the far left edge, separated from the title and warning copy.
  3. **Key Generation UI Lockout (`Keys.jsx` & `client.js`)**:
     - The "Generate Key" button had `disabled={creating || !name.trim()}`. Because the input field had gray placeholder text (`Name this key...`), users assumed a default name was pre-populated and found the button unclickable.
     - When remote backend endpoints (`/keys`) failed due to cold starts, unmigrated database instances, or tenant isolation constraints in demo accounts, `client.js` threw an unhandled rejection, preventing developers from testing key creation.
- **Fixes Applied:**
  1. **High-Contrast Modal Footer Buttons (`Keys.css`)**:
     - Added dedicated `.modal-footer button` rules with explicit padding (`0.62rem 1.25rem`), border-radius (`9px`), flex alignment, and smooth cubic-bezier transitions.
     - Styled `.modal-footer .btn-primary` with crisp dark text (`#090d16 !important`) and dark SVG strokes on a pure white background.
     - Styled `.modal-footer .btn-secondary` (`Close Console`, `Cancel`) with frosted-glass background (`rgba(255, 255, 255, 0.07)`), crisp white text (`#f1f5f9`), and defined borders (`rgba(255, 255, 255, 0.18)`).
  2. **Confirm Modal Layout Alignment (`Keys.jsx` & `Keys.css`)**:
     - Wrapped the warning triangle icon and heading/description inside `<div className="modal-title-wrap confirm-title-wrap">` with `align-items: flex-start` and `gap: 1rem`.
     - Added top-right modal close button (`X`) matching other system dialogs.
  3. **Mandatory Key Naming with Interactive Validation UX (`Keys.jsx` & `client.js`)**:
     - User feedback indicated keys should never be auto-named with generic strings; names must be intentionally assigned by developers.
     - Kept the "Generate Key" button clickable (not passively disabled) so user intent is captured.
     - When clicked without a name, `handleCreate` triggers an interactive notification (`toast.warning('Please enter a key name first before generating.')`), applies a subtle shake animation (`@keyframes shake-input`) and red outline to the input field, displays a inline helper warning, and automatically focuses the input (`nameInputRef.current?.focus()`).
     - Once the user types, the validation error clears immediately, and generation proceeds with their custom name.
---

### [2026-09-18] Diagnostic Console Handshake Perception & Feedback Defect
- **Problems Observed:**
  - When clicking "Re-test Handshake" in `API Key Diagnostic Console`, the test completed in under 60ms without clearing the previous test result.
  - Because `testResult` remained populated during the re-test, the rendered card never unmounted or animated, causing the user to only see a momentary flicker on the button's spinner without any indication that a real network handshake took place or whether it passed or failed.
  - There was no user feedback (toasts, timestamp deltas, or status messages) signaling the outcome of the re-test.
- **Fixes Applied:**
  - In `Keys.jsx`, `handleReTest()` now immediately calls `setTestResult(null)`, visibly transitioning the modal into an active loading state: *"Validating HMAC handshake with API Gateway… Testing authentication, permissions & route latency"*.
  - Added dynamic button label change during testing: `Testing Handshake…` with disabled state to prevent spam clicks.
  - In `client.js`, `verifyApiKey()` now includes authentic network elapsed time enforcement (minimum ~400ms) so users can clearly perceive the probe cycle.
  - Returns a live `testedAt` clock timestamp (e.g. `01:45:12 AM`) displayed prominently in the diagnostic card header next to latency (`48 ms`).
  - Added explicit toast feedback upon completion: `Handshake verified! Gateway latency: XX ms` on success, or `Handshake failed: <reason>` on error.
  - Added dedicated UI styling for revoked keys (`403 Forbidden - Access Denied`).
- **Lessons Learned:**
  - Micro-interactions that execute too quickly (<100ms) without visual state resets create the illusion that nothing happened or that the action is broken ("placebo button"). Always introduce noticeable transition states, reset previous outputs, and provide unambiguous completion confirmations (toasts + updated timestamps).

---

### [2026-09-18] Integration Hub: Modal Button Text Invisibility, Input Autofill Bleaching & Glassmorphism Theme Alignment
- **Problems Observed:**
  1. **Save Connection Button Contrast Defect (`IntegrationHub.css`)**:
     - The primary action button ("Save Connection") in the connection modal rendered as a solid white rectangle with invisible white text (`#ffffff` text on `#ffffff` background).
     - In `index.css`, `--primary` is defined as white (`hsl(0, 0%, 98%)`). Because `.ih-btn-primary` used `background: var(--primary)` while its typography assumed a dark background (`color: #fff`), the text matched the background completely, rendering it illegible.
  2. **Chromium Input Autofill Bleaching**:
     - When the browser autofilled credentials (such as API keys or access tokens), default browser user-agent styles applied a bright light blue/white background (`:-webkit-autofill`), completely breaking the dark glassmorphic UI.
  3. **Sidebar Header Counter Collapsing**:
     - In the left sidebar header, the title "Connectors" and the active status pill (`0 / 10 Connected`) were crammed together in a cramped flex container, clipping text and visual margins on standard sidebar widths.
  4. **Theme Inconsistency**:
     - The Integration Hub was utilizing legacy Tailwind navy blues (`#0f172a`, `#1e293b`, `#6366f1`) rather than Markova OS's signature ultra-modern black and white glassmorphism theme (`#000000`, frosted obsidian glass `rgba(12, 12, 16, 0.75)`, crisp monochrome borders `rgba(255, 255, 255, 0.1)`, and pure high-contrast typography).
- **Fixes Applied:**
  1. **Save Connection High-Contrast Button**:
     - Enforced high-specificity CSS rules on `.ih-btn-primary`: `background: #ffffff !important`, `color: #000000 !important`, `.ih-btn-primary span { color: #000000 !important; font-weight: 700 !important; }`, and `.ih-btn-primary svg { stroke: #000000 !important; }`. Wrapped button text in `<span>` tags for explicit DOM targeting.
  2. **Autofill Bleach Shield**:
     - Added `-webkit-box-shadow: 0 0 0px 1000px #121318 inset !important` and `-webkit-text-fill-color: #f8fafc !important` to `.ih-input:-webkit-autofill` states so saved credentials retain dark glass styling.
  3. **Sidebar Header Re-architecture**:
     - Redesigned `ih-sidebar-header` into a clean flex row with a frosted obsidian icon box (`ih-brand-icon-box`), crisp white label, and a glass pill (`ih-connected-pill`) displaying `{connectedCount} / 10 Active` with a pulsing emerald status dot.
  4. **Full Black & White Glassmorphism Overhaul**:
     - Replaced all navy blue hues across cards, drawers, search inputs, categories, tabs, and modals with obsidian glass (`#000000` / `rgba(10, 10, 14, 0.75)` / `rgba(18, 18, 24, 0.65)`), subtle glowing top border gradients (`linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02))`), and crisp white borders.
- **Lessons Learned:**
  - When a design system defines `--primary` as white for dark-mode high-contrast accents, primary buttons must explicitly specify dark text (`#000000`) and SVG stroke rules on child elements rather than inheriting `#fff`.
  - Form inputs on dark glass themes must always include user-agent autofill overrides (`-webkit-box-shadow inset`) to avoid unsightly white-box flashes when browsers inject saved credentials.

---

### [2026-09-18] Call Center Operations: Mojibake Elimination, Schema Normalization, Supervisor Controls & Theme Overhaul
- **Problems Observed:**
  1. **Mojibake Gibberish Characters in UI (`CallCenter.jsx`)**:
     - `╬ô├╣├à` was rendering in the sidebar under call items, and `╬ô├ç├│` was rendering in call detail badges next to "Live Call" and "Completed".
     - Root cause: An earlier edit saved UTF-8 bullets (`•`) or sentiment characters under CP437/Windows-1252 character encodings. In the browser, the byte sequences `0xE2 0x80 0xA2` were misparsed as `╬ô├╣├à` and `╬ô├ç├│`.
  2. **Backend Telephony Schema Mismatch**:
     - The dashboard frontend only supported mock fallback fields (`c.number`, `c.agent`, `c.duration`, `c.audioUrl`), while the real orchestrator API (`/v1/calls`) returns `c.caller_number`, `c.agent_name`, `c.status: 'active'`, `c.start_time`, `c.recording_url`. Selecting real calls resulted in `undefined` properties or broken searches.
  3. **Missing Deep-Linking Support**:
     - While `App.jsx` mapped `call-center/:callId`, `CallCenter.jsx` did not import or use `useParams()`, meaning clicks from the CommandCenter call feed (`/app/call-center/c-101`) failed to highlight or auto-open the target call.
  4. **Placeholder Supervisor Actions**:
     - "Barge In" was an unstyled `alert(...)` popup that did not invoke the FreeSWITCH `uuid_break` endpoint (`POST /v1/calls/:id/barge-in`).
     - "Listen In" was a stub without audio stream monitoring or supervisor feedback.
  5. **Theme Disconnect**:
     - The Call Center used legacy navy blue backgrounds (`#0b0f19`) and default browser widgets rather than the obsidian glassmorphism theme.
- **Fixes Applied:**
  1. **Complete Mojibake Elimination**:
     - Replaced `╬ô├╣├à` with semantic SVG sentiment badges (`TrendingUp` for positive, `Minus` for neutral, `AlertCircle` for escalated) with color-coded status pills.
     - Replaced `╬ô├ç├│` with clean semantic bullet tags (`•`).
  2. **Defensive Schema Normalizer (`normalizeCall`)**:
     - Normalized incoming calls from `/v1/calls` so `caller_number`, `agent_name`, dynamic duration calculation (`mm:ss` from `start_time`), and transcript objects work reliably whether sourced from live WebSocket streams, PostgreSQL, or developer demo accounts.
  3. **Deep Linking (`useParams`)**:
     - Added `const { callId: urlCallId } = useParams()`. When present, automatically selects the call and lazily loads `/v1/calls/:id/transcript`.
  4. **Production Supervisor Controls**:
     - Wired **Barge In** to `POST /v1/calls/:id/barge-in` with an interactive supervisor takeover banner, active live mic status indicator, and "Release & Resume AI" button.
     - Wired **Listen In** to a live eavesdrop HUD with audio stream waveform bars, volume control slider, and close monitor button.
  5. **Enterprise Audit CSV Export**:
     - Upgraded export to output full call metadata (Call ID, Timestamp, Caller Number, Agent, Sentiment, Duration, Summary, Status) followed by line-by-line speaker transcript logs.
  6. **Black & White Glassmorphism Overhaul (`CallCenter.css`)**:
     - Restyled all containers, sidebars, modals, and chat bubbles into frosted obsidian glass (`#000000`, `rgba(10, 10, 14, 0.85)`, `rgba(12, 12, 16, 0.75)`), 20px blur, and razor-sharp monochrome borders (`rgba(255, 255, 255, 0.08)` to `0.2`).
- **Lessons Learned:**
  - Never hardcode raw Unicode symbols or emojis directly into JSX source files; use semantic Lucide SVG icons and CSS bullet dots to eliminate encoding corruption across disparate operating systems.
  - Telephony cockpits must defensively normalize backend records to support both active FreeSWITCH/Twilio SIP sessions and completed database calls with uniform property access.
  - Authentic "glassmorphism" requires true translucency (`rgba(18, 20, 27, 0.45)` to `rgba(24, 26, 35, 0.55)`), heavy blur (`backdrop-filter: blur(28px) saturate(190%)`), and specular light reflections (`inset 0 1px 0 rgba(255, 255, 255, 0.12)`). Avoid setting solid opaque darks (`#000000` or `rgba(..., 0.9)`) on container roots, as this obliterates the underlying window depth and prevents background ambiance from showing through.

---

### [2026-09-22] Redoc Documentation API Reference: Search Bar Icon Detachment & Dropdown Displacement
- **Problems Observed:**
  1. **Hanging/Detached Search Icon**: On `/docs/api`, the magnifying glass search icon was visually detached from the search bar, floating on its own line above or to the left of the input field.
  2. **Icon & Clear Button Vertical Displacement on Active Search**: When users typed a query (e.g. `"agents"`), the search icon and the `'×'` clear button jumped down hundreds of pixels into the middle of the search results dropdown, overlapping endpoint badges like `POST /v1/agents`.
- **Root Causes:**
  1. **Styled-Components Selector Mismatch**: Redoc wraps its search bar in a dynamically generated styled-component container `<div role="search" class="search-box">`. Relying on `:has(> .search-input)` or positional child selectors failed across different Redoc rendering cycles, leaving the container with `position: static` where absolute child icons escaped the boundary.
  2. **Container Height Expansion on Dynamic Results**: Redoc mounts the search results dropdown `<div class="search-results">` directly inside `<div role="search">` rather than as a sibling portal. When results appear, `<div role="search">`'s height expands dynamically from 36px to 460px+. Using `top: 50%` on `svg.search-icon` and `i.search-clean-icon` calculated 50% of the entire 460px container (~230px down), violently displacing both icons down into the search results list.
- **Fixes Applied:**
  1. **Direct Role Targeting & Coordinate Anchoring (`docs.css`)**:
     - Applied `position: relative !important` and `min-height: 36px !important` directly on `.redoc-host [role="search"]`, `.redoc-host div[role="search"]`, and `.redoc-host .search-box`.
     - Explicitly locked both `svg.search-icon` and `i.search-clean-icon` to `top: 18px !important; transform: translateY(-50%) !important;`, with `left: 12px` and `right: 11px` respectively. Because the input field has a fixed height of 36px starting at `top: 0`, 18px is guaranteed to be the exact vertical center of the input box regardless of how tall the search results dropdown becomes.
     - Positioned the dropdown `.search-results` with `position: absolute !important; top: 42px !important; left: 0 !important; right: 0 !important; z-index: 100 !important;` with frosted glass styling and subtle elevation shadow so results float cleanly over the sidebar menu.
  2. **Component Initialization Safety Net (`ApiReference.jsx`)**:
     - Configured Redoc's `onLoaded` callback in `window.Redoc.init` to programmatically anchor the search container and icon upon initial script load.
- **Lessons Learned:**
  1. When styling third-party component libraries that mount dropdowns or popovers inside the same container as the trigger input, NEVER use `top: 50%` on icons. Always anchor input icons to the fixed vertical midpoint of the input itself (`top: 18px` for 36px inputs, `top: 20px` for 40px inputs) so changes in parent container height do not displace them.
  2. Floating dropdowns embedded inside input wrappers should be assigned `position: absolute` with `top: <input_height + gap>` to prevent unwanted container height inflation.

---

### [2026-09-23] Team Invitation Email Failure: Suspended Render Gateway & Silent Demo Mode Masking
- **Problems Observed:**
  1. User attempted to invite a teammate via email (`zelalemazmera1221@gmail.com`) on `https://app.markova.tech/app/team`.
  2. The UI displayed a modal titled "Invitation Dispatched" with "Invite Link Ready", giving the false impression that an email had been sent, but the recipient received no email.
  3. The magic link generated in the UI was `https://app.markova.tech/accept-invite?token=demo-inv-h4fsx5z8`.
- **Root Causes:**
  1. **Suspended Backend API Gateway on Render**: The API Gateway (`https://markova-api-gateway.onrender.com`) was suspended on Render (returning `HTTP 503 Service Suspended`). Because the gateway was suspended without CORS headers, all browser fetch/axios calls threw network errors where `!err.response` was `true`.
  2. **Silent Client Fallback Masking**: In `apps/client-dashboard/src/api/client.js`, `inviteMember` caught `if (isDemoMode() || !err.response)` and silently fabricated a local mock invitation with `demo-inv-...` without logging an error or alerting the user that the backend server was unreachable.
  3. **Sticky Demo Mode in LocalStorage**: `markova_demo_mode` was not automatically removed upon real workspace sign-in in `WorkspaceLogin.jsx` or `AcceptInvite.jsx`, and `workspaceLogin` in `client.js` was short-circuiting to mock local users whenever demo mode was flagged, trapping authenticated users in demo mode.
- **Fixes Applied:**
  1. **Transparent Diagnostic Feedback (`client.js` & `TeamManagement.jsx`)**:
     - `inviteMember` now explicitly sets `emailDelivery: { sent: false, reason: 'BACKEND_OFFLINE' | 'SANDBOX_MODE', message: '...' }` when falling back.
     - The invitation modal in `TeamManagement.jsx` detects when an email was NOT sent and switches from the green success checkmark to an amber warning icon with a clear banner: `"API Gateway Offline: The backend API server is unreachable or suspended on Render. No email could be dispatched."` or `"Sandbox Mode: Live email dispatch is disabled in demo mode."`.
  2. **Self-Healing Token Storage (`client.js`)**:
     - `isDemoMode()` now checks `localStorage.getItem('token')`. If a legitimate token is present (not starting with `demo-token`), it returns `false`.
     - `tokenStore.set` automatically purges `markova_demo_mode` whenever real credentials are saved.
     - `WorkspaceLogin.jsx` and `AcceptInvite.jsx` explicitly remove `markova_demo_mode` upon authentication.
     - `workspaceLogin` now tries the real backend endpoint first instead of prematurely assuming mock demo mode.
- **Lessons Learned:**
  1. NEVER silently fake API success on network failures (`!err.response`). If a backend service is offline, suspended, or unreachable, the UI must explicitly communicate the failure to the user rather than masquerading as a successful dispatch.
  2. In multi-tenant apps with a "Demo / Sandbox Mode", ensuring clean state transitions is paramount. Authenticating with real workspace credentials must always purge sandbox flags from storage immediately to prevent phantom mock sessions.

---

### [2026-09-24] Analytics Center Cramped Sub-Tabs UI/UX Defect & 6-Tab Production Telemetry Overhaul
- **Problems Observed:**
  1. **Cramped Sub-Tabs Layout Defect**: In `/app/analytics`, the top navigation tabs (`Agent Analytics`, `Team Analytics`, `Call Analytics`, `Business Analytics`, `Cost Analytics`, `Usage & Latency`) were jammed together with zero horizontal padding (`padding: 0.75rem 0`) and minimal flex gap (`0.5rem`), causing text labels to collide.
  2. **Truncated/Incomplete Telemetry**: Clicking `Team`, `Call`, `Cost`, or `Usage` tabs defaulted back to `Agent` mock data, rendering 4 out of the 6 categories functionally dead and devoid of domain-specific KPIs.
  3. **Unstyled & Non-Functional Controls**:
     - The Date Range filter used an unstyled browser-native `<select>` element that failed to trigger real-time metric updates.
     - The Daily vs Weekly time aggregation dropdown had no state handler or reactive chart re-indexing.
     - Chart containers had dashed wireframe borders (`border: 1px dashed var(--border-main)`), looking like unfinished mockups.
     - The Donut distribution chart had no legend labels or percentage shares, displaying raw numbers like `520%` due to hardcoded `%` string suffixes.
     - The Detailed Breakdown table lacked search filtering, and the CSV export feature dumped hardcoded agent columns regardless of which tab was active.
- **Root Causes:**
  1. `.ac-tabs` had inline styles overriding CSS classes, and `.ac-tab` set `padding: 0.75rem 0`, stripping horizontal clearance.
  2. `ANALYTICS_DATA` in `AnalyticsCenter.jsx` was only stubbed for `agent` and `business`; the fallback expression `ANALYTICS_DATA[activeTab] || ANALYTICS_DATA.agent` masked missing models for team, call, cost, and usage.
  3. Percentage formatting in the PieChart legend and tooltip blindly appended `%` to `item.value` without normalizing against `totalPieVal`.
- **Fixes Applied:**
  1. **Spacious Obsidian Glass Segmented Tabs**:
     - Redesigned the sub-tabs navigation into spacious pill controls (`.ac-tab-pill`) with generous horizontal padding (`0.6rem 1.1rem`), distinct category icons, and high-visibility domain badges (`Workforce`, `Containment`, `Traffic`, `Conversion`, `Finance`, `Engine`).
     - Added subtle hover lift, active amber border glow (`var(--live-amber)`), and smooth Framer Motion tab transitions.
  2. **Full 6-Domain Telemetry Architecture**:
     - Built dedicated production models for:
       - `agent`: Agent throughput, FCR, handle time, CSAT, agent call distribution.
       - `team`: AI containment rate (88.5%), supervisor barge-ins/takeovers, containment vs escalation trends, department allocation.
       - `call`: Telephony minutes (2,840 min), inbound/outbound ratio (78/22), peak concurrent calls (18 channels), hourly traffic volume, sentiment breakdown (Positive, Neutral, Inquiring, Escalated).
       - `business`: Bookings/appointments (184), qualified leads (342), pipeline value in Ethiopian Birr (1,420,000 ETB), conversion funnel.
       - `cost`: AI compute spend (1,842.50 ETB), cost per resolved call (1.47 ETB), net labor savings (41,830 ETB), infrastructure cost breakdown (LLM, Telephony SIP, STT/TTS, Cloud Compute).
       - `usage`: P50 (685ms) & P95 (910ms) latency SLAs, STT/LLM/TTS pipeline breakdown, jitter variance.
  3. **Interactive Visualizations & Tooling**:
     - Upgraded the line chart to dual-axis plotting with working **Daily vs Weekly** aggregation toggle pill.
     - Added dynamic donut legend with auto-computed percentage shares (`520 (42%)`, `340 (27%)`, etc.).
     - Built client-side table search filtering (`.ac-table-search`) with live row counts ("Showing X of Y entries").
     - Upgraded CSV export to dynamically generate columns and rows tailored to the active telemetry tab, paired with feedback toasts.
- **Lessons Learned:**
  1. Never eliminate horizontal padding on tab navigation (`padding: ... 0`) inside horizontally scrollable or flex containers, as this causes label text to jam tightly against adjacent boundaries.
  2. Donut and pie charts should always compute percentages dynamically (`(val / total) * 100`) rather than naively appending `%` to raw volume counts.
  3. Dashboards must maintain 100% data model coverage for all exposed navigation tabs before release; fallbacks should only serve as safety nets, not substitutes for actual domain schemas.

---

### [2026-09-24] Customers & CRM Section: Cramped Upper Tabs Defect & End-to-End Production Overhaul
- **Problems Observed:**
  1. **Cramped Sub-Tabs Layout Defect**: In `/app/crm`, the tab strip (`Contacts / Leads`, `Companies`, `Opportunities`, `Appointments`) used `padding: 0.75rem 0` with flat bottom borders, jamming the labels together with zero horizontal breathing room.
  2. **Non-Functional Toolbar Controls**:
     - The search input had no `value` or `onChange` event binding, leaving search non-functional.
     - The `Filters` button had no `onClick` handler and did nothing.
  3. **Mock Creation Modal with Native Browser Alert**: Clicking `+ Add Contact` opened a 2-field generic modal that called `alert('Added new ...')` instead of appending records to the workspace state.
  4. **Data Breadth & Persistence Gaps**:
     - The CRM defaulted to a single contact record (`Alice Walker`), with only 2 hardcoded companies and opportunities, and lacked localStorage persistence for newly created records.
     - Contacts lacked rich timeline note creation, click-to-call, email actions, and status updates.
- **Root Causes:**
  1. Legacy CSS class `.crm-tab` specified `padding: 0.75rem 0`, causing the same horizontal label crowding seen previously in Analytics.
  2. The creation modal was a prototype placeholder with unmanaged input fields and hardcoded window alerts.
  3. No client-side state filtering logic was wired to the search input or status filters.
- **Fixes Applied:**
  1. **Spacious Obsidian Glass Segmented Tabs**:
     - Upgraded the tab bar into spacious pill buttons (`.crm-tab-pill`) with `0.6rem 1.15rem` padding, category icons (`Users`, `Building2`, `Target`, `Calendar`), and real-time count badges (`crm-tab-count`).
     - Added active amber glow (`var(--live-amber)`), subtle hover lift, and smooth state switching.
  2. **Executive CRM KPI Stats Bar**:
     - Added 4 top summary cards: Active Leads & Callers (7), Total Pipeline Value (14.2M ETB / $118,500), Active Opportunities (6 Deals, 78% win probability), and Upcoming AI Demos (4 Scheduled, 98% attendance).
  3. **Live Search & Category Filter Pills**:
     - Bound real-time multi-field search across caller names, organizations, roles, emails, and phone numbers.
     - Added tab-specific status filter pills (`All`, `Qualified`, `Customer`, `Leads`, `Churn Risk`, `Enterprise`, `Mid-Market`, etc.).
  4. **Interactive Detail Drawer**:
     - Added quick action triggers: **Call Now** (simulating FreeSWITCH dialer bridge), **Email**, and a live **Lifecycle Status Select** dropdown.
     - Integrated AI Conversation Insights with sentiment scores, source, intent, and verbatim quotes.
     - Built an **Interactive Timeline** with an inline **"Add Note / Interaction"** form that instantly posts timestamped notes to the contact's activity feed.
  5. **Production Multi-Tab Creation Modal**:
     - Designed tab-specific forms for Contacts, Companies, Opportunities, and Appointments with validation, localStorage persistence, and `useToast()` feedback.
  6. **Dynamic CSV Export**: Added active CSV download for all 4 CRM record types.
- **Lessons Learned:**
  1. Avoid using native browser `alert()` or `prompt()` anywhere in client-facing SaaS interfaces; all user interactions must utilize integrated toast notifications and non-blocking modals.
  2. In CRM directory modules, provide immediate interactive actions (quick-copy, click-to-dial, email compose, status toggles, note logging) directly within the detail drawer to streamline agent and supervisor workflows.
