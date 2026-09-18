import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'

// Lazy loaded page components for optimal initial bundle & fast navigation
const CommandCenter = lazy(() => import('./pages/CommandCenter'))
const OnboardingCenter = lazy(() => import('./pages/OnboardingCenter'))
const AgentStudio = lazy(() => import('./pages/AgentStudio'))
const AgentBuilder = lazy(() => import('./pages/AgentBuilder'))
const KnowledgeCenter = lazy(() => import('./pages/KnowledgeCenter'))
const IntegrationHub = lazy(() => import('./pages/IntegrationHub'))
const CallCenter = lazy(() => import('./pages/CallCenter'))
const UsageCenter = lazy(() => import('./pages/UsageCenter'))
const AnalyticsCenter = lazy(() => import('./pages/AnalyticsCenter'))
const Settings = lazy(() => import('./pages/Settings'))
const BillingCenter = lazy(() => import('./pages/BillingCenter'))
const Keys = lazy(() => import('./pages/Keys'))
const PhoneChannels = lazy(() => import('./pages/PhoneChannels'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Pricing = lazy(() => import('./pages/Pricing'))
const DocsSite = lazy(() => import('./pages/DocsSite'))
const CRM = lazy(() => import('./pages/CRM'))
const Governance = lazy(() => import('./pages/Governance'))
const Organization = lazy(() => import('./pages/Organization'))
const Notifications = lazy(() => import('./pages/Notifications'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const TeamManagement = lazy(() => import('./pages/TeamManagement'))
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'))

import { getMe, login as loginRequest, logout as logoutRequest, tokenStore, isDemoMode } from './api/client'
import { supabase } from './config/supabase'
import { ROUTES } from './config/site'

import { ToastProvider } from './contexts/ToastContext'
import { AuthProvider } from './contexts/AuthContext'
import { EnvironmentProvider } from './contexts/EnvironmentContext'
import RequirePermission from './components/RequirePermission'
import EnvironmentStrip from './components/EnvironmentStrip'
import SystemHealthBar from './components/SystemHealthBar'
import ImpersonationBanner from './components/ImpersonationBanner'
import MobileBottomBar from './components/MobileBottomBar'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'

const PageLoadingFallback = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    padding: '2rem',
    width: '100%',
    boxSizing: 'border-box'
  }}>
    <div style={{
      height: '34px',
      width: '260px',
      background: 'rgba(255, 255, 255, 0.08)',
      borderRadius: '8px',
      animation: 'pulse 1.5s infinite ease-in-out'
    }} />
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '1.25rem'
    }}>
      {[1, 2, 3, 4].map(k => (
        <div key={k} style={{
          height: '160px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '14px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          animation: 'pulse 1.5s infinite ease-in-out'
        }} />
      ))}
    </div>
  </div>
)

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
      <AuthProvider initialUser={user}>
        <Suspense fallback={<PageLoadingFallback />}>
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

            {/* Public auth & invite acceptance */}
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
            <Route
              path={ROUTES.acceptInvite}
              element={<AcceptInvite onLogin={handleLogin} />}
            />

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
                          <ErrorBoundary key={location.pathname} resetKey={location.pathname}>
                            <Suspense fallback={<PageLoadingFallback />}>
                              <Routes>
                                <Route index element={<CommandCenter />} />
                                <Route path="onboarding" element={<OnboardingCenter />} />
                                <Route path="dashboard" element={<Navigate to={ROUTES.app} replace />} />
                                <Route path="team" element={<RequirePermission permission="users:read"><TeamManagement /></RequirePermission>} />
                                <Route path="agent-studio" element={<RequirePermission permission="agents:read"><AgentStudio /></RequirePermission>} />
                                <Route path="agent-builder" element={<RequirePermission permission="agents:write"><AgentBuilder /></RequirePermission>} />
                                <Route path="knowledge" element={<RequirePermission permission="knowledge:read"><KnowledgeCenter /></RequirePermission>} />
                                <Route path="phone-channels" element={<RequirePermission permission="telephony:read"><PhoneChannels /></RequirePermission>} />
                                <Route path="keys" element={<RequirePermission permission="keys:read"><Keys /></RequirePermission>} />
                                <Route path="integrations" element={<RequirePermission permission="integrations:read"><IntegrationHub /></RequirePermission>} />
                                <Route path="call-center" element={<RequirePermission permission="calls:read"><CallCenter /></RequirePermission>} />
                                <Route path="call-center/:callId" element={<RequirePermission permission="calls:read"><CallCenter /></RequirePermission>} />
                                <Route path="usage" element={<RequirePermission permission="analytics:read"><UsageCenter /></RequirePermission>} />
                                <Route path="analytics" element={<RequirePermission permission="analytics:read"><AnalyticsCenter /></RequirePermission>} />
                                <Route path="settings" element={<Settings />} />
                                <Route path="billing" element={<RequirePermission permission="billing:read"><BillingCenter /></RequirePermission>} />
                                <Route path="crm" element={<RequirePermission permission="crm:read"><CRM /></RequirePermission>} />
                                <Route path="governance" element={<RequirePermission permission="governance:read"><Governance /></RequirePermission>} />
                                <Route path="organization" element={<RequirePermission permission="users:read"><Organization /></RequirePermission>} />
                                <Route path="notifications" element={<Notifications />} />
                                <Route path="*" element={<Navigate to={ROUTES.app} replace />} />
                              </Routes>
                            </Suspense>
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
        </Suspense>
      </AuthProvider>
    </ToastProvider>
  )
}

export default App
