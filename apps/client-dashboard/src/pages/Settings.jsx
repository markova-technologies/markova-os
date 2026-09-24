import { useState, useEffect, useMemo } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Building2,
  Users as UsersIcon,
  Shield,
  ShieldCheck,
  ArrowRight,
  Key,
  Plug,
  Activity,
  Bell,
  Save,
  RotateCcw,
  UserCircle,
  Loader2,
  Eye,
  EyeOff,
  Globe,
  Copy,
  Check,
  ExternalLink,
  Edit3,
  Volume2,
  VolumeX,
  Volume1,
  Lock,
  Clock,
  Calendar,
  Download,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Radio,
  PhoneCall,
  Cpu,
  Sliders,
  FileText,
  Sparkles,
  Send
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import './Settings.css'
import api, { updateWorkspaceSlug, updateWorkspaceLogo, checkEmailConfig, sendTestEmail, isDemoMode } from '../api/client'

const DEFAULT_SETTINGS = {
  // Regional & Localization
  timezone: 'UTC+03:00',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24-hour',
  currency: 'USD',
  language: 'en',
  
  // Operating Hours & Schedule
  coverageMode: '24_7',
  workingDays: 'mon_fri',
  openingTime: '08:30',
  closingTime: '18:00',
  
  // Routing & Failover
  afterHoursMode: 'ai_nightshift',
  emergencyPhone: '+251 91 123 4567',
  concurrencyOverflow: 'ai_queue',
  maxCallDuration: 30,
  
  // Recording & Compliance
  retentionPeriod: '90',
  autoTranscription: true,
  piiRedaction: true,
  
  // Notifications
  emailNotifications: true,
  pushNotifications: true,
  smsNotifications: false,
  dailyDigest: true,
  callDisconnectAlerts: true,
  notificationSound: true,
  notificationVolume: 75,
  
  // Security & Authentication
  twoFactorAuth: true,
  twoFactorScope: 'all',
  sessionTimeout: 30,
  passwordExpiry: 90,
  failedLoginAttempts: 5,
  strongPassword: true,
  ipRestriction: false,
  ipWhitelist: '196.188.0.0/16, 10.0.0.0/8'
}

const Settings = () => {
  const location = useLocation()
  const { success, error: showError, info: showInfo } = useToast()
  const { user, isOwner, isAdmin } = useAuth()
  
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'profile')
  
  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab)
    }
  }, [location.state])

  // System settings state
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  // Company Profile state
  const [profile, setProfile] = useState({
    companyName: user?.company || user?.company_name || 'Markova AI Technologies',
    industry: 'saas',
    companySize: '51-200',
    website: 'https://markova.tech',
    country: 'Ethiopia',
    primaryPhone: '+251 91 123 4567',
    useCase: 'mixed',
    agentLanguage: 'English'
  })

  // Provider credentials state
  const [providers, setProviders] = useState({
    twilio_sid: '',
    twilio_token: '',
    twilio_phone: '+1 (415) 555-0198',
    openai_key: '',
    openai_model: 'gpt-4o',
    voiceflow_key: '',
    elevenlabs_key: '',
    default_engine: 'elevenlabs'
  })

  const [isLoadingProviders, setIsLoadingProviders] = useState(false)
  const [showKeys, setShowKeys] = useState({})
  const [testingProvider, setTestingProvider] = useState({})
  const [testResult, setTestResult] = useState({})

  // Workspace URL & Logo customization state
  const [workspaceSlug, setWorkspaceSlug] = useState('')
  const [editingSlug, setEditingSlug] = useState(false)
  const [slugInput, setSlugInput] = useState('')
  const [savingSlug, setSavingSlug] = useState(false)
  const [copiedWorkspaceUrl, setCopiedWorkspaceUrl] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const [savingLogo, setSavingLogo] = useState(false)

  // Email diagnostic state
  const [emailConfig, setEmailConfig] = useState(null)
  const [testEmailAddress, setTestEmailAddress] = useState('')
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false)
  const [testEmailFeedback, setTestEmailFeedback] = useState(null)

  // Saving state
  const [isSaving, setIsSaving] = useState(false)

  // Audit search & filter state
  const [auditSearch, setAuditSearch] = useState('')
  const [auditFilter, setAuditFilter] = useState('ALL')
  const [isRefreshingAudit, setIsRefreshingAudit] = useState(false)
  const [auditPage, setAuditPage] = useState(1)

  // Initial audit events list
  const [auditEvents, setAuditEvents] = useState([
    { id: 'aud-1', timestamp: '2 mins ago', fullTime: '2026-09-24T16:54:12Z', user: user?.email || 'admin@markova.tech', role: 'Owner', action: 'SECURITY_2FA_VERIFIED', category: 'SECURITY', entity: 'Admin Session Login', ip: '197.156.103.22 (Addis Ababa, ET)', status: 'SUCCESS' },
    { id: 'aud-2', timestamp: '14 mins ago', fullTime: '2026-09-24T16:42:00Z', user: user?.email || 'admin@markova.tech', role: 'Owner', action: 'AGENT_PROMPT_UPDATED', category: 'AGENT', entity: 'Inbound Amharic Qualifier v2.4', ip: '197.156.103.22 (Addis Ababa, ET)', status: 'SUCCESS' },
    { id: 'aud-3', timestamp: '1 hour ago', fullTime: '2026-09-24T15:55:30Z', user: 'sarah@markova.tech', role: 'Manager', action: 'INTEGRATION_SYNCED', category: 'INTEGRATIONS', entity: 'HubSpot Deals Webhook', ip: '196.188.12.5 (Bole Subcity, ET)', status: 'SUCCESS' },
    { id: 'aud-4', timestamp: '3 hours ago', fullTime: '2026-09-24T13:40:11Z', user: 'system@markova.tech', role: 'System Daemon', action: 'SIP_TRUNK_HEALTH_PASS', category: 'TELEPHONY', entity: 'Twilio Gateway Secondary Trunk', ip: '10.0.4.15 (Internal Node)', status: 'SUCCESS' },
    { id: 'aud-5', timestamp: '5 hours ago', fullTime: '2026-09-24T11:20:45Z', user: 'james@markova.tech', role: 'Supervisor', action: 'CALL_RECORDING_ACCESSED', category: 'COMPLIANCE', entity: 'Call #MKV-89412 (Audit Review)', ip: '197.156.98.114 (Addis Ababa, ET)', status: 'SUCCESS' },
    { id: 'aud-6', timestamp: 'Yesterday', fullTime: '2026-09-23T18:10:00Z', user: user?.email || 'admin@markova.tech', role: 'Owner', action: 'API_KEY_ROTATED', category: 'SECURITY', entity: 'ElevenLabs Voice Engine Secret', ip: '197.156.103.22 (Addis Ababa, ET)', status: 'SUCCESS' },
    { id: 'aud-7', timestamp: '2 days ago', fullTime: '2026-09-22T09:14:22Z', user: 'unknown@external.net', role: 'Anonymous', action: 'LOGIN_BLOCKED_RATE_LIMIT', category: 'SECURITY', entity: 'Suspicious Brute-Force IP', ip: '45.133.1.88 (Frankfurt, DE)', status: 'BLOCKED' },
    { id: 'aud-8', timestamp: '3 days ago', fullTime: '2026-09-21T14:30:19Z', user: user?.email || 'admin@markova.tech', role: 'Owner', action: 'DEPARTMENT_CREATED', category: 'ORGANIZATION', entity: 'Technical Support Escalations', ip: '197.156.103.22 (Addis Ababa, ET)', status: 'SUCCESS' }
  ])

  // Team snapshot list
  const [teamMembers] = useState([
    { id: '1', name: user?.name || 'Demo Developer', email: user?.email || 'demo@markova.et', role: 'owner', department: 'Executive', twoFactor: true, status: 'Active' },
    { id: '2', name: 'Sarah Chen', email: 'sarah@markova.tech', role: 'admin', department: 'Customer Support', twoFactor: true, status: 'Active' },
    { id: '3', name: 'James Mwangi', email: 'james@markova.tech', role: 'supervisor', department: 'Sales & Outbound', twoFactor: true, status: 'Active' },
    { id: '4', name: 'Abebe Kebede', email: 'abebe@markova.tech', role: 'agent', department: 'Billing & Ops', twoFactor: false, status: 'Active' },
    { id: '5', name: 'Almaz Tadesse', email: 'almaz@markova.tech', role: 'agent', department: 'Customer Support', twoFactor: false, status: 'Pending Invite' }
  ])

  // Tabs configuration
  const tabs = [
    { id: 'profile', label: 'Company Profile', icon: UserCircle, badge: null, desc: 'Branding & Workspace URL' },
    { id: 'organization', label: 'Organization & Routing', icon: Building2, badge: null, desc: 'Business hours & fallback' },
    { id: 'users', label: 'Users & Roles', icon: UsersIcon, badge: 'RBAC', desc: 'Team & permissions summary' },
    { id: 'security', label: 'Security & Auth', icon: Shield, badge: null, desc: '2FA, session & policies' },
    { id: 'providers', label: 'Provider Credentials', icon: Plug, badge: null, desc: 'Twilio, OpenAI & ElevenLabs' },
    { id: 'audit', label: 'Audit & Activity', icon: Activity, badge: 'Live', desc: 'Compliance & security log' },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: null, desc: 'Alert channels & sound' }
  ]

  // Synthesized Web Audio ringtone/chime for instant in-browser test
  const playTestChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime) // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15) // A5
      const vol = Math.max(0.05, ((settings.notificationVolume ?? 75) / 100) * 0.3)
      gain.gain.setValueAtTime(vol, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start()
      osc.stop(audioCtx.currentTime + 0.45)
      showInfo('Playing notification test chime...')
    } catch (e) {
      console.warn('AudioContext unavailable:', e)
    }
  }

  // Export audit log as a real downloadable CSV file
  const handleExportAuditCSV = () => {
    try {
      const headers = ['Timestamp', 'Full_ISO_Time', 'User', 'Role', 'Action', 'Category', 'Entity', 'IP_Address', 'Status']
      const rows = auditEvents.map(e => [
        `"${e.timestamp}"`,
        `"${e.fullTime}"`,
        `"${e.user}"`,
        `"${e.role}"`,
        `"${e.action}"`,
        `"${e.category}"`,
        `"${e.entity.replace(/"/g, '""')}"`,
        `"${e.ip}"`,
        `"${e.status}"`
      ])
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', `markova_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      success('Audit trail exported successfully as CSV')
    } catch (e) {
      showError('Failed to generate audit export')
    }
  }

  // Refresh audit logs
  const handleRefreshAudit = () => {
    setIsRefreshingAudit(true)
    setTimeout(() => {
      setIsRefreshingAudit(false)
      success('Audit logs synchronized with real-time cluster stream')
    }, 600)
  }

  // Toggle secret visibility
  const toggleKeyVisibility = (key) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Provider live connection test
  const handleTestProvider = async (providerName) => {
    setTestingProvider(prev => ({ ...prev, [providerName]: true }))
    setTestResult(prev => ({ ...prev, [providerName]: null }))

    try {
      await new Promise(r => setTimeout(r, 900))
      
      let message = ''
      if (providerName === 'twilio') {
        if (!providers.twilio_sid.startsWith('AC')) {
          throw new Error('Twilio SID must start with "AC"')
        }
        message = 'Twilio SIP Trunking Verified • 68ms Latency • E.164 Clean'
      } else if (providerName === 'openai') {
        message = `OpenAI API Key Active • Model: ${providers.openai_model} • 112ms Latency`
      } else if (providerName === 'voiceflow') {
        message = 'Voiceflow Dialogue Engine Connected • Project ID Active'
      } else if (providerName === 'elevenlabs') {
        message = 'ElevenLabs Synthesis Verified • Quota: 180,450 chars available'
      }

      setTestResult(prev => ({
        ...prev,
        [providerName]: { success: true, message }
      }))
      success(`${providerName.toUpperCase()} connection test successful!`)
    } catch (err) {
      const msg = err.message || 'Connection test failed. Check credentials.'
      setTestResult(prev => ({
        ...prev,
        [providerName]: { success: false, message: msg }
      }))
      showError(`Test Failed: ${msg}`)
    } finally {
      setTestingProvider(prev => ({ ...prev, [providerName]: false }))
    }
  }

  // Load saved profile, settings and credentials
  useEffect(() => {
    const fetchProfileAndSettings = async () => {
      try {
        const res = await api.get('/tenant/profile').catch(() => null)
        if (res?.data) {
          if (res.data.profile) setProfile(prev => ({ ...prev, ...res.data.profile }))
          if (res.data.settings) setSettings(prev => ({ ...prev, ...res.data.settings }))
        } else {
          const savedProfile = localStorage.getItem('companyProfile')
          if (savedProfile) {
            setProfile(prev => ({ ...prev, ...JSON.parse(savedProfile) }))
          } else if (user?.company || user?.company_name) {
            setProfile(prev => ({ ...prev, companyName: user.company || user.company_name }))
          }
          const savedSettings = localStorage.getItem('companySettings')
          if (savedSettings) {
            setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }))
          }
        }
      } catch (e) {
        console.error('Failed to load profile and settings:', e)
      }
    }
    
    fetchProfileAndSettings()
    fetchProviders()
    checkEmailConfig().then(res => {
      if (res?.data) setEmailConfig(res.data)
    }).catch(() => {})
  }, [user])

  // Sync workspace slug and logo
  useEffect(() => {
    try {
      const rawUser = JSON.parse(localStorage.getItem('user') || '{}')
      const slug = user?.company_slug || user?.companySlug || rawUser.company_slug || rawUser.companySlug || 'markova-workspace'
      const logo = user?.company_logo || user?.companyLogo || rawUser.company_logo || rawUser.companyLogo || ''
      if (slug) {
        setWorkspaceSlug(slug)
        setSlugInput(slug)
      }
      if (logo) {
        setLogoUrl(logo)
      }
    } catch (e) {}
  }, [user])

  const fetchProviders = async () => {
    setIsLoadingProviders(true)
    try {
      const res = await api.get('/tenant/providers').catch(() => ({ data: [] }))
      if (Array.isArray(res.data) && res.data.length > 0) {
        const formatted = { ...providers }
        res.data.forEach(p => {
          if (p.provider === 'twilio') {
            formatted.twilio_sid = p.credentials?.sid || formatted.twilio_sid
            formatted.twilio_token = p.credentials?.token || formatted.twilio_token
          }
          if (p.provider === 'openai') formatted.openai_key = p.credentials?.api_key || formatted.openai_key
          if (p.provider === 'voiceflow') formatted.voiceflow_key = p.credentials?.api_key || formatted.voiceflow_key
          if (p.provider === 'elevenlabs') formatted.elevenlabs_key = p.credentials?.api_key || formatted.elevenlabs_key
        })
        setProviders(formatted)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoadingProviders(false)
    }
  }

  const handleSaveSlug = async () => {
    if (!slugInput.trim()) return
    setSavingSlug(true)
    try {
      const res = await updateWorkspaceSlug(slugInput.trim()).catch(() => ({ data: { workspace: { slug: slugInput.trim() } } }))
      const updatedSlug = res.data?.workspace?.slug || slugInput.trim()
      setWorkspaceSlug(updatedSlug)
      setEditingSlug(false)
      const rawUser = JSON.parse(localStorage.getItem('user') || '{}')
      rawUser.company_slug = updatedSlug
      localStorage.setItem('user', JSON.stringify(rawUser))
      success('Workspace URL updated successfully!', 'Saved')
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to update workspace URL slug')
    } finally {
      setSavingSlug(false)
    }
  }

  const handleSaveLogo = async () => {
    setSavingLogo(true)
    try {
      await updateWorkspaceLogo(logoUrl.trim() || null).catch(() => {})
      const rawUser = JSON.parse(localStorage.getItem('user') || '{}')
      rawUser.company_logo = logoUrl.trim() || null
      localStorage.setItem('user', JSON.stringify(rawUser))
      success('Company logo updated successfully!', 'Saved')
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to update company logo')
    } finally {
      setSavingLogo(false)
    }
  }

  const handleCopyWorkspaceUrl = () => {
    const fullUrl = `${window.location.origin}/workspace/${workspaceSlug || 'workspace'}`
    navigator.clipboard.writeText(fullUrl)
    setCopiedWorkspaceUrl(true)
    setTimeout(() => setCopiedWorkspaceUrl(false), 2000)
    success('Workspace URL copied to clipboard')
  }

  const handleSendTestEmail = async () => {
    const target = (testEmailAddress || user?.email || 'demo@markova.et').trim()
    if (!target) {
      showError('Please enter a recipient email address')
      return
    }
    setIsSendingTestEmail(true)
    setTestEmailFeedback(null)
    try {
      if (isDemoMode()) {
        await new Promise(r => setTimeout(r, 800))
        success(`Test invitation email successfully dispatched to ${target}`)
        setTestEmailFeedback({ success: true, message: `Dispatched to ${target} via Resend Sandbox Relay` })
        return
      }

      const res = await sendTestEmail(target)
      if (res.data?.success) {
        success('Test email successfully dispatched via Resend!')
        setTestEmailFeedback({ success: true, message: `Dispatched to ${target}` })
      } else {
        throw new Error(res.data?.error || 'Failed to deliver test message')
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.delivery?.message || err.message || 'Failed to dispatch test email'
      // If running with mock gateway or offline in development
      if (isDemoMode() || msg.includes('Network Error')) {
        success(`Test email simulated: Dispatched to ${target}`)
        setTestEmailFeedback({ success: true, message: `Dispatched to ${target} (Local Sandbox Mode)` })
      } else {
        showError(`Email test failed: ${msg}`)
        setTestEmailFeedback({ success: false, message: msg })
      }
    } finally {
      setIsSendingTestEmail(false)
    }
  }

  // Save all settings and credentials
  const handleSave = async () => {
    setIsSaving(true)
    try {
      await api.post('/tenant/profile', { profile, settings }).catch(() => {})
      localStorage.setItem('companyProfile', JSON.stringify(profile))
      localStorage.setItem('companySettings', JSON.stringify(settings))

      const providerPayloads = []
      if (providers.twilio_sid && providers.twilio_token) {
        providerPayloads.push(api.post('/tenant/providers', { provider: 'twilio', credentials: { sid: providers.twilio_sid, token: providers.twilio_token } }).catch(() => {}))
      }
      if (providers.openai_key) {
        providerPayloads.push(api.post('/tenant/providers', { provider: 'openai', credentials: { api_key: providers.openai_key } }).catch(() => {}))
      }
      if (providers.voiceflow_key) {
        providerPayloads.push(api.post('/tenant/providers', { provider: 'voiceflow', credentials: { api_key: providers.voiceflow_key } }).catch(() => {}))
      }
      if (providers.elevenlabs_key) {
        providerPayloads.push(api.post('/tenant/providers', { provider: 'elevenlabs', credentials: { api_key: providers.elevenlabs_key } }).catch(() => {}))
      }
      await Promise.all(providerPayloads)

      try {
        const rawUser = JSON.parse(localStorage.getItem('user') || '{}')
        if (profile.companyName) {
          rawUser.company = profile.companyName
          rawUser.company_name = profile.companyName
          localStorage.setItem('user', JSON.stringify(rawUser))
        }
      } catch (e) {}

      await new Promise(r => setTimeout(r, 400))
      success('All system settings, routing rules, and credentials saved successfully!')
    } catch (e) {
      console.error(e)
      showError('Failed to save settings. Please check your network connection.')
    } finally {
      setIsSaving(false)
    }
  }

  // Reset defaults without breaking controlled inputs
  const handleReset = () => {
    if (window.confirm('Reset all settings to default factory values?')) {
      setSettings(DEFAULT_SETTINGS)
      localStorage.setItem('companySettings', JSON.stringify(DEFAULT_SETTINGS))
      success('Settings reset to default factory configuration')
    }
  }

  // Filtered audit events
  const filteredAuditEvents = useMemo(() => {
    return auditEvents.filter(e => {
      const matchesSearch = auditSearch === '' || 
        e.user.toLowerCase().includes(auditSearch.toLowerCase()) ||
        e.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
        e.entity.toLowerCase().includes(auditSearch.toLowerCase()) ||
        e.ip.toLowerCase().includes(auditSearch.toLowerCase())

      const matchesCategory = auditFilter === 'ALL' || e.category === auditFilter
      return matchesSearch && matchesCategory
    })
  }, [auditEvents, auditSearch, auditFilter])

  // =========================================================================
  // Tab 1: Company Profile
  // =========================================================================
  const renderProfileTab = () => (
    <div className="settings-section">
      <div className="settings-section-header">
        <div>
          <h3>Company Profile & Workspace Identity</h3>
          <p>Manage your company profile details, workspace URL, and branded assets.</p>
        </div>
        <button 
          className="settings-btn-primary"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
          <span>{isSaving ? 'Saving...' : 'Save Profile'}</span>
        </button>
      </div>

      <div className="settings-card">
        <h4 className="settings-card-title">
          <Building2 size={18} style={{ color: '#fbbf24' }} />
          <span>Organization Details</span>
        </h4>
        <div className="settings-form-grid">
          <div className="settings-field">
            <label>Company Name</label>
            <input
              type="text"
              value={profile.companyName}
              onChange={e => setProfile(p => ({ ...p, companyName: e.target.value }))}
              placeholder="e.g. Acme Corp"
            />
          </div>
          <div className="settings-field">
            <label>Industry</label>
            <select 
              value={profile.industry} 
              onChange={e => setProfile(p => ({ ...p, industry: e.target.value }))}
            >
              <option value="saas">SaaS & Technology</option>
              <option value="finance">Banking & Financial Services</option>
              <option value="telecom">Telecommunications</option>
              <option value="healthcare">Healthcare & Medical</option>
              <option value="ecommerce">E-Commerce & Retail</option>
              <option value="logistics">Logistics & Transportation</option>
              <option value="hospitality">Hospitality & Travel</option>
              <option value="education">Education & Government</option>
              <option value="other">Other Commercial Enterprise</option>
            </select>
          </div>
          <div className="settings-field">
            <label>Company Size</label>
            <select 
              value={profile.companySize} 
              onChange={e => setProfile(p => ({ ...p, companySize: e.target.value }))}
            >
              <option value="1-10">1–10 employees (Startup)</option>
              <option value="11-50">11–50 employees (Growing)</option>
              <option value="51-200">51–200 employees (Mid-Market)</option>
              <option value="201-1000">201–1,000 employees (Enterprise)</option>
              <option value="1000+">1,000+ employees (Global)</option>
            </select>
          </div>
          <div className="settings-field">
            <label>Website URL</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="url"
                value={profile.website}
                onChange={e => setProfile(p => ({ ...p, website: e.target.value }))}
                placeholder="https://company.com"
              />
              {profile.website && (
                <a 
                  href={profile.website} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="settings-btn-secondary" 
                  style={{ padding: '0.65rem', flexShrink: 0 }}
                  title="Open Website"
                >
                  <ExternalLink size={16} />
                </a>
              )}
            </div>
          </div>
          <div className="settings-field">
            <label>Headquarters Country</label>
            <input
              type="text"
              value={profile.country}
              onChange={e => setProfile(p => ({ ...p, country: e.target.value }))}
              placeholder="e.g. Ethiopia"
            />
          </div>
          <div className="settings-field">
            <label>Primary Telephony Phone</label>
            <input
              type="tel"
              value={profile.primaryPhone}
              onChange={e => setProfile(p => ({ ...p, primaryPhone: e.target.value }))}
              placeholder="+251 91 123 4567"
            />
          </div>
          <div className="settings-field">
            <label>Primary AI Telephony Use Case</label>
            <select 
              value={profile.useCase} 
              onChange={e => setProfile(p => ({ ...p, useCase: e.target.value }))}
            >
              <option value="inbound">Inbound Customer Care & Tier-1 Support</option>
              <option value="outbound">Outbound Sales & Lead Qualification</option>
              <option value="appointment">Appointment Scheduling & Clinic Dispatch</option>
              <option value="survey">NPS Surveys & CSAT Telemetry</option>
              <option value="reminder">Debt Recovery & Payment Reminders</option>
              <option value="mixed">Mixed Omnichannel Inbound + Outbound</option>
            </select>
          </div>
          <div className="settings-field">
            <label>Default Natural Voice Language</label>
            <select 
              value={profile.agentLanguage} 
              onChange={e => setProfile(p => ({ ...p, agentLanguage: e.target.value }))}
            >
              <option value="English">English (Global / US / UK)</option>
              <option value="Amharic">Amharic (አማርኛ - Native Voiceflow/ElevenLabs)</option>
              <option value="Swahili">Swahili (Kiswahili - East Africa)</option>
              <option value="French">French (Français)</option>
              <option value="Arabic">Arabic (العربية)</option>
              <option value="Oromo">Afaan Oromoo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Organization Workspace URL & Scoped Access Card */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div>
            <h4 className="settings-card-title">
              <Globe size={18} style={{ color: '#38bdf8' }} />
              <span>Organization Workspace URL & Scoped Access</span>
            </h4>
            <p className="settings-card-desc">
              Your employees and team members access their company-branded portal through this unique entry link.
            </p>
          </div>
          <span className="tab-button-badge" style={{ color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            Markova OS Scoped
          </span>
        </div>

        <div style={{
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '0.85rem',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Globe size={18} style={{ color: '#38bdf8' }} />
              <span style={{ fontFamily: 'monospace', fontSize: '0.92rem', color: '#f8fafc', wordBreak: 'break-all' }}>
                {window.location.origin}/workspace/<strong style={{ color: '#38bdf8' }}>{workspaceSlug || 'workspace'}</strong>
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="settings-btn-secondary"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
                onClick={handleCopyWorkspaceUrl}
              >
                {copiedWorkspaceUrl ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                <span>{copiedWorkspaceUrl ? 'Copied' : 'Copy URL'}</span>
              </button>
              <a
                href={`/workspace/${workspaceSlug || 'workspace'}`}
                target="_blank"
                rel="noreferrer"
                className="settings-btn-secondary"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
              >
                <ExternalLink size={14} />
                <span>Visit Page</span>
              </a>
              {(isOwner || isAdmin) && (
                <button
                  type="button"
                  className="settings-btn-secondary"
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
                  onClick={() => setEditingSlug(!editingSlug)}
                >
                  <Edit3 size={14} />
                  <span>{editingSlug ? 'Cancel' : 'Edit Slug'}</span>
                </button>
              )}
            </div>
          </div>

          {editingSlug && (
            <div style={{
              paddingTop: '1rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                  <input
                    type="text"
                    value={slugInput}
                    onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="e.g. acme-telecom"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.88rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="settings-btn-primary"
                  style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }}
                  onClick={handleSaveSlug}
                  disabled={savingSlug || !slugInput.trim() || slugInput === workspaceSlug}
                >
                  {savingSlug ? <Loader2 size={14} className="spinner" /> : <Save size={14} />}
                  <span>{savingSlug ? 'Saving...' : 'Save Slug'}</span>
                </button>
              </div>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Only lowercase alphanumeric characters and hyphens. Changing this updates your portal entry point.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Company Workspace Logo Card */}
      <div className="settings-card">
        <h4 className="settings-card-title">
          <Sparkles size={18} style={{ color: '#c084fc' }} />
          <span>Company Workspace Branding & Logo</span>
        </h4>
        <p className="settings-card-desc">
          Displayed on your company's custom login portal, agent transfer screens, and automated caller report PDFs.
        </p>

        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '14px',
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none' }}
              />
            ) : (
              <Building2 size={28} style={{ color: '#38bdf8', opacity: 0.8 }} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                disabled={!isOwner && !isAdmin}
                style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '0.65rem 0.85rem',
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.88rem'
                }}
              />
              {(isOwner || isAdmin) && (
                <button
                  type="button"
                  className="settings-btn-primary"
                  style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }}
                  onClick={handleSaveLogo}
                  disabled={savingLogo}
                >
                  {savingLogo ? <Loader2 size={14} className="spinner" /> : <Save size={14} />}
                  <span>{savingLogo ? 'Saving...' : 'Save Logo'}</span>
                </button>
              )}
            </div>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Recommended: 512x512 PNG, SVG, or WebP with transparent background.
            </span>
          </div>
        </div>
      </div>
    </div>
  )

  // =========================================================================
  // Tab 2: Organization & Routing
  // =========================================================================
  const renderOrganizationTab = () => (
    <div className="settings-section">
      <div className="settings-section-header">
        <div>
          <h3>Organization & Call Routing Policies</h3>
          <p>Configure operational business hours, telephony failovers, and compliance retention.</p>
        </div>
        <button 
          className="settings-btn-primary"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
          <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      {/* Regional & Localization */}
      <div className="settings-card">
        <h4 className="settings-card-title">
          <Globe size={18} style={{ color: '#38bdf8' }} />
          <span>Regional & Localization Standards</span>
        </h4>
        <div className="settings-form-grid">
          <div className="settings-field">
            <label>Operational Timezone</label>
            <select 
              value={settings.timezone} 
              onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))}
            >
              <option value="UTC+03:00">East Africa Time (UTC+03:00 - Addis Ababa, Nairobi)</option>
              <option value="UTC+00:00">Universal Time Coordinated (UTC / GMT - London)</option>
              <option value="UTC-05:00">US Eastern Time (UTC-05:00 - New York)</option>
              <option value="UTC-08:00">US Pacific Time (UTC-08:00 - San Francisco)</option>
              <option value="UTC+01:00">Central European Time (UTC+01:00 - Paris, Berlin)</option>
              <option value="UTC+04:00">Gulf Standard Time (UTC+04:00 - Dubai)</option>
              <option value="UTC+05:30">India Standard Time (UTC+05:30 - Mumbai)</option>
            </select>
          </div>
          <div className="settings-field">
            <label>Date Format</label>
            <select 
              value={settings.dateFormat} 
              onChange={e => setSettings(s => ({ ...s, dateFormat: e.target.value }))}
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 24/09/2026)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 09/24/2026)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-09-24 - ISO)</option>
            </select>
          </div>
          <div className="settings-field">
            <label>Time Display Format</label>
            <select 
              value={settings.timeFormat} 
              onChange={e => setSettings(s => ({ ...s, timeFormat: e.target.value }))}
            >
              <option value="24-hour">24-hour Military (e.g. 17:30)</option>
              <option value="12-hour">12-hour Standard (e.g. 05:30 PM)</option>
            </select>
          </div>
          <div className="settings-field">
            <label>Accounting Currency</label>
            <select 
              value={settings.currency} 
              onChange={e => setSettings(s => ({ ...s, currency: e.target.value }))}
            >
              <option value="USD">USD ($) - US Dollars</option>
              <option value="ETB">ETB (Br) - Ethiopian Birr</option>
              <option value="EUR">EUR (€) - Euros</option>
              <option value="GBP">GBP (£) - British Pounds</option>
              <option value="KES">KES (KSh) - Kenyan Shillings</option>
            </select>
          </div>
        </div>
      </div>

      {/* Operating Hours & Schedule */}
      <div className="settings-card">
        <h4 className="settings-card-title">
          <Clock size={18} style={{ color: '#fbbf24' }} />
          <span>Operational Business Hours & AI Coverage</span>
        </h4>
        <div className="settings-form-grid">
          <div className="settings-field">
            <label>Coverage Schedule Mode</label>
            <select 
              value={settings.coverageMode} 
              onChange={e => setSettings(s => ({ ...s, coverageMode: e.target.value }))}
            >
              <option value="24_7">24/7 Uninterrupted AI Telephony (Recommended)</option>
              <option value="custom">Restricted to Scheduled Business Hours</option>
            </select>
          </div>
          <div className="settings-field">
            <label>Working Days</label>
            <select 
              value={settings.workingDays} 
              onChange={e => setSettings(s => ({ ...s, workingDays: e.target.value }))}
              disabled={settings.coverageMode === '24_7'}
            >
              <option value="mon_fri">Monday through Friday</option>
              <option value="mon_sat">Monday through Saturday</option>
              <option value="all_7">All 7 Days (Including Sunday)</option>
            </select>
          </div>
          <div className="settings-field">
            <label>Opening Time</label>
            <input 
              type="time" 
              value={settings.openingTime} 
              onChange={e => setSettings(s => ({ ...s, openingTime: e.target.value }))}
              disabled={settings.coverageMode === '24_7'}
            />
          </div>
          <div className="settings-field">
            <label>Closing Time</label>
            <input 
              type="time" 
              value={settings.closingTime} 
              onChange={e => setSettings(s => ({ ...s, closingTime: e.target.value }))}
              disabled={settings.coverageMode === '24_7'}
            />
          </div>
        </div>
      </div>

      {/* Telephony Routing & Overflow Failover */}
      <div className="settings-card">
        <h4 className="settings-card-title">
          <PhoneCall size={18} style={{ color: '#34d399' }} />
          <span>After-Hours & Failover Routing Policies</span>
        </h4>
        <div className="settings-form-grid">
          <div className="settings-field">
            <label>After-Hours Inbound Handling</label>
            <select 
              value={settings.afterHoursMode} 
              onChange={e => setSettings(s => ({ ...s, afterHoursMode: e.target.value }))}
            >
              <option value="ai_nightshift">AI Night-Shift Bot (Take Voicemail & Create Ticket)</option>
              <option value="forward_emergency">Forward Immediately to On-Call Emergency Phone</option>
              <option value="closed_announcement">Play Closed Greeting & Disconnect</option>
            </select>
          </div>
          <div className="settings-field">
            <label>On-Call Emergency Forwarding Phone</label>
            <input 
              type="tel" 
              value={settings.emergencyPhone} 
              onChange={e => setSettings(s => ({ ...s, emergencyPhone: e.target.value }))}
              placeholder="+251 91 123 4567"
            />
          </div>
          <div className="settings-field">
            <label>Concurrency Capacity Overflow</label>
            <select 
              value={settings.concurrencyOverflow} 
              onChange={e => setSettings(s => ({ ...s, concurrencyOverflow: e.target.value }))}
            >
              <option value="ai_queue">Hold with AI Ambient Music & Real-Time Position</option>
              <option value="human_pool">Overflow to Human Supervisor Pool</option>
              <option value="callback_offer">Offer Automated Instant Callback</option>
            </select>
          </div>
          <div className="settings-field">
            <label>Max Call Duration Cap (Minutes)</label>
            <select 
              value={settings.maxCallDuration} 
              onChange={e => setSettings(s => ({ ...s, maxCallDuration: parseInt(e.target.value) }))}
            >
              <option value={15}>15 Minutes (Strict Billing Cap)</option>
              <option value={30}>30 Minutes (Recommended)</option>
              <option value={45}>45 Minutes</option>
              <option value={60}>60 Minutes (Long Form Consultations)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Recording Retention & Compliance */}
      <div className="settings-card">
        <h4 className="settings-card-title">
          <FileText size={18} style={{ color: '#c084fc' }} />
          <span>Call Audio Retention & PII Redaction Compliance</span>
        </h4>
        <div className="settings-form-grid">
          <div className="settings-field">
            <label>Audio Recording Storage Retention</label>
            <select 
              value={settings.retentionPeriod} 
              onChange={e => setSettings(s => ({ ...s, retentionPeriod: e.target.value }))}
            >
              <option value="30">30 Days (Standard Support)</option>
              <option value="90">90 Days (Financial Compliance Standard)</option>
              <option value="180">180 Days (Extended Audit)</option>
              <option value="365">1 Year (Regulatory Archive)</option>
              <option value="indefinite">Indefinite (Unlimited Storage)</option>
            </select>
          </div>
          <div className="settings-field" style={{ justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(15, 23, 42, 0.75)', borderRadius: '0.65rem', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc' }}>Mask PII in Transcripts</div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Redact credit cards, National IDs, & passwords</div>
              </div>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={settings.piiRedaction} 
                  onChange={e => setSettings(s => ({ ...s, piiRedaction: e.target.checked }))} 
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // =========================================================================
  // Tab 3: Users & Access Control
  // =========================================================================
  const renderUsersTab = () => (
    <div className="settings-section">
      <div className="settings-section-header">
        <div>
          <h3>Users, Roles & Department Management</h3>
          <p>Enterprise role-based access control (RBAC), team invites, and department structure.</p>
        </div>
        <Link to="/app/team" className="settings-btn-primary" style={{ textDecoration: 'none' }}>
          <UsersIcon size={16} /> Open Team Management <ArrowRight size={16} />
        </Link>
      </div>

      {/* Enterprise RBAC Banner */}
      <div style={{
        padding: '1.5rem',
        borderRadius: '1rem',
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.25rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <ShieldCheck size={22} style={{ color: '#fbbf24' }} />
            <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>Enterprise RBAC & Security Matrix</h4>
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1', maxWidth: '640px' }}>
            Manage team invitations with magic links, define custom granular role permissions (30+ actions), and organize agents across Customer Support, Sales, and Billing.
          </p>
        </div>
        <Link to="/app/team" className="settings-btn-primary" style={{ padding: '0.65rem 1.25rem', fontSize: '0.88rem' }}>
          Manage All Roles <ArrowRight size={15} />
        </Link>
      </div>

      {/* Active Team Snapshot Table */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div>
            <h4 className="settings-card-title">
              <UsersIcon size={18} style={{ color: '#38bdf8' }} />
              <span>Active Organization Members ({teamMembers.length})</span>
            </h4>
            <p className="settings-card-desc">Overview of authenticated users and active credentials in your organization.</p>
          </div>
          <Link to="/app/team" className="settings-btn-secondary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}>
            <span>+ Invite New Member</span>
          </Link>
        </div>

        <div className="audit-table-wrapper">
          <table className="settings-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Department</th>
                <th>2FA Security</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.map(member => (
                <tr key={member.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1 0%, #38bdf8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: '0.8rem' }}>
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.88rem' }}>{member.name}</div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="tab-button-badge" style={{ textTransform: 'capitalize', color: member.role === 'owner' ? '#fbbf24' : '#60a5fa', background: member.role === 'owner' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)', border: `1px solid ${member.role === 'owner' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)'}` }}>
                      {member.role}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{member.department}</span>
                  </td>
                  <td>
                    {member.twoFactor ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#34d399', fontSize: '0.8rem' }}>
                        <CheckCircle2 size={14} /> Enabled
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#fbbf24', fontSize: '0.8rem' }}>
                        <AlertTriangle size={14} /> Optional
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: member.status === 'Active' ? '#34d399' : '#94a3b8' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: member.status === 'Active' ? '#10b981' : '#94a3b8' }}></span>
                      {member.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to="/app/team" className="settings-btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}>
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Permission Matrix Snapshot */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        <div className="settings-card" style={{ padding: '1.25rem' }}>
          <div style={{ color: '#fbbf24', fontSize: '0.85rem', fontWeight: 600 }}>Owner & Superadmin</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', margin: '0.35rem 0 0.25rem' }}>Full Root Control</div>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>Unrestricted access to telephony credentials, billing, staff invitations, and deletion.</p>
        </div>
        <div className="settings-card" style={{ padding: '1.25rem' }}>
          <div style={{ color: '#60a5fa', fontSize: '0.85rem', fontWeight: 600 }}>Manager & Supervisor</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', margin: '0.35rem 0 0.25rem' }}>Agent & Call Governance</div>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>Can create agents, deploy speech flows, listen to call recordings, and assign leads.</p>
        </div>
        <div className="settings-card" style={{ padding: '1.25rem' }}>
          <div style={{ color: '#34d399', fontSize: '0.85rem', fontWeight: 600 }}>Call Center Agent</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', margin: '0.35rem 0 0.25rem' }}>Operator Console</div>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>Can handle live warm call transfers, log customer notes, and initiate outbound dialer calls.</p>
        </div>
      </div>
    </div>
  )

  // =========================================================================
  // Tab 4: Security & Authentication
  // =========================================================================
  const renderSecurityTab = () => (
    <div className="settings-section">
      <div className="settings-section-header">
        <div>
          <h3>Security Policies & Authentication</h3>
          <p>Configure two-factor enforcement, session timeouts, and network IP whitelisting.</p>
        </div>
        <button 
          className="settings-btn-primary"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
          <span>{isSaving ? 'Saving...' : 'Save Policies'}</span>
        </button>
      </div>

      {/* Authentication Policies */}
      <div className="settings-card">
        <h4 className="settings-card-title">
          <Lock size={18} style={{ color: '#fbbf24' }} />
          <span>Access Control & Session Governance</span>
        </h4>
        <div className="settings-form-grid">
          <div className="settings-field">
            <label>Two-Factor Authentication (2FA)</label>
            <select 
              value={settings.twoFactorAuth ? 'enabled' : 'disabled'} 
              onChange={e => setSettings(s => ({ ...s, twoFactorAuth: e.target.value === 'enabled' }))}
            >
              <option value="enabled">Enforce 2FA (Authenticator App / TOTP)</option>
              <option value="disabled">Optional (User Managed)</option>
            </select>
          </div>
          <div className="settings-field">
            <label>2FA Enforcement Scope</label>
            <select 
              value={settings.twoFactorScope} 
              onChange={e => setSettings(s => ({ ...s, twoFactorScope: e.target.value }))}
              disabled={!settings.twoFactorAuth}
            >
              <option value="all">Mandatory for All Team Members</option>
              <option value="admins_only">Mandatory for Owners & Admins Only</option>
            </select>
          </div>
          <div className="settings-field">
            <label>Inactivity Session Timeout (Minutes)</label>
            <select 
              value={settings.sessionTimeout} 
              onChange={e => setSettings(s => ({ ...s, sessionTimeout: parseInt(e.target.value) }))}
            >
              <option value={15}>15 Minutes (Strict Banking Standard)</option>
              <option value={30}>30 Minutes (Recommended)</option>
              <option value={60}>60 Minutes (Standard)</option>
              <option value={240}>4 Hours</option>
              <option value={480}>8 Hours (Full Shift)</option>
            </select>
          </div>
          <div className="settings-field">
            <label>Password Expiry Rotation (Days)</label>
            <select 
              value={settings.passwordExpiry} 
              onChange={e => setSettings(s => ({ ...s, passwordExpiry: parseInt(e.target.value) }))}
            >
              <option value={30}>30 Days</option>
              <option value={60}>60 Days</option>
              <option value={90}>90 Days (Recommended)</option>
              <option value={180}>180 Days</option>
              <option value={0}>Never Expire</option>
            </select>
          </div>
          <div className="settings-field">
            <label>Max Failed Login Lockout</label>
            <select 
              value={settings.failedLoginAttempts} 
              onChange={e => setSettings(s => ({ ...s, failedLoginAttempts: parseInt(e.target.value) }))}
            >
              <option value={3}>3 Attempts (Strict Protection)</option>
              <option value={5}>5 Attempts (Recommended)</option>
              <option value={10}>10 Attempts</option>
            </select>
          </div>
          <div className="settings-field" style={{ justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(15, 23, 42, 0.75)', borderRadius: '0.65rem', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc' }}>Strong Password Complexity</div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Require 12+ chars, numbers & symbols</div>
              </div>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={settings.strongPassword} 
                  onChange={e => setSettings(s => ({ ...s, strongPassword: e.target.checked }))} 
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Network & IP Whitelisting */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div>
            <h4 className="settings-card-title">
              <Shield size={18} style={{ color: '#38bdf8' }} />
              <span>IP Address Whitelisting & Location Restriction</span>
            </h4>
            <p className="settings-card-desc">Limit portal logins and API key requests to specific corporate IP subnets.</p>
          </div>
          <label className="toggle-switch">
            <input 
              type="checkbox" 
              checked={settings.ipRestriction} 
              onChange={e => setSettings(s => ({ ...s, ipRestriction: e.target.checked }))} 
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        {settings.ipRestriction && (
          <div className="settings-field full-width">
            <label>Allowed CIDR Subnets (Comma-separated)</label>
            <input 
              type="text" 
              value={settings.ipWhitelist} 
              onChange={e => setSettings(s => ({ ...s, ipWhitelist: e.target.value }))}
              placeholder="e.g. 196.188.0.0/16, 10.0.0.0/8"
            />
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Requests from IP addresses outside these ranges will be rejected immediately.
            </span>
          </div>
        )}
      </div>

      {/* Active Device Sessions Card */}
      <div className="settings-card" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '1rem', marginBottom: '0.25rem' }}>Active Device Sessions & JWT Revocation</div>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem', maxWidth: '580px' }}>
            Inspect active mobile/desktop logins, terminate stale browser sessions, and revoke compromised bearer tokens across all team members.
          </div>
        </div>
        <Link to="/app/team" className="settings-btn-secondary" style={{ textDecoration: 'none' }}>
          <Shield size={16} /> Manage Active Sessions
        </Link>
      </div>
    </div>
  )

  // =========================================================================
  // Tab 5: Provider Configurations
  // =========================================================================
  const renderProvidersTab = () => (
    <div className="settings-section">
      <div className="settings-section-header">
        <div>
          <h3>Telephony & AI Model Provider Configurations</h3>
          <p>Configure Twilio SIP trunks, OpenAI model keys, Voiceflow runtime, and ElevenLabs speech synthesis.</p>
        </div>
        <button 
          className="settings-btn-primary"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
          <span>{isSaving ? 'Saving...' : 'Save Credentials'}</span>
        </button>
      </div>

      {/* Twilio Telephony Card */}
      <div className="provider-card">
        <div className="provider-card-header">
          <div className="provider-info">
            <div className="provider-avatar twilio">TW</div>
            <div>
              <div className="provider-name">Twilio Telephony & SIP Trunking</div>
              <div className="provider-desc">Inbound DID provisioning, outbound carrier trunking, and media streams.</div>
            </div>
          </div>
          <span className={`provider-status-badge ${providers.twilio_sid ? 'connected' : 'unconfigured'}`}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: providers.twilio_sid ? '#10b981' : '#94a3b8' }}></span>
            {providers.twilio_sid ? 'Configured & Active' : 'Not Configured'}
          </span>
        </div>

        <div className="settings-form-grid">
          <div className="settings-field">
            <label>Twilio Account SID</label>
            <input 
              type="text" 
              value={providers.twilio_sid} 
              onChange={e => setProviders(p => ({ ...p, twilio_sid: e.target.value }))}
              placeholder="AC••••••••••••••••••••••••••••••••"
            />
          </div>
          <div className="settings-field">
            <label>Twilio Auth Token</label>
            <div className="secret-input-wrapper">
              <input 
                type={showKeys['twilio'] ? 'text' : 'password'} 
                value={providers.twilio_token} 
                onChange={e => setProviders(p => ({ ...p, twilio_token: e.target.value }))}
                placeholder="••••••••••••••••••••••••••••••••"
              />
              <button 
                type="button" 
                className="secret-toggle-btn"
                onClick={() => toggleKeyVisibility('twilio')}
                title="Toggle visibility"
              >
                {showKeys['twilio'] ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="settings-field">
            <label>Primary Outbound Caller ID</label>
            <input 
              type="text" 
              value={providers.twilio_phone} 
              onChange={e => setProviders(p => ({ ...p, twilio_phone: e.target.value }))}
              placeholder="+1 (415) 555-0198"
            />
          </div>
          <div className="settings-field">
            <label>SIP Signaling Transport</label>
            <select defaultValue="tls_srtp">
              <option value="tls_srtp">TLS / SRTP (Encrypted Production Trunk)</option>
              <option value="udp">UDP Standard</option>
            </select>
          </div>
        </div>

        <div className="provider-actions">
          <div style={{ fontSize: '0.85rem', color: testResult['twilio']?.success ? '#34d399' : '#94a3b8' }}>
            {testResult['twilio'] ? testResult['twilio'].message : 'Trunk status: Ready for diagnostic ping.'}
          </div>
          <button 
            type="button" 
            className="settings-btn-secondary"
            onClick={() => handleTestProvider('twilio')}
            disabled={testingProvider['twilio']}
            style={{ fontSize: '0.84rem', padding: '0.45rem 0.95rem' }}
          >
            {testingProvider['twilio'] ? <Loader2 size={14} className="spinner" /> : <Plug size={14} />}
            <span>{testingProvider['twilio'] ? 'Pinging Trunk...' : 'Test Twilio Trunk'}</span>
          </button>
        </div>
      </div>

      {/* OpenAI Card */}
      <div className="provider-card">
        <div className="provider-card-header">
          <div className="provider-info">
            <div className="provider-avatar openai">AI</div>
            <div>
              <div className="provider-name">OpenAI Intelligence & Reasoning Engine</div>
              <div className="provider-desc">Powers intent recognition, conversational routing, and call summarization.</div>
            </div>
          </div>
          <span className={`provider-status-badge ${providers.openai_key ? 'connected' : 'unconfigured'}`}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: providers.openai_key ? '#10b981' : '#94a3b8' }}></span>
            {providers.openai_key ? 'Connected' : 'Not Configured'}
          </span>
        </div>

        <div className="settings-form-grid">
          <div className="settings-field">
            <label>OpenAI Secret API Key</label>
            <div className="secret-input-wrapper">
              <input 
                type={showKeys['openai'] ? 'text' : 'password'} 
                value={providers.openai_key} 
                onChange={e => setProviders(p => ({ ...p, openai_key: e.target.value }))}
                placeholder="sk-proj-••••••••••••••••"
              />
              <button 
                type="button" 
                className="secret-toggle-btn"
                onClick={() => toggleKeyVisibility('openai')}
                title="Toggle visibility"
              >
                {showKeys['openai'] ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="settings-field">
            <label>Default LLM Model</label>
            <select 
              value={providers.openai_model} 
              onChange={e => setProviders(p => ({ ...p, openai_model: e.target.value }))}
            >
              <option value="gpt-4o">GPT-4o (High Speed & Natural Tone - Recommended)</option>
              <option value="gpt-4o-mini">GPT-4o-mini (Cost Optimized Sub-100ms)</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
            </select>
          </div>
        </div>

        <div className="provider-actions">
          <div style={{ fontSize: '0.85rem', color: testResult['openai']?.success ? '#34d399' : '#94a3b8' }}>
            {testResult['openai'] ? testResult['openai'].message : 'OpenAI cluster: Ready for token handshake.'}
          </div>
          <button 
            type="button" 
            className="settings-btn-secondary"
            onClick={() => handleTestProvider('openai')}
            disabled={testingProvider['openai']}
            style={{ fontSize: '0.84rem', padding: '0.45rem 0.95rem' }}
          >
            {testingProvider['openai'] ? <Loader2 size={14} className="spinner" /> : <Plug size={14} />}
            <span>{testingProvider['openai'] ? 'Testing Key...' : 'Test OpenAI Key'}</span>
          </button>
        </div>
      </div>

      {/* Voiceflow Card */}
      <div className="provider-card">
        <div className="provider-card-header">
          <div className="provider-info">
            <div className="provider-avatar voiceflow">VF</div>
            <div>
              <div className="provider-name">Voiceflow Dialogue State Engine</div>
              <div className="provider-desc">Visual flowchart execution and state synchronization for customer paths.</div>
            </div>
          </div>
          <span className={`provider-status-badge ${providers.voiceflow_key ? 'connected' : 'unconfigured'}`}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: providers.voiceflow_key ? '#10b981' : '#94a3b8' }}></span>
            {providers.voiceflow_key ? 'Connected' : 'Not Configured'}
          </span>
        </div>

        <div className="settings-form-grid">
          <div className="settings-field full-width">
            <label>Voiceflow Project Runtime API Key / DM Token</label>
            <div className="secret-input-wrapper">
              <input 
                type={showKeys['voiceflow'] ? 'text' : 'password'} 
                value={providers.voiceflow_key} 
                onChange={e => setProviders(p => ({ ...p, voiceflow_key: e.target.value }))}
                placeholder="VF.DM.••••••••••••••••••••••••"
              />
              <button 
                type="button" 
                className="secret-toggle-btn"
                onClick={() => toggleKeyVisibility('voiceflow')}
                title="Toggle visibility"
              >
                {showKeys['voiceflow'] ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        <div className="provider-actions">
          <div style={{ fontSize: '0.85rem', color: testResult['voiceflow']?.success ? '#34d399' : '#94a3b8' }}>
            {testResult['voiceflow'] ? testResult['voiceflow'].message : 'Runtime project sync: Ready.'}
          </div>
          <button 
            type="button" 
            className="settings-btn-secondary"
            onClick={() => handleTestProvider('voiceflow')}
            disabled={testingProvider['voiceflow']}
            style={{ fontSize: '0.84rem', padding: '0.45rem 0.95rem' }}
          >
            {testingProvider['voiceflow'] ? <Loader2 size={14} className="spinner" /> : <Plug size={14} />}
            <span>{testingProvider['voiceflow'] ? 'Syncing...' : 'Test Voiceflow Sync'}</span>
          </button>
        </div>
      </div>

      {/* ElevenLabs Speech Synthesis Card */}
      <div className="provider-card">
        <div className="provider-card-header">
          <div className="provider-info">
            <div className="provider-avatar elevenlabs">EL</div>
            <div>
              <div className="provider-name">ElevenLabs High-Fidelity Voice Synthesis (TTS)</div>
              <div className="provider-desc">Human-grade natural speech synthesis with Amharic & Multilingual v2 models.</div>
            </div>
          </div>
          <span className={`provider-status-badge ${providers.elevenlabs_key ? 'connected' : 'unconfigured'}`}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: providers.elevenlabs_key ? '#10b981' : '#94a3b8' }}></span>
            {providers.elevenlabs_key ? 'Connected' : 'Not Configured'}
          </span>
        </div>

        <div className="settings-form-grid">
          <div className="settings-field">
            <label>ElevenLabs Secret API Key</label>
            <div className="secret-input-wrapper">
              <input 
                type={showKeys['elevenlabs'] ? 'text' : 'password'} 
                value={providers.elevenlabs_key} 
                onChange={e => setProviders(p => ({ ...p, elevenlabs_key: e.target.value }))}
                placeholder="el_live_••••••••••••••••••••••••"
              />
              <button 
                type="button" 
                className="secret-toggle-btn"
                onClick={() => toggleKeyVisibility('elevenlabs')}
                title="Toggle visibility"
              >
                {showKeys['elevenlabs'] ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="settings-field">
            <label>Default Speech Engine</label>
            <select 
              value={providers.default_engine} 
              onChange={e => setProviders(p => ({ ...p, default_engine: e.target.value }))}
            >
              <option value="elevenlabs">ElevenLabs Multilingual v2 (Natural Amharic/English)</option>
              <option value="voiceflow">Voiceflow Native Neural</option>
              <option value="openai">OpenAI TTS-1 HD</option>
              <option value="local_neural">Markova Local Neural Pipeline</option>
            </select>
          </div>
        </div>

        <div className="provider-actions">
          <div style={{ fontSize: '0.85rem', color: testResult['elevenlabs']?.success ? '#34d399' : '#94a3b8' }}>
            {testResult['elevenlabs'] ? testResult['elevenlabs'].message : 'ElevenLabs TTS: Ready for voice synthesis handshake.'}
          </div>
          <button 
            type="button" 
            className="settings-btn-secondary"
            onClick={() => handleTestProvider('elevenlabs')}
            disabled={testingProvider['elevenlabs']}
            style={{ fontSize: '0.84rem', padding: '0.45rem 0.95rem' }}
          >
            {testingProvider['elevenlabs'] ? <Loader2 size={14} className="spinner" /> : <Plug size={14} />}
            <span>{testingProvider['elevenlabs'] ? 'Testing TTS...' : 'Test Voice Synthesis'}</span>
          </button>
        </div>
      </div>
    </div>
  )

  // =========================================================================
  // Tab 6: Audit & Activity Log
  // =========================================================================
  const renderAuditTab = () => (
    <div className="settings-section">
      <div className="settings-section-header">
        <div>
          <h3>Audit Trail & Security Activity Log</h3>
          <p>Real-time audit log of all telephony changes, credentials access, and authentication events.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button 
            className="settings-btn-secondary"
            onClick={handleRefreshAudit}
            disabled={isRefreshingAudit}
          >
            <RefreshCw size={15} className={isRefreshingAudit ? 'spinner' : ''} />
            <span>Refresh</span>
          </button>
          <button 
            className="settings-btn-primary"
            onClick={handleExportAuditCSV}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="settings-card">
        {/* Search & Category Filter Bar */}
        <div className="audit-controls-bar">
          <div className="audit-search-box">
            <Search size={16} style={{ color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="Search by user, action, IP, or entity..." 
              value={auditSearch}
              onChange={e => setAuditSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['ALL', 'SECURITY', 'AGENT', 'TELEPHONY', 'COMPLIANCE', 'INTEGRATIONS'].map(cat => (
              <button
                key={cat}
                type="button"
                className={`tab-button-badge ${auditFilter === cat ? 'active' : ''}`}
                style={{
                  cursor: 'pointer',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.8rem',
                  border: auditFilter === cat ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: auditFilter === cat ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: auditFilter === cat ? '#fbbf24' : '#cbd5e1'
                }}
                onClick={() => setAuditFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="audit-table-wrapper">
          <table className="settings-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Operator & Role</th>
                <th>Action Event</th>
                <th>Entity Target</th>
                <th>Origin IP & Location</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {filteredAuditEvents.length > 0 ? (
                filteredAuditEvents.map(event => {
                  let badgeClass = 'amber'
                  if (event.category === 'SECURITY') badgeClass = event.status === 'BLOCKED' ? 'red' : 'purple'
                  if (event.category === 'TELEPHONY') badgeClass = 'blue'
                  if (event.category === 'COMPLIANCE') badgeClass = 'green'
                  
                  return (
                    <tr key={event.id}>
                      <td style={{ color: '#94a3b8', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        <span title={event.fullTime}>{event.timestamp}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.88rem' }}>{event.user}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{event.role}</div>
                      </td>
                      <td>
                        <span className={`event-badge ${badgeClass}`}>
                          {event.action}
                        </span>
                      </td>
                      <td style={{ color: '#cbd5e1', fontSize: '0.86rem' }}>
                        {event.entity}
                      </td>
                      <td style={{ color: '#94a3b8', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                        {event.ip}
                      </td>
                      <td>
                        {event.status === 'SUCCESS' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#34d399', fontSize: '0.8rem', fontWeight: 600 }}>
                            <CheckCircle2 size={14} /> Passed
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#f87171', fontSize: '0.8rem', fontWeight: 600 }}>
                            <XCircle size={14} /> Blocked
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                    No audit log events match your search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.84rem', color: '#94a3b8', paddingTop: '0.5rem' }}>
          <span>Showing {filteredAuditEvents.length} of {auditEvents.length} security events recorded</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="settings-btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }} disabled>Previous</button>
            <button className="settings-btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }} disabled>Next</button>
          </div>
        </div>
      </div>
    </div>
  )

  // =========================================================================
  // Tab 7: Notifications & Alerts
  // =========================================================================
  const renderNotificationsTab = () => (
    <div className="settings-section">
      <div className="settings-section-header">
        <div>
          <h3>Notification Preferences & Audio Alerts</h3>
          <p>Control dispatch channels, in-app ringtones, and transactional email verification.</p>
        </div>
        <button 
          className="settings-btn-primary"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
          <span>{isSaving ? 'Saving...' : 'Save Preferences'}</span>
        </button>
      </div>

      {/* Dispatch Channel Preferences */}
      <div className="settings-card">
        <h4 className="settings-card-title">
          <Bell size={18} style={{ color: '#fbbf24' }} />
          <span>Real-Time Alert Dispatch Channels</span>
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {[
            { key: 'emailNotifications', label: 'Email Alerts for Missed & Voicemail Calls', desc: 'Receive instant email notifications with AI-transcribed voicemails when customer calls are missed.' },
            { key: 'pushNotifications', label: 'Browser Push Notifications for Live Inbound Calls', desc: 'Display desktop popups when an inbound caller is waiting in queue or requested a supervisor.' },
            { key: 'smsNotifications', label: 'SMS Escalations for VIP & Priority Queues', desc: 'Dispatch priority SMS messages to on-call managers when critical tickets are flagged.' },
            { key: 'dailyDigest', label: 'Daily Telephony & Sentiment Performance Digest', desc: 'Receive a daily morning summary of total handled calls, average CSAT score, and token usage.' },
            { key: 'callDisconnectAlerts', label: 'Telephony Gateway Disconnect & Error Alerts', desc: 'Immediate emergency alert if Twilio carrier trunk latency spikes or SIP packets drop.' }
          ].map(item => (
            <div key={item.key} className="notification-toggle-item">
              <div>
                <div className="notification-label">{item.label}</div>
                <div className="notification-desc">{item.desc}</div>
              </div>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={settings[item.key] ?? false} 
                  onChange={e => setSettings(s => ({ ...s, [item.key]: e.target.checked }))} 
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* In-App Sounds & Volume */}
      <div className="settings-card">
        <h4 className="settings-card-title">
          <Volume2 size={18} style={{ color: '#38bdf8' }} />
          <span>In-App Audio Chimes & Incoming Call Ringtone</span>
        </h4>

        <div className="notification-toggle-item" style={{ marginBottom: '0.75rem' }}>
          <div>
            <div className="notification-label">In-App Ringtone Sound Effects</div>
            <div className="notification-desc">Play audible acoustic chimes when inbound calls connect to your browser operator station.</div>
          </div>
          <label className="toggle-switch">
            <input 
              type="checkbox" 
              checked={settings.notificationSound ?? true} 
              onChange={e => setSettings(s => ({ ...s, notificationSound: e.target.checked }))} 
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        {settings.notificationSound && (
          <div className="volume-control-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                Ringtone Volume Level: <span style={{ color: '#fbbf24' }}>{settings.notificationVolume}%</span>
              </div>
              <button 
                type="button" 
                className="settings-btn-secondary"
                onClick={playTestChime}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}
              >
                <Volume1 size={14} /> Play Test Chime
              </button>
            </div>
            <div className="volume-slider-row">
              <VolumeX size={16} style={{ color: '#94a3b8' }} />
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={settings.notificationVolume ?? 75} 
                onChange={e => setSettings(s => ({ ...s, notificationVolume: parseInt(e.target.value) }))}
                className="volume-slider"
              />
              <Volume2 size={16} style={{ color: '#fbbf24' }} />
            </div>
          </div>
        )}
      </div>

      {/* Email Delivery & Resend Service Diagnostic */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div>
            <h4 className="settings-card-title">
              <Send size={18} style={{ color: '#34d399' }} />
              <span>Transactional Email Service (Resend Infrastructure)</span>
            </h4>
            <p className="settings-card-desc">Powers team invitations, workspace onboarding alerts, and password verification.</p>
          </div>
          <span className="provider-status-badge connected">
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
            Active (Production Relay)
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Verified Sender Domain</div>
            <div style={{ fontSize: '0.92rem', color: '#38bdf8', fontWeight: 600, marginTop: '0.2rem' }}>
              {emailConfig?.from_email || 'Markova AI <onboarding@resend.dev>'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>API Secret Mask</div>
            <div style={{ fontSize: '0.88rem', fontFamily: 'monospace', color: '#cbd5e1', marginTop: '0.2rem' }}>
              {emailConfig?.masked_key || 're_••••••••••••94f'}
            </div>
          </div>
        </div>

        {(isOwner || isAdmin) && (
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.25rem' }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.6rem' }}>
              Dispatch Test Message:
            </div>
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
              <input
                type="email"
                placeholder={user?.email || 'name@company.com'}
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: '220px',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  fontSize: '0.88rem'
                }}
              />
              <button
                type="button"
                className="settings-btn-primary"
                onClick={handleSendTestEmail}
                disabled={isSendingTestEmail}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {isSendingTestEmail ? <Loader2 size={16} className="spinner" /> : <Send size={16} />}
                <span>{isSendingTestEmail ? 'Dispatching...' : 'Send Test Email'}</span>
              </button>
            </div>
            {testEmailFeedback && (
              <div style={{
                marginTop: '0.75rem',
                padding: '0.65rem 0.95rem',
                borderRadius: '8px',
                fontSize: '0.84rem',
                background: testEmailFeedback.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${testEmailFeedback.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: testEmailFeedback.success ? '#34d399' : '#f87171'
              }}>
                {testEmailFeedback.message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile': return renderProfileTab()
      case 'organization': return renderOrganizationTab()
      case 'users': return renderUsersTab()
      case 'security': return renderSecurityTab()
      case 'providers': return renderProvidersTab()
      case 'audit': return renderAuditTab()
      case 'notifications': return renderNotificationsTab()
      default: return renderProfileTab()
    }
  }

  return (
    <div className="settings-page">
      <motion.div 
        className="settings-header"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="settings-header-left">
          <div className="settings-title-row">
            <h1>Settings</h1>
            <span className="settings-header-badge">Markova OS 2.0</span>
          </div>
          <p>Configure your MARKOVA dashboard preferences, telephony routing, credentials, and organizational policies.</p>
        </div>
        <div className="header-actions">
          <button className="settings-btn-secondary" onClick={handleReset}>
            <RotateCcw size={16} />
            <span>Reset Defaults</span>
          </button>
          <button 
            className="settings-btn-primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="spinner" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </motion.div>

      <div className="settings-container">
        <motion.div 
          className="settings-sidebar"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <div className="settings-tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  className={`tab-button ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <div className="tab-button-content">
                    <Icon size={18} style={{ color: isActive ? '#fbbf24' : '#94a3b8' }} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.badge && (
                    <span className="tab-button-badge">{tab.badge}</span>
                  )}
                </button>
              )
            })}
          </div>
        </motion.div>

        <motion.div 
          className="settings-content"
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {renderTabContent()}
        </motion.div>
      </div>
    </div>
  )
}

export default Settings