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
