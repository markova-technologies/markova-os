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
 * Prod: set VITE_DOCS_URL (e.g. https://docs.markova.et) or reverse-proxy at /docs
 */
export const DOCS_URL =
  import.meta.env.VITE_DOCS_URL ||
  (import.meta.env.DEV ? 'http://localhost:3002' : '/docs')
