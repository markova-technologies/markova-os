import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, User, Building, Phone, CheckCircle, AlertCircle, ArrowRight, Sparkles } from 'lucide-react'
import { register as registerRequest, login as loginRequest, tokenStore } from '../api/client'
import PublicHeader from '../components/PublicHeader'
import './Signup.css'

const Signup = ({ onBackToLogin, onLogin }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    company: '',
    phone: ''
  })

  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})

  const validateForm = () => {
    const newErrors = {}

    if (!formData.name.trim()) newErrors.name = 'Name is required'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid'
    if (!formData.password) newErrors.password = 'Password is required'
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters'
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match'
    if (!formData.company.trim()) newErrors.company = 'Company name is required'
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)
    setError('')

    try {
      await registerRequest({
        name: formData.name,
        companyName: formData.company,
        email: formData.email,
        password: formData.password
      })

      // Registration returns the user; sign in immediately to start onboarding.
      const { data } = await loginRequest(formData.email, formData.password)
      tokenStore.set(data.token, data.refreshToken)
      localStorage.setItem('user', JSON.stringify(data.user))

      if (onLogin) {
        onLogin(data.user)
      } else {
        setSuccess(true)
      }
    } catch (err) {
      console.error('Registration/Login error:', err);
      const specificMsg = err.message || err.error_description || err.hint || err.details || err.response?.data?.error || err.response?.data?.message || (typeof err === 'string' ? err : JSON.stringify(err));
      if (err.response?.status === 409 || err.code === 'user_already_exists' || specificMsg?.toLowerCase().includes('already registered') || specificMsg?.toLowerCase().includes('already exists')) {
        setError('That email is already registered. Try signing in instead.');
      } else {
        setError(`Supabase/Backend Error: ${specificMsg}`);
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  if (success) {
    return (
      <div className="signup-page-wrapper">
        <PublicHeader />
        <main className="signup-page-main">
          <motion.div
            className="success-container glass-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="success-icon">
              <CheckCircle size={54} />
            </div>
            <h2>Account Registered Successfully!</h2>
            <p>Your account is ready. Continue to access your dashboard.</p>
            <button className="signup-button" style={{ maxWidth: '220px', margin: '1.5rem auto 0' }} onClick={onBackToLogin}>
              Proceed to Sign In
            </button>
          </motion.div>
        </main>
      </div>
    )
  }

  return (
    <div className="signup-page-wrapper">
      <PublicHeader />

      <main className="signup-page-main">
        <motion.div
          className="signup-container glass-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="signup-left">
            <motion.div
              className="signup-brand"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <div className="brand-hero-badge">
                <Sparkles size={14} />
                <span>BUILD YOUR AI WORKFORCE</span>
              </div>
              <h1>Get Started with Markova</h1>
              <p>Deploy specialized AI voice & chat agents tailored to your business operations</p>
            </motion.div>

            <motion.div
              className="features"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              <div className="feature">
                <div className="feature-icon">
                  <CheckCircle size={22} />
                </div>
                <div>
                  <h3>Free Sandbox API Keys</h3>
                  <p>Build and test with free sandbox keys — zero charges or setup friction</p>
                </div>
              </div>
              <div className="feature">
                <div className="feature-icon">
                  <Lock size={22} />
                </div>
                <div>
                  <h3>Isolated Knowledge Base</h3>
                  <p>Your business documents train only your agents with absolute privacy</p>
                </div>
              </div>
              <div className="feature">
                <div className="feature-icon">
                  <User size={22} />
                </div>
                <div>
                  <h3>Instant Telephony Integration</h3>
                  <p>Provision phone channels and connect your agents in minutes</p>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div
            className="signup-right"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <div className="signup-form-container">
              <div className="signup-header">
                <h2>Create Account</h2>
                <p>Enter your details to create your Markova account</p>
              </div>

              <form onSubmit={handleSubmit} className="signup-form">
                {error && (
                  <div className="error-message">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="name">Full Name</label>
                    <div className="input-wrapper">
                      <User className="input-icon" size={18} />
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="John Doe"
                        className={errors.name ? 'error' : ''}
                      />
                    </div>
                    {errors.name && <span className="error-text">{errors.name}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="company">Company</label>
                    <div className="input-wrapper">
                      <Building className="input-icon" size={18} />
                      <input
                        type="text"
                        id="company"
                        name="company"
                        value={formData.company}
                        onChange={handleChange}
                        placeholder="Acme Corp"
                        className={errors.company ? 'error' : ''}
                      />
                    </div>
                    {errors.company && <span className="error-text">{errors.company}</span>}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="email">Work Email</label>
                  <div className="input-wrapper">
                    <Mail className="input-icon" size={18} />
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="name@company.com"
                      className={errors.email ? 'error' : ''}
                    />
                  </div>
                  {errors.email && <span className="error-text">{errors.email}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <div className="input-wrapper">
                    <Phone className="input-icon" size={18} />
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+251 91 123 4567"
                      className={errors.phone ? 'error' : ''}
                    />
                  </div>
                  {errors.phone && <span className="error-text">{errors.phone}</span>}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <div className="input-wrapper">
                      <Lock className="input-icon" size={18} />
                      <input
                        type="password"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        className={errors.password ? 'error' : ''}
                      />
                    </div>
                    {errors.password && <span className="error-text">{errors.password}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirmPassword">Confirm Password</label>
                    <div className="input-wrapper">
                      <Lock className="input-icon" size={18} />
                      <input
                        type="password"
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="••••••••"
                        className={errors.confirmPassword ? 'error' : ''}
                      />
                    </div>
                    {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
                  </div>
                </div>

                <motion.button
                  type="submit"
                  className="signup-button"
                  disabled={isLoading}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  {isLoading ? (
                    <div className="spinner"></div>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </motion.button>
              </form>

              <div className="signup-footer">
                <p>
                  Already have an account?{' '}
                  <Link to="/login" className="link-button">
                    Sign In
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

export default Signup