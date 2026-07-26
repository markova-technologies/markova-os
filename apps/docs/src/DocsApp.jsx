import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { DocsBaseProvider, docsPath } from './docsBase'
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

/**
 * Full Markova docs site.
 * Relative routes + pathless layout so this works:
 * - standalone at `/` (apps/docs)
 * - embedded under `/docs/*` in the client dashboard
 */
const DocsApp = ({ base = '' }) => (
  <DocsBaseProvider base={base}>
    <Routes>
      <Route path="api" element={<ApiReference />} />
      <Route element={<DocsLayout />}>
        <Route index element={<Home />} />
        <Route path="quickstart" element={<Quickstart />} />
        <Route path="concepts/agents" element={<Agents />} />
        <Route path="concepts/calls" element={<Calls />} />
        <Route path="concepts/numbers" element={<Numbers />} />
        <Route path="concepts/knowledge" element={<Knowledge />} />
        <Route path="concepts/environments" element={<Environments />} />
        <Route path="concepts/webhooks" element={<WebhooksConcept />} />
        <Route path="webhooks" element={<WebhooksGuide />} />
        <Route path="sdks" element={<Sdks />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="changelog" element={<Changelog />} />
        <Route path="*" element={<Navigate to={docsPath(base, '/')} replace />} />
      </Route>
    </Routes>
  </DocsBaseProvider>
)

export default DocsApp
