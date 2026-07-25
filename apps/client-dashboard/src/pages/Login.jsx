import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { motion } from 'framer-motion'
import { Phone, Mail, Lock, Eye, EyeOff, ArrowRight, BarChart3, Brain, Shield } from 'lucide-react'
import './Login.css'

const Login = ({ onLogin, onSwitchToSignup }) => {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSsoMode, setIsSsoMode] = useState(false)
  const [ssoCompanyId, setSsoCompanyId] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('') // Clear previous errors

    try {
      const response = await axios.post(`${import.meta.env.VITE_SYSTEM_DASHBOARD_URL}/api/clients/login`, {
        email: formData.email,
        password: formData.password
      })

      const { token, client } = response.data

      // Store token and user data
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(client))

      // Update parent state
      onLogin(client)
      navigate('/dashboard')

    } catch (err) {
      if (err.response?.status === 403) {
        setError('Your account is pending approval. Please wait for admin confirmation.')
      } else if (err.response?.status === 401) {
        setError('Invalid email or password')
      } else {
        setError(err.message || 'Login failed. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSsoSubmit = async (e) => {
    e.preventDefault()
    if (!ssoCompanyId) return setError('Company ID is required for SSO')
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.get(`${import.meta.env.VITE_SYSTEM_DASHBOARD_URL || 'http://localhost:8000'}/api/auth/sso/login/${ssoCompanyId}`)
      if (response.data.loginUrl) {
        window.location.href = response.data.loginUrl // Redirect to IdP
      }
    } catch (err) {
      setError('SSO not configured for this company ID')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    // Clear error when user starts typing again
    if (error) setError('')
  }

  return (
    <div className="login-page">
      <motion.div
        className="login-container"
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
            <h1>MARKOVA</h1>
            <p>Advanced analytics for your customer interactions</p>
          </motion.div>

          <motion.div
            className="features"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <div className="feature">
              <div className="feature-icon">
                <BarChart3 size={24} />
              </div>
              <div>
                <h3>Real-time Analytics</h3>
                <p>Monitor performance metrics in real-time</p>
              </div>
            </div>
            <div className="feature">
              <div className="feature-icon">
                <Brain size={24} />
              </div>
              <div>
                <h3>AI-Powered Insights</h3>
                <p>Get intelligent recommendations</p>
              </div>
            </div>
            <div className="feature">
              <div className="feature-icon">
                <Shield size={24} />
              </div>
              <div>
                <h3>Secure & Reliable</h3>
                <p>Enterprise-grade security</p>
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
              <h2>Welcome Back</h2>
              <p>Sign in to your account to continue</p>
            </div>

            {error && (
              <motion.div 
                className="error-message p-3 mb-8 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg flex gap-2 items-center"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <span>{error}</span>
              </motion.div>
            )}

            {!isSsoMode ? (
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
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
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
                <Link to="/forgot-password" className="forgot-password">Forgot password?</Link>
              </div>

              <motion.button
                type="submit"
                className="login-button"
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isLoading ? (
                  <div className="spinner"></div>
                ) : (
                  <>
                    Sign In
                    <ArrowRight size={18} />
                  </>
                )}
                  </motion.button>
                </form>
              ) : (
                <form onSubmit={handleSsoSubmit} className="login-form">
                  <div className="form-group">
                    <label htmlFor="ssoCompanyId">Company ID</label>
                    <div className="input-wrapper">
                      <Shield className="input-icon" size={18} />
                      <input
                        type="text"
                        id="ssoCompanyId"
                        name="ssoCompanyId"
                        value={ssoCompanyId}
                        onChange={(e) => setSsoCompanyId(e.target.value)}
                        placeholder="e.g. markova-inc"
                        required
                      />
                    </div>
                  </div>
                  <motion.button
                    type="submit"
                    className="login-button sso-button mt-4"
                    disabled={isLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                  >
                    {isLoading ? <div className="spinner"></div> : 'Continue with SAML SSO'}
                  </motion.button>
                </form>
              )}

            <div className="text-center mt-6">
              <button 
                onClick={() => setIsSsoMode(!isSsoMode)} 
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {isSsoMode ? '← Back to Email Login' : 'Enterprise SSO Login'}
              </button>
            </div>

            <div className="login-footer">
              <p>Don't have an account? <button onClick={onSwitchToSignup} className="link-button">Create Account</button></p>
              
              <button 
                onClick={() => onLogin({ name: "Dev User", email: "dev@markova.test", id: "dev-1" })}
                className="mt-4 px-4 py-2 w-full border border-dashed border-primary-500 text-primary-500 rounded-lg hover:bg-primary-500/10 text-sm font-semibold transition-colors"
                type="button"
              >
                🛠️ Bypass Login (Dev Mode)
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default Login