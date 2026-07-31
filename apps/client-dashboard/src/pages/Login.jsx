import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, ArrowRight, BarChart3, Brain, Shield, Bot, Sparkles } from 'lucide-react'
import {
  login as loginRequest,
  loginWithGoogle,
  tokenStore,
  DEMO_CREDENTIALS,
  DEMO_USER,
  enterDemoMode,
  DEMO_MODE_KEY,
} from '../api/client'
import PublicHeader from '../components/PublicHeader'
import './Login.css'

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '8px' }}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
  </svg>
)


const Login = ({ onLogin }) => {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const { data } = await loginRequest(formData.email, formData.password)
      const { token, refreshToken, user } = data

      tokenStore.set(token, refreshToken)
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.removeItem(DEMO_MODE_KEY)

      onLogin(user)
    } catch (err) {
      if (err.response?.status === 401) {
        setError('That email and password don’t match. Try again.')
      } else {
        setError('We couldn’t sign you in just now. Try again in a moment.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle()
    } catch (err) {
      setError(err.message || 'Google sign-in failed. Check your Supabase Google OAuth setup.')
    }
  }

  const handleDemoLogin = async () => {
    setDemoLoading(true)
    setError('')
    try {
      const { data } = await loginRequest(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password)
      tokenStore.set(data.token, data.refreshToken)
      localStorage.setItem('user', JSON.stringify(data.user))
      localStorage.removeItem(DEMO_MODE_KEY)
      onLogin(data.user)
    } catch {
      // API unreachable (e.g. Vercel without gateway) — local demo shell.
      enterDemoMode()
      onLogin(DEMO_USER)
    } finally {
      setDemoLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
    if (error) setError('')
  }

  return (
    <div className="login-page-wrapper">
      <PublicHeader />

      <main className="login-page-main">
        <motion.div
          className="login-container glass-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="login-left">
            <motion.div
              className="login-brand"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <div className="brand-hero-badge">
                <Sparkles size={14} />
                <span>MARKOVA AI OPERATING SYSTEM</span>
              </div>
              <h1>Welcome to Markova</h1>
              <p>Autonomous AI agents powering real business workflows across your organization</p>
            </motion.div>

            <motion.div
              className="features"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              <div className="feature">
                <div className="feature-icon">
                  <BarChart3 size={22} />
                </div>
                <div>
                  <h3>Real-time Analytics</h3>
                  <p>Monitor performance & conversation metrics live</p>
                </div>
              </div>
              <div className="feature">
                <div className="feature-icon">
                  <Brain size={22} />
                </div>
                <div>
                  <h3>Autonomous Agents</h3>
                  <p>Multi-lingual AI agents trained for complex tasks</p>
                </div>
              </div>
              <div className="feature">
                <div className="feature-icon">
                  <Shield size={22} />
                </div>
                <div>
                  <h3>Enterprise Security</h3>
                  <p>Encrypted telemetry, RBAC & strict privacy standards</p>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div
            className="login-right"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <div className="login-form-container">
              <div className="login-header">
                <h2>Sign In</h2>
                <p>Access your AI workforce dashboard</p>
              </div>

              {error && (
                <motion.div
                  className="error-message"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <span>{error}</span>
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="login-form">
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <div className="input-wrapper">
                    <Mail className="input-icon" size={18} />
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="name@company.com"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <div className="input-wrapper">
                    <Lock className="input-icon" size={18} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="form-options">
                  <label className="checkbox">
                    <input type="checkbox" />
                    <span className="checkmark"></span>
                    Remember me
                  </label>
                  <Link to="/forgot-password" className="forgot-password">
                    Forgot password?
                  </Link>
                </div>

                <motion.button
                  type="submit"
                  className="login-button"
                  disabled={isLoading || demoLoading}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  {isLoading ? (
                    <div className="spinner"></div>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </motion.button>

                <button
                  type="button"
                  className="google-login-button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading || demoLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justify-content: 'center',
                    width: '100%',
                    padding: '0.75rem',
                    marginTop: '0.75rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <GoogleIcon />
                  <span>Sign in with Google</span>
                </button>
              </form>

              <div className="login-demo-divider" aria-hidden="true">
                <span>OR</span>
              </div>

              <button
                type="button"
                className="login-demo-button"
                onClick={handleDemoLogin}
                disabled={isLoading || demoLoading}
              >
                {demoLoading ? 'Opening demo…' : 'Developer Demo Login'}
              </button>
              <p className="login-demo-hint">
                Instantly explore the system dashboard in demo mode.
              </p>

              <div className="login-footer">
                <p>
                  Don&apos;t have an account?{' '}
                  <Link to="/signup" className="link-button">
                    Create Account
                  </Link>
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}

export default Login
