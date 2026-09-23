import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Phone,
  Building,
  Shield,
  ShieldCheck,
  Key,
  Lock,
  Eye,
  EyeOff,
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  Copy,
  Check,
  Bell,
  Sparkles,
  Headphones,
  Bot,
  BookOpen,
  Plug,
  Users,
  CreditCard,
  BarChart3,
  FileText,
  RefreshCw,
  Send,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  requestEmailChange,
  verifyEmailChange,
  uploadAvatarToSupabase
} from '../api/client';
import './Profile.css';

// Role metadata with display styles and clearance descriptions
const ROLE_METADATA = {
  owner: {
    label: 'Account Owner',
    badgeClass: 'role-owner',
    color: '#f59e0b',
    description: 'Supreme clearance. Unrestricted access to financial billing, security, data deletion, and team governance.'
  },
  superadmin: {
    label: 'Super Admin',
    badgeClass: 'role-superadmin',
    color: '#ec4899',
    description: 'Full platform administrative control across all sub-tenants and system nodes.'
  },
  admin: {
    label: 'Administrator',
    badgeClass: 'role-admin',
    color: '#8b5cf6',
    description: 'System configuration, telephony orchestration, team management, and integration control.'
  },
  supervisor: {
    label: 'Call Supervisor',
    badgeClass: 'role-supervisor',
    color: '#10b981',
    description: 'Operational lead: Live call monitoring, audio barge-in takeover, agent evaluations, and CRM oversight.'
  },
  agent: {
    label: 'Voice Agent / Operator',
    badgeClass: 'role-agent',
    color: '#0ea5e9',
    description: 'Frontline operations: Inbound/outbound call queues, customer notes, call logs, and customer CRM records.'
  },
  analyst: {
    label: 'Data Analyst',
    badgeClass: 'role-analyst',
    color: '#d946ef',
    description: 'Business intelligence: Telephony metrics, token consumption, sentiment curves, and custom analytics exports.'
  },
  viewer: {
    label: 'Read-Only Viewer',
    badgeClass: 'role-viewer',
    color: '#64748b',
    description: 'Audit and visibility: Read-only access to call summaries, dashboard telemetry, and public knowledge sources.'
  },
  developer: {
    label: 'API Developer',
    badgeClass: 'role-developer',
    color: '#06b6d4',
    description: 'Engineering access: API keys, webhook subscribers, connector logic, and system error diagnostics.'
  }
};

// System capability catalog mapped to domain permissions
const CAPABILITY_DOMAINS = [
  {
    id: 'telephony',
    title: 'Telephony & Live Calls',
    icon: Headphones,
    color: 'text-pink-400',
    capabilities: [
      { action: 'calls:read', name: 'View Calls & Transcripts', desc: 'Inspect call records, duration, audio recordings, and text transcripts' },
      { action: 'calls:listen', name: 'Live Call Monitoring', desc: 'Silently listen in on live customer calls in real-time' },
      { action: 'calls:barge', name: 'Supervisor Barge-In Takeover', desc: 'Directly bridge microphone into live calls and mute AI agent' },
      { action: 'calls:download', name: 'Download Audio Recordings', desc: 'Download raw WAV/MP3 stereo audio recordings for offline QA' },
      { action: 'telephony:read', name: 'View Phone Lines', desc: 'Access assigned SIP trunks, Twilio numbers, and routing policies' }
    ]
  },
  {
    id: 'agents',
    title: 'AI Agents & Prompts',
    icon: Bot,
    color: 'text-purple-400',
    capabilities: [
      { action: 'agents:read', name: 'View AI Agents', desc: 'Review active agents, voice IDs, and system prompt configurations' },
      { action: 'agents:create', name: 'Create AI Agents', desc: 'Deploy new voice personas, LLM models, and conversation trees' },
      { action: 'agents:update', name: 'Edit Agent Prompts', desc: 'Modify Amharic instructions, tools, and temperature settings' },
      { action: 'agents:delete', name: 'Delete Agents', desc: 'Retire and permanently delete AI agent personas' }
    ]
  },
  {
    id: 'knowledge',
    title: 'Knowledge Base & RAG',
    icon: BookOpen,
    color: 'text-rose-400',
    capabilities: [
      { action: 'knowledge:read', name: 'View Knowledge Sources', desc: 'Browse indexed documents, FAQs, and scraped URLs' },
      { action: 'knowledge:create', name: 'Upload Documents', desc: 'Ingest PDF catalogs, sheets, and web crawlers for pgvector RAG' },
      { action: 'knowledge:update', name: 'Re-sync & Edit RAG', desc: 'Trigger manual embedding re-indexing and update knowledge facts' },
      { action: 'knowledge:delete', name: 'Delete Documents', desc: 'Purge knowledge chunks and embeddings from database' }
    ]
  },
  {
    id: 'crm',
    title: 'CRM & Customer Directory',
    icon: Users,
    color: 'text-blue-400',
    capabilities: [
      { action: 'crm:read', name: 'View Customer Records', desc: 'Access caller identities, previous interaction history, and notes' },
      { action: 'crm:write', name: 'Create & Update Contacts', desc: 'Record follow-up appointments, customer details, and pipeline stages' },
      { action: 'crm:delete', name: 'Delete Contacts', desc: 'Remove contact records and customer interaction cards' }
    ]
  },
  {
    id: 'integrations',
    title: 'Connectors & API Keys',
    icon: Plug,
    color: 'text-cyan-400',
    capabilities: [
      { action: 'integrations:read', name: 'View Integrations', desc: 'Inspect connected tools (Telegram, Sheets, n8n, Webhooks)' },
      { action: 'integrations:create', name: 'Connect New Tools', desc: 'Authorize and link third-party cloud services and webhooks' },
      { action: 'keys:read', name: 'View API Credentials', desc: 'View tenant API key prefixes and active environment tokens' },
      { action: 'keys:create', name: 'Generate API Keys', desc: 'Provision new programmatic authentication keys for SDK access' }
    ]
  },
  {
    id: 'governance',
    title: 'Governance & Compliance',
    icon: Shield,
    color: 'text-amber-400',
    capabilities: [
      { action: 'governance:read', name: 'View Guardrails & Rules', desc: 'Review AI safety boundaries, PII redactions, and banned terms' },
      { action: 'governance:write', name: 'Configure Policies', desc: 'Update compliance guardrails and statutory recording disclosures' },
      { action: 'audit:read', name: 'Access Audit Logs', desc: 'Query immutable security audit trails for destructive events' }
    ]
  },
  {
    id: 'team',
    title: 'Team & Organization',
    icon: Building,
    color: 'text-sky-400',
    capabilities: [
      { action: 'users:read', name: 'View Team Roster', desc: 'See colleague directory, assigned roles, and invitations' },
      { action: 'users:invite', name: 'Invite Team Members', desc: 'Dispatch email invitations and generate shareable magic links' },
      { action: 'users:manage_roles', name: 'Assign & Edit Roles', desc: 'Promote or modify colleagues’ RBAC clearance levels' },
      { action: 'users:deactivate', name: 'Deactivate Users', desc: 'Revoke access and disable compromised team accounts' }
    ]
  },
  {
    id: 'billing',
    title: 'Billing & Subscriptions',
    icon: CreditCard,
    color: 'text-emerald-400',
    capabilities: [
      { action: 'billing:read', name: 'View Usage & Invoices', desc: 'Inspect token consumption, telephony minutes, and billing history' },
      { action: 'billing:write', name: 'Manage Plan & Payments', desc: 'Upgrade subscription, purchase voice credit packs, update payment' }
    ]
  }
];

export default function Profile() {
  const { user: authUser, role: authRole, permissions, can, setUser: setAuthUser, refreshAuth } = useAuth();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    bio: '',
    avatar_url: '',
    role: '',
    company_name: '',
    department_name: '',
    created_at: '',
    notification_prefs: {
      email_call_summary: true,
      email_missed_calls: true,
      email_security: true,
      email_digest: false,
      sms_urgent: false
    }
  });

  const [copiedId, setCopiedId] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Password change state
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [changingPassword, setChangingPassword] = useState(false);

  // Email change state (Two-Step Flow)
  const [emailChangeStep, setEmailChangeStep] = useState(1); // 1: input new email + password, 2: enter code
  const [newEmail, setNewEmail] = useState('');
  const [emailVerifyPassword, setEmailVerifyPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [requestingEmailChange, setRequestingEmailChange] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);

  // Load user profile
  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await getMyProfile();
        if (mounted && res?.data) {
          const u = res.data;
          setProfileData({
            id: u.id || authUser?.id || '',
            name: u.name || authUser?.name || '',
            email: u.email || authUser?.email || '',
            phone: u.phone || '',
            bio: u.bio || '',
            avatar_url: u.avatar_url || authUser?.avatar_url || '',
            role: u.role || authRole || 'agent',
            company_name: u.company_name || u.companyName || authUser?.companyName || 'Markova Enterprise',
            department_name: u.department_name || 'General Operations',
            created_at: u.created_at || '',
            notification_prefs: {
              email_call_summary: u.notification_prefs?.email_call_summary ?? true,
              email_missed_calls: u.notification_prefs?.email_missed_calls ?? true,
              email_security: u.notification_prefs?.email_security ?? true,
              email_digest: u.notification_prefs?.email_digest ?? false,
              sms_urgent: u.notification_prefs?.sms_urgent ?? false
            }
          });
        }
      } catch (err) {
        console.warn('Failed to fetch profile details:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => { mounted = false; };
  }, [authUser, authRole]);

  // Handle Avatar Upload
  const handleAvatarFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Please select a valid image file (PNG, JPG, WebP)', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addToast('Image size exceeds 5MB limit. Please choose a smaller image.', 'error');
      return;
    }

    try {
      setAvatarUploading(true);
      const result = await uploadAvatarToSupabase(file, profileData.id);
      if (result.success && result.url) {
        setProfileData(prev => ({ ...prev, avatar_url: result.url }));
        
        // Save immediately to backend profile
        await updateMyProfile({ avatar_url: result.url });

        // Update local session cache & AuthContext
        const local = JSON.parse(localStorage.getItem('user') || '{}');
        const updated = { ...local, avatar_url: result.url };
        localStorage.setItem('user', JSON.stringify(updated));
        if (setAuthUser) setAuthUser(updated);

        addToast('Profile picture updated successfully!', 'success');
      } else {
        throw new Error(result.error || 'Failed to process image');
      }
    } catch (err) {
      console.error('Avatar upload error:', err);
      addToast('Failed to upload avatar. Please try again.', 'error');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle General Profile Update
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const payload = {
        name: profileData.name.trim(),
        phone: profileData.phone.trim(),
        bio: profileData.bio.trim(),
        notification_prefs: profileData.notification_prefs
      };

      await updateMyProfile(payload);

      // Sync local storage & AuthContext
      const local = JSON.parse(localStorage.getItem('user') || '{}');
      const updated = { ...local, name: payload.name, phone: payload.phone, bio: payload.bio };
      localStorage.setItem('user', JSON.stringify(updated));
      if (setAuthUser) setAuthUser(updated);
      if (refreshAuth) refreshAuth();

      addToast('Profile updated successfully!', 'success');
    } catch (err) {
      console.error('Profile update failed:', err);
      addToast(err.response?.data?.error || err.message || 'Failed to save profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwords.currentPassword) {
      addToast('Please enter your current password', 'error');
      return;
    }
    if (passwords.newPassword.length < 8) {
      addToast('New password must be at least 8 characters long', 'error');
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      addToast('New password and confirmation do not match', 'error');
      return;
    }

    try {
      setChangingPassword(true);
      await changeMyPassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      });

      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      addToast('Password changed successfully! Keep your credentials secure.', 'success');
    } catch (err) {
      console.error('Password change failed:', err);
      addToast(err.response?.data?.error || 'Failed to update password. Verify your current password.', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  // Handle Email Change Step 1 (Request Verification Code)
  const handleRequestEmailChange = async (e) => {
    e.preventDefault();
    const targetEmail = newEmail.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      addToast('Please enter a valid new email address', 'error');
      return;
    }
    if (targetEmail === profileData.email.toLowerCase()) {
      addToast('The new email address is identical to your current email', 'error');
      return;
    }
    if (!emailVerifyPassword) {
      addToast('Please enter your current password to authorize this change', 'error');
      return;
    }

    try {
      setRequestingEmailChange(true);
      const res = await requestEmailChange({
        newEmail: targetEmail,
        password: emailVerifyPassword
      });

      setEmailChangeStep(2);
      addToast(res.data?.message || `A 6-digit confirmation code was sent to ${targetEmail}`, 'success');
    } catch (err) {
      console.error('Email change request failed:', err);
      addToast(err.response?.data?.error || 'Failed to request email change. Check your password.', 'error');
    } finally {
      setRequestingEmailChange(false);
    }
  };

  // Handle Email Change Step 2 (Verify Code & Commit)
  const handleVerifyEmailChange = async (e) => {
    e.preventDefault();
    const code = verificationCode.trim();
    if (!code || code.length < 6) {
      addToast('Please enter the 6-digit verification code', 'error');
      return;
    }

    try {
      setVerifyingCode(true);
      const res = await verifyEmailChange({ code });

      const updatedEmail = res.data?.newEmail || newEmail.trim().toLowerCase();
      setProfileData(prev => ({ ...prev, email: updatedEmail }));

      // Sync local storage & AuthContext
      const local = JSON.parse(localStorage.getItem('user') || '{}');
      const updated = { ...local, email: updatedEmail };
      localStorage.setItem('user', JSON.stringify(updated));
      if (setAuthUser) setAuthUser(updated);

      // Reset email change flow
      setEmailChangeStep(1);
      setNewEmail('');
      setEmailVerifyPassword('');
      setVerificationCode('');

      addToast(`Email successfully updated to ${updatedEmail}!`, 'success');
    } catch (err) {
      console.error('Email verification failed:', err);
      addToast(err.response?.data?.error || 'Invalid or expired verification code', 'error');
    } finally {
      setVerifyingCode(false);
    }
  };

  // Copy User ID
  const handleCopyId = () => {
    if (!profileData.id) return;
    navigator.clipboard.writeText(profileData.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
    addToast('Account ID copied to clipboard', 'info');
  };

  // Toggle notification preference
  const handleTogglePref = (key) => {
    setProfileData(prev => ({
      ...prev,
      notification_prefs: {
        ...prev.notification_prefs,
        [key]: !prev.notification_prefs[key]
      }
    }));
  };

  const userRoleKey = (profileData.role || authRole || 'agent').toLowerCase();
  const currentRoleMeta = ROLE_METADATA[userRoleKey] || ROLE_METADATA.agent;

  const initials = (profileData.name || 'User')
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="profile-page">
      {/* Page Header */}
      <div className="profile-header">
        <div>
          <h1 className="profile-title">User Profile & Clearance</h1>
          <p className="profile-subtitle">
            Manage your personal identity, enterprise role privileges, security credentials, and alerts.
          </p>
        </div>
      </div>

      {/* Hero Card */}
      <motion.div
        className="profile-hero-card"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="hero-avatar-section">
          <div className="hero-avatar-wrapper" onClick={() => fileInputRef.current?.click()} title="Click to upload new avatar">
            {profileData.avatar_url ? (
              <img src={profileData.avatar_url} alt={profileData.name} className="hero-avatar-img" />
            ) : (
              <div className="hero-avatar-fallback">
                {initials}
              </div>
            )}
            <div className="avatar-hover-overlay">
              <Camera size={22} />
              <span>{avatarUploading ? 'Uploading...' : 'Change'}</span>
            </div>
            {avatarUploading && (
              <div className="avatar-spinner-overlay">
                <RefreshCw size={24} className="spin-icon" />
              </div>
            )}
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarFileSelect}
            accept="image/*"
            style={{ display: 'none' }}
          />
        </div>

        <div className="hero-info-section">
          <div className="hero-name-row">
            <h2 className="hero-user-name">{profileData.name || 'System Operator'}</h2>
            <div className={`role-badge-pill ${currentRoleMeta.badgeClass}`}>
              <Shield size={14} />
              <span>{currentRoleMeta.label}</span>
            </div>
          </div>

          <div className="hero-meta-row">
            <div className="hero-meta-item">
              <Building size={15} className="meta-icon" />
              <span>{profileData.company_name}</span>
            </div>
            <div className="hero-meta-item">
              <Mail size={15} className="meta-icon" />
              <span>{profileData.email}</span>
              <CheckCircle2 size={13} className="text-emerald-400 ml-1" title="Email Verified" />
            </div>
            {profileData.id && (
              <div className="hero-meta-item cursor-pointer" onClick={handleCopyId} title="Click to copy User ID">
                <Key size={14} className="meta-icon" />
                <span className="font-mono text-xs text-slate-400">
                  {profileData.id.length > 18 ? `${profileData.id.substring(0, 8)}...${profileData.id.slice(-4)}` : profileData.id}
                </span>
                {copiedId ? <Check size={13} className="text-emerald-400 ml-1" /> : <Copy size={13} className="text-slate-400 ml-1" />}
              </div>
            )}
            {profileData.created_at && (
              <div className="hero-meta-item">
                <Clock size={14} className="meta-icon" />
                <span className="text-xs text-slate-400">
                  Joined {new Date(profileData.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>

          <p className="hero-role-desc">
            {currentRoleMeta.description}
          </p>
        </div>
      </motion.div>

      {/* Profile Navigation Tabs */}
      <div className="profile-tabs-bar">
        <button
          className={`profile-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          <User size={16} />
          <span>General Info</span>
        </button>

        <button
          className={`profile-tab-btn ${activeTab === 'privileges' ? 'active' : ''}`}
          onClick={() => setActiveTab('privileges')}
        >
          <ShieldCheck size={16} />
          <span>Role & Privileges</span>
          <span className="tab-pill-count">{can('*') ? 'All' : `${permissions.length}`}</span>
        </button>

        <button
          className={`profile-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <Lock size={16} />
          <span>Security & Password</span>
        </button>

        <button
          className={`profile-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          <Bell size={16} />
          <span>Notifications</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="profile-content-area">
        {/* TAB 1: General Info */}
        {activeTab === 'general' && (
          <motion.div
            key="general"
            className="tab-card-pane"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="pane-header">
              <h3>Personal Identity & Profile Details</h3>
              <p>Update your personal information and contact channels for operational team logging.</p>
            </div>

            <form onSubmit={handleSaveProfile} className="profile-form-grid">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div className="input-with-icon">
                  <User size={18} className="input-icon" />
                  <input
                    type="text"
                    className="form-input"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <div className="input-with-icon">
                  <Phone size={18} className="input-icon" />
                  <input
                    type="tel"
                    className="form-input"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    placeholder="+251 91 123 4567"
                  />
                </div>
                <span className="form-hint">Used for urgent supervisor call-bridge and security alerts</span>
              </div>

              <div className="form-group">
                <label className="form-label">Email Address (Read-Only)</label>
                <div className="input-with-icon">
                  <Mail size={18} className="input-icon" />
                  <input
                    type="email"
                    className="form-input read-only-input"
                    value={profileData.email}
                    disabled
                    title="To update email, visit the Security tab"
                  />
                </div>
                <span className="form-hint">To change your email address, use the Security tab re-verification flow.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Organization / Company</label>
                <div className="input-with-icon">
                  <Building size={18} className="input-icon" />
                  <input
                    type="text"
                    className="form-input read-only-input"
                    value={profileData.company_name}
                    disabled
                  />
                </div>
              </div>

              <div className="form-group full-width">
                <label className="form-label">Bio & Operational Focus</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={profileData.bio}
                  onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                  placeholder="Share a brief overview of your role, specialties, or call coverage schedule..."
                />
              </div>

              <div className="form-actions-row">
                <button
                  type="submit"
                  className="profile-primary-btn"
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <>
                      <RefreshCw size={16} className="spin-icon" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Save Profile Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* TAB 2: Role & Privileges Matrix */}
        {activeTab === 'privileges' && (
          <motion.div
            key="privileges"
            className="tab-card-pane"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="privileges-overview-card">
              <div className="privilege-role-badge">
                <ShieldCheck size={28} style={{ color: currentRoleMeta.color }} />
                <div>
                  <h3 className="text-lg font-bold text-white">{currentRoleMeta.label} Privileges</h3>
                  <p className="text-sm text-slate-300">{currentRoleMeta.description}</p>
                </div>
              </div>
              <div className="privilege-indicator-pill">
                <span className="indicator-dot" />
                <span>{can('*') ? 'Unrestricted Root Access' : `${permissions.length} Actions Permitted`}</span>
              </div>
            </div>

            <div className="domains-matrix-container">
              {CAPABILITY_DOMAINS.map(domain => {
                const DomainIcon = domain.icon;
                return (
                  <div key={domain.id} className="capability-domain-card">
                    <div className="domain-card-header">
                      <div className="domain-title-wrap">
                        <DomainIcon size={20} className={domain.color} />
                        <h4>{domain.title}</h4>
                      </div>
                    </div>

                    <div className="capability-list">
                      {domain.capabilities.map(cap => {
                        const hasAccess = can(cap.action);
                        return (
                          <div key={cap.action} className={`capability-row ${hasAccess ? 'granted' : 'restricted'}`}>
                            <div className="capability-check">
                              {hasAccess ? (
                                <CheckCircle2 size={16} className="text-emerald-400" />
                              ) : (
                                <Lock size={15} className="text-slate-500" />
                              )}
                            </div>
                            <div className="capability-text">
                              <span className="capability-name">{cap.name}</span>
                              <span className="capability-desc">{cap.desc}</span>
                            </div>
                            <span className="capability-action-tag">{cap.action}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="privilege-upgrade-notice">
              <HelpCircle size={18} className="text-sky-400" />
              <span>Need elevated permissions for your tasks? Contact your organization <strong>Owner</strong> or <strong>Administrator</strong> to update your assigned role.</span>
            </div>
          </motion.div>
        )}

        {/* TAB 3: Security & Credentials */}
        {activeTab === 'security' && (
          <motion.div
            key="security"
            className="tab-card-pane"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="security-sections-split">
              {/* Change Password Panel */}
              <div className="security-subpanel">
                <div className="subpanel-header">
                  <Key size={20} className="text-amber-400" />
                  <div>
                    <h4>Update Password</h4>
                    <p>Ensure your account is protected with a strong, distinct passphrase.</p>
                  </div>
                </div>

                <form onSubmit={handleChangePassword} className="security-form">
                  <div className="form-group">
                    <label className="form-label">Current Password</label>
                    <div className="input-with-icon">
                      <Lock size={17} className="input-icon" />
                      <input
                        type={showPasswords.current ? 'text' : 'password'}
                        className="form-input"
                        value={passwords.currentPassword}
                        onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                        placeholder="Enter current password"
                        required
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      >
                        {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <div className="input-with-icon">
                      <Lock size={17} className="input-icon" />
                      <input
                        type={showPasswords.new ? 'text' : 'password'}
                        className="form-input"
                        value={passwords.newPassword}
                        onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                        placeholder="Min 8 characters"
                        minLength={8}
                        required
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      >
                        {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Confirm New Password</label>
                    <div className="input-with-icon">
                      <Lock size={17} className="input-icon" />
                      <input
                        type={showPasswords.confirm ? 'text' : 'password'}
                        className="form-input"
                        value={passwords.confirmPassword}
                        onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                        placeholder="Re-type new password"
                        minLength={8}
                        required
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      >
                        {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="profile-primary-btn"
                    disabled={changingPassword}
                  >
                    {changingPassword ? (
                      <>
                        <RefreshCw size={16} className="spin-icon" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>Update Password</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Email Address Re-Verification Panel */}
              <div className="security-subpanel">
                <div className="subpanel-header">
                  <Mail size={20} className="text-sky-400" />
                  <div>
                    <h4>Email Address Re-Verification</h4>
                    <p>Change your contact address with high-security 2-step verification.</p>
                  </div>
                </div>

                <div className="current-email-status">
                  <div className="email-status-pill">
                    <span className="text-xs text-slate-400">Current Login Email:</span>
                    <strong className="text-white font-mono text-sm">{profileData.email}</strong>
                    <CheckCircle2 size={15} className="text-emerald-400 ml-auto" />
                  </div>
                </div>

                {emailChangeStep === 1 ? (
                  <form onSubmit={handleRequestEmailChange} className="security-form">
                    <div className="form-group">
                      <label className="form-label">New Email Address</label>
                      <div className="input-with-icon">
                        <Mail size={17} className="input-icon" />
                        <input
                          type="email"
                          className="form-input"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="colleague@markova.tech"
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Verify Current Account Password</label>
                      <div className="input-with-icon">
                        <Lock size={17} className="input-icon" />
                        <input
                          type="password"
                          className="form-input"
                          value={emailVerifyPassword}
                          onChange={(e) => setEmailVerifyPassword(e.target.value)}
                          placeholder="Your account password"
                          required
                        />
                      </div>
                      <span className="form-hint">Password verification ensures only you can request an email migration.</span>
                    </div>

                    <button
                      type="submit"
                      className="profile-secondary-btn"
                      disabled={requestingEmailChange}
                    >
                      {requestingEmailChange ? (
                        <>
                          <RefreshCw size={16} className="spin-icon" />
                          <span>Sending Verification Code...</span>
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          <span>Send 6-Digit Code</span>
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyEmailChange} className="security-form verification-code-flow">
                    <div className="code-flow-prompt">
                      <Sparkles size={20} className="text-amber-400" />
                      <p>
                        We sent a 6-digit confirmation code to <strong>{newEmail}</strong>. Enter it below to commit the email change.
                      </p>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Verification Code</label>
                      <input
                        type="text"
                        maxLength={6}
                        className="form-input code-input-box"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        required
                        autoFocus
                      />
                      <span className="form-hint">Code expires in 15 minutes.</span>
                    </div>

                    <div className="code-actions-row">
                      <button
                        type="button"
                        className="profile-ghost-btn"
                        onClick={() => {
                          setEmailChangeStep(1);
                          setVerificationCode('');
                        }}
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="profile-primary-btn"
                        disabled={verifyingCode || verificationCode.length < 6}
                      >
                        {verifyingCode ? (
                          <>
                            <RefreshCw size={16} className="spin-icon" />
                            <span>Verifying...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={16} />
                            <span>Confirm & Commit Email</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 4: Notification Preferences */}
        {activeTab === 'notifications' && (
          <motion.div
            key="notifications"
            className="tab-card-pane"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="pane-header">
              <h3>Notification & Telephony Alert Channels</h3>
              <p>Choose when and how Markova notifies you about customer interactions and system events.</p>
            </div>

            <div className="notification-preferences-list">
              <div className="pref-item-card">
                <div className="pref-info">
                  <span className="pref-title">Inbound Call Summaries</span>
                  <span className="pref-desc">Receive an email recap when customer voice sessions conclude with Amharic transcription and sentiment notes.</span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={profileData.notification_prefs.email_call_summary}
                    onChange={() => handleTogglePref('email_call_summary')}
                  />
                  <span className="slider round" />
                </label>
              </div>

              <div className="pref-item-card">
                <div className="pref-info">
                  <span className="pref-title">Missed Call & Voicemail Alerts</span>
                  <span className="pref-desc">Urgent notification dispatched when an Ethiopian caller hangs up before reaching an AI agent or operator.</span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={profileData.notification_prefs.email_missed_calls}
                    onChange={() => handleTogglePref('email_missed_calls')}
                  />
                  <span className="slider round" />
                </label>
              </div>

              <div className="pref-item-card">
                <div className="pref-info">
                  <span className="pref-title">Security & Session Alerts</span>
                  <span className="pref-desc">Instant notification whenever a new device signs in with your workspace credentials or changes password.</span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={profileData.notification_prefs.email_security}
                    onChange={() => handleTogglePref('email_security')}
                  />
                  <span className="slider round" />
                </label>
              </div>

              <div className="pref-item-card">
                <div className="pref-info">
                  <span className="pref-title">Weekly Executive Analytics Digest</span>
                  <span className="pref-desc">Weekly rollup of total voice minutes, hours saved, agent accuracy, and customer satisfaction metrics.</span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={profileData.notification_prefs.email_digest}
                    onChange={() => handleTogglePref('email_digest')}
                  />
                  <span className="slider round" />
                </label>
              </div>

              <div className="pref-item-card">
                <div className="pref-info">
                  <span className="pref-title">Urgent SMS Bridge Notification</span>
                  <span className="pref-desc">Direct SMS alert dispatched to your mobile phone when a customer requests supervisor human takeover.</span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={profileData.notification_prefs.sms_urgent}
                    onChange={() => handleTogglePref('sms_urgent')}
                  />
                  <span className="slider round" />
                </label>
              </div>
            </div>

            <div className="form-actions-row mt-6">
              <button
                type="button"
                className="profile-primary-btn"
                onClick={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <>
                    <RefreshCw size={16} className="spin-icon" />
                    <span>Saving Preferences...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Save Alert Preferences</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
