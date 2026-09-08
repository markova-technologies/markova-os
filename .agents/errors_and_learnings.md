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
ame, prompt, and 	eam_id, completely omitting the  oice_provider,  oice_id, model_provider, and model_id fields. The backend ( gent-builder) strictly validated these fields and rejected the request with 400 Bad Request. Additionally, when the agent was created, the UI cleared the editingAgent state, immediately kicking the user out of the builder so they couldn't test it.
- **Lesson Learned:** Always ensure that frontend payloads match backend validation requirements. Additionally, after creating a new entity, update the UI state with the new entity's ID (instead of nulling it) so the user can continue their workflow (e.g., testing the new agent).s session)
