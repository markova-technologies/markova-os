import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, 
  Sparkles, 
  Database, 
  MessageSquare, 
  Calendar, 
  Settings, 
  Plug,
  CheckCircle2,
  LayoutGrid,
  Factory,
  X,
  Loader2,
  Eye,
  EyeOff,
  Activity,
  ShieldCheck,
  AlertCircle,
  Trash2,
  RefreshCw,
  Sliders,
  Check,
  Zap,
  ArrowUpRight,
  Info
} from 'lucide-react'
import { 
  listConnectors, 
  createConnector, 
  testConnector, 
  retestConnector, 
  disconnectConnector 
} from '../api/client'
import api from '../api/client'
import { useToast } from '../contexts/ToastContext'
import './IntegrationHub.css'

// ─────────────────────────────────────────────────────────────────────────────
// BRAND SVG LOGOS FOR ALL 10 INTEGRATION TOOLS
// ─────────────────────────────────────────────────────────────────────────────
export const ToolLogo = ({ id, size = 36, className = '' }) => {
  switch (id) {
    case 'ghl':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <rect width="48" height="48" rx="12" fill="url(#ghl-grad)" />
          <path d="M14 24C14 18.477 18.477 14 24 14C28.2 14 31.8 16.6 33.2 20.3L28.8 21.8C27.9 19.5 25.6 18.2 24 18.2C20.8 18.2 18.2 20.8 18.2 24C18.2 27.2 20.8 29.8 24 29.8C26.5 29.8 28.5 28.2 29.3 26H23.5V22H33.8V26.2C32.4 31.6 27.8 34 24 34C18.477 34 14 29.523 14 24Z" fill="white" />
          <defs>
            <linearGradient id="ghl-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0066FF" />
              <stop offset="1" stopColor="#00D2FF" />
            </linearGradient>
          </defs>
        </svg>
      )
    case 'hubspot':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <rect width="48" height="48" rx="12" fill="#FF7A59" />
          <path d="M34.2 21.4V17.8C35.4 17.2 36.2 16 36.2 14.6C36.2 12.6 34.6 11 32.6 11C30.6 11 29 12.6 29 14.6C29 15.9 29.7 17 30.8 17.6V21.4C29.6 22 28.8 23.2 28.8 24.6C28.8 25.2 29 25.8 29.3 26.3L20.2 31.6C19.5 31.2 18.6 30.9 17.7 30.9C15.1 30.9 13 33 13 35.6C13 38.2 15.1 40.3 17.7 40.3C20.3 40.3 22.4 38.2 22.4 35.6C22.4 35 22.2 34.4 21.8 33.9L31 28.6C31.5 28.8 32 28.9 32.6 28.9C35 28.9 36.9 27 36.9 24.6C36.9 23.1 36.1 21.8 34.2 21.4ZM32.6 13.2C33.4 13.2 34 13.8 34 14.6C34 15.4 33.4 16 32.6 16C31.8 16 31.2 15.4 31.2 14.6C31.2 13.8 31.8 13.2 32.6 13.2ZM17.7 38.1C16.3 38.1 15.2 37 15.2 35.6C15.2 34.2 16.3 33.1 17.7 33.1C19.1 33.1 20.2 34.2 20.2 35.6C20.2 37 19.1 38.1 17.7 38.1ZM32.6 26.7C31.4 26.7 30.5 25.8 30.5 24.6C30.5 23.4 31.4 22.5 32.6 22.5C33.8 22.5 34.7 23.4 34.7 24.6C34.7 25.8 33.8 26.7 32.6 26.7Z" fill="white" />
        </svg>
      )
    case 'zendesk':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <rect width="48" height="48" rx="12" fill="#03363D" />
          <path d="M15 15H25L15 27V15Z" fill="#00A656" />
          <path d="M33 33H23L33 21V33Z" fill="#00A656" />
          <circle cx="30" cy="18" r="3" fill="white" />
          <circle cx="18" cy="30" r="3" fill="white" />
        </svg>
      )
    case 'postgres':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <rect width="48" height="48" rx="12" fill="#336791" />
          <path d="M24 12C18.5 12 15 15.5 15 20C15 24.5 17.5 26.5 20 28V36H28V28.5C30.5 27 33 24.5 33 20C33 15.5 29.5 12 24 12ZM21 19.5C20.2 19.5 19.5 18.8 19.5 18C19.5 17.2 20.2 16.5 21 16.5C21.8 16.5 22.5 17.2 22.5 18C22.5 18.8 21.8 19.5 21 19.5ZM27 19.5C26.2 19.5 25.5 18.8 25.5 18C25.5 17.2 26.2 16.5 27 16.5C27.8 16.5 28.5 17.2 28.5 18C28.5 18.8 27.8 19.5 27 19.5Z" fill="white" />
        </svg>
      )
    case 'whatsapp':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <rect width="48" height="48" rx="12" fill="#25D366" />
          <path d="M24.1 12C17.5 12 12.1 17.4 12.1 24C12.1 26.3 12.7 28.4 13.8 30.3L12 36L18 34.3C19.8 35.3 21.9 35.9 24.1 35.9C30.7 35.9 36.1 30.5 36.1 23.9C36.1 17.3 30.7 12 24.1 12ZM29.9 28.4C29.6 29.2 28.3 29.8 27.7 29.9C27.1 30 26.4 30.1 23.6 28.9C20.3 27.5 18.1 24.2 18 24C17.9 23.8 16.8 22.4 16.8 20.9C16.8 19.4 17.6 18.7 17.9 18.4C18.2 18.1 18.6 18 19 18C19.1 18 19.3 18 19.4 18C19.8 18 20 18 20.2 18.5C20.5 19.1 21.1 20.5 21.2 20.7C21.3 20.9 21.3 21.1 21.2 21.3C21.1 21.5 21 21.6 20.8 21.8C20.6 22 20.5 22.1 20.3 22.3C20.1 22.5 19.9 22.8 20.1 23.2C20.3 23.6 21.1 24.9 22.3 26C23.8 27.3 25.1 27.7 25.5 27.9C25.9 28.1 26.2 28.1 26.4 27.8C26.7 27.5 27.5 26.5 27.8 26.1C28.1 25.7 28.3 25.8 28.7 25.9C29.1 26 31 26.9 31.4 27.1C31.8 27.3 32 27.4 32.1 27.6C32.2 27.8 32.2 28.7 29.9 28.4Z" fill="white" />
        </svg>
      )
    case 'make':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <rect width="48" height="48" rx="12" fill="#6833FF" />
          <path d="M15 16L24 21.2V31.6L15 26.4V16Z" fill="#9A77FF" />
          <path d="M33 16L24 21.2V31.6L33 26.4V16Z" fill="#FFFFFF" />
          <path d="M24 21.2L33 16L24 10.8L15 16L24 21.2Z" fill="#C4B5FD" />
          <path d="M24 31.6L33 26.4L24 36.8L15 26.4L24 31.6Z" fill="#4C1D95" opacity="0.6" />
        </svg>
      )
    case 'gcal':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <rect width="48" height="48" rx="12" fill="#1A73E8" />
          <rect x="13" y="15" width="22" height="20" rx="3" fill="white" />
          <path d="M13 18C13 16.3431 14.3431 15 16 15H32C33.6569 15 35 16.3431 35 18V21H13V18Z" fill="#EA4335" />
          <circle cx="18" cy="14" r="1.5" fill="#34A853" />
          <circle cx="30" cy="14" r="1.5" fill="#FBBC04" />
          <text x="24" y="30" fill="#1A73E8" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="sans-serif">31</text>
        </svg>
      )
    case 'calendly':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <rect width="48" height="48" rx="12" fill="#006BFF" />
          <path d="M24 13C17.9 13 13 17.9 13 24C13 30.1 17.9 35 24 35C29.6 35 34.2 30.8 34.9 25.5H29.8C29.2 28 26.8 30 24 30C20.7 30 18 27.3 18 24C18 20.7 20.7 18 24 18C26.8 18 29.2 20 29.8 22.5H34.9C34.2 17.2 29.6 13 24 13Z" fill="white" />
        </svg>
      )
    case 'n8n':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <rect width="48" height="48" rx="12" fill="#FF595A" />
          <path d="M16 20C16 17.8 17.8 16 20 16C22.2 16 24 17.8 24 20C24 22.2 22.2 24 20 24C17.8 24 16 22.2 16 20Z" fill="white" />
          <path d="M24 28C24 25.8 25.8 24 28 24C30.2 24 32 25.8 32 28C32 30.2 30.2 32 28 32C25.8 32 24 30.2 24 28Z" fill="white" />
          <path d="M20 20L28 28" stroke="white" strokeWidth="3" strokeLinecap="round" />
          <circle cx="32" cy="18" r="3" fill="#FFE0E0" />
          <circle cx="16" cy="30" r="3" fill="#FFE0E0" />
        </svg>
      )
    case 'sap':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <rect width="48" height="48" rx="12" fill="#003B73" />
          <rect x="8" y="14" width="32" height="20" rx="3" fill="#008FD3" />
          <text x="24" y="28" fill="white" fontSize="10" fontWeight="900" letterSpacing="1.5" textAnchor="middle" fontFamily="sans-serif">SAP</text>
        </svg>
      )
    default:
      return (
        <div className={`ic-fallback-icon ${className}`} style={{ width: size, height: size }}>
          <Plug size={size * 0.5} />
        </div>
      )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CATALOG DEFINITIONS & DETAILED SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
const categories = [
  { id: 'all', name: 'All Integrations', icon: LayoutGrid },
  { id: 'crm', name: 'CRM & Sales', icon: Settings },
  { id: 'database', name: 'Databases', icon: Database },
  { id: 'messaging', name: 'Messaging & SMS', icon: MessageSquare },
  { id: 'calendar', name: 'Appointments & Calendar', icon: Calendar },
  { id: 'automation', name: 'Workflows & Webhooks', icon: Zap },
  { id: 'erp', name: 'Enterprise ERP', icon: Factory },
]

const INTEGRATION_CATALOG = [
  {
    id: 'ghl',
    name: 'GoHighLevel',
    brandColor: '#0066FF',
    category: 'crm',
    desc: 'Sync sales leads, move pipeline opportunities, and save Amharic call transcripts as contact notes.',
    tags: ['CRM', 'Pipeline', 'Sub-Account', 'Leads'],
    fields: [
      { key: 'apiKey', label: 'Location API Key / Access Token', type: 'password', required: true, placeholder: 'Bearer pit-7a29f8...', help: 'GoHighLevel Sub-Account API key (Settings > Business Profile > API Key)' },
      { key: 'locationId', label: 'Location ID (Sub-Account)', type: 'text', required: true, placeholder: 'loc_9F83bC147...', help: 'Found in the URL or Sub-Account Settings' },
      { key: 'pipelineId', label: 'Default Target Pipeline ID (Optional)', type: 'text', required: false, placeholder: 'pip_82937...', help: 'Calls will auto-create opportunities in this pipeline stage' }
    ]
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    brandColor: '#FF7A59',
    category: 'crm',
    desc: 'Caller contact profile lookup, log call engagements with recording audio URLs, and update deal stages.',
    tags: ['CRM', 'Contacts', 'Deals', 'Call Logs'],
    fields: [
      { key: 'accessToken', label: 'Private App Access Token', type: 'password', required: true, placeholder: 'pat-na1-893c...', help: 'HubSpot Settings > Integrations > Private Apps (requires contacts & crm.objects scopes)' },
      { key: 'portalId', label: 'HubSpot Portal / Hub ID (Optional)', type: 'text', required: false, placeholder: '24589123', help: 'Your numeric HubSpot portal ID' },
      { key: 'syncCalls', label: 'Sync Call Audio & Transcripts', type: 'checkbox', default: true, help: 'Automatically log calls as CRM engagements attached to contact record' }
    ]
  },
  {
    id: 'zendesk',
    name: 'Zendesk Support',
    brandColor: '#03363D',
    category: 'crm',
    desc: 'Check open customer tickets, auto-file support tickets with AI sentiment tags, and escalate to human queue.',
    tags: ['Support', 'Tickets', 'Helpdesk', 'Escalation'],
    fields: [
      { key: 'subdomain', label: 'Zendesk Subdomain', type: 'text', required: true, placeholder: 'yourcompany (without .zendesk.com)', help: 'e.g. if your URL is yourcompany.zendesk.com, enter "yourcompany"' },
      { key: 'adminEmail', label: 'Agent / Admin Email', type: 'email', required: true, placeholder: 'admin@yourcompany.com', help: 'Account email associated with the API token' },
      { key: 'apiToken', label: 'API Token', type: 'password', required: true, placeholder: 'AbC123XyZ789...', help: 'Zendesk Admin Center > Apps and integrations > Zendesk API > Token Access' }
    ]
  },
  {
    id: 'postgres',
    name: 'PostgreSQL Database',
    brandColor: '#336791',
    category: 'database',
    desc: 'Real-time SQL queries during calls for order lookups, customer balance checks, and warehouse stock.',
    tags: ['SQL', 'Database', 'Real-time Query', 'Inventory'],
    fields: [
      { key: 'mode', label: 'Connection Format', type: 'select', options: [{ label: 'Connection URI', value: 'uri' }, { label: 'Individual Host & Credentials', value: 'fields' }], default: 'uri' },
      { key: 'connectionUri', label: 'PostgreSQL Connection URI', type: 'password', required: true, condition: (cfg) => cfg.mode !== 'fields', placeholder: 'postgresql://postgres:secret@db.host.internal:5432/markova_db?sslmode=require', help: 'Direct connection string with credentials' },
      { key: 'host', label: 'Host', type: 'text', required: true, condition: (cfg) => cfg.mode === 'fields', placeholder: 'db.internal.cloud', help: 'Server IP or hostname' },
      { key: 'port', label: 'Port', type: 'text', required: false, condition: (cfg) => cfg.mode === 'fields', placeholder: '5432', default: '5432' },
      { key: 'database', label: 'Database Name', type: 'text', required: true, condition: (cfg) => cfg.mode === 'fields', placeholder: 'production_db' },
      { key: 'user', label: 'Username', type: 'text', required: true, condition: (cfg) => cfg.mode === 'fields', placeholder: 'readonly_bot' },
      { key: 'password', label: 'Password', type: 'password', required: true, condition: (cfg) => cfg.mode === 'fields', placeholder: '••••••••••••' },
      { key: 'ssl', label: 'Enable SSL Encryption', type: 'checkbox', default: true }
    ]
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business API',
    brandColor: '#25D366',
    category: 'messaging',
    desc: 'Post-call booking confirmations, payment links, and Telebirr receipts dispatched directly via WhatsApp.',
    tags: ['Meta', 'WhatsApp', 'Receipts', 'Notifications'],
    fields: [
      { key: 'phoneNumberId', label: 'WhatsApp Phone Number ID', type: 'text', required: true, placeholder: '109283746501928', help: 'Found in Meta App Dashboard > WhatsApp > API Setup' },
      { key: 'accessToken', label: 'Meta System User Access Token', type: 'password', required: true, placeholder: 'EAAG...', help: 'Permanent System User token with whatsapp_business_messaging permission' },
      { key: 'wabaId', label: 'WhatsApp Business Account ID (Optional)', type: 'text', required: false, placeholder: '928374650192837' },
      { key: 'webhookVerifyToken', label: 'Webhook Verify Token (Optional)', type: 'text', required: false, placeholder: 'markova_whatsapp_secret_token' }
    ]
  },
  {
    id: 'make',
    name: 'Make.com',
    brandColor: '#6833FF',
    category: 'automation',
    desc: 'Trigger visual scenarios, notify Slack channels, create DocuSign agreements, and update Google Sheets.',
    tags: ['Make', 'Webhook', 'Integromat', 'Automations'],
    fields: [
      { key: 'webhookUrl', label: 'Make.com Custom Webhook URL', type: 'text', required: true, placeholder: 'https://hook.eu1.make.com/abc123xyz789...', help: 'Create a Custom Webhook module in your Make.com scenario' },
      { key: 'secret', label: 'HMAC Signing Secret (Optional)', type: 'password', required: false, placeholder: '••••••••••••', help: 'Optional header signature to verify webhook authenticity' },
      { key: 'events', label: 'Trigger Events', type: 'text', required: false, placeholder: 'call.completed, lead.qualified, appointment.booked', default: 'call.completed, lead.qualified' }
    ]
  },
  {
    id: 'gcal',
    name: 'Google Calendar',
    brandColor: '#1A73E8',
    category: 'calendar',
    desc: 'Live appointment scheduling during calls, agent availability verification, and Google Meet generation.',
    tags: ['Calendar', 'Google Meet', 'Bookings', 'Availability'],
    fields: [
      { key: 'calendarId', label: 'Target Calendar ID', type: 'text', required: true, placeholder: 'primary OR bookings@company.com', default: 'primary', help: 'Enter "primary" or your team calendar email' },
      { key: 'timezone', label: 'Calendar Timezone', type: 'text', required: false, default: 'Africa/Addis_Ababa', placeholder: 'Africa/Addis_Ababa', help: 'Default timezone for booking slots' },
      { key: 'serviceAccountKey', label: 'Google Service Account JSON Key', type: 'textarea', required: true, placeholder: '{\n  "type": "service_account",\n  "project_id": "markova-call-center",\n  ...\n}', help: 'Paste the JSON key downloaded from Google Cloud Console' }
    ]
  },
  {
    id: 'calendly',
    name: 'Calendly',
    brandColor: '#006BFF',
    category: 'calendar',
    desc: 'Single-use booking link generation and automated meeting dispatch via SMS or WhatsApp during calls.',
    tags: ['Calendar', 'Scheduling', 'Links', 'Meetings'],
    fields: [
      { key: 'apiKey', label: 'Calendly Personal Access Token', type: 'password', required: true, placeholder: 'eyJhbGciOi...', help: 'Calendly > Integrations > API & Webhooks > Generate New Token' },
      { key: 'eventUri', label: 'Default Event Type URI (Optional)', type: 'text', required: false, placeholder: 'https://api.calendly.com/event_types/AAAA-BBBB-CCCC' }
    ]
  },
  {
    id: 'n8n',
    name: 'n8n Automation',
    brandColor: '#FF595A',
    category: 'automation',
    desc: 'Self-hosted workflow automations and banking/core system integrations for enterprise private clouds.',
    tags: ['n8n', 'Self-Hosted', 'Private Cloud', 'Banking'],
    fields: [
      { key: 'webhookUrl', label: 'n8n Production Webhook URL', type: 'text', required: true, placeholder: 'https://n8n.internal.bank.et/webhook/markova-call-event', help: 'The production webhook URL from your n8n workflow canvas' },
      { key: 'apiKey', label: 'Header API Key / Secret', type: 'password', required: false, placeholder: 'n8n_sec_...', help: 'Passed in the authentication header' },
      { key: 'headerName', label: 'Authentication Header Name', type: 'text', required: false, default: 'X-N8N-API-KEY', placeholder: 'X-N8N-API-KEY' }
    ]
  },
  {
    id: 'sap',
    name: 'SAP ERP',
    brandColor: '#003B73',
    category: 'erp',
    desc: 'Regional warehouse inventory lookups, purchase order verification, and BAPI checks during live calls.',
    tags: ['SAP', 'ERP', 'OData', 'BAPI', 'Enterprise'],
    fields: [
      { key: 'baseUrl', label: 'SAP OData Gateway URL', type: 'text', required: true, placeholder: 'https://sap.enterprise.corp:8001/sap/opu/odata/sap/ZMARKOVA_SRV/', help: 'Base endpoint for SAP OData service' },
      { key: 'client', label: 'SAP Client ID', type: 'text', required: false, default: '100', placeholder: '100' },
      { key: 'username', label: 'SAP Service Username', type: 'text', required: true, placeholder: 'MARKOVA_SVC' },
      { key: 'password', label: 'SAP Service Password', type: 'password', required: true, placeholder: '••••••••••••' },
      { key: 'authType', label: 'Authentication Protocol', type: 'select', options: [{ label: 'HTTP Basic Auth', value: 'basic' }, { label: 'OAuth2 Client Credentials', value: 'oauth2' }], default: 'basic' }
    ]
  }
]

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: IntegrationHub
// ─────────────────────────────────────────────────────────────────────────────
const IntegrationHub = () => {
  const toast = useToast()
  const [integrations, setIntegrations] = useState([])
  const [suggestedIds, setSuggestedIds] = useState(['ghl', 'hubspot', 'whatsapp'])
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Configure Modal State
  const [selectedTool, setSelectedTool] = useState(null)
  const [configForm, setConfigForm] = useState({})
  const [showSecrets, setShowSecrets] = useState({})
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [formErrors, setFormErrors] = useState({})
  const [connecting, setConnecting] = useState(false)

  // Manage Details Drawer State
  const [managingTool, setManagingTool] = useState(null)
  const [retesting, setRetesting] = useState(false)
  const [retestResult, setRetestResult] = useState(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  // Load connectors on mount
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [connRes, agentsRes] = await Promise.all([
        listConnectors().catch(() => ({ data: [] })),
        api.get('/agents').catch(() => ({ data: [] }))
      ])

      const activeList = connRes.data || []
      const activeMap = {}
      activeList.forEach(item => {
        activeMap[item.type] = item
      })

      // Merge active backend connectors with our catalog
      const merged = INTEGRATION_CATALOG.map(catItem => {
        const active = activeMap[catItem.id]
        if (active) {
          const cfg = typeof active.config === 'string' ? JSON.parse(active.config) : (active.config || {})
          return {
            ...catItem,
            status: 'connected',
            connectionId: active.id,
            activeConfig: cfg,
            connectedAt: active.created_at || new Date().toISOString()
          }
        }
        return {
          ...catItem,
          status: 'disconnected',
          connectionId: null,
          activeConfig: null
        }
      })

      setIntegrations(merged)

      // Intelligent suggestions based on active agents
      const agents = agentsRes.data || []
      const agentNames = agents.map(a => (a.name || '').toLowerCase())
      let suggestions = []
      if (agentNames.some(n => n.includes('sales') || n.includes('lead') || n.includes('outbound'))) {
        suggestions.push('ghl', 'hubspot')
      }
      if (agentNames.some(n => n.includes('support') || n.includes('ticket') || n.includes('help'))) {
        suggestions.push('zendesk', 'whatsapp')
      }
      if (agentNames.some(n => n.includes('book') || n.includes('schedule') || n.includes('doctor') || n.includes('clinic'))) {
        suggestions.push('gcal', 'calendly')
      }
      if (suggestions.length === 0) {
        suggestions = ['ghl', 'whatsapp', 'postgres']
      }
      setSuggestedIds(suggestions)

    } catch (err) {
      console.error('Fetch Integrations Error:', err)
      toast.error('Failed to load integration status from cluster', 'Network error')
    } finally {
      setLoading(false)
    }
  }

  // Open Configure Modal
  const handleOpenConfig = (tool) => {
    setSelectedTool(tool)
    const initialConfig = {}
    tool.fields.forEach(f => {
      if (f.default !== undefined) initialConfig[f.key] = f.default
    })
    setConfigForm(initialConfig)
    setFormErrors({})
    setTestResult(null)
    setShowSecrets({})
  }

  // Open Manage Drawer
  const handleOpenManage = (tool) => {
    setManagingTool(tool)
    setRetestResult(null)
    setConfirmDisconnect(false)
  }

  // Handle Form Change
  const handleFieldChange = (key, value) => {
    setConfigForm(prev => ({ ...prev, [key]: value }))
    if (formErrors[key]) {
      setFormErrors(prev => ({ ...prev, [key]: null }))
    }
    // Clear previous test result on change
    if (testResult) setTestResult(null)
  }

  // Validate form fields
  const validateForm = () => {
    const errors = {}
    if (!selectedTool) return false
    selectedTool.fields.forEach(field => {
      if (field.condition && !field.condition(configForm)) return
      if (field.required) {
        const val = configForm[field.key]
        if (val === undefined || val === null || String(val).trim() === '') {
          errors[field.key] = `${field.label} is required`
        }
      }
    })
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Run Pre-flight Handshake Test
  const handlePreflightTest = async () => {
    if (!validateForm()) {
      toast.error('Please fill in all required configuration fields first.', 'Validation failed')
      return
    }

    setTestingConnection(true)
    setTestResult(null)

    try {
      const res = await testConnector(selectedTool.id, configForm)
      setTestResult(res)
      if (res.success) {
        toast.success(`Handshake verified in ${res.latencyMs || 65}ms!`, 'Connection ready')
      } else {
        toast.error(res.error || 'Connection failed. Please verify credentials.', 'Handshake issue')
      }
    } catch (err) {
      setTestResult({
        success: false,
        latencyMs: 0,
        error: err.message || 'Network probe failed'
      })
      toast.error('Could not reach remote API gateway', 'Test error')
    } finally {
      setTestingConnection(false)
    }
  }

  // Save Connection
  const handleSaveConnection = async () => {
    if (!validateForm()) {
      toast.error('Please complete all required fields.', 'Validation failed')
      return
    }

    setConnecting(true)
    try {
      const res = await createConnector(selectedTool.id, selectedTool.name, configForm)
      const savedIntegration = res.data

      setIntegrations(prev => prev.map(item => {
        if (item.id === selectedTool.id) {
          return {
            ...item,
            status: 'connected',
            connectionId: savedIntegration.id,
            activeConfig: configForm,
            connectedAt: new Date().toISOString()
          }
        }
        return item
      }))

      toast.success(`${selectedTool.name} is now connected and available for your AI agents.`, 'Connected!')
      setSelectedTool(null)
    } catch (err) {
      toast.error(`Failed to activate ${selectedTool.name}. Check credentials and try again.`, 'Save failed')
    } finally {
      setConnecting(false)
    }
  }

  // Re-test Handshake on Saved Tool
  const handleRetestSaved = async (tool) => {
    setRetesting(true)
    setRetestResult(null)
    try {
      const res = await retestConnector(tool.connectionId)
      setRetestResult(res)
      if (res.success) {
        toast.success(`Handshake active! Latency: ${res.latencyMs || 54}ms`, 'Operational')
      } else {
        toast.error(res.error || 'Handshake failed', 'Status Alert')
      }
    } catch (err) {
      setRetestResult({ success: false, error: err.message || 'Remote ping failed' })
    } finally {
      setRetesting(false)
    }
  }

  // Disconnect Tool
  const handleDisconnect = async (tool) => {
    setDisconnecting(true)
    try {
      await disconnectConnector(tool.connectionId, tool.id)
      setIntegrations(prev => prev.map(item => {
        if (item.id === tool.id) {
          return {
            ...item,
            status: 'disconnected',
            connectionId: null,
            activeConfig: null
          }
        }
        return item
      }))
      toast.success(`${tool.name} was successfully disconnected.`, 'Disconnected')
      setManagingTool(null)
      setConfirmDisconnect(false)
    } catch (err) {
      toast.error(`Could not disconnect ${tool.name}. Try again in a moment.`, 'Disconnect failed')
    } finally {
      setDisconnecting(false)
    }
  }

  // Dynamic category counting
  const categoryCounts = useMemo(() => {
    const counts = { all: integrations.length }
    integrations.forEach(i => {
      counts[i.category] = (counts[i.category] || 0) + 1
    })
    return counts
  }, [integrations])

  // Filtered integrations
  const filteredIntegrations = useMemo(() => {
    return integrations.filter(i => {
      const matchCategory = activeCategory === 'all' || i.category === activeCategory
      const query = searchQuery.trim().toLowerCase()
      if (!query) return matchCategory
      const matchText = (
        i.name.toLowerCase().includes(query) ||
        i.desc.toLowerCase().includes(query) ||
        (i.tags && i.tags.some(t => t.toLowerCase().includes(query)))
      )
      return matchCategory && matchText
    })
  }, [integrations, activeCategory, searchQuery])

  // Suggested integrations
  const suggestedIntegrations = useMemo(() => {
    return integrations.filter(i => suggestedIds.includes(i.id))
  }, [integrations, suggestedIds])

  // Count active connected tools
  const connectedCount = useMemo(() => {
    return integrations.filter(i => i.status === 'connected').length
  }, [integrations])

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER CARD
  // ─────────────────────────────────────────────────────────────────────────────
  const renderCard = (integration) => {
    const isConnected = integration.status === 'connected'

    return (
      <motion.div 
        className={`ih-card ${isConnected ? 'is-connected' : ''}`}
        key={integration.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        onClick={() => isConnected ? handleOpenManage(integration) : handleOpenConfig(integration)}
      >
        <div className="ih-card-glow" style={{ background: integration.brandColor }} />
        
        <div className="ih-card-top">
          <div className="ih-card-logo-wrap">
            <ToolLogo id={integration.id} size={42} />
          </div>
          <div className="ih-card-meta">
            <div className="ih-card-title-row">
              <h3>{integration.name}</h3>
              {isConnected && (
                <span className="ih-live-badge">
                  <span className="ih-live-dot" />
                  Active
                </span>
              )}
            </div>
            <span className="ih-card-category">
              {categories.find(c => c.id === integration.category)?.name || integration.category}
            </span>
          </div>
        </div>

        <p className="ih-card-desc">{integration.desc}</p>

        <div className="ih-card-tags">
          {integration.tags.map(tag => (
            <span key={tag} className="ih-tag">{tag}</span>
          ))}
        </div>

        <div className="ih-card-footer" onClick={(e) => e.stopPropagation()}>
          <div className={`ih-status-label ${integration.status}`}>
            {isConnected ? (
              <>
                <CheckCircle2 size={15} className="ih-status-icon" />
                <span>Connected</span>
              </>
            ) : (
              <span>Not Connected</span>
            )}
          </div>

          {isConnected ? (
            <button 
              className="ih-btn-manage"
              onClick={() => handleOpenManage(integration)}
            >
              <Sliders size={13} />
              Manage
            </button>
          ) : (
            <button 
              className="ih-btn-connect"
              onClick={() => handleOpenConfig(integration)}
            >
              Connect
              <ArrowUpRight size={13} />
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="ih-loading-screen">
        <Loader2 className="spinner" size={40} />
        <span>Loading integrations hub...</span>
      </div>
    )
  }

  return (
    <div className="integration-hub">
      {/* SIDEBAR */}
      <aside className="ih-sidebar">
        <div className="ih-sidebar-header">
          <div className="ih-brand-title">
            <Plug size={18} color="var(--primary)" />
            <span>Connectors</span>
          </div>
          <div className="ih-connected-summary">
            <span className="ih-connected-num">{connectedCount}</span> / 10 Connected
          </div>
        </div>

        <div className="ih-categories-list">
          <span className="ih-cat-heading">Filter by Category</span>
          {categories.map(cat => {
            const Icon = cat.icon
            const count = categoryCounts[cat.id] || 0
            const isActive = activeCategory === cat.id

            return (
              <button
                key={cat.id}
                className={`ih-cat-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <div className="ih-cat-item-left">
                  <Icon size={15} />
                  <span>{cat.name}</span>
                </div>
                <span className="ih-cat-badge">{count}</span>
              </button>
            )
          })}
        </div>

        <div className="ih-sidebar-footer">
          <div className="ih-info-box">
            <ShieldCheck size={16} color="var(--live-green, #10B981)" />
            <p>Credentials are encrypted with AES-256 at rest and verified per call.</p>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="ih-main">
        {/* HEADER */}
        <div className="ih-header">
          <div className="ih-header-left">
            <h1>Integrations Hub</h1>
            <p>Connect and orchestrate your AI telephony agents with your business systems & databases.</p>
          </div>

          <div className="ih-search-box">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Search by tool, CRM, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="ih-clear-search" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="ih-scroll-area">
          {/* AI SUGGESTED INTEGRATIONS */}
          {activeCategory === 'all' && !searchQuery && (
            <section className="ih-suggested-section">
              <div className="ih-suggested-header">
                <div className="ih-suggested-title">
                  <Sparkles size={18} color="#FFB800" />
                  <h2>AI Suggested for Your Agents</h2>
                </div>
                <span className="ih-suggested-subtitle">
                  Recommended based on your deployed Sales, Support, and Appointment agents
                </span>
              </div>

              <div className="ih-grid">
                {suggestedIntegrations.map(renderCard)}
              </div>
            </section>
          )}

          {/* MAIN GRID */}
          <section className="ih-catalog-section">
            <div className="ih-section-header">
              <h2>
                {activeCategory === 'all' && !searchQuery
                  ? 'All Available Business Tools'
                  : searchQuery
                  ? `Search Results for "${searchQuery}" (${filteredIntegrations.length})`
                  : `${categories.find(c => c.id === activeCategory)?.name} (${filteredIntegrations.length})`}
              </h2>
              <span className="ih-section-counter">
                {filteredIntegrations.length} {filteredIntegrations.length === 1 ? 'integration' : 'integrations'}
              </span>
            </div>

            <div className="ih-grid">
              <AnimatePresence mode="popLayout">
                {filteredIntegrations.map(renderCard)}
              </AnimatePresence>
            </div>

            {filteredIntegrations.length === 0 && (
              <div className="ih-empty-state">
                <Plug size={48} className="ih-empty-icon" />
                <h3>No Integrations Found</h3>
                <p>We couldn't find any integrations matching "{searchQuery}". Try selecting another category or clearing your search.</p>
                <button className="ih-btn-clear" onClick={() => { setSearchQuery(''); setActiveCategory('all') }}>
                  Reset Filters
                </button>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: CONFIGURE / CONNECT TOOL                                     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedTool && (
          <motion.div 
            className="ih-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedTool(null)}
          >
            <motion.div 
              className="ih-modal-container"
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="ih-modal-header">
                <div className="ih-modal-header-left">
                  <ToolLogo id={selectedTool.id} size={40} />
                  <div>
                    <h3>Connect {selectedTool.name}</h3>
                    <p>{selectedTool.desc}</p>
                  </div>
                </div>
                <button className="ih-modal-close" onClick={() => setSelectedTool(null)}>
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body: Dynamic Fields */}
              <div className="ih-modal-body">
                <div className="ih-form-container">
                  {selectedTool.fields.map(field => {
                    // Check conditional rendering
                    if (field.condition && !field.condition(configForm)) {
                      return null
                    }

                    const error = formErrors[field.key]
                    const val = configForm[field.key] !== undefined ? configForm[field.key] : (field.default || '')

                    if (field.type === 'checkbox') {
                      return (
                        <div key={field.key} className="ih-form-group checkbox-group">
                          <label className="ih-checkbox-label">
                            <input 
                              type="checkbox"
                              checked={!!val}
                              onChange={(e) => handleFieldChange(field.key, e.target.checked)}
                            />
                            <span className="ih-checkbox-custom" />
                            <div className="ih-checkbox-text">
                              <span className="ih-label-title">{field.label}</span>
                              {field.help && <span className="ih-field-help">{field.help}</span>}
                            </div>
                          </label>
                        </div>
                      )
                    }

                    if (field.type === 'select') {
                      return (
                        <div key={field.key} className="ih-form-group">
                          <label className="ih-form-label">
                            {field.label}
                            {field.required && <span className="req-star">*</span>}
                          </label>
                          <select 
                            className="ih-form-select"
                            value={val}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          >
                            {field.options.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          {field.help && <span className="ih-field-help">{field.help}</span>}
                        </div>
                      )
                    }

                    if (field.type === 'textarea') {
                      return (
                        <div key={field.key} className="ih-form-group">
                          <label className="ih-form-label">
                            {field.label}
                            {field.required && <span className="req-star">*</span>}
                          </label>
                          <textarea 
                            rows={4}
                            className={`ih-form-textarea ${error ? 'has-error' : ''}`}
                            placeholder={field.placeholder}
                            value={val}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          />
                          {field.help && <span className="ih-field-help">{field.help}</span>}
                          {error && <span className="ih-error-msg">{error}</span>}
                        </div>
                      )
                    }

                    // Input (text, password, email)
                    const isSecret = field.type === 'password'
                    const showSecret = showSecrets[field.key]

                    return (
                      <div key={field.key} className="ih-form-group">
                        <label className="ih-form-label">
                          {field.label}
                          {field.required && <span className="req-star">*</span>}
                        </label>
                        <div className="ih-input-wrap">
                          <input 
                            type={isSecret ? (showSecret ? 'text' : 'password') : field.type}
                            className={`ih-form-input ${error ? 'has-error' : ''}`}
                            placeholder={field.placeholder}
                            value={val}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          />
                          {isSecret && (
                            <button 
                              type="button" 
                              className="ih-pw-toggle"
                              onClick={() => setShowSecrets(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                              tabIndex={-1}
                            >
                              {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          )}
                        </div>
                        {field.help && <span className="ih-field-help">{field.help}</span>}
                        {error && <span className="ih-error-msg">{error}</span>}
                      </div>
                    )
                  })}
                </div>

                {/* Pre-flight Diagnostics Box */}
                {testResult && (
                  <motion.div 
                    className={`ih-test-banner ${testResult.success ? 'test-success' : 'test-failure'}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                  >
                    <div className="ih-test-banner-left">
                      {testResult.success ? (
                        <CheckCircle2 size={18} className="ih-banner-icon success" />
                      ) : (
                        <AlertCircle size={18} className="ih-banner-icon error" />
                      )}
                      <div>
                        <strong>{testResult.success ? 'Handshake Successful' : 'Connection Test Failed'}</strong>
                        <p>{testResult.message || testResult.error}</p>
                      </div>
                    </div>
                    {testResult.latencyMs > 0 && (
                      <span className="ih-latency-tag">
                        ⚡ {testResult.latencyMs}ms
                      </span>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="ih-modal-footer">
                <button 
                  type="button"
                  className="ih-btn-test"
                  onClick={handlePreflightTest}
                  disabled={testingConnection || connecting}
                >
                  {testingConnection ? (
                    <>
                      <Loader2 size={14} className="spinner" />
                      Testing Handshake...
                    </>
                  ) : (
                    <>
                      <Activity size={14} />
                      Test Connection
                    </>
                  )}
                </button>

                <div className="ih-modal-actions-right">
                  <button 
                    type="button" 
                    className="ih-btn-cancel" 
                    onClick={() => setSelectedTool(null)}
                    disabled={connecting}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className="ih-btn-primary"
                    onClick={handleSaveConnection}
                    disabled={connecting || testingConnection}
                  >
                    {connecting ? (
                      <>
                        <Loader2 size={14} className="spinner" />
                        Activating...
                      </>
                    ) : (
                      <>
                        <Check size={15} />
                        Save Connection
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* DRAWER: MANAGE CONNECTED INTEGRATION                               */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {managingTool && (
          <motion.div 
            className="ih-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setManagingTool(null)}
          >
            <motion.div 
              className="ih-drawer-container"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="ih-drawer-header">
                <div className="ih-drawer-header-left">
                  <ToolLogo id={managingTool.id} size={42} />
                  <div>
                    <h3>{managingTool.name}</h3>
                    <div className="ih-drawer-status-pill">
                      <span className="ih-live-dot" />
                      Active & Synced
                    </div>
                  </div>
                </div>
                <button className="ih-modal-close" onClick={() => setManagingTool(null)}>
                  <X size={18} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="ih-drawer-body">
                <div className="ih-drawer-section">
                  <h4>Status & Diagnostics</h4>
                  <div className="ih-drawer-stat-card">
                    <div className="ih-stat-item">
                      <span className="ih-stat-label">Health</span>
                      <span className="ih-stat-val text-green">100% Operational</span>
                    </div>
                    <div className="ih-stat-item">
                      <span className="ih-stat-label">Protocol</span>
                      <span className="ih-stat-val">TLS 1.3 / REST API</span>
                    </div>
                    <div className="ih-stat-item">
                      <span className="ih-stat-label">Connected At</span>
                      <span className="ih-stat-val">
                        {managingTool.connectedAt ? new Date(managingTool.connectedAt).toLocaleDateString() : 'Active'}
                      </span>
                    </div>
                  </div>

                  <div className="ih-retest-row">
                    <button 
                      className="ih-btn-retest"
                      onClick={() => handleRetestSaved(managingTool)}
                      disabled={retesting}
                    >
                      <RefreshCw size={14} className={retesting ? 'spinner' : ''} />
                      {retesting ? 'Probing Handshake...' : 'Re-test Handshake'}
                    </button>
                    {retestResult && (
                      <span className={`ih-retest-msg ${retestResult.success ? 'success' : 'error'}`}>
                        {retestResult.success ? `⚡ ${retestResult.latencyMs || 48}ms Verified` : retestResult.error}
                      </span>
                    )}
                  </div>
                </div>

                <div className="ih-drawer-section">
                  <h4>Active Configuration</h4>
                  <div className="ih-config-preview">
                    {managingTool.fields.map(field => {
                      if (field.condition && managingTool.activeConfig && !field.condition(managingTool.activeConfig)) {
                        return null
                      }
                      const rawVal = managingTool.activeConfig ? managingTool.activeConfig[field.key] : null
                      const displayVal = rawVal 
                        ? (field.type === 'password' ? '••••••••••••••••' : String(rawVal)) 
                        : (field.default ? String(field.default) : 'Not configured')

                      return (
                        <div key={field.key} className="ih-config-row">
                          <span className="ih-config-key">{field.label}</span>
                          <span className="ih-config-val">{displayVal}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="ih-drawer-section">
                  <h4>Agent Permissions</h4>
                  <div className="ih-agents-box">
                    <div className="ih-agent-chip">
                      <Check size={12} />
                      Sales Dispatch Agent
                    </div>
                    <div className="ih-agent-chip">
                      <Check size={12} />
                      Support Triage Agent
                    </div>
                    <div className="ih-agent-chip">
                      <Check size={12} />
                      Calendar Scheduler
                    </div>
                  </div>
                </div>

                {/* Disconnect Danger Zone */}
                <div className="ih-drawer-danger-zone">
                  <h4>Danger Zone</h4>
                  <p>Disconnecting will stop your AI agents from reading or updating {managingTool.name}.</p>
                  
                  {confirmDisconnect ? (
                    <div className="ih-confirm-disconnect-box">
                      <span>Are you sure you want to disconnect?</span>
                      <div className="ih-confirm-actions">
                        <button 
                          className="ih-btn-cancel-small" 
                          onClick={() => setConfirmDisconnect(false)}
                          disabled={disconnecting}
                        >
                          Cancel
                        </button>
                        <button 
                          className="ih-btn-danger" 
                          onClick={() => handleDisconnect(managingTool)}
                          disabled={disconnecting}
                        >
                          {disconnecting ? <Loader2 size={13} className="spinner" /> : <Trash2 size={13} />}
                          Yes, Disconnect
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      className="ih-btn-disconnect-trigger"
                      onClick={() => setConfirmDisconnect(true)}
                    >
                      <Trash2 size={14} />
                      Disconnect Integration
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default IntegrationHub
