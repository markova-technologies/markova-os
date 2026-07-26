/**
 * Client public + app route map.
 * Keep paths stable: `/` is marketing, `/app/*` is the product shell.
 */
export const ROUTES = {
  home: '/',
  pricing: '/pricing',
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  /** Authenticated product shell — real system dashboard lives under here */
  app: '/app',
  onboarding: '/app/onboarding',
  agentStudio: '/app/agent-studio',
  knowledge: '/app/knowledge',
  numbers: '/app/numbers',
  keys: '/app/keys',
  integrations: '/app/integrations',
  callCenter: '/app/call-center',
  usage: '/app/usage',
  settings: '/app/settings',
  /** In-app invoices / plan management (after login) */
  billing: '/app/billing',
}

/**
 * Docs site origin.
 * Dev: http://localhost:3002
 * Prod: set VITE_DOCS_URL (e.g. https://docs.markova.et) or reverse-proxy at /docs
 */
export const DOCS_URL =
  import.meta.env.VITE_DOCS_URL ||
  (import.meta.env.DEV ? 'http://localhost:3002' : '/docs')
