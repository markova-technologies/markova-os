import { useState } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import { Mail, Lock, User, Building, Phone, CheckCircle, AlertCircle } from 'lucide-react'
import './Signup.css'

const Signup = ({ onBackToLogin }) => {
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
      // API call to System Dashboard
      const response = await axios.post(`${import.meta.env.VITE_SYSTEM_DASHBOARD_URL}/api/clients/register`, {
        name: formData.name,
        company: formData.company,
        email: formData.email,
        phone: formData.phone,
        password: formData.password
      })

      setSuccess(true)
      setFormData({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        company: '',
        phone: ''
      })

    } catch (err) {
      if (err.response?.status === 409) {
        setError('Email already registered')
      } else if (err.response?.data?.error) {
        setError(err.response.data.error)
      } else {
        setError(err.message || 'Registration failed. Please try again.')
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

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  if (success) {
    return (
      <div className="signup-page">
        <motion.div
          className="success-container"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="success-icon">
            <CheckCircle size={64} />
          </div>
          <h2>Registration Successful!</h2>
          <p>Your account is pending approval. You'll receive an email once approved.</p>
          <button className="signup-button" style={{ maxWidth: '200px', margin: '0 auto' }} onClick={onBackToLogin}>
            Back to Login
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="signup-page">
      <motion.div
        className="signup-container"
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
            <div className="brand-icon">
              <Phone size={32} />
            </div>
            <h1>MARKOVA</h1>
            <p>Join our advanced AI call center platform</p>
          </motion.div>

          <motion.div
            className="features"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <div className="feature">
              <div className="feature-icon">
                <CheckCircle size={24} />
              </div>
              <div>
                <h3>Approval Required</h3>
                <p>All accounts are reviewed for security</p>
              </div>
            </div>
            <div className="feature">
              <div className="feature-icon">
                <Lock size={24} />
              </div>
              <div>
                <h3>Secure Platform</h3>
                <p>Enterprise-grade security for your data</p>
              </div>
            </div>
            <div className="feature">
              <div className="feature-icon">
                <User size={24} />
              </div>
              <div>
                <h3>Easy Management</h3>
                <p>Simple user administration dashboard</p>
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
              <p>Sign up to access our AI call center platform</p>
            </div>

            <form onSubmit={handleSubmit} className="signup-form">
              {error && (
                <div className="error-message">
                  <AlertCircle size={16} />
                  {error}
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
                      placeholder="Enter your full name"
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
                      placeholder="Enter your company name"
                      className={errors.company ? 'error' : ''}
                    />
                  </div>
                  {errors.company && <span className="error-text">{errors.company}</span>}
                </div>
              </div>

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
                    placeholder="Enter your phone number"
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
                      placeholder="Create a password"
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
                      placeholder="Confirm your password"
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
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isLoading ? (
                  <div className="spinner"></div>
                ) : (
                  'Create Account'
                )}
              </motion.button>
            </form>

            <div className="signup-footer">
              <p>Already have an account? <button onClick={onBackToLogin} className="link-button">Sign In</button></p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default Signup