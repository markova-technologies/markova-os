import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import CommandCenter from './pages/CommandCenter'
import OnboardingCenter from './pages/OnboardingCenter'
import AgentStudio from './pages/AgentStudio'
import FlowBuilder from './pages/FlowBuilder'
import KnowledgeCenter from './pages/KnowledgeCenter'
import IntegrationHub from './pages/IntegrationHub'
import PhoneChannels from './pages/PhoneChannels'
import CallCenter from './pages/CallCenter'
import AnalyticsCenter from './pages/AnalyticsCenter'
import CRM from './pages/CRM'
import Settings from './pages/Settings'
import BillingCenter from './pages/BillingCenter'
import Governance from './pages/Governance'
import Organization from './pages/Organization'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import axios from 'axios'

import { DataProvider } from './contexts/SimpleDataContext'
import { ToastProvider } from './contexts/ToastContext'
import realTimeService from './services/realTimeService'
import unifiedDataService from './services/unifiedDataService'
import AmharicVoiceAgent from './components/AmharicVoiceAgent'
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

      const token = localStorage.getItem('token')
      const userData = localStorage.getItem('user')

      if (token && userData) {
        try {
          const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/auth/verify-token`, { token })

          if (response.data.valid) {
            setIsAuthenticated(true)
            setUser(JSON.parse(userData))
            realTimeService.connect()
          }
        } catch (err) {
          // Token invalid or expired
          console.error('Session expired:', err)
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setIsAuthenticated(false)
          setUser(null)
        }
      }
    }

    verifyToken()

    // Listen for successful connection to switch to real data
    realTimeService.on('connected', () => {
      console.log('Connected to AI agent - switching to real data mode')
      unifiedDataService.switchToRealData(realTimeService)
    })

    return () => {
      realTimeService.off('connected', () => { })
    }
  }, [])

  const handleLogin = (userData) => {
    setIsAuthenticated(true)
    setUser(userData)
    // Connect to real-time service on fresh login
    realTimeService.connect()

    const onboardingDone = localStorage.getItem('onboardingComplete')
    if (!onboardingDone) {
      navigate('/onboarding')
    } else {
      navigate('/')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    realTimeService.disconnect()
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
              <Signup onBackToLogin={() => navigate('/login')} />
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
              <DataProvider>
                <div className="app-container">
                  <AmharicVoiceAgent />
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
                        <Route path="/flow-builder" element={<FlowBuilder />} />
                        <Route path="/knowledge" element={<KnowledgeCenter />} />
                        <Route path="/integrations" element={<IntegrationHub />} />
                        <Route path="/channels" element={<PhoneChannels />} />
                        <Route path="/call-center" element={<CallCenter />} />
                        <Route path="/analytics" element={<AnalyticsCenter />} />
                        <Route path="/crm" element={<CRM />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/billing" element={<BillingCenter />} />
                        <Route path="/governance" element={<Governance />} />
                        <Route path="/organization" element={<Organization />} />
                        {/* Catch-all for authenticated users */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </div>
                  </div>
                </div>
              </DataProvider>
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