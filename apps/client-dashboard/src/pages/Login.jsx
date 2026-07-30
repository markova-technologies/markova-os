import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, ArrowRight, BarChart3, Brain, Shield, Bot, Sparkles } from 'lucide-react'
import {
  login as loginRequest,
  tokenStore,
  DEMO_CREDENTIALS,
  DEMO_USER,
  enterDemoMode,
  DEMO_MODE_KEY,
} from '../api/client'
import PublicHeader from '../components/PublicHeader'
import './Login.css'

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
