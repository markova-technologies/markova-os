# 🐛 Markova AI Agent: Errors, Bugs, and Faults Log

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
- **Error/Fault:** \ModuleNotFoundError: No module named 'structlog'\ in \markova-knowledge-service\ on Render.
- **How it Happened:** \structlog\ and \httpx\ were imported and used in the codebase but were never added to the \equirements.txt\ file. The deployment container crashed during startup because the packages were not installed by pip.
- **Lesson Learned:** Always double-check \equirements.txt\ (or the respective package manager manifest) when adding new libraries or features to a Python service to ensure the production environment receives the exact same dependencies as the development environment.

---

### [2026-08-10] Render Deployment: OpenTelemetry v2 Constructor Change
- **Error/Fault:** \TypeError: Resource is not a constructor\ in \markova-api-gateway\ on Render.
- **How it Happened:** The service upgraded to \@opentelemetry/resources\ version 2.x, which removed the \Resource\ class constructor from its public API. The code was still trying to instantiate \
ew Resource({ ... })\, which crashed Node.js.
- **Lesson Learned:** When debugging \TypeError\ constructor issues in dependencies, aggressively check the package versions in \package.json\ and consult the \
pm\ registry or package source code. OpenTelemetry v2 requires using the \esourceFromAttributes()\ factory function instead of \
ew Resource()\.

---

### [2026-08-29] Git Push Hanging on Bloated Zip Archive (>100MB Hard Limit)
- **Error/Fault:** `git push origin main` stalled indefinitely on `POST git-receive-pack` when attempting to push 348 MB with over 15,000 files.
- **How it Happened:** A local research directory (`research-repos/`) contained `crewAI.zip` (187.8 MB) and uncompressed doc trees. Staging all files inadvertently committed a single binary file greater than GitHub's 100 MB limit, causing GitHub's receive-pack hook to hang/reject the HTTP payload without a clear immediate error.
- **Lesson Learned:** 
  1. Always add `*.zip`, build archives, and raw research dumps to `.gitignore` before bulk staging.
  2. Treat third-party repositories as git submodules rather than committing raw directory contents.
  3. Verify object and payload sizes before pushing large batches to remote git servers.
