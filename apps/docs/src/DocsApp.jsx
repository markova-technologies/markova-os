import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { DocsBaseProvider } from './docsBase'
import DocsLayout from './components/DocsLayout'
import Home from './pages/Home'
import Quickstart from './pages/Quickstart'
import Agents from './pages/concepts/Agents'
import Calls from './pages/concepts/Calls'
import Numbers from './pages/concepts/Numbers'
import Knowledge from './pages/concepts/Knowledge'
import Environments from './pages/concepts/Environments'
import WebhooksConcept from './pages/concepts/WebhooksConcept'
import ApiReference from './pages/ApiReference'
import WebhooksGuide from './pages/WebhooksGuide'
import Sdks from './pages/Sdks'
import Pricing from './pages/Pricing'
import Changelog from './pages/Changelog'

/** Absolute path under optional base (`''` or `/docs`). */
const p = (base, path) => {
  if (!base) return path
  if (path === '/') return base
  return `${base}${path}`
}

/**
 * Full Markova docs site.
 * `base` is '' for the standalone docs app, or '/docs' when embedded in the client.
 */
const DocsApp = ({ base = '' }) => (
  <DocsBaseProvider base={base}>
    <Routes>
      <Route path={p(base, '/api')} element={<ApiReference />} />
      <Route
        path={base ? `${base}/*` : '/*'}
        element={
          <DocsLayout>
            <Routes>
              <Route path={p(base, '/')} element={<Home />} />
              <Route path={p(base, '/quickstart')} element={<Quickstart />} />
              <Route path={p(base, '/concepts/agents')} element={<Agents />} />
              <Route path={p(base, '/concepts/calls')} element={<Calls />} />
              <Route path={p(base, '/concepts/numbers')} element={<Numbers />} />
              <Route path={p(base, '/concepts/knowledge')} element={<Knowledge />} />
              <Route path={p(base, '/concepts/environments')} element={<Environments />} />
              <Route path={p(base, '/concepts/webhooks')} element={<WebhooksConcept />} />
              <Route path={p(base, '/webhooks')} element={<WebhooksGuide />} />
              <Route path={p(base, '/sdks')} element={<Sdks />} />
              <Route path={p(base, '/pricing')} element={<Pricing />} />
              <Route path={p(base, '/changelog')} element={<Changelog />} />
              <Route path="*" element={<Navigate to={p(base, '/')} replace />} />
            </Routes>
          </DocsLayout>
        }
      />
    </Routes>
  </DocsBaseProvider>
)

export default DocsApp
