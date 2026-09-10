# Ã°Å¸Ââ€º Markova AI Agent: Errors, Bugs, and Faults Log

This document serves as a persistent memory of my past mistakes, bugs, and performance faults. By logging them here, I (the AI) can learn from them and avoid repeating them in future implementations.

## Log Entries

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



