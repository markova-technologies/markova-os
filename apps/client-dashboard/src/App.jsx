import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import CommandCenter from './pages/CommandCenter'
import OnboardingCenter from './pages/OnboardingCenter'
import AgentStudio from './pages/AgentStudio'
import AgentBuilder from './pages/AgentBuilder'
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
import { supabase } from './config/supabase'
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
    let mounted = true

    // 1. Subscribe to Supabase auth events (OAuth redirect, sign-in, token refresh)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (session?.access_token) {
        tokenStore.set(session.access_token, session.refresh_token)
        const userData = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0],
          companyName: session.user.user_metadata?.companyName || 'Markova Enterprise',
        }
        localStorage.setItem('user', JSON.stringify(userData))
        setIsAuthenticated(true)
        setUser(userData)

        // Clear ugly OAuth hash fragment from browser URL address bar
        if (window.location.hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname === '/' ? '/app' : window.location.pathname)
        }
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false)
        setUser(null)
      }
    })

    // 2. Initial token & session verification
    const verifyToken = async () => {
      // Check Supabase session first (handles OAuth callback or existing Supabase session)
      try {
        const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: {} }))
        if (session?.access_token && mounted) {
          tokenStore.set(session.access_token, session.refresh_token)
          const userData = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0],
            companyName: session.user.user_metadata?.companyName || 'Markova Enterprise',
          }
          localStorage.setItem('user', JSON.stringify(userData))
          setIsAuthenticated(true)
          setUser(userData)

          if (window.location.hash.includes('access_token')) {
            window.history.replaceState(null, '', window.location.pathname === '/' ? '/app' : window.location.pathname)
          }
          return
        }
      } catch (err) {
        console.warn('Supabase getSession check failed:', err)
      }

      // Local demo session (Vercel without API, or explicit demo login).
      if (isDemoMode()) {
        try {
          const saved = JSON.parse(localStorage.getItem('user') || 'null')
          if (saved && mounted) {
            setIsAuthenticated(true)
            setUser(saved)
            return
          }
        } catch {
          // fall through
        }
      }

      let token = tokenStore.get()

      if (!token) return

      try {
        const { data } = await getMe()
        if (mounted) {
          setIsAuthenticated(true)
          setUser(data)
          localStorage.setItem('user', JSON.stringify(data))
        }
      } catch (err) {
        // Token invalid or expired
        tokenStore.clear()
        if (mounted) {
          setIsAuthenticated(false)
          setUser(null)
        }
      }
    }

    verifyToken()

    return () => {
      mounted = false
      authListener?.subscription?.unsubscribe()
    }
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
                          <Route path="agent-builder" element={<AgentBuilder />} />
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
