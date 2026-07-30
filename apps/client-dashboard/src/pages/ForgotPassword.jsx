import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import PublicHeader from '../components/PublicHeader'
import './Signup.css'
import { IoArrowBack, IoMail, IoCheckmarkCircle, IoCloseCircle, IoTimeOutline } from 'react-icons/io5'

const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle, submitting, pending, approved, rejected, error
  const [message, setMessage] = useState('')
  const pollRef = useRef(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const startPolling = (submittedEmail) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_SYSTEM_DASHBOARD_URL}/api/clients/reset-request-status?email=${encodeURIComponent(submittedEmail)}`
        )
        const { status: reqStatus } = res.data

        if (reqStatus === 'approved') {
          clearInterval(pollRef.current)
          setStatus('approved')
        } else if (reqStatus === 'rejected') {
          clearInterval(pollRef.current)
          setStatus('rejected')
        }
      } catch (e) {
        // Silent polling error handling
      }
    }, 5000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('submitting')
    setMessage('')

    try {
      await axios.post(`${import.meta.env.VITE_SYSTEM_DASHBOARD_URL}/api/clients/request-password-reset`, { email })
      setStatus('pending')
      startPolling(email)
    } catch (err) {
      setStatus('error')
      setMessage(err.response?.data?.error || 'Failed to submit request. Please try again.')
    }
  }

  const renderContent = () => {
    if (status === 'approved') {
      return (
        <div className="success-container glass-card" style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div className="success-icon" style={{ background: 'var(--icon-success-bg)', color: 'var(--icon-success-color)' }}>
            <IoCheckmarkCircle size={48} />
          </div>
          <h2>Request Approved!</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            A password reset link has been sent to <strong>{email}</strong>. Check your inbox.
          </p>
          <Link to="/login" className="signup-button" style={{ display: 'flex', textDecoration: 'none', justifyContent: 'center' }}>
            Back to Sign In
          </Link>
        </div>
      )
    }

    if (status === 'rejected') {
      return (
        <div className="success-container glass-card" style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div className="success-icon" style={{ background: 'var(--icon-danger-bg)', color: 'var(--icon-danger-color)' }}>
            <IoCloseCircle size={48} />
          </div>
          <h2 style={{ color: '#ef4444' }}>Request Declined</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            Your password reset request was not approved. Please contact system support.
          </p>
          <Link to="/login" className="signup-button" style={{ display: 'flex', textDecoration: 'none', justifyContent: 'center' }}>
            Back to Sign In
          </Link>
        </div>
      )
    }

    if (status === 'pending') {
      return (
        <div className="success-container glass-card" style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div className="success-icon" style={{ background: 'var(--icon-primary-bg)', color: 'var(--icon-primary-color)' }}>
            <IoTimeOutline size={48} />
          </div>
          <h2>Awaiting Admin Approval</h2>
          <p style={{ marginBottom: '0.5rem' }}>
            Your reset request for <strong>{email}</strong> has been submitted.
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            This page will automatically update once approved...
          </p>
          <Link to="/login" className="link-button" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <IoArrowBack /> Back to Sign In
          </Link>
        </div>
      )
    }

    return (
      <div className="signup-container glass-card" style={{ gridTemplateColumns: '1fr', maxWidth: '480px', margin: '0 auto' }}>
        <div className="signup-right" style={{ width: '100%', background: 'transparent' }}>
          <div className="signup-form-container">
            <div className="signup-header">
              <h2>Reset Password</h2>
              <p>Enter your registered account email</p>
            </div>

            <form onSubmit={handleSubmit} className="signup-form">
              <div className="form-group">
                <label htmlFor="email">Work Email</label>
                <div className="input-wrapper">
                  <IoMail className="input-icon" size={18} />
                  <input
                    type="email"
                    id="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                {status === 'submitting' ? 'Submitting Request...' : 'Request Password Reset'}
              </button>

              <div className="signup-footer" style={{ marginTop: '1.5rem' }}>
                <Link to="/login" className="link-button" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <IoArrowBack /> Back to Sign In
                </Link>
              </div>
            </form>
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

export default ForgotPassword
