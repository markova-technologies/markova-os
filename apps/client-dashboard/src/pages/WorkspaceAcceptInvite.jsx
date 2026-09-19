import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ShieldCheck, Lock, Mail, User, Eye, EyeOff, AlertCircle,
  Building2, Sparkles, ArrowRight, CheckCircle2, KeyRound
} from 'lucide-react'
import { verifyInvitation, acceptInvitation, tokenStore } from '../api/client'
import { supabase } from '../config/supabase'
import { ROUTES } from '../config/site'
import { useToast } from '../contexts/ToastContext'
import './WorkspaceLogin.css'

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '8px' }}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
  </svg>
)

export default function WorkspaceAcceptInvite({ onLogin }) {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [inviteData, setInviteData] = useState(null)
  const [error, setError] = useState(null)

  // Form State
  const [name, setName] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [authMethod, setAuthMethod] = useState('password') // 'password' | 'sso'

  // 1. Verify token on mount
  useEffect(() => {
    let mounted = true
    const checkToken = async () => {
      if (!token) {
        setError('No invitation token was provided in this URL.')
        setLoading(false)
        return
      }

      try {
        const res = await verifyInvitation(token)
        if (mounted) {
          if (res.data?.success && res.data.invitation) {
            setInviteData(res.data.invitation)
            if (res.data.invitation.email) {
              setEmailInput(res.data.invitation.email)
            }
          } else {
            setError(res.data?.error || 'Invalid or expired invitation link')
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err.response?.data?.error || 'This invitation link is invalid or has already been used.')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    checkToken()
    return () => {
      mounted = false
    }
  }, [token])

  // 2. Submit account activation
  const handleSubmit = async (e) => {
    e.preventDefault()
    const userEmail = (inviteData?.email || emailInput || '').trim().toLowerCase()

    if (!userEmail) {
      setError('Please provide your work email address')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await acceptInvitation({
        token,
        email: userEmail,
        name: name.trim() || userEmail.split('@')[0],
        password
      })

      if (res.data?.success && res.data.token) {
        tokenStore.set(res.data.token, res.data.refreshToken)
        localStorage.setItem('user', JSON.stringify(res.data.user))
        localStorage.setItem('onboardingComplete', 'true')

        if (onLogin && res.data.user) {
          onLogin(res.data.user)
        }
        addToast(`Welcome to the ${inviteData?.companyName || 'Markova OS'} workspace!`, 'success')
        navigate(ROUTES.app, { replace: true })
      } else {
        setError(res.data?.error || 'Failed to activate workspace account')
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to complete workspace activation')
    } finally {
      setSubmitting(false)
    }
  }

  // 3. SSO OAuth Handler
  const handleGoogleSSO = async () => {
    try {
      setSubmitting(true)
      const currentWorkspaceSlug = slug || inviteData?.companySlug || 'workspace'
      const redirectUrl = `${window.location.origin}/workspace/${currentWorkspaceSlug}/accept-invite?token=${token}`
      const { error: ssoErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl
        }
      })
      if (ssoErr) throw ssoErr
    } catch (err) {
      setError(err.message || 'Google SSO authentication failed')
      setSubmitting(false)
    }
  }

  const getInitials = (orgName) => {
    if (!orgName) return 'WS'
    return orgName
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  if (loading) {
    return (
      <div className="workspace-login-wrapper">
        <div className="workspace-login-card loading-card">
          <div className="workspace-spinner" />
          <p className="workspace-loading-text">Validating your workspace invitation...</p>
        </div>
      </div>
    )
  }

  if (error && !inviteData) {
    return (
      <div className="workspace-login-wrapper">
        <div className="workspace-login-card error-card">
          <div className="markova-hero-header">
            <div className="markova-emblem">
              <Sparkles size={18} className="sparkle-icon" />
              <span className="markova-wordmark">MARKOVA OS</span>
            </div>
            <p className="markova-hero-tagline">AI Call Center & Operating System</p>
          </div>

          <div className="error-icon-box">
            <AlertCircle size={32} />
          </div>

          <h2 className="workspace-error-title">Invalid Invitation Link</h2>
          <p className="workspace-error-desc">
            {error || 'This workspace invitation has expired or has already been redeemed.'}
          </p>

          <div className="error-actions">
            <Link
              to={slug ? `/workspace/${slug}` : ROUTES.login}
              className="primary-link-btn"
            >
              Go to Workspace Login
            </Link>
          </div>

          <footer className="workspace-footer">
            Powered by <strong>Markova OS</strong> · markova.io
          </footer>
        </div>
      </div>
    )
  }

  const companyName = inviteData?.companyName || 'Enterprise Workspace'

  return (
    <div className="workspace-login-wrapper">
      <div className="ambient-glow ambient-top-left" />
      <div className="ambient-glow ambient-bottom-right" />

      <motion.div
        className="workspace-login-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* PRIMARY BRAND: Markova OS (Dominant Hero Brand) */}
        <div className="markova-hero-header">
          <div className="markova-emblem">
            <div className="emblem-hex">
              <Sparkles size={15} className="sparkle-icon" />
            </div>
            <span className="markova-wordmark">MARKOVA OS</span>
            <span className="markova-badge">INVITATION</span>
          </div>
          <p className="markova-hero-tagline">You've been invited to join an AI workforce workspace</p>
        </div>

        <div className="workspace-divider" />

        {/* SECONDARY BRAND: Organization Scope */}
        <div className="org-secondary-header">
          <div className="org-avatar-container">
            {inviteData?.companyLogo ? (
              <img
                src={inviteData.companyLogo}
                alt={companyName}
                className="org-logo-image"
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.nextSibling.style.display = 'flex'
                }}
              />
            ) : null}
            <div
              className="org-avatar-fallback"
              style={{ display: inviteData?.companyLogo ? 'none' : 'flex' }}
            >
              <Building2 size={20} className="org-fallback-icon" />
              <span>{getInitials(companyName)}</span>
            </div>
          </div>

          <div className="org-text-meta">
            <h2 className="org-name">Join {companyName}</h2>
          </div>
          <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
            <span className="workspace-slug-pill">
              Role: <strong>{inviteData?.roleDisplayName || inviteData?.role || 'Team Member'}</strong>
            </span>
            {inviteData?.departmentName && (
              <span className="workspace-slug-pill">
                Dept: {inviteData.departmentName}
              </span>
            )}
          </div>
        </div>

        {error && (
          <motion.div
            className="workspace-error-banner"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Option C: Method Toggle (Password vs Google SSO) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.5rem',
          background: 'rgba(15, 23, 42, 0.6)',
          padding: '0.3rem',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: '1.25rem'
        }}>
          <button
            type="button"
            onClick={() => setAuthMethod('password')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              padding: '0.55rem',
              borderRadius: '7px',
              border: 'none',
              background: authMethod === 'password' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: authMethod === 'password' ? '#60a5fa' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            <KeyRound size={14} /> Set Password
          </button>
          <button
            type="button"
            onClick={() => setAuthMethod('sso')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              padding: '0.55rem',
              borderRadius: '7px',
              border: 'none',
              background: authMethod === 'sso' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: authMethod === 'sso' ? '#60a5fa' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            Google Workspace
          </button>
        </div>

        {authMethod === 'sso' ? (
          <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <p style={{ color: '#cbd5e1', fontSize: '0.86rem', margin: '0 0 1.2rem', lineHeight: 1.5 }}>
              Activate your workspace account with your organization Google account.
            </p>
            <button
              type="button"
              onClick={handleGoogleSSO}
              disabled={submitting}
              className="workspace-submit-btn"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff'
              }}
            >
              <GoogleIcon /> Continue with Google
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="workspace-login-form">
            <div className="form-group">
              <label htmlFor="invite-name">Full Name</label>
              <div className="input-with-icon">
                <User size={17} className="input-icon" />
                <input
                  id="invite-name"
                  type="text"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="invite-email">Work Email</label>
              <div className="input-with-icon">
                <Mail size={17} className="input-icon" />
                <input
                  id="invite-email"
                  type="email"
                  placeholder="name@company.com"
                  value={inviteData?.email || emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  disabled={Boolean(inviteData?.email) || submitting}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="invite-password">Create Password</label>
              <div className="input-with-icon">
                <Lock size={17} className="input-icon" />
                <input
                  id="invite-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters (uppercase, number)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  required
                />
                <button
                  type="button"
                  className="eye-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="invite-confirm-password">Confirm Password</label>
              <div className="input-with-icon">
                <Lock size={17} className="input-icon" />
                <input
                  id="invite-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="workspace-submit-btn"
              disabled={submitting}
            >
              {submitting ? (
                <span className="btn-spinner-wrap">
                  <span className="btn-spinner" />
                  <span>Activating Workspace...</span>
                </span>
              ) : (
                <span className="btn-label-wrap">
                  <span>Activate & Join {companyName}</span>
                  <ArrowRight size={17} />
                </span>
              )}
            </button>
          </form>
        )}

        <div className="workspace-footer-links">
          <p className="owner-login-hint">
            Already have an active account?{' '}
            <Link
              to={slug ? `/workspace/${slug}` : ROUTES.login}
              className="generic-login-link"
            >
              Sign In
            </Link>
          </p>
        </div>

        <footer className="workspace-footer">
          <span>Powered by <strong>Markova OS</strong> · Enterprise AI Architecture</span>
        </footer>
      </motion.div>
    </div>
  )
}
