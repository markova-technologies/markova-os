import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield, AlertCircle, Building2, Sparkles } from 'lucide-react'
import { getWorkspaceBySlug, workspaceLogin, tokenStore } from '../api/client'
import { ROUTES } from '../config/site'
import './WorkspaceLogin.css'

export default function WorkspaceLogin({ onLogin }) {
  const { slug } = useParams()
  const navigate = useNavigate()

  const [workspace, setWorkspace] = useState(null)
  const [loadingWorkspace, setLoadingWorkspace] = useState(true)
  const [workspaceError, setWorkspaceError] = useState(null)

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [crossOrgError, setCrossOrgError] = useState(false)

  // 1. Resolve Workspace by Slug
  useEffect(() => {
    let mounted = true
    const resolveWorkspace = async () => {
      setLoadingWorkspace(true)
      setWorkspaceError(null)
      try {
        const res = await getWorkspaceBySlug(slug)
        if (mounted) {
          if (res.data?.workspace) {
            setWorkspace(res.data.workspace)
          } else {
            setWorkspaceError('Workspace could not be found')
          }
        }
      } catch (err) {
        if (mounted) {
          const msg = err.response?.data?.error || 'Workspace not found. Please check the URL link provided by your organization.'
          setWorkspaceError(msg)
        }
      } finally {
        if (mounted) setLoadingWorkspace(false)
      }
    }

    if (slug) {
      resolveWorkspace()
    }
    return () => {
      mounted = false
    }
  }, [slug])

  // 2. Submit Scoped Workspace Login
  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setCrossOrgError(false)

    try {
      const res = await workspaceLogin({
        slug,
        email: formData.email.trim(),
        password: formData.password
      })

      if (res.data?.success && res.data.token) {
        tokenStore.set(res.data.token, res.data.refreshToken)
        localStorage.removeItem('markova_demo_mode')
        localStorage.setItem('user', JSON.stringify(res.data.user))
        localStorage.setItem('onboardingComplete', 'true')

        if (onLogin) {
          onLogin(res.data.user)
        }
        navigate(ROUTES.app, { replace: true })
      } else {
        setError(res.data?.error || 'Failed to sign in to workspace')
      }
    } catch (err) {
      const status = err.response?.status
      const data = err.response?.data
      if (status === 403 && data?.code === 'CROSS_ORG_ACCESS_DENIED') {
        setCrossOrgError(true)
        setError(data.error)
      } else if (status === 401) {
        setError('Invalid email or password for this workspace')
      } else if (status === 404) {
        setError('Workspace not found. Please verify the URL with your team.')
      } else {
        setError(data?.error || data?.message || 'Unable to connect to workspace. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Generate initials for organization avatar fallback
  const getInitials = (name) => {
    if (!name) return 'WS'
    return name
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  if (loadingWorkspace) {
    return (
      <div className="workspace-login-wrapper">
        <div className="workspace-login-card loading-card">
          <div className="workspace-spinner" />
          <p className="workspace-loading-text">Connecting to Markova OS Workspace...</p>
        </div>
      </div>
    )
  }

  if (workspaceError || !workspace) {
    return (
      <div className="workspace-login-wrapper">
        <div className="workspace-login-card error-card">
          <div className="markova-hero-header">
            <div className="markova-emblem">
              <Sparkles size={18} className="sparkle-icon" />
              <span className="markova-wordmark">MARKOVA OS</span>
            </div>
            <p className="markova-hero-tagline">AI Call Center & Enterprise Operating System</p>
          </div>

          <div className="error-icon-box">
            <AlertCircle size={32} />
          </div>

          <h2 className="workspace-error-title">Workspace Not Found</h2>
          <p className="workspace-error-desc">
            {workspaceError || `We couldn't locate an organization workspace with the identifier "${slug}".`}
          </p>

          <div className="error-actions">
            <Link to={ROUTES.login} className="primary-link-btn">
              Go to Markova OS Login
            </Link>
            <p className="support-hint">
              If you received this link from your employer, please contact your workspace administrator to verify the link.
            </p>
          </div>

          <footer className="workspace-footer">
            Powered by <strong>Markova OS</strong> · markova.io
          </footer>
        </div>
      </div>
    )
  }

  return (
    <div className="workspace-login-wrapper">
      <div className="ambient-glow ambient-top-left" />
      <div className="ambient-glow ambient-bottom-right" />

      <motion.div
        className="workspace-login-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* PRIMARY BRAND: Markova OS (Dominant Hero Brand - Apple Style) */}
        <div className="markova-hero-header">
          <div className="markova-emblem">
            <div className="emblem-hex">
              <Sparkles size={15} className="sparkle-icon" />
            </div>
            <span className="markova-wordmark">MARKOVA OS</span>
            <span className="markova-badge">ENTERPRISE</span>
          </div>
          <p className="markova-hero-tagline">AI Call Center & Voice Workforce Platform</p>
        </div>

        <div className="workspace-divider" />

        {/* SECONDARY BRAND: Organization Identity (Subordinate to Markova OS) */}
        <div className="org-secondary-header">
          <div className="org-avatar-container">
            {workspace.logo_url ? (
              <img
                src={workspace.logo_url}
                alt={workspace.name}
                className="org-logo-image"
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.nextSibling.style.display = 'flex'
                }}
              />
            ) : null}
            <div
              className="org-avatar-fallback"
              style={{ display: workspace.logo_url ? 'none' : 'flex' }}
            >
              <Building2 size={20} className="org-fallback-icon" />
              <span>{getInitials(workspace.name)}</span>
            </div>
          </div>

          <div className="org-text-meta">
            <h2 className="org-name">{workspace.name}</h2>
            <span className="workspace-slug-pill">/workspace/{workspace.slug}</span>
          </div>
          <p className="org-workspace-subtitle">Sign in to your organization workspace</p>
        </div>

        {/* Alerts / Cross-org Error Notices */}
        {crossOrgError && (
          <motion.div
            className="cross-org-warning-box"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="warning-icon-pill">
              <Shield size={16} />
            </div>
            <div className="warning-text-content">
              <strong>Cross-Organization Access Restricted</strong>
              <p>{error}</p>
              <div className="warning-links">
                <Link to={ROUTES.login} className="warning-soft-link">
                  Sign in with owner/different account &rarr;
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {!crossOrgError && error && (
          <motion.div
            className="workspace-error-banner"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="workspace-login-form">
          <div className="form-group">
            <label htmlFor="ws-email">Organization Email</label>
            <div className="input-with-icon">
              <Mail size={17} className="input-icon" />
              <input
                id="ws-email"
                type="email"
                required
                placeholder="name@company.com"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                autoComplete="email"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-group">
            <div className="label-with-aside">
              <label htmlFor="ws-password">Password</label>
              <Link to={ROUTES.forgotPassword} className="forgot-password-link">
                Forgot password?
              </Link>
            </div>
            <div className="input-with-icon">
              <Lock size={17} className="input-icon" />
              <input
                id="ws-password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••••••"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                autoComplete="current-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="eye-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="workspace-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="btn-spinner-wrap">
                <span className="btn-spinner" />
                <span>Signing in...</span>
              </span>
            ) : (
              <span className="btn-label-wrap">
                <span>Sign In to {workspace.name}</span>
                <ArrowRight size={17} />
              </span>
            )}
          </button>
        </form>

        {/* Global Platform Sign-In Fallback for Owners / Developers */}
        <div className="workspace-footer-links">
          <p className="owner-login-hint">
            Organization Owner or Platform Admin?{' '}
            <Link to={ROUTES.login} className="generic-login-link">
              Sign in at main Markova OS
            </Link>
          </p>
        </div>

        {/* Subordinate Footer */}
        <footer className="workspace-footer">
          <span>Powered by <strong>Markova OS</strong> · Enterprise AI Architecture</span>
        </footer>
      </motion.div>
    </div>
  )
}
