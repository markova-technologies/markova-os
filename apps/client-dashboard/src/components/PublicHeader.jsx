import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bot, Menu, X, ArrowRight, Sparkles } from 'lucide-react'
import { ROUTES } from '../config/site'
import './PublicHeader.css'

const PublicHeader = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  const isActive = (path) => {
    if (path === ROUTES.home) return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <header className="public-header glass-panel">
      <div className="public-header-inner">
        <Link to={ROUTES.home} className="public-brand">
          <div className="public-brand-icon">
            <Bot size={22} className="brand-bot-icon" />
          </div>
          <div className="public-brand-text">
            <span className="brand-name">MARKOVA</span>
            <span className="brand-badge">OS</span>
          </div>
        </Link>

        <nav className="public-nav-desktop">
          <Link to={ROUTES.home} className={`public-nav-link ${isActive(ROUTES.home) ? 'active' : ''}`}>
            Home
          </Link>
          <Link to={ROUTES.pricing} className={`public-nav-link ${isActive(ROUTES.pricing) ? 'active' : ''}`}>
            Pricing
          </Link>
          <Link to={ROUTES.docs} className={`public-nav-link ${isActive(ROUTES.docs) ? 'active' : ''}`}>
            Documentation
          </Link>
        </nav>

        <div className="public-header-actions">
          <Link to={ROUTES.login} className="public-btn-ghost">
            Sign In
          </Link>
          <Link to={ROUTES.signup} className="public-btn-primary">
            <span>Get Started</span>
            <ArrowRight size={16} />
          </Link>
          <button
            className="public-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="public-mobile-menu glass-panel">
          <Link
            to={ROUTES.home}
            className={`public-mobile-link ${isActive(ROUTES.home) ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Home
          </Link>
          <Link
            to={ROUTES.pricing}
            className={`public-mobile-link ${isActive(ROUTES.pricing) ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Pricing
          </Link>
          <Link
            to={ROUTES.docs}
            className={`public-mobile-link ${isActive(ROUTES.docs) ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Documentation
          </Link>
          <div className="public-mobile-actions">
            <Link
              to={ROUTES.login}
              className="public-btn-ghost w-full"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign In
            </Link>
            <Link
              to={ROUTES.signup}
              className="public-btn-primary w-full"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>Get Started</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

export default PublicHeader
