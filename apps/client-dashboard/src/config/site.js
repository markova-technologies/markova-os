/**
 * Client public + app route map.
 * Keep paths stable: `/` is marketing, `/app/*` is the product shell.
 */
export const ROUTES = {
  home: '/',
  pricing: '/pricing',
  docs: '/docs',
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  /** Authenticated product shell — real system dashboard lives under here */
  app: '/app',
  onboarding: '/app/onboarding',
  agentStudio: '/app/agent-studio',
  knowledge: '/app/knowledge',
  phoneChannels: '/app/phone-channels',
  keys: '/app/keys',
  integrations: '/app/integrations',
  callCenter: '/app/call-center',
  usage: '/app/usage',
  analytics: '/app/analytics',
  settings: '/app/settings',
  crm: '/app/crm',
  governance: '/app/governance',
  organization: '/app/organization',
  /** In-app invoices / plan management (after login) */
  billing: '/app/billing',
}
