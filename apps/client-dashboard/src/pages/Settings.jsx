import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import axios from 'axios'
import { 
  Building2,
  Users as UsersIcon,
  Shield,
  Key,
  Plug,
  Activity,
  Bell,
  CreditCard,
  Save,
  RotateCcw,
  UserCircle,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react'
import './Settings.css'
import api from '../api/client'

const Settings = () => {
  const location = useLocation()
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'profile')
  
  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab)
    }
  }, [location.state])

  const [settings, setSettings] = useState({
    // General
    companyName: 'AI CallCenter Inc.',
    timezone: 'UTC-05:00',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12-hour',
    
    // Appearance
    theme: 'dark',
    language: 'en',
    fontSize: 'medium',
    animations: true,
    
    // Notifications
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    notificationSound: true,
    notificationVolume: 70,
    
    // Security
    twoFactorAuth: true,
    sessionTimeout: 30,
    passwordExpiry: 90,
    failedLoginAttempts: 5
  })

  // Company profile from onboarding
  const [profile, setProfile] = useState({
    companyName: '',
    industry: '',
    companySize: '',
    website: '',
    country: '',
    primaryPhone: '',
    useCase: '',
    agentLanguage: 'English'
  })

  const [users, setUsers] = useState([
    { id: '1', name: 'Admin User', email: 'admin@markova.tech', role: 'Owner', status: 'Active' },
    { id: '2', name: 'Sarah Chen', email: 'sarah@markova.tech', role: 'Manager', status: 'Active' },
    { id: '3', name: 'James Mwangi', email: 'james@markova.tech', role: 'Agent Supervisor', status: 'Pending Invite' }
  ])

  const [apiKeys, setApiKeys] = useState([
    { id: '1', name: 'Production Key', key: 'mk_live_••••••••••••abcd', type: 'live' },
    { id: '2', name: 'Staging Key', key: 'mk_test_••••••••••••efgh', type: 'test' }
  ])

  const [providers, setProviders] = useState({
    twilio_sid: '',
    twilio_token: '',
    openai_key: '',
    voiceflow_key: '',
    elevenlabs_key: '',
    default_engine: 'voiceflow'
  })

  const [isLoadingProviders, setIsLoadingProviders] = useState(false)
  const [showKeys, setShowKeys] = useState({})

  // Load saved profile from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('companyProfile')
    if (saved) {
      try {
        setProfile(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to parse company profile:', e)
      }
    }
    
    fetchProviders()
    fetchUsers()
  }, [])

  const fetchProviders = async () => {
    setIsLoadingProviders(true)
    try {
      const res = await api.get('/tenant/providers').catch(() => ({ data: [] }))
      const formatted = { ...providers }
      res.data.forEach(p => {
        if (p.provider === 'twilio') {
          formatted.twilio_sid = p.credentials.sid || ''
          formatted.twilio_token = p.credentials.token || ''
        }
        if (p.provider === 'openai') formatted.openai_key = p.credentials.api_key || ''
        if (p.provider === 'voiceflow') formatted.voiceflow_key = p.credentials.api_key || ''
        if (p.provider === 'elevenlabs') formatted.elevenlabs_key = p.credentials.api_key || ''
      })
      setProviders(formatted)
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoadingProviders(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await api.get('/tenant/users').catch(() => null)
      if (res && res.data) {
        setUsers(res.data)
      }
    } catch (e) {}
  }

  const [isSaving, setIsSaving] = useState(false)

  const tabs = [
    { id: 'profile', label: 'Company Profile', icon: UserCircle },
    { id: 'organization', label: 'Organization', icon: Building2 },
    { id: 'users', label: 'Users & Roles', icon: UsersIcon },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'apikeys', label: 'API Keys', icon: Key },
    { id: 'providers', label: 'Provider Configurations', icon: Plug },
    { id: 'audit', label: 'Audit & Activity', icon: Activity },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'billing', label: 'Billing', icon: CreditCard }
  ]

  const handleProfileChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }))
  }

  const handleProviderChange = (field, value) => {
    setProviders(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    // Save profile to localStorage (in real app, send to backend)
    localStorage.setItem('companyProfile', JSON.stringify(profile))
    
    // Save providers
    try {
      if (providers.twilio_sid && providers.twilio_token) {
        await api.post('/tenant/providers', { provider: 'twilio', credentials: { sid: providers.twilio_sid, token: providers.twilio_token } }).catch(()=>{})
      }
      if (providers.openai_key) {
        await api.post('/tenant/providers', { provider: 'openai', credentials: { api_key: providers.openai_key } }).catch(()=>{})
      }
      if (providers.voiceflow_key) {
        await api.post('/tenant/providers', { provider: 'voiceflow', credentials: { api_key: providers.voiceflow_key } }).catch(()=>{})
      }
      if (providers.elevenlabs_key) {
        await api.post('/tenant/providers', { provider: 'elevenlabs', credentials: { api_key: providers.elevenlabs_key } }).catch(()=>{})
      }
    } catch (e) {
      console.error(e)
    }

    await new Promise(resolve => setTimeout(resolve, 500))
    setIsSaving(false)
    console.log('Settings saved:', { settings, profile, providers })
  }

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all settings to default values?')) {
      setSettings({})
    }
  }

  const renderProfileTab = () => (
    <div className="settings-section">
      <h3>Company Profile</h3>
      <p style={{ color: 'var(--gray)', marginBottom: '1.5rem' }}>
        This is the information you provided during onboarding. You can update it anytime.
      </p>
      <div className="settings-form-grid">
        <div className="settings-field">
          <label>Company Name</label>
          <input
            type="text"
            value={profile.companyName}
            onChange={e => handleProfileChange('companyName', e.target.value)}
            placeholder="Your company name"
          />
        </div>
        <div className="settings-field">
          <label>Industry</label>
          <select value={profile.industry} onChange={e => handleProfileChange('industry', e.target.value)}>
            <option value="">Select industry</option>
            <option value="healthcare">Healthcare</option>
            <option value="finance">Finance & Banking</option>
            <option value="ecommerce">E-commerce & Retail</option>
            <option value="saas">SaaS / Technology</option>
            <option value="education">Education</option>
            <option value="logistics">Logistics & Transport</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="settings-field">
          <label>Company Size</label>
          <select value={profile.companySize} onChange={e => handleProfileChange('companySize', e.target.value)}>
            <option value="">Select size</option>
            <option value="1-10">1–10 employees</option>
            <option value="11-50">11–50 employees</option>
            <option value="51-200">51–200 employees</option>
            <option value="201-1000">201–1,000 employees</option>
            <option value="1000+">1,000+ employees</option>
          </select>
        </div>
        <div className="settings-field">
          <label>Website</label>
          <input
            type="url"
            value={profile.website}
            onChange={e => handleProfileChange('website', e.target.value)}
            placeholder="https://yourcompany.com"
          />
        </div>
        <div className="settings-field">
          <label>Country</label>
          <input
            type="text"
            value={profile.country}
            onChange={e => handleProfileChange('country', e.target.value)}
            placeholder="e.g. Ethiopia"
          />
        </div>
        <div className="settings-field">
          <label>Primary Phone</label>
          <input
            type="tel"
            value={profile.primaryPhone}
            onChange={e => handleProfileChange('primaryPhone', e.target.value)}
            placeholder="+251..."
          />
        </div>
        <div className="settings-field">
          <label>Primary Use Case</label>
          <select value={profile.useCase} onChange={e => handleProfileChange('useCase', e.target.value)}>
            <option value="">Select use case</option>
            <option value="inbound">Inbound Customer Support</option>
            <option value="outbound">Outbound Sales Calls</option>
            <option value="appointment">Appointment Scheduling</option>
            <option value="survey">Customer Surveys</option>
            <option value="reminder">Payment Reminders</option>
            <option value="mixed">Mixed / All of the above</option>
          </select>
        </div>
        <div className="settings-field">
          <label>Agent Language</label>
          <select value={profile.agentLanguage} onChange={e => handleProfileChange('agentLanguage', e.target.value)}>
            <option value="English">English</option>
            <option value="Amharic">Amharic</option>
            <option value="Swahili">Swahili</option>
            <option value="French">French</option>
            <option value="Arabic">Arabic</option>
          </select>
        </div>
      </div>
    </div>
  )

  const renderOrganizationTab = () => (
    <div className="settings-section">
      <h3>Organization Settings</h3>
      <p style={{ color: 'var(--gray)', marginBottom: '1.5rem' }}>Configure timezone, date format, and regional preferences.</p>
      <div className="settings-form-grid">
        <div className="settings-field">
          <label>Timezone</label>
          <select value={settings.timezone} onChange={e => setSettings(s => ({...s, timezone: e.target.value}))}>
            <option value="UTC-05:00">US Eastern (UTC-05:00)</option>
            <option value="UTC+00:00">UTC (GMT)</option>
            <option value="UTC+03:00">East Africa (UTC+03:00)</option>
            <option value="UTC+05:30">India (UTC+05:30)</option>
          </select>
        </div>
        <div className="settings-field">
          <label>Date Format</label>
          <select value={settings.dateFormat} onChange={e => setSettings(s => ({...s, dateFormat: e.target.value}))}>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>
        <div className="settings-field">
          <label>Time Format</label>
          <select value={settings.timeFormat} onChange={e => setSettings(s => ({...s, timeFormat: e.target.value}))}>
            <option value="12-hour">12-hour</option>
            <option value="24-hour">24-hour</option>
          </select>
        </div>
        <div className="settings-field">
          <label>UI Language</label>
          <select value={settings.language} onChange={e => setSettings(s => ({...s, language: e.target.value}))}>
            <option value="en">English</option>
            <option value="am">Amharic</option>
            <option value="fr">French</option>
            <option value="ar">Arabic</option>
          </select>
        </div>
      </div>
    </div>
  )

  const renderUsersTab = () => (
    <div className="settings-section">
      <h3>Users & Roles</h3>
      <p style={{ color: 'var(--gray)', marginBottom: '1.5rem' }}>Manage who has access to the MARKOVA platform and their roles.</p>
      <table className="settings-table">
        <thead>
          <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td><span style={{color: u.role === 'Owner' ? 'var(--live-amber)' : 'inherit', fontWeight: u.role === 'Owner' ? 600 : 400}}>{u.role}</span></td>
              <td><span style={{color: u.status === 'Active' ? 'var(--live-amber)' : 'var(--live-amber)'}}>● {u.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn btn-primary" style={{marginTop:'1rem'}}><UsersIcon size={16}/> Invite Team Member</button>
    </div>
  )

  const toggleKeyVisibility = (id) => {
    setShowKeys(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const renderApiKeysTab = () => (
    <div className="settings-section">
      <h3>API Keys</h3>
      <p style={{ color: 'var(--gray)', marginBottom: '1.5rem' }}>Manage API keys for external integrations and programmatic access.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {apiKeys.map(k => (
          <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-main)', borderRadius: '0.5rem', border: '1px solid var(--border-main)' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{k.name}</div>
              <code style={{ fontSize: '0.85rem', color: 'var(--gray)' }}>{showKeys[k.id] ? k.key.replace(/•/g, 'X') : k.key}</code>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => toggleKeyVisibility(k.id)} style={{padding:'0.4rem 0.75rem', fontSize:'0.85rem'}}>
                {showKeys[k.id] ? <EyeOff size={14}/> : <Eye size={14}/>} {showKeys[k.id] ? 'Hide' : 'Reveal'}
              </button>
              <button className="btn btn-secondary" style={{padding:'0.4rem 0.75rem', fontSize:'0.85rem', color:'var(--coral-pulse)'}}>Revoke</button>
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn-primary" style={{marginTop:'1rem'}}><Key size={16}/> Generate New Key</button>
    </div>
  )

  const renderProvidersTab = () => (
    <div className="settings-section">
      <h3>Provider Configurations</h3>
      <p style={{ color: 'var(--gray)', marginBottom: '1.5rem' }}>Configure the external services that power your AI agents.</p>
      {isLoadingProviders ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}><Loader2 className="spinner" size={20} /> Loading providers...</div>
      ) : (
        <div className="settings-form-grid">
          <div className="settings-field">
            <label>Twilio Account SID</label>
            <input type="text" value={providers.twilio_sid} onChange={e => handleProviderChange('twilio_sid', e.target.value)} placeholder="AC••••••••••••••••" />
          </div>
          <div className="settings-field">
            <label>Twilio Auth Token</label>
            <input type="password" value={providers.twilio_token} onChange={e => handleProviderChange('twilio_token', e.target.value)} placeholder="••••••••••••" />
          </div>
          <div className="settings-field">
            <label>OpenAI API Key</label>
            <input type="password" value={providers.openai_key} onChange={e => handleProviderChange('openai_key', e.target.value)} placeholder="sk-••••••••••••••••" />
          </div>
          <div className="settings-field">
            <label>Voiceflow API Key</label>
            <input type="password" value={providers.voiceflow_key} onChange={e => handleProviderChange('voiceflow_key', e.target.value)} placeholder="VF.DM.••••••••" />
          </div>
          <div className="settings-field">
            <label>ElevenLabs API Key</label>
            <input type="password" value={providers.elevenlabs_key} onChange={e => handleProviderChange('elevenlabs_key', e.target.value)} placeholder="••••••••••••" />
          </div>
          <div className="settings-field">
            <label>Default Voice Engine</label>
            <select value={providers.default_engine} onChange={e => handleProviderChange('default_engine', e.target.value)}>
              <option value="voiceflow">Voiceflow (Amharic Native)</option>
              <option value="elevenlabs">ElevenLabs</option>
              <option value="playht">Play.ht</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )

  const renderAuditTab = () => (
    <div className="settings-section">
      <h3>Audit & Activity Log</h3>
      <p style={{ color: 'var(--gray)', marginBottom: '1.5rem' }}>Track all actions taken in the platform for compliance and security.</p>
      <table className="settings-table">
        <thead>
          <tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th></tr>
        </thead>
        <tbody>
          <tr><td style={{color:'var(--gray)', fontSize:'0.85rem'}}>2 mins ago</td><td>admin@markova.tech</td><td><span style={{color:'var(--live-amber)'}}>AGENT_UPDATED</span></td><td>Inbound Qualifier</td></tr>
          <tr><td style={{color:'var(--gray)', fontSize:'0.85rem'}}>15 mins ago</td><td>admin@markova.tech</td><td><span style={{color:'#3b82f6'}}>FLOW_DEPLOYED</span></td><td>Main Inbound Flow</td></tr>
          <tr><td style={{color:'var(--gray)', fontSize:'0.85rem'}}>1 hour ago</td><td>sarah@markova.tech</td><td><span style={{color:'var(--live-amber)'}}>INTEGRATION_CONNECTED</span></td><td>HubSpot CRM</td></tr>
          <tr><td style={{color:'var(--gray)', fontSize:'0.85rem'}}>3 hours ago</td><td>admin@markova.tech</td><td><span style={{color:'var(--slate-wire)'}}>NUMBER_PROVISIONED</span></td><td>+1 (415) 555-0198</td></tr>
          <tr><td style={{color:'var(--gray)', fontSize:'0.85rem'}}>Yesterday</td><td>admin@markova.tech</td><td><span style={{color:'var(--live-amber)'}}>AGENT_CREATED</span></td><td>Outbound Closer</td></tr>
        </tbody>
      </table>
    </div>
  )

  const renderBillingTab = () => (
    <div className="settings-section">
      <h3>Billing & Plan</h3>
      <p style={{ color: 'var(--gray)', marginBottom: '1.5rem' }}>Manage your subscription, usage, and payment methods.</p>
      <div style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(232, 163, 61, 0.1), rgba(59, 130, 246, 0.1))', borderRadius: '1rem', border: '1px solid rgba(232, 163, 61, 0.2)', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--gray)', marginBottom: '0.25rem' }}>Current Plan</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>Growth Plan</div>
            <div style={{ color: 'var(--gray)', fontSize: '0.9rem' }}>$299/month • 10,000 minutes included</div>
          </div>
          <button className="btn btn-primary">Upgrade Plan</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <div style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: '0.5rem', border: '1px solid var(--border-main)' }}>
          <div style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>Minutes Used</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>3,247</div>
          <div style={{ color: 'var(--gray)', fontSize: '0.8rem' }}>of 10,000</div>
        </div>
        <div style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: '0.5rem', border: '1px solid var(--border-main)' }}>
          <div style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>Active Agents</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>8</div>
          <div style={{ color: 'var(--gray)', fontSize: '0.8rem' }}>of 15 max</div>
        </div>
        <div style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: '0.5rem', border: '1px solid var(--border-main)' }}>
          <div style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>Next Invoice</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>$299</div>
          <div style={{ color: 'var(--gray)', fontSize: '0.8rem' }}>Due Jul 1, 2026</div>
        </div>
      </div>
    </div>
  )

  const renderNotificationsTab = () => (
    <div className="settings-section">
      <h3>Notification Preferences</h3>
      <p style={{ color: 'var(--gray)', marginBottom: '1.5rem' }}>Control how and when you receive alerts from the MARKOVA platform.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {[
          { label: 'Email Alerts for Missed Calls', desc: 'Get an email summary when a call goes to voicemail.', key: 'emailNotifications' },
          { label: 'Push Notifications', desc: 'Browser push notifications for live call events.', key: 'pushNotifications' },
          { label: 'SMS Alerts', desc: 'Receive SMS for critical escalations.', key: 'smsNotifications' },
          { label: 'In-App Sound Effects', desc: 'Play sounds when new calls arrive.', key: 'notificationSound' },
        ].map(item => (
          <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-main)', borderRadius: '0.5rem', border: '1px solid var(--border-main)' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.label}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--gray)' }}>{item.desc}</div>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={settings[item.key]} onChange={e => setSettings(s => ({...s, [item.key]: e.target.checked}))} />
              <span className="toggle-slider"></span>
            </label>
          </div>
        ))}
      </div>
    </div>
  )

  const renderSecurityTab = () => (
    <div className="settings-section">
      <h3>Security & Authentication</h3>
      <p style={{ color: 'var(--gray)', marginBottom: '1.5rem' }}>Configure authentication policies and security controls.</p>
      <div className="settings-form-grid">
        <div className="settings-field">
          <label>Two-Factor Authentication</label>
          <select value={settings.twoFactorAuth ? 'enabled' : 'disabled'} onChange={e => setSettings(s => ({...s, twoFactorAuth: e.target.value === 'enabled'}))}>
            <option value="enabled">Enabled (Recommended)</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        <div className="settings-field">
          <label>Session Timeout (minutes)</label>
          <input type="number" value={settings.sessionTimeout} onChange={e => setSettings(s => ({...s, sessionTimeout: parseInt(e.target.value)}))} />
        </div>
        <div className="settings-field">
          <label>Password Expiry (days)</label>
          <input type="number" value={settings.passwordExpiry} onChange={e => setSettings(s => ({...s, passwordExpiry: parseInt(e.target.value)}))} />
        </div>
        <div className="settings-field">
          <label>Max Failed Login Attempts</label>
          <input type="number" value={settings.failedLoginAttempts} onChange={e => setSettings(s => ({...s, failedLoginAttempts: parseInt(e.target.value)}))} />
        </div>
      </div>
      <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(232, 163, 61, 0.1)', border: '1px solid rgba(232, 163, 61, 0.2)', borderRadius: '0.5rem' }}>
        <div style={{ color: 'var(--live-amber)', fontWeight: 600, marginBottom: '0.25rem' }}>⚠ Security Recommendation</div>
        <div style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>Enable 2FA for all users and set session timeouts to 30 minutes or less for compliance.</div>
      </div>
    </div>
  )

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile': return renderProfileTab()
      case 'organization': return renderOrganizationTab()
      case 'users': return renderUsersTab()
      case 'security': return renderSecurityTab()
      case 'apikeys': return renderApiKeysTab()
      case 'providers': return renderProvidersTab()
      case 'audit': return renderAuditTab()
      case 'notifications': return renderNotificationsTab()
      case 'billing': return renderBillingTab()
      default: return renderProfileTab()
    }
  }

  return (
    <div className="settings-page">
      <motion.div 
        className="settings-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div>
          <h1>Settings</h1>
          <p>Configure your MARKOVA dashboard preferences and system settings</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handleReset}>
            <RotateCcw size={18} />
            Reset Defaults
          </button>
          <button 
            className={`btn btn-primary ${isSaving ? 'loading' : ''}`}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <div className="spinner"></div>
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </motion.div>

      <div className="settings-container">
        <motion.div 
          className="settings-sidebar"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className="settings-tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={20} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </motion.div>

        <motion.div 
          className="settings-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {renderTabContent()}
        </motion.div>
      </div>
    </div>
  )
}

export default Settings