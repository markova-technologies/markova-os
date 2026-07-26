/**
 * Admin public + console route map.
 * `/` is marketing landing; console lives under named paths (not `/`).
 */
export const ROUTES = {
  home: '/',
  dashboard: '/dashboard',
  companies: '/companies',
  revenue: '/revenue',
  calls: '/calls',
  health: '/health',
  usage: '/usage',
  tickets: '/tickets',
  audit: '/audit',
  settings: '/settings',
}

/**
 * Docs site origin.
 * Dev: http://localhost:3002
 * Prod: set VITE_DOCS_URL to the deployed docs origin (do not use same-origin /docs).
 */
export const DOCS_URL =
  import.meta.env.VITE_DOCS_URL ||
  (import.meta.env.DEV ? 'http://localhost:3002' : '')
