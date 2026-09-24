import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Users, 
  Building2, 
  Target, 
  Calendar, 
  Search, 
  Filter, 
  Plus, 
  X,
  Phone,
  Mail,
  Sparkles,
  MessageSquare,
  Briefcase,
  Loader2,
  DollarSign,
  TrendingUp,
  Download,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  PhoneCall,
  Bot,
  MapPin,
  Send,
  MoreVertical,
  ShieldCheck,
  Tag
} from 'lucide-react'
import api, { listCRMContacts } from '../api/client'
import { useToast } from '../contexts/ToastContext'
import { useEnvironment } from '../contexts/EnvironmentContext'
import './CRM.css'

// Default enterprise seed data for realistic Markova CRM operations
const INITIAL_COMPANIES = [
  { id: 'comp-1', name: 'Acme Corp', industry: 'Cloud & SaaS', employees: '250', value: '$120,000', location: 'San Francisco, CA', tier: 'Enterprise', website: 'acme.com', phone: '+1 555-0100', openDeals: 2 },
  { id: 'comp-2', name: 'GM Furniture', industry: 'Retail & Manufacturing', employees: '450', value: '2,850,000 ETB', location: 'Addis Ababa, ET', tier: 'Enterprise', website: 'gmfurniture.et', phone: '+251 11 661 2233', openDeals: 1 },
  { id: 'comp-3', name: 'SoleRebels', industry: 'Sustainable Apparel', employees: '180', value: '1,450,000 ETB', location: 'Addis Ababa, ET', tier: 'Mid-Market', website: 'solerebels.com', phone: '+251 11 550 4455', openDeals: 1 },
  { id: 'comp-4', name: 'CloudScale Inc', industry: 'DevOps Infrastructure', employees: '85', value: '$45,000', location: 'Austin, TX', tier: 'Mid-Market', website: 'cloudscale.io', phone: '+1 512-555-0188', openDeals: 1 },
  { id: 'comp-5', name: 'Zemen Bank', industry: 'Banking & Finance', employees: '1,200+', value: '8,900,000 ETB', location: 'Addis Ababa, ET', tier: 'Enterprise', website: 'zemenbank.com', phone: '+251 11 557 0000', openDeals: 1 },
  { id: 'comp-6', name: 'Kuriftu Resorts & Spas', industry: 'Hospitality & Leisure', employees: '320', value: '1,780,000 ETB', location: 'Bishoftu, ET', tier: 'Mid-Market', website: 'kurifturesorts.com', phone: '+251 11 430 0000', openDeals: 1 }
]

const INITIAL_OPPORTUNITIES = [
  { id: 'opp-1', title: 'Enterprise AI Call Center Rollout', company: 'Acme Corp', stage: 'Negotiation', amount: '$120,000', currency: 'USD', closeDate: '2026-10-15', probability: '85%', owner: 'Almaz (AI Agent)' },
  { id: 'opp-2', title: 'Amharic Showroom Telephony IVR Upgrade', company: 'GM Furniture', stage: 'Proposal Sent', amount: '850,000 ETB', currency: 'ETB', closeDate: '2026-10-02', probability: '75%', owner: 'Dawit (AI Agent)' },
  { id: 'opp-3', title: 'Nationwide Delivery Voice Bot Dispatch', company: 'SoleRebels', stage: 'Discovery', amount: '620,000 ETB', currency: 'ETB', closeDate: '2026-10-28', probability: '50%', owner: 'Abebe (AI Agent)' },
  { id: 'opp-4', title: 'Omnichannel Inbound Lead Automation', company: 'CloudScale Inc', stage: 'Qualified', amount: '$38,000', currency: 'USD', closeDate: '2026-11-10', probability: '60%', owner: 'Almaz (AI Agent)' },
  { id: 'opp-5', title: 'Core Banking SIP Bridge & 24/7 Agent', company: 'Zemen Bank', stage: 'Closed Won', amount: '4,500,000 ETB', currency: 'ETB', closeDate: '2026-09-18', probability: '100%', owner: 'Sara (Support Lead)' },
  { id: 'opp-6', title: 'Resort Room Booking & Concierge Voice Bot', company: 'Kuriftu Resorts', stage: 'Negotiation', amount: '950,000 ETB', currency: 'ETB', closeDate: '2026-10-20', probability: '80%', owner: 'Almaz (AI Agent)' }
]

const INITIAL_APPOINTMENTS = [
  { id: 'apt-1', title: 'Executive AI Architecture & Voice Demo', contact: 'Alice Walker', company: 'Acme Corp', time: 'Tomorrow, 10:00 AM', duration: '45 min', channel: 'Google Meet', status: 'Scheduled', agent: 'Almaz (Customer Care)' },
  { id: 'apt-2', title: 'Showroom Voice Catalog Tuning Session', contact: 'Dawit Bekele', company: 'GM Furniture', time: 'Sep 26, 2:30 PM', duration: '30 min', channel: 'In-Person Showroom', status: 'Scheduled', agent: 'Dawit (Sales & Booking)' },
  { id: 'apt-3', title: 'FreeSWITCH SIP Trunk Verification & Demo', contact: 'Semira Ahmed', company: 'Zemen Bank', time: 'Sep 28, 11:00 AM', duration: '60 min', channel: 'Zoom SIP Bridge', status: 'Scheduled', agent: 'Almaz (Customer Care)' },
  { id: 'apt-4', title: 'Quarterly SLA & Agent Quality Review', contact: 'Yonas Haile', company: 'Kuriftu Resorts', time: 'Yesterday, 4:00 PM', duration: '30 min', channel: 'Phone Call', status: 'Completed', agent: 'Sara (Supervisor)' },
  { id: 'apt-5', title: 'Supply Chain IVR Dispatch Walkthrough', contact: 'Bethlehem Tilahun', company: 'SoleRebels', time: 'Oct 01, 3:00 PM', duration: '45 min', channel: 'Google Meet', status: 'Scheduled', agent: 'Abebe (Logistics Agent)' }
]

const INITIAL_CONTACTS = [
  {
    id: 'cont-1',
    name: 'Alice Walker',
    company: 'Acme Corp',
    email: 'alice@acme.com',
    phone: '+1 555-0192',
    status: 'qualified',
    source: 'Web Chat',
    role: 'Chief Technology Officer',
    interest: 'AI Voice Agents & Telephony Bridge',
    message: 'Looking to automate our frontline support and reduce escalation queue times.',
    sentiment: 'Positive (92%)',
    lastContact: 'Today, 10:45 AM',
    timeline: [
      { id: 't-1', type: 'call', time: 'Today, 10:45 AM', text: 'Inbound call handled by Sales Agent. Duration: 04:30. Inquired about SIP trunking and latency SLAs.', color: '#3b82f6' },
      { id: 't-2', type: 'appointment', time: 'Today, 10:50 AM', text: 'Demo appointment scheduled by Booking Agent for tomorrow at 10:00 AM.', color: '#10b981' },
      { id: 't-3', type: 'whatsapp', time: 'Yesterday, 3:20 PM', text: 'Customer opened WhatsApp proposal sent by Marketing Agent.', color: '#8b5cf6' },
      { id: 't-4', type: 'system', time: 'Sep 22, 9:15 AM', text: 'Lead profile created via Web Chat intake form.', color: '#64748b' }
    ]
  },
  {
    id: 'cont-2',
    name: 'Dawit Bekele',
    company: 'GM Furniture',
    email: 'dawit@gmfurniture.et',
    phone: '+251 91 122 3344',
    status: 'customer',
    source: 'Phone Call (FreeSWITCH)',
    role: 'VP Operations',
    interest: 'Amharic Voice Catalog & Order Dispatch',
    message: 'We need Almaz to answer calls regarding sofa catalogs and dining table pricing in Amharic.',
    sentiment: 'Positive (96%)',
    lastContact: 'Yesterday, 4:15 PM',
    timeline: [
      { id: 't-5', type: 'call', time: 'Yesterday, 4:15 PM', text: 'Order catalog inquiry handled by Almaz in Amharic. Customer confirmed sofa delivery timeline.', color: '#3b82f6' },
      { id: 't-6', type: 'appointment', time: 'Sep 20, 2:00 PM', text: 'Showroom deployment kickoff completed successfully.', color: '#10b981' }
    ]
  },
  {
    id: 'cont-3',
    name: 'Bethlehem Tilahun',
    company: 'SoleRebels',
    email: 'b.tilahun@solerebels.com',
    phone: '+251 92 344 5566',
    status: 'qualified',
    source: 'Inbound Telephony',
    role: 'Head of Global Logistics',
    interest: 'Automated Order Status & Dispatch IVR',
    message: 'E-commerce customers need instant tracking updates over phone and WhatsApp.',
    sentiment: 'Neutral (78%)',
    lastContact: 'Sep 22, 11:30 AM',
    timeline: [
      { id: 't-7', type: 'call', time: 'Sep 22, 11:30 AM', text: 'Inbound inquiry on webhook tool integration with Shopify & PostgreSQL.', color: '#3b82f6' }
    ]
  },
  {
    id: 'cont-4',
    name: 'Marcus Chen',
    company: 'CloudScale Inc',
    email: 'marcus@cloudscale.io',
    phone: '+1 415 678-9012',
    status: 'lead',
    source: 'Webhook Integration',
    role: 'Director of Growth',
    interest: 'Outbound AI Lead Qualification',
    message: 'Testing outbound campaign triggers for newly registered developer accounts.',
    sentiment: 'Positive (84%)',
    lastContact: 'Sep 21, 6:00 PM',
    timeline: [
      { id: 't-8', type: 'whatsapp', time: 'Sep 21, 6:00 PM', text: 'Automated follow-up message sent after sandbox sign-up.', color: '#8b5cf6' }
    ]
  },
  {
    id: 'cont-5',
    name: 'Semira Ahmed',
    company: 'Zemen Bank',
    email: 'semira.a@zemenbank.com',
    phone: '+251 91 566 7788',
    status: 'customer',
    source: 'FreeSWITCH SIP Trunk',
    role: 'Customer Experience Lead',
    interest: '24/7 Account Balance & Branch Routing',
    message: 'High-security requirements with statutory INSA audio consent recording.',
    sentiment: 'Positive (98%)',
    lastContact: 'Sep 23, 2:10 PM',
    timeline: [
      { id: 't-9', type: 'call', time: 'Sep 23, 2:10 PM', text: 'Telephony load testing completed: 18 concurrent channels verified with zero packet loss.', color: '#3b82f6' }
    ]
  },
  {
    id: 'cont-6',
    name: 'Yonas Haile',
    company: 'Kuriftu Resorts & Spas',
    email: 'yonas.h@kurifturesorts.com',
    phone: '+251 93 455 6677',
    status: 'churn_risk',
    source: 'Inbound Escalation',
    role: 'Chief Operating Officer',
    interest: 'Room Booking Voice Bot & Weekend Escalations',
    message: 'Experienced 2 missed calls during weekend peak hours; requires supervisor fallback audit.',
    sentiment: 'Concerned (62%)',
    lastContact: 'Sep 20, 5:30 PM',
    timeline: [
      { id: 't-10', type: 'call', time: 'Sep 20, 5:30 PM', text: 'Supervisor barge-in conducted by Sara. Re-routed caller to Bishoftu front desk.', color: '#ef4444' }
    ]
  }
]

const CRM = () => {
  const { environment } = useEnvironment()
  const { success, info, error } = useToast()

  const [activeTab, setActiveTab] = useState('contacts') // 'contacts' | 'companies' | 'opportunities' | 'appointments'
  const [contacts, setContacts] = useState(() => {
    try {
      const saved = localStorage.getItem('markova_crm_contacts')
      return saved ? JSON.parse(saved) : INITIAL_CONTACTS
    } catch {
      return INITIAL_CONTACTS
    }
  })
  const [companies, setCompanies] = useState(() => {
    try {
      const saved = localStorage.getItem('markova_crm_companies')
      return saved ? JSON.parse(saved) : INITIAL_COMPANIES
    } catch {
      return INITIAL_COMPANIES
    }
  })
  const [opportunities, setOpportunities] = useState(() => {
    try {
      const saved = localStorage.getItem('markova_crm_opportunities')
      return saved ? JSON.parse(saved) : INITIAL_OPPORTUNITIES
    } catch {
      return INITIAL_OPPORTUNITIES
    }
  })
  const [appointments, setAppointments] = useState(() => {
    try {
      const saved = localStorage.getItem('markova_crm_appointments')
      return saved ? JSON.parse(saved) : INITIAL_APPOINTMENTS
    } catch {
      return INITIAL_APPOINTMENTS
    }
  })

  const [selectedContact, setSelectedContact] = useState(INITIAL_CONTACTS[0])
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [selectedOpportunity, setSelectedOpportunity] = useState(null)
  const [selectedAppointment, setSelectedAppointment] = useState(null)

  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [copiedField, setCopiedField] = useState(null)
  const [newNoteText, setNewNoteText] = useState('')

  // Form state for creating new records
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    role: '',
    status: 'qualified',
    interest: '',
    message: '',
    industry: 'Cloud & SaaS',
    employees: '50-100',
    value: '$50,000',
    title: '',
    stage: 'Discovery',
    amount: '$25,000',
    closeDate: '',
    time: '',
    channel: 'Google Meet',
    agent: 'Almaz (AI Agent)'
  })

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('markova_crm_contacts', JSON.stringify(contacts))
    } catch (e) {
      console.warn('Failed to save contacts to localStorage', e)
    }
  }, [contacts])

  useEffect(() => {
    try {
      localStorage.setItem('markova_crm_companies', JSON.stringify(companies))
    } catch (e) {
      console.warn('Failed to save companies to localStorage', e)
    }
  }, [companies])

  useEffect(() => {
    try {
      localStorage.setItem('markova_crm_opportunities', JSON.stringify(opportunities))
    } catch (e) {
      console.warn('Failed to save opportunities to localStorage', e)
    }
  }, [opportunities])

  useEffect(() => {
    try {
      localStorage.setItem('markova_crm_appointments', JSON.stringify(appointments))
    } catch (e) {
      console.warn('Failed to save appointments to localStorage', e)
    }
  }, [appointments])

  // Try fetching dynamic caller leads from backend if available
  useEffect(() => {
    const fetchBackendLeads = async () => {
      try {
        const res = await listCRMContacts().catch(() => ({ data: [] }))
        if (res.data && res.data.length > 0) {
          const apiContacts = res.data.map(lead => ({
            id: lead.id || `lead-${Math.random()}`,
            name: lead.name || 'Caller ' + (lead.phone?.slice(-4) || 'Lead'),
            company: lead.company || 'Direct Inbound Caller',
            email: lead.email || '',
            phone: lead.phone || '',
            status: lead.status || 'lead',
            source: lead.source || 'Voice Engine',
            role: lead.role || 'Caller',
            interest: lead.service_interest || 'Telephony Service',
            message: lead.message || 'Call recording transcript available in Call Center.',
            sentiment: 'Neutral (75%)',
            lastContact: lead.lastCall ? new Date(lead.lastCall).toLocaleDateString() : 'Recent',
            timeline: [
              { id: 't-api', type: 'call', time: 'Recent Call', text: `Inbound telephony call logged across ${lead.agents?.join(', ') || 'AI voice agent'}.`, color: '#3b82f6' }
            ]
          }))

          // Merge with unique phone numbers
          setContacts(prev => {
            const existingPhones = new Set(prev.map(p => p.phone))
            const newEntries = apiContacts.filter(c => !existingPhones.has(c.phone))
            return [...newEntries, ...prev]
          })
        }
      } catch (err) {
        console.warn('Using enriched local CRM database', err)
      }
    }
    fetchBackendLeads()
  }, [])

  // KPI calculations
  const stats = useMemo(() => {
    const qualifiedCount = contacts.filter(c => c.status === 'qualified').length
    const scheduledAppts = appointments.filter(a => a.status === 'Scheduled').length
    return {
      totalContacts: contacts.length,
      qualifiedContacts: qualifiedCount,
      totalCompanies: companies.length,
      pipelineValueETB: '14.2M ETB',
      pipelineValueUSD: '$118,500',
      activeOpportunities: opportunities.length,
      scheduledAppointments: scheduledAppts
    }
  }, [contacts, companies, opportunities, appointments])

  // Filtered dataset for active tab
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.phone && c.phone.includes(searchQuery))
      const matchesStatus = statusFilter === 'all' || c.status.toLowerCase() === statusFilter.toLowerCase()
      return matchesSearch && matchesStatus
    })
  }, [contacts, searchQuery, statusFilter])

  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.industry.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.location.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesTier = statusFilter === 'all' || (c.tier && c.tier.toLowerCase() === statusFilter.toLowerCase())
      return matchesSearch && matchesTier
    })
  }, [companies, searchQuery, statusFilter])

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter(o => {
      const matchesSearch = 
        o.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.stage.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStage = statusFilter === 'all' || o.stage.toLowerCase() === statusFilter.toLowerCase()
      return matchesSearch && matchesStage
    })
  }, [opportunities, searchQuery, statusFilter])

  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      const matchesSearch = 
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.company.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || a.status.toLowerCase() === statusFilter.toLowerCase()
      return matchesSearch && matchesStatus
    })
  }, [appointments, searchQuery, statusFilter])

  // Copy to clipboard helper
  const handleCopy = (text, fieldName) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    info(`Copied ${fieldName} to clipboard`, 'Copied')
    setTimeout(() => setCopiedField(null), 1800)
  }

  // Quick call simulation
  const handleInitiateCall = (contact) => {
    info(`Initiating AI outbound dialer to ${contact.phone} (${contact.name})...`, 'Telephony Bridge')
  }

  // Quick email simulation
  const handleSendEmail = (contact) => {
    if (!contact.email) {
      error('No email address available for this contact.')
      return
    }
    window.open(`mailto:${contact.email}?subject=Follow-up from Markova AI Call Center`)
  }

  // Add interactive timeline note
  const handleAddNote = (e) => {
    e.preventDefault()
    if (!newNoteText.trim() || !selectedContact) return

    const newNote = {
      id: `note-${Date.now()}`,
      type: 'system',
      time: 'Just now',
      text: newNoteText.trim(),
      color: '#10b981'
    }

    const updated = {
      ...selectedContact,
      timeline: [newNote, ...(selectedContact.timeline || [])]
    }

    setSelectedContact(updated)
    setContacts(prev => prev.map(c => c.id === updated.id ? updated : c))
    setNewNoteText('')
    success('Added note to customer interaction timeline.', 'Timeline Updated')
  }

  // Change contact status
  const handleStatusChange = (newStatus) => {
    if (!selectedContact) return
    const updated = { ...selectedContact, status: newStatus }
    setSelectedContact(updated)
    setContacts(prev => prev.map(c => c.id === updated.id ? updated : c))
    success(`Updated status to ${newStatus.toUpperCase()}`, 'Status Saved')
  }

  // Add new record modal submission
  const handleSaveNewRecord = (e) => {
    e.preventDefault()

    if (activeTab === 'contacts') {
      if (!formData.name.trim()) {
        error('Please enter a contact name.')
        return
      }
      const newContact = {
        id: `cont-${Date.now()}`,
        name: formData.name.trim(),
        company: formData.company.trim() || 'Independent',
        email: formData.email.trim(),
        phone: formData.phone.trim() || '+251 90 000 0000',
        status: formData.status || 'lead',
        source: 'Manual Dashboard Entry',
        role: formData.role.trim() || 'Decision Maker',
        interest: formData.interest.trim() || 'AI Voice Automation',
        message: formData.message.trim() || 'Customer added manually from CRM dashboard.',
        sentiment: 'Positive (90%)',
        lastContact: 'Today',
        timeline: [
          { id: `tl-${Date.now()}`, type: 'system', time: 'Just now', text: 'Contact record created manually in CRM.', color: '#3b82f6' }
        ]
      }
      setContacts([newContact, ...contacts])
      setSelectedContact(newContact)
      success(`Contact "${newContact.name}" created successfully!`, 'Contact Added')
    } else if (activeTab === 'companies') {
      if (!formData.name.trim()) {
        error('Please enter a company name.')
        return
      }
      const newCompany = {
        id: `comp-${Date.now()}`,
        name: formData.name.trim(),
        industry: formData.industry || 'General',
        employees: formData.employees || '50-100',
        value: formData.value || '$50,000',
        location: formData.location || 'Addis Ababa, ET',
        tier: 'Enterprise',
        website: formData.website || 'example.com',
        phone: formData.phone || '+251 11 000 0000',
        openDeals: 1
      }
      setCompanies([newCompany, ...companies])
      setSelectedCompany(newCompany)
      success(`Company "${newCompany.name}" added to accounts!`, 'Company Added')
    } else if (activeTab === 'opportunities') {
      if (!formData.title.trim()) {
        error('Please enter an opportunity title.')
        return
      }
      const newOpp = {
        id: `opp-${Date.now()}`,
        title: formData.title.trim(),
        company: formData.company.trim() || 'Acme Corp',
        stage: formData.stage || 'Discovery',
        amount: formData.amount || '$25,000',
        currency: formData.amount?.includes('ETB') ? 'ETB' : 'USD',
        closeDate: formData.closeDate || '2026-11-01',
        probability: '60%',
        owner: 'Almaz (AI Agent)'
      }
      setOpportunities([newOpp, ...opportunities])
      setSelectedOpportunity(newOpp)
      success(`Opportunity "${newOpp.title}" created!`, 'Deal Added')
    } else if (activeTab === 'appointments') {
      if (!formData.title.trim()) {
        error('Please enter an appointment title.')
        return
      }
      const newApt = {
        id: `apt-${Date.now()}`,
        title: formData.title.trim(),
        contact: formData.name.trim() || 'New Lead',
        company: formData.company.trim() || 'Independent',
        time: formData.time || 'Tomorrow, 2:00 PM',
        duration: '30 min',
        channel: formData.channel || 'Google Meet',
        status: 'Scheduled',
        agent: formData.agent || 'Almaz (Customer Care)'
      }
      setAppointments([newApt, ...appointments])
      setSelectedAppointment(newApt)
      success(`Appointment "${newApt.title}" scheduled!`, 'Appointment Booked')
    }

    setIsAddModalOpen(false)
    setFormData({
      name: '',
      company: '',
      email: '',
      phone: '',
      role: '',
      status: 'qualified',
      interest: '',
      message: '',
      industry: 'Cloud & SaaS',
      employees: '50-100',
      value: '$50,000',
      title: '',
      stage: 'Discovery',
      amount: '$25,000',
      closeDate: '',
      time: '',
      channel: 'Google Meet',
      agent: 'Almaz (AI Agent)'
    })
  }

  // Export CSV handler
  const handleExportCSV = () => {
    let filename = `markova_crm_${activeTab}_export.csv`
    let csvRows = []

    if (activeTab === 'contacts') {
      csvRows.push(['ID', 'Name', 'Company', 'Role', 'Email', 'Phone', 'Status', 'Source', 'Interest', 'Last Contact'])
      contacts.forEach(c => {
        csvRows.push([c.id, c.name, c.company, c.role, c.email, c.phone, c.status, c.source, c.interest, c.lastContact])
      })
    } else if (activeTab === 'companies') {
      csvRows.push(['ID', 'Company Name', 'Industry', 'Employees', 'Estimated Value', 'Location', 'Tier', 'Phone'])
      companies.forEach(c => {
        csvRows.push([c.id, c.name, c.industry, c.employees, c.value, c.location, c.tier, c.phone])
      })
    } else if (activeTab === 'opportunities') {
      csvRows.push(['ID', 'Deal Title', 'Company', 'Stage', 'Amount', 'Probability', 'Close Date', 'Owner'])
      opportunities.forEach(o => {
        csvRows.push([o.id, o.title, o.company, o.stage, o.amount, o.probability, o.closeDate, o.owner])
      })
    } else if (activeTab === 'appointments') {
      csvRows.push(['ID', 'Meeting Title', 'Contact', 'Company', 'Scheduled Time', 'Duration', 'Channel', 'Status', 'Assigned Agent'])
      appointments.forEach(a => {
        csvRows.push([a.id, a.title, a.contact, a.company, a.time, a.duration, a.channel, a.status, a.agent])
      })
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.map(x => `"${String(x || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    success(`Exported ${activeTab} records as CSV.`, 'Download Complete')
  }

  // Sub-tabs config
  const TABS = [
    { id: 'contacts', label: 'Contacts & Leads', icon: Users, count: contacts.length, badge: 'Workforce CRM' },
    { id: 'companies', label: 'Companies & Accounts', icon: Building2, count: companies.length, badge: 'Enterprise' },
    { id: 'opportunities', label: 'Deals & Opportunities', icon: Target, count: opportunities.length, badge: 'Pipeline' },
    { id: 'appointments', label: 'Appointments & Demos', icon: Calendar, count: appointments.length, badge: 'Calendar' }
  ]

  return (
    <div className="crm-page">
      {/* Top Header */}
      <header className="crm-header">
        <div className="crm-title-row">
          <div className="crm-title">
            <div className="crm-headline-wrap">
              <h1>Customers & CRM</h1>
              <span className={`crm-env-badge env-${environment}`}>
                <span className="crm-pulse-dot" />
                {environment === 'live' ? 'Live Telephony Sync' : 'Sandbox CRM'}
              </span>
            </div>
            <p>Unified directory of caller identities, enterprise accounts, deal pipelines, and AI conversation memory.</p>
          </div>

          <div className="crm-actions">
            <button className="btn btn-secondary crm-btn-export" onClick={handleExportCSV} title="Export active records to CSV">
              <Download size={15} />
              <span>Export CSV</span>
            </button>
            <button 
              className="btn btn-primary crm-btn-add" 
              onClick={() => setIsAddModalOpen(true)}
              id="crm-add-record-btn"
            >
              <Plus size={16} />
              <span>Add {activeTab === 'contacts' ? 'Contact' : activeTab === 'companies' ? 'Company' : activeTab === 'opportunities' ? 'Opportunity' : 'Appointment'}</span>
            </button>
          </div>
        </div>

        {/* Executive KPI Stats Bar */}
        <div className="crm-stats-grid">
          <div className="crm-stat-card">
            <div className="crm-stat-icon-wrap icon-amber">
              <Users size={16} />
            </div>
            <div className="crm-stat-meta">
              <span className="crm-stat-label">Active Leads & Callers</span>
              <div className="crm-stat-val">
                {stats.totalContacts}
                <span className="crm-stat-trend trend-pos">+{stats.qualifiedContacts} qualified</span>
              </div>
            </div>
          </div>

          <div className="crm-stat-card">
            <div className="crm-stat-icon-wrap icon-emerald">
              <DollarSign size={16} />
            </div>
            <div className="crm-stat-meta">
              <span className="crm-stat-label">Total Pipeline Value</span>
              <div className="crm-stat-val">
                {stats.pipelineValueETB}
                <span className="crm-stat-sub">({stats.pipelineValueUSD})</span>
              </div>
            </div>
          </div>

          <div className="crm-stat-card">
            <div className="crm-stat-icon-wrap icon-blue">
              <Target size={16} />
            </div>
            <div className="crm-stat-meta">
              <span className="crm-stat-label">Active Opportunities</span>
              <div className="crm-stat-val">
                {stats.activeOpportunities} Deals
                <span className="crm-stat-trend trend-pos">78% Win Probability</span>
              </div>
            </div>
          </div>

          <div className="crm-stat-card">
            <div className="crm-stat-icon-wrap icon-purple">
              <Calendar size={16} />
            </div>
            <div className="crm-stat-meta">
              <span className="crm-stat-label">Upcoming AI Demos</span>
              <div className="crm-stat-val">
                {stats.scheduledAppointments} Scheduled
                <span className="crm-stat-trend trend-pos">98% Attendance</span>
              </div>
            </div>
          </div>
        </div>

        {/* Spacious Segmented Sub-Tabs Bar */}
        <div className="crm-tabs-bar" role="tablist">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                className={`crm-tab-pill ${isActive ? 'is-active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id)
                  setSearchQuery('')
                  setStatusFilter('all')
                  if (tab.id === 'contacts' && !selectedContact && contacts.length > 0) {
                    setSelectedContact(contacts[0])
                  }
                }}
              >
                <Icon size={16} className="crm-tab-icon" />
                <span className="crm-tab-label">{tab.label}</span>
                <span className="crm-tab-count">{tab.count}</span>
              </button>
            )
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="crm-main">
        {/* Table & List View */}
        <div className="crm-list-area">
          {/* List Toolbar */}
          <div className="crm-list-toolbar">
            <div className="crm-search-box">
              <Search size={15} className="crm-search-icon" />
              <input 
                type="text" 
                placeholder={`Search ${activeTab} by name, company, email, phone...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                id="crm-search-input"
              />
              {searchQuery && (
                <button className="crm-search-clear" onClick={() => setSearchQuery('')}>
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Quick Status Filter Pills */}
            <div className="crm-filter-pills">
              {activeTab === 'contacts' && (
                <>
                  <button 
                    className={`crm-filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('all')}
                  >
                    All ({contacts.length})
                  </button>
                  <button 
                    className={`crm-filter-pill ${statusFilter === 'qualified' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('qualified')}
                  >
                    Qualified
                  </button>
                  <button 
                    className={`crm-filter-pill ${statusFilter === 'customer' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('customer')}
                  >
                    Customer
                  </button>
                  <button 
                    className={`crm-filter-pill ${statusFilter === 'lead' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('lead')}
                  >
                    Leads
                  </button>
                  <button 
                    className={`crm-filter-pill ${statusFilter === 'churn_risk' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('churn_risk')}
                  >
                    Churn Risk
                  </button>
                </>
              )}

              {activeTab === 'companies' && (
                <>
                  <button 
                    className={`crm-filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('all')}
                  >
                    All Tiers
                  </button>
                  <button 
                    className={`crm-filter-pill ${statusFilter === 'enterprise' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('enterprise')}
                  >
                    Enterprise
                  </button>
                  <button 
                    className={`crm-filter-pill ${statusFilter === 'mid-market' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('mid-market')}
                  >
                    Mid-Market
                  </button>
                </>
              )}

              {activeTab === 'opportunities' && (
                <>
                  <button 
                    className={`crm-filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('all')}
                  >
                    All Stages
                  </button>
                  <button 
                    className={`crm-filter-pill ${statusFilter === 'negotiation' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('negotiation')}
                  >
                    Negotiation
                  </button>
                  <button 
                    className={`crm-filter-pill ${statusFilter === 'proposal sent' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('proposal sent')}
                  >
                    Proposal
                  </button>
                  <button 
                    className={`crm-filter-pill ${statusFilter === 'closed won' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('closed won')}
                  >
                    Won
                  </button>
                </>
              )}

              {activeTab === 'appointments' && (
                <>
                  <button 
                    className={`crm-filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('all')}
                  >
                    All ({appointments.length})
                  </button>
                  <button 
                    className={`crm-filter-pill ${statusFilter === 'scheduled' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('scheduled')}
                  >
                    Scheduled
                  </button>
                  <button 
                    className={`crm-filter-pill ${statusFilter === 'completed' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('completed')}
                  >
                    Completed
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="crm-table-container">
            {/* Contacts Table */}
            {activeTab === 'contacts' && (
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Caller & Contact Name</th>
                    <th>Account / Company</th>
                    <th>Lifecycle Status</th>
                    <th>Primary Phone</th>
                    <th>Extracted Role</th>
                    <th>Last Interaction</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="crm-empty-cell">
                        <Users size={28} className="empty-icon" />
                        <p>No contacts match your query.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredContacts.map(c => {
                      const isSelected = selectedContact?.id === c.id
                      return (
                        <tr 
                          key={c.id} 
                          className={`crm-row ${isSelected ? 'active' : ''}`}
                          onClick={() => setSelectedContact(c)}
                        >
                          <td>
                            <div className="crm-cell-user">
                              <div className="crm-avatar">{c.name.charAt(0).toUpperCase()}</div>
                              <div className="crm-cell-name-box">
                                <div className="crm-cell-name">{c.name}</div>
                                <div className="crm-cell-email">{c.email || 'No email registered'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="crm-cell-company">{c.company}</td>
                          <td>
                            <span className={`crm-badge badge-${c.status}`}>
                              {c.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="crm-cell-mono">{c.phone}</td>
                          <td className="crm-cell-role">{c.role}</td>
                          <td className="crm-cell-time">{c.lastContact}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            )}

            {/* Companies Table */}
            {activeTab === 'companies' && (
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Company Name</th>
                    <th>Industry Sector</th>
                    <th>Team Size</th>
                    <th>Location</th>
                    <th>Tier</th>
                    <th>Estimated Pipeline</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompanies.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="crm-empty-cell">
                        <Building2 size={28} className="empty-icon" />
                        <p>No companies found.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredCompanies.map(comp => (
                      <tr 
                        key={comp.id} 
                        className={`crm-row ${selectedCompany?.id === comp.id ? 'active' : ''}`}
                        onClick={() => setSelectedCompany(comp)}
                      >
                        <td>
                          <div className="crm-cell-company-title">
                            <Building2 size={16} className="comp-icon" />
                            <strong>{comp.name}</strong>
                          </div>
                        </td>
                        <td>{comp.industry}</td>
                        <td>{comp.employees} employees</td>
                        <td>
                          <div className="crm-cell-loc">
                            <MapPin size={12} />
                            <span>{comp.location}</span>
                          </div>
                        </td>
                        <td>
                          <span className="crm-badge badge-tier">{comp.tier}</span>
                        </td>
                        <td className="crm-cell-val">{comp.value}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* Opportunities Table */}
            {activeTab === 'opportunities' && (
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Deal Opportunity Title</th>
                    <th>Client Account</th>
                    <th>Pipeline Stage</th>
                    <th>Contract Amount</th>
                    <th>Probability</th>
                    <th>Target Close Date</th>
                    <th>AI Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOpportunities.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="crm-empty-cell">
                        <Target size={28} className="empty-icon" />
                        <p>No opportunities found.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredOpportunities.map(opp => (
                      <tr 
                        key={opp.id} 
                        className={`crm-row ${selectedOpportunity?.id === opp.id ? 'active' : ''}`}
                        onClick={() => setSelectedOpportunity(opp)}
                      >
                        <td>
                          <strong>{opp.title}</strong>
                        </td>
                        <td>{opp.company}</td>
                        <td>
                          <span className={`crm-badge badge-stage stage-${opp.stage.toLowerCase().replace(/\s+/g, '-')}`}>
                            {opp.stage}
                          </span>
                        </td>
                        <td className="crm-cell-amount">{opp.amount}</td>
                        <td>
                          <span className="crm-probability-pill">{opp.probability}</span>
                        </td>
                        <td className="crm-cell-time">{opp.closeDate}</td>
                        <td className="crm-cell-owner">{opp.owner}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* Appointments Table */}
            {activeTab === 'appointments' && (
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Meeting / Demo Title</th>
                    <th>Attendee</th>
                    <th>Client Organization</th>
                    <th>Scheduled Time</th>
                    <th>Meeting Channel</th>
                    <th>Assigned AI Agent</th>
                    <th>Booking Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="crm-empty-cell">
                        <Calendar size={28} className="empty-icon" />
                        <p>No appointments scheduled.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAppointments.map(apt => (
                      <tr 
                        key={apt.id} 
                        className={`crm-row ${selectedAppointment?.id === apt.id ? 'active' : ''}`}
                        onClick={() => setSelectedAppointment(apt)}
                      >
                        <td>
                          <strong>{apt.title}</strong>
                        </td>
                        <td>{apt.contact}</td>
                        <td>{apt.company}</td>
                        <td className="crm-cell-time">{apt.time}</td>
                        <td>
                          <span className="crm-channel-pill">{apt.channel}</span>
                        </td>
                        <td className="crm-cell-owner">{apt.agent}</td>
                        <td>
                          <span className={`crm-badge badge-${apt.status.toLowerCase()}`}>
                            {apt.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Detail Panel / Drawer (Contacts) */}
        <AnimatePresence>
          {activeTab === 'contacts' && selectedContact && (
            <motion.aside 
              className="crm-detail-panel"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <div className="cd-header">
                <div className="cd-profile">
                  <div className="cd-avatar">{selectedContact.name.charAt(0)}</div>
                  <div className="cd-info">
                    <h2>{selectedContact.name}</h2>
                    <p className="cd-company-sub">{selectedContact.company} • {selectedContact.role}</p>
                  </div>
                </div>
                <button className="btn-icon cd-close-btn" onClick={() => setSelectedContact(null)} title="Close contact drawer">
                  <X size={18} />
                </button>
              </div>

              {/* Quick Action Buttons */}
              <div className="cd-quick-actions">
                <button 
                  className="cd-action-btn btn-call" 
                  onClick={() => handleInitiateCall(selectedContact)}
                  title="Bridge call via FreeSWITCH telephony"
                >
                  <PhoneCall size={14} />
                  <span>Call Now</span>
                </button>
                <button 
                  className="cd-action-btn btn-email" 
                  onClick={() => handleSendEmail(selectedContact)}
                  title="Send follow-up email"
                >
                  <Mail size={14} />
                  <span>Email</span>
                </button>
                <div className="cd-status-dropdown-wrap">
                  <select 
                    className="cd-status-select" 
                    value={selectedContact.status} 
                    onChange={e => handleStatusChange(e.target.value)}
                  >
                    <option value="qualified">Qualified</option>
                    <option value="customer">Customer</option>
                    <option value="lead">Lead</option>
                    <option value="churn_risk">Churn Risk</option>
                  </select>
                </div>
              </div>

              <div className="cd-content">
                {/* Contact Coordinates */}
                <div className="cd-section">
                  <h3>Direct Coordinates</h3>
                  <div className="cd-grid">
                    <div className="cd-field">
                      <span className="label">Work Email</span>
                      <div className="val-copy-row">
                        <span className="val">{selectedContact.email || 'N/A'}</span>
                        {selectedContact.email && (
                          <button className="copy-btn" onClick={() => handleCopy(selectedContact.email, 'Email')}>
                            {copiedField === 'Email' ? <Check size={12} className="copy-ok" /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="cd-field">
                      <span className="label">Telephony Phone</span>
                      <div className="val-copy-row">
                        <span className="val mono">{selectedContact.phone || 'N/A'}</span>
                        {selectedContact.phone && (
                          <button className="copy-btn" onClick={() => handleCopy(selectedContact.phone, 'Phone')}>
                            {copiedField === 'Phone' ? <Check size={12} className="copy-ok" /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Extracted Insights */}
                <div className="cd-section">
                  <div className="cd-section-header">
                    <h3><Sparkles size={14} className="sparkle-icon" /> AI Conversation Insights</h3>
                    <span className="ai-score-pill">{selectedContact.sentiment || 'Positive'}</span>
                  </div>
                  <div className="ai-insight-box">
                    <div className="ai-meta-rows">
                      <div className="ai-meta-row">
                        <span className="meta-lbl">Acquisition Source:</span>
                        <span className="meta-val">{selectedContact.source}</span>
                      </div>
                      <div className="ai-meta-row">
                        <span className="meta-lbl">Detected Intent:</span>
                        <span className="meta-val">{selectedContact.interest || 'AI Telephony Evaluation'}</span>
                      </div>
                    </div>
                    {selectedContact.message && (
                      <div className="ai-quote-box">
                        <p className="quote-text">"{selectedContact.message}"</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Interaction Timeline */}
                <div className="cd-section">
                  <h3>Interaction Timeline</h3>

                  {/* Add Quick Note Form */}
                  <form className="cd-add-note-form" onSubmit={handleAddNote}>
                    <input 
                      type="text" 
                      placeholder="Add an internal note or call summary..."
                      value={newNoteText}
                      onChange={e => setNewNoteText(e.target.value)}
                    />
                    <button type="submit" disabled={!newNoteText.trim()} title="Post note">
                      <Send size={13} />
                    </button>
                  </form>

                  <div className="cd-timeline">
                    {(selectedContact.timeline || []).map((item, idx) => (
                      <div className="timeline-item" key={item.id || idx}>
                        <div className="tl-icon" style={{ borderColor: item.color || '#3b82f6', color: item.color || '#3b82f6' }}>
                          {item.type === 'call' && <Phone size={13} />}
                          {item.type === 'appointment' && <Calendar size={13} />}
                          {item.type === 'whatsapp' && <MessageSquare size={13} />}
                          {item.type === 'system' && <Bot size={13} />}
                        </div>
                        <div className="tl-content">
                          <div className="tl-time">{item.time}</div>
                          <p className="tl-text">{item.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.aside>
          )}

          {/* Right Detail Panel / Drawer (Companies) */}
          {activeTab === 'companies' && selectedCompany && (
            <motion.aside 
              className="crm-detail-panel"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <div className="cd-header">
                <div className="cd-profile">
                  <div className="cd-avatar comp-avatar">
                    <Building2 size={24} />
                  </div>
                  <div className="cd-info">
                    <h2>{selectedCompany.name}</h2>
                    <p className="cd-company-sub">{selectedCompany.industry} • {selectedCompany.location}</p>
                  </div>
                </div>
                <button className="btn-icon cd-close-btn" onClick={() => setSelectedCompany(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="cd-content">
                <div className="cd-section">
                  <h3>Account Architecture</h3>
                  <div className="cd-grid">
                    <div className="cd-field">
                      <span className="label">Tier Level</span>
                      <span className="val">{selectedCompany.tier}</span>
                    </div>
                    <div className="cd-field">
                      <span className="label">Headcount</span>
                      <span className="val">{selectedCompany.employees}</span>
                    </div>
                    <div className="cd-field">
                      <span className="label">Pipeline Valuation</span>
                      <span className="val amount">{selectedCompany.value}</span>
                    </div>
                    <div className="cd-field">
                      <span className="label">Corporate Switchboard</span>
                      <span className="val mono">{selectedCompany.phone}</span>
                    </div>
                  </div>
                </div>

                <div className="cd-section">
                  <h3>Connected Contacts</h3>
                  <div className="cd-connected-list">
                    {contacts.filter(c => c.company.toLowerCase() === selectedCompany.name.toLowerCase()).map(c => (
                      <div className="cd-contact-mini-card" key={c.id} onClick={() => { setActiveTab('contacts'); setSelectedContact(c); }}>
                        <div className="mini-avatar">{c.name.charAt(0)}</div>
                        <div className="mini-info">
                          <strong>{c.name}</strong>
                          <span>{c.role} • {c.phone}</span>
                        </div>
                        <ChevronRight size={14} className="mini-arrow" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Production Creation Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div 
            className="crm-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsAddModalOpen(false)}
          >
            <motion.div 
              className="crm-modal-dialog"
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="crm-modal-header">
                <div>
                  <h3>Add New {activeTab === 'contacts' ? 'Contact' : activeTab === 'companies' ? 'Company' : activeTab === 'opportunities' ? 'Opportunity' : 'Appointment'}</h3>
                  <p>Register records into your enterprise Markova OS workspace.</p>
                </div>
                <button className="crm-modal-close" onClick={() => setIsAddModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveNewRecord} className="crm-modal-form">
                {activeTab === 'contacts' && (
                  <>
                    <div className="form-group">
                      <label>Full Name *</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Abebe Bikila" 
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="form-row-2">
                      <div className="form-group">
                        <label>Company / Organization</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Ethiopian Airlines" 
                          value={formData.company}
                          onChange={e => setFormData({ ...formData, company: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Job Title / Role</label>
                        <input 
                          type="text" 
                          placeholder="e.g. VP Operations" 
                          value={formData.role}
                          onChange={e => setFormData({ ...formData, role: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-row-2">
                      <div className="form-group">
                        <label>Work Email</label>
                        <input 
                          type="email" 
                          placeholder="caller@example.com" 
                          value={formData.email}
                          onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Telephony Phone Number *</label>
                        <input 
                          type="tel" 
                          required
                          placeholder="+251 91 123 4567" 
                          value={formData.phone}
                          onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Lifecycle Status</label>
                      <select 
                        value={formData.status} 
                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                      >
                        <option value="qualified">Qualified</option>
                        <option value="lead">Lead</option>
                        <option value="customer">Customer</option>
                        <option value="churn_risk">Churn Risk</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Customer Requirement / Interest Note</label>
                      <textarea 
                        rows={2}
                        placeholder="Brief summary of customer inquiry or conversational intent..."
                        value={formData.message}
                        onChange={e => setFormData({ ...formData, message: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {activeTab === 'companies' && (
                  <>
                    <div className="form-group">
                      <label>Company Name *</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Dashen Bank" 
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="form-row-2">
                      <div className="form-group">
                        <label>Industry</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Banking & Financial" 
                          value={formData.industry}
                          onChange={e => setFormData({ ...formData, industry: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Employees</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 500+" 
                          value={formData.employees}
                          onChange={e => setFormData({ ...formData, employees: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-row-2">
                      <div className="form-group">
                        <label>Location (City, Country)</label>
                        <input 
                          type="text" 
                          placeholder="Addis Ababa, Ethiopia" 
                          value={formData.location}
                          onChange={e => setFormData({ ...formData, location: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Estimated Pipeline</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 1,500,000 ETB" 
                          value={formData.value}
                          onChange={e => setFormData({ ...formData, value: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'opportunities' && (
                  <>
                    <div className="form-group">
                      <label>Opportunity / Deal Title *</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. 24/7 AI Customer Support Deployment" 
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                      />
                    </div>
                    <div className="form-row-2">
                      <div className="form-group">
                        <label>Associated Company</label>
                        <input 
                          type="text" 
                          placeholder="e.g. GM Furniture" 
                          value={formData.company}
                          onChange={e => setFormData({ ...formData, company: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Contract Amount</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 750,000 ETB or $45,000" 
                          value={formData.amount}
                          onChange={e => setFormData({ ...formData, amount: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-row-2">
                      <div className="form-group">
                        <label>Deal Stage</label>
                        <select 
                          value={formData.stage} 
                          onChange={e => setFormData({ ...formData, stage: e.target.value })}
                        >
                          <option value="Discovery">Discovery</option>
                          <option value="Qualified">Qualified</option>
                          <option value="Proposal Sent">Proposal Sent</option>
                          <option value="Negotiation">Negotiation</option>
                          <option value="Closed Won">Closed Won</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Target Close Date</label>
                        <input 
                          type="date" 
                          value={formData.closeDate}
                          onChange={e => setFormData({ ...formData, closeDate: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'appointments' && (
                  <>
                    <div className="form-group">
                      <label>Meeting / Demo Title *</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Amharic Telephony Voice Demonstration" 
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                      />
                    </div>
                    <div className="form-row-2">
                      <div className="form-group">
                        <label>Attendee Name</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Dawit Bekele" 
                          value={formData.name}
                          onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Company</label>
                        <input 
                          type="text" 
                          placeholder="e.g. GM Furniture" 
                          value={formData.company}
                          onChange={e => setFormData({ ...formData, company: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-row-2">
                      <div className="form-group">
                        <label>Date & Time</label>
                        <input 
                          type="text" 
                          placeholder="Tomorrow, 2:30 PM" 
                          value={formData.time}
                          onChange={e => setFormData({ ...formData, time: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Channel / Medium</label>
                        <select 
                          value={formData.channel} 
                          onChange={e => setFormData({ ...formData, channel: e.target.value })}
                        >
                          <option value="Google Meet">Google Meet</option>
                          <option value="Zoom SIP Bridge">Zoom SIP Bridge</option>
                          <option value="In-Person Showroom">In-Person Showroom</option>
                          <option value="Phone Call">Phone Call</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <div className="crm-modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setIsAddModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create {activeTab.slice(0, -1)}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default CRM
