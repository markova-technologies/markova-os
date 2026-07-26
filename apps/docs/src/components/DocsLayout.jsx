import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ExternalLink, Menu, X } from 'lucide-react'
import Waveform from '../../../../packages/ui/waveform/Waveform'
import { DocsLink, DocsNavLink, useDocsBase } from '../docsBase'

const NAV = [
  {
    title: 'Start here',
    items: [
      { to: '/', label: 'Welcome', end: true },
      { to: '/quickstart', label: 'Quickstart' },
    ],
  },
  {
    title: 'Core concepts',
    items: [
      { to: '/concepts/agents', label: 'Agents' },
      { to: '/concepts/calls', label: 'Calls' },
      { to: '/concepts/numbers', label: 'Numbers' },
      { to: '/concepts/knowledge', label: 'Knowledge' },
      { to: '/concepts/environments', label: 'Sandbox vs Live' },
      { to: '/concepts/webhooks', label: 'Webhooks' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { to: '/api', label: 'API reference' },
      { to: '/webhooks', label: 'Webhooks guide' },
      { to: '/sdks', label: 'SDKs' },
    ],
  },
  {
    title: 'Product',
    items: [
      { to: '/pricing', label: 'Pricing' },
      { to: '/changelog', label: 'Changelog' },
    ],
  },
]

const DocsLayout = ({ children, wide = false }) => {
  const [navOpen, setNavOpen] = useState(false)
  const base = useDocsBase()
  const location = useLocation()
  // When docs are embedded under the client app, stay on the same origin.
  const dashboardHref = base
    ? '/'
    : import.meta.env.VITE_DASHBOARD_URL || 'http://localhost:3001'

  useEffect(() => {
    setNavOpen(false)
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="docs-shell">
      <header className="docs-topbar">
        <button
          className="docs-menu-toggle"
          onClick={() => setNavOpen((open) => !open)}
          aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={navOpen}
        >
          {navOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <DocsLink to="/" className="docs-brand">
          <span className="docs-brand-mark">
            <Waveform size="strip" env="test" ariaLabel="" />
          </span>
          MARKOVA
          <span className="docs-brand-tag">docs</span>
        </DocsLink>

        <nav className="docs-topbar-links">
          <DocsNavLink to="/quickstart">Quickstart</DocsNavLink>
          <DocsNavLink to="/api">API</DocsNavLink>
          <DocsNavLink to="/pricing">Pricing</DocsNavLink>
          <a className="docs-cta" href={dashboardHref}>
            {base ? 'Back to Markova' : 'Open dashboard'} <ExternalLink size={13} />
          </a>
        </nav>
      </header>

      <div className="docs-body">
        <aside className={`docs-nav ${navOpen ? 'is-open' : ''}`} aria-label="Documentation">
          {NAV.map((group) => (
            <div className="docs-nav-group" key={group.title}>
              <p className="docs-nav-title">{group.title}</p>
              {group.items.map((item) => (
                <DocsNavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => (isActive ? 'is-active' : '')}
                >
                  {item.label}
                </DocsNavLink>
              ))}
            </div>
          ))}
        </aside>

        <main className={`docs-main ${wide ? 'is-wide' : ''}`}>{children}</main>
      </div>
    </div>
  )
}

export default DocsLayout
