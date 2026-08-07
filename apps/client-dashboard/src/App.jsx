import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import CommandCenter from './pages/CommandCenter'
import OnboardingCenter from './pages/OnboardingCenter'
import AgentStudio from './pages/AgentStudio'
import KnowledgeCenter from './pages/KnowledgeCenter'
import IntegrationHub from './pages/IntegrationHub'
import CallCenter from './pages/CallCenter'
import UsageCenter from './pages/UsageCenter'
import AnalyticsCenter from './pages/AnalyticsCenter'
import Settings from './pages/Settings'
import BillingCenter from './pages/BillingCenter'
import Keys from './pages/Keys'
import PhoneChannels from './pages/PhoneChannels'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Pricing from './pages/Pricing'
import DocsSite from './pages/DocsSite'
import CRM from './pages/CRM'
import Governance from './pages/Governance'
import Organization from './pages/Organization'
import Notifications from './pages/Notifications'
import LandingPage from './pages/LandingPage'
import { getMe, login as loginRequest, logout as logoutRequest, tokenStore, isDemoMode } from './api/client'
import { ROUTES } from './config/site'


import { ToastProvider } from './contexts/ToastContext'
import { EnvironmentProvider } from './contexts/EnvironmentContext'
import EnvironmentStrip from './components/EnvironmentStrip'
import SystemHealthBar from './components/SystemHealthBar'
import ImpersonationBanner from './components/ImpersonationBanner'
import MobileBottomBar from './components/MobileBottomBar'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const [user, setUser] = useState(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const verifyToken = async () => {
      // Local demo session (Vercel without API, or explicit demo login).
      if (isDemoMode()) {
        try {
          const saved = JSON.parse(localStorage.getItem('user') || 'null')
          if (saved) {
            setIsAuthenticated(true)
            setUser(saved)
            return
          }
        } catch {
          // fall through
        }
      }

      let token = tokenStore.get()

      // Local auto-login only in development.
      if (!token && import.meta.env.DEV) {
        try {
          const { data } = await loginRequest('demo@markova.et', 'MarkovaDemo2026!')
          tokenStore.set(data.token, data.refreshToken)
          localStorage.setItem('user', JSON.stringify(data.user))
          token = data.token
        } catch (err) {
          // Demo auto-login failed; fall back to the normal login flow.
        }
      }

      if (!token) return

      try {
        const { data } = await getMe()
        setIsAuthenticated(true)
        setUser(data)
        localStorage.setItem('user', JSON.stringify(data))
      } catch (err) {
        // Token invalid or expired
        tokenStore.clear()
        setIsAuthenticated(false)
        setUser(null)
      }
    }

    verifyToken()
  }, [])

  const handleLogin = (userData) => {
    setIsAuthenticated(true)
    setUser(userData)

    const onboardingDone = localStorage.getItem('onboardingComplete')
    if (!onboardingDone) {
      navigate(ROUTES.onboarding)
    } else {
      navigate(ROUTES.app)
    }
  }

  const handleLogout = () => {
    logoutRequest().catch(() => {})
    setIsAuthenticated(false)
    setUser(null)
    tokenStore.clear()
    localStorage.removeItem('user')
    navigate(ROUTES.home)
  }

  return (
    <ToastProvider>
      <Routes>
        {/* Root: redirect authenticated users to /app, everyone else to LandingPage */}
        <Route
          path={ROUTES.home}
          element={
            isAuthenticated
              ? <Navigate to={ROUTES.app} replace />
              : <LandingPage />
          }
        />

        {/* Public product pages — before authenticated /app dashboard */}
        <Route path={ROUTES.pricing} element={<Pricing />} />
        <Route path={`${ROUTES.docs}/*`} element={<DocsSite />} />

        {/* Public auth */}
        <Route
          path={ROUTES.login}
          element={
            isAuthenticated ? (
              <Navigate to={ROUTES.app} replace />
            ) : (
              <Login
                onLogin={handleLogin}
                onSwitchToSignup={() => navigate(ROUTES.signup)}
              />
            )
          }
        />
        <Route
          path={ROUTES.signup}
          element={
            isAuthenticated ? (
              <Navigate to={ROUTES.app} replace />
            ) : (
              <Signup onBackToLogin={() => navigate(ROUTES.login)} onLogin={handleLogin} />
            )
          }
        />
        <Route path={ROUTES.forgotPassword} element={<ForgotPassword />} />
        <Route path={ROUTES.resetPassword} element={<ResetPassword />} />

        {/* Authenticated product shell — all console UI under /app/* */}
        <Route
          path={`${ROUTES.app}/*`}
          element={
            isAuthenticated ? (
              <EnvironmentProvider>
                <div className="app-container">
                  <ImpersonationBanner user={user} />
                  <SystemHealthBar />
                  <EnvironmentStrip />
                  <Sidebar
                    onLogout={handleLogout}
                    isOpen={isMobileMenuOpen}
                    toggleMenu={toggleMobileMenu}
                  />
                  <div className={`main-content ${isMobileMenuOpen ? 'menu-open' : ''}`}>
                    <Header
                      user={user}
                      onLogout={handleLogout}
                      toggleMobileMenu={toggleMobileMenu}
                    />
                    {isMobileMenuOpen && (
                      <div className="mobile-overlay" onClick={toggleMobileMenu} />
                    )}
                    <div className="content-wrapper">
                      <ErrorBoundary>
                        <Routes>
                          <Route index element={<CommandCenter />} />
                          <Route path="onboarding" element={<OnboardingCenter />} />
                          <Route path="dashboard" element={<Navigate to={ROUTES.app} replace />} />
                          <Route path="agent-studio" element={<AgentStudio />} />
                          <Route path="knowledge" element={<KnowledgeCenter />} />
                          <Route path="phone-channels" element={<PhoneChannels />} />
                          <Route path="keys" element={<Keys />} />
                          <Route path="integrations" element={<IntegrationHub />} />
                          <Route path="call-center" element={<CallCenter />} />
                          <Route path="call-center/:callId" element={<CallCenter />} />
                          <Route path="usage" element={<UsageCenter />} />
                          <Route path="analytics" element={<AnalyticsCenter />} />
                          <Route path="settings" element={<Settings />} />
                          <Route path="billing" element={<BillingCenter />} />
                          <Route path="crm" element={<CRM />} />
                          <Route path="governance" element={<Governance />} />
                          <Route path="organization" element={<Organization />} />
                          <Route path="notifications" element={<Notifications />} />
                          <Route path="*" element={<Navigate to={ROUTES.app} replace />} />
                        </Routes>
                      </ErrorBoundary>
                    </div>
                  </div>
                  <MobileBottomBar toggleMobileMenu={toggleMobileMenu} />
                </div>
              </EnvironmentProvider>
            ) : (
              <Navigate to={ROUTES.login} state={{ from: location }} replace />
            )
          }
        />

        <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
      </Routes>
    </ToastProvider>
  )
}

export default App
