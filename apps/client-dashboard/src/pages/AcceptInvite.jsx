import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { verifyInvitation, acceptInvitation, tokenStore } from '../api/client';
import { supabase } from '../config/supabase';
import { useToast } from '../contexts/ToastContext';
import { Bot, CheckCircle2, AlertCircle, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { ROUTES } from '../config/site';
import './AcceptInvite.css';

const AcceptInvite = ({ onLogin }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const searchParams = new URLSearchParams(location.search);
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inviteData, setInviteData] = useState(null);
  const [error, setError] = useState(null);

  // Auth Method: 'password' or 'sso' (Option C)
  const [authMethod, setAuthMethod] = useState('password');

  // Form fields
  const [name, setName] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 1. Verify invitation token on mount
  useEffect(() => {
    if (!token) {
      setError('Missing invitation token in URL.');
      setLoading(false);
      return;
    }

    let isMounted = true;
    verifyInvitation(token)
      .then((res) => {
        if (!isMounted) return;
        if (res.data?.success && res.data.invitation) {
          const inv = res.data.invitation;
          setInviteData(inv);
          if (inv.email) {
            setName(inv.email.split('@')[0] || '');
            setEmailInput(inv.email);
          }
        } else {
          setError(res.data?.error || 'Invalid or expired invitation link.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.response?.data?.error || 'Failed to verify invitation. The link may have expired.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  // 2. Handle Password Submission
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const userEmail = (inviteData?.email || emailInput).trim();
    if (!userEmail) {
      setError('Please provide your work email address to accept the invitation.');
      return;
    }

    if (!password) {
      setError('Please enter a password');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await acceptInvitation({
        token,
        email: userEmail,
        name: name.trim(),
        password
      });

      if (res.data?.success && res.data.token) {
        tokenStore.set(res.data.token, res.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        if (onLogin && res.data.user) {
          onLogin(res.data.user);
        }
        addToast(`Welcome to ${inviteData?.companyName || 'Markova OS'}!`, 'success');
        navigate(ROUTES.app, { replace: true });
      } else {
        setError(res.data?.error || 'Failed to accept invitation');
      }
    } catch (err) {
      const errDetail = err.response?.data?.error || err.response?.data?.detail || err.response?.data?.message;
      if (err.response?.status === 404 || errDetail === 'Not Found') {
        setError('Unable to reach the workspace activation service. Please check your connection or verify the link with your administrator.');
      } else {
        setError(errDetail || 'An error occurred while setting up your account.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Handle SSO OAuth (Option C)
  const handleGoogleSSO = async () => {
    try {
      setSubmitting(true);
      const { error: ssoErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/accept-invite?token=${token}`
        }
      });
      if (ssoErr) throw ssoErr;
    } catch (err) {
      setError(err.message || 'Google SSO failed');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="accept-invite-container">
        <div className="accept-invite-card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
          <div style={{
            width: '44px',
            height: '44px',
            border: '3px solid rgba(59, 130, 246, 0.2)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1.5rem'
          }} />
          <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>Verifying your invitation token...</p>
        </div>
      </div>
    );
  }

  if (error && !inviteData) {
    return (
      <div className="accept-invite-container">
        <div className="accept-invite-card" style={{ textAlign: 'center' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f87171',
            margin: '0 auto 1.25rem'
          }}>
            <AlertCircle size={32} />
          </div>
          <h2 style={{ fontSize: '1.4rem', color: '#ffffff', margin: '0 0 0.5rem' }}>Invalid Invitation Link</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '2rem' }}>
            {error}
          </p>
          <Link
            to={ROUTES.login}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: '#2563eb',
              color: '#ffffff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.9rem'
            }}
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="accept-invite-container">
      <div className="accept-invite-card">
        <div className="accept-invite-header">
          <div className="accept-invite-badge">
            <ShieldCheck size={14} /> Enterprise Invitation
          </div>
          <h1 className="accept-invite-title">Join {inviteData?.companyName || 'Markova OS'}</h1>
          <p className="accept-invite-subtitle">
            You have been invited to join the enterprise team workspace.
          </p>
        </div>

        {/* Invite Metadata Box */}
        <div className="invite-details-box">
          <div className="invite-detail-row">
            <span className="invite-detail-label">Invitation For</span>
            <span className="invite-detail-value">{inviteData?.email || 'Shareable Workspace Link'}</span>
          </div>
          <div className="invite-detail-row">
            <span className="invite-detail-label">Assigned Role</span>
            <span className="invite-role-chip">{inviteData?.roleDisplayName || inviteData?.role}</span>
          </div>
          {inviteData?.departmentName && (
            <div className="invite-detail-row">
              <span className="invite-detail-label">Department</span>
              <span className="invite-detail-value">{inviteData.departmentName}</span>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert-error" style={{ marginBottom: '1.25rem' }}>
            {error}
          </div>
        )}

        {/* Auth Method Tabs (Option C) */}
        <div className="accept-invite-tabs">
          <button
            type="button"
            className={`accept-tab-btn ${authMethod === 'password' ? 'active' : ''}`}
            onClick={() => { setAuthMethod('password'); setError(null); }}
          >
            Password Setup
          </button>
          <button
            type="button"
            className={`accept-tab-btn ${authMethod === 'sso' ? 'active' : ''}`}
            onClick={() => { setAuthMethod('sso'); setError(null); }}
          >
            Google SSO
          </button>
        </div>

        {authMethod === 'password' ? (
          <form onSubmit={handlePasswordSubmit} className="accept-invite-form">
            <div className="form-group">
              <label className="form-label">Your Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="you@company.com"
                value={inviteData?.email || emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                disabled={Boolean(inviteData?.email)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Create Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="submit-btn" disabled={submitting}>
              {submitting ? 'Setting up account...' : (
                <>
                  <span>Activate Account & Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.5, margin: 0, textAlign: 'center' }}>
              Sign in with your Google account matching <strong>{inviteData?.email}</strong> to seamlessly activate access.
            </p>
            <button
              type="button"
              className="sso-btn"
              onClick={handleGoogleSSO}
              disabled={submitting}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcceptInvite;
