import React, { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ExternalLink, Menu, X } from 'lucide-react'
import Waveform from '../../../../packages/ui/waveform/Waveform'

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

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || 'http://localhost:3001'

const DocsLayout = ({ children, wide = false }) => {
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()

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

        <Link to="/" className="docs-brand">
          {/* Nav accent only — the waveform does live work in the dashboard, not here. */}
          <span className="docs-brand-mark">
            <Waveform size="strip" env="test" ariaLabel="" />
          </span>
          MARKOVA
          <span className="docs-brand-tag">docs</span>
        </Link>

        <nav className="docs-topbar-links">
          <NavLink to="/quickstart">Quickstart</NavLink>
          <NavLink to="/api">API</NavLink>
          <NavLink to="/pricing">Pricing</NavLink>
          <a className="docs-cta" href={DASHBOARD_URL}>
            Open dashboard <ExternalLink size={13} />
          </a>
        </nav>
      </header>

      <div className="docs-body">
        <aside className={`docs-nav ${navOpen ? 'is-open' : ''}`} aria-label="Documentation">
          {NAV.map((group) => (
            <div className="docs-nav-group" key={group.title}>
              <p className="docs-nav-title">{group.title}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => (isActive ? 'is-active' : '')}
                >
                  {item.label}
                </NavLink>
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
