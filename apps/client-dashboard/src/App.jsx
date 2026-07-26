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
import Settings from './pages/Settings'
import BillingCenter from './pages/BillingCenter'
import Keys from './pages/Keys'
import Numbers from './pages/Numbers'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import { getMe, logout as logoutRequest, tokenStore } from './api/client'

import { ToastProvider } from './contexts/ToastContext'
import { EnvironmentProvider } from './contexts/EnvironmentContext'
import EnvironmentStrip from './components/EnvironmentStrip'
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
      // Skip verification for public routes
      const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password']
      if (publicRoutes.includes(location.pathname)) {
        return
      }

      const token = tokenStore.get()

      if (token) {
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
    }

    verifyToken()
  }, [])

  const handleLogin = (userData) => {
    setIsAuthenticated(true)
    setUser(userData)

    const onboardingDone = localStorage.getItem('onboardingComplete')
    if (!onboardingDone) {
      navigate('/onboarding')
    } else {
      navigate('/')
    }
  }

  const handleLogout = () => {
    logoutRequest().catch(() => {})
    setIsAuthenticated(false)
    setUser(null)
    tokenStore.clear()
    navigate('/login')
  }




  return (
    <ToastProvider>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <Login
                onLogin={handleLogin}
                onSwitchToSignup={() => navigate('/signup')}
              />
            )
          }
        />
        <Route
          path="/signup"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <Signup onBackToLogin={() => navigate('/login')} onLogin={handleLogin} />
            )
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />



        {/* Main App Routes - Require authentication */}
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <EnvironmentProvider>
                <div className="app-container">
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
                      <Routes>
                        <Route path="/" element={<CommandCenter />} />
                        <Route path="/onboarding" element={<OnboardingCenter />} />
                        <Route path="/dashboard" element={<Navigate to="/" replace />} />
                        <Route path="/agent-studio" element={<AgentStudio />} />
                        <Route path="/knowledge" element={<KnowledgeCenter />} />
                        <Route path="/numbers" element={<Numbers />} />
                        <Route path="/keys" element={<Keys />} />
                        <Route path="/integrations" element={<IntegrationHub />} />
                        <Route path="/call-center" element={<CallCenter />} />
                        <Route path="/call-center/:callId" element={<CallCenter />} />
                        <Route path="/usage" element={<UsageCenter />} />
                        <Route path="/analytics" element={<Navigate to="/usage" replace />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/billing" element={<BillingCenter />} />
                        {/* Catch-all for authenticated users */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </div>
                  </div>
                </div>
              </EnvironmentProvider>
            ) : (
              <Navigate to="/login" state={{ from: location }} replace />
            )
          }
        />
      </Routes>
    </ToastProvider>
  )
}

export default App