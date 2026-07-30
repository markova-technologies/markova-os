import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Bot, Phone, BarChart3, Menu } from 'lucide-react'
import { ROUTES } from '../config/site'
import './MobileBottomBar.css'

const MobileBottomBar = ({ toggleMobileMenu }) => {
  const location = useLocation()

  const isActive = (path) => {
    if (path === ROUTES.app) return location.pathname === '/app' || location.pathname === '/app/'
    return location.pathname.startsWith(path)
  }

  return (
    <nav className="mobile-bottom-bar glass-panel" aria-label="Mobile Navigation">
      <Link
        to={ROUTES.app}
        className={`mobile-bottom-link ${isActive(ROUTES.app) ? 'active' : ''}`}
      >
        <LayoutDashboard size={20} />
        <span>Dashboard</span>
      </Link>

      <Link
        to={ROUTES.agentStudio}
        className={`mobile-bottom-link ${isActive(ROUTES.agentStudio) ? 'active' : ''}`}
      >
        <Bot size={20} />
        <span>Agents</span>
      </Link>

      <Link
        to={ROUTES.callCenter}
        className={`mobile-bottom-link ${isActive(ROUTES.callCenter) ? 'active' : ''}`}
      >
        <Phone size={20} />
        <span>Calls</span>
      </Link>

      <Link
        to={ROUTES.analytics}
        className={`mobile-bottom-link ${isActive(ROUTES.analytics) ? 'active' : ''}`}
      >
        <BarChart3 size={20} />
        <span>Analytics</span>
      </Link>

      <button
        type="button"
        className="mobile-bottom-link"
        onClick={toggleMobileMenu}
        aria-label="Open Full Navigation Menu"
      >
        <Menu size={20} />
        <span>Menu</span>
      </button>
    </nav>
  )
}

export default MobileBottomBar
