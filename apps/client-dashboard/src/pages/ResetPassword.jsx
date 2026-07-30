import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import axios from 'axios'
import PublicHeader from '../components/PublicHeader'
import './Signup.css'
import { IoLockClosed, IoCheckmarkCircle, IoArrowBack } from 'react-icons/io5'

const ResetPassword = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('idle') // idle, submitting, success, error
  const [isValidating, setIsValidating] = useState(true)

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setStatus('error')
        setMessage('Invalid or missing reset token.')
        setIsValidating(false)
        return
      }
      setIsValidating(false)
    }

    validateToken()
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      setMessage('Passwords do not match')
      setStatus('error')
      return
    }

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters')
      setStatus('error')
      return
    }

    setStatus('submitting')
    setMessage('')

    try {
      await axios.post(`${import.meta.env.VITE_SYSTEM_DASHBOARD_URL}/api/clients/reset-password`, {
        token,
        password
      })
      setStatus('success')
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err) {
      setStatus('error')
      setMessage(err.response?.data?.error || 'Failed to reset password. Token may be expired.')
    }
  }

  const renderContent = () => {
    if (isValidating) {
      return (
        <div className="success-container glass-card" style={{ maxWidth: '440px', margin: '0 auto' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
          <p>Verifying security token...</p>
        </div>
      )
    }

    if (!token) {
      return (
        <div className="success-container glass-card" style={{ maxWidth: '440px', margin: '0 auto' }}>
          <h2 style={{ color: '#ef4444' }}>Invalid Token</h2>
          <p style={{ marginBottom: '1.5rem' }}>This password reset link is invalid or has expired.</p>
          <Link to="/login" className="signup-button" style={{ display: 'flex', textDecoration: 'none', justifyContent: 'center' }}>
            Back to Sign In
          </Link>
        </div>
      )
    }

    return (
      <div className="signup-container glass-card" style={{ gridTemplateColumns: '1fr', maxWidth: '480px', margin: '0 auto' }}>
        <div className="signup-right" style={{ width: '100%', background: 'transparent' }}>
          <div className="signup-form-container">
            <div className="signup-header">
              <h2>Set New Password</h2>
              <p>Enter your new secure account password</p>
            </div>

            {status === 'success' ? (
              <div className="success-container" style={{ padding: '1rem 0' }}>
                <div className="success-icon" style={{ background: 'var(--icon-success-bg)', color: 'var(--icon-success-color)' }}>
                  <IoCheckmarkCircle size={48} />
                </div>
                <h2>Password Reset Successful!</h2>
                <p>Redirecting you to sign in...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="signup-form">
                <div className="form-group">
                  <label htmlFor="password">New Password</label>
                  <div className="input-wrapper">
                    <IoLockClosed className="input-icon" size={18} />
                    <input
                      type="password"
                      id="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={status === 'submitting'}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm New Password</label>
                  <div className="input-wrapper">
                    <IoLockClosed className="input-icon" size={18} />
                    <input
                      type="password"
                      id="confirmPassword"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={status === 'submitting'}
                    />
                  </div>
                </div>

                {status === 'error' && (
                  <div className="error-message">
                    <span>{message}</span>
                  </div>
                )}

                <button type="submit" className="signup-button" disabled={status === 'submitting'}>
                  {status === 'submitting' ? 'Updating Password...' : 'Reset Password'}
                </button>

                <div className="signup-footer" style={{ marginTop: '1.5rem' }}>
                  <Link to="/login" className="link-button" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <IoArrowBack /> Back to Sign In
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="signup-page-wrapper">
      <PublicHeader />
      <main className="signup-page-main">{renderContent()}</main>
    </div>
  )
}

export default ResetPassword
