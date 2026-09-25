import React, { useState, useEffect, useMemo } from 'react'
import {
  Shield,
  AlertTriangle,
  Check,
  X,
  Clock,
  TerminalSquare,
  Lock,
  FileCheck,
  Activity,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Zap,
  RotateCcw,
  UserCheck,
  Search,
  Eye,
  Info,
  Download,
  Play,
  RefreshCw,
  Plus,
  Filter,
  Database,
  CheckSquare,
  Settings2,
  Trash2,
  ArrowRight,
  Radio,
  FileText,
  Copy,
  ChevronRight,
  Server
} from 'lucide-react'
import { getGovernanceSummary } from '../api/client'
import { useToast } from '../contexts/ToastContext'
import './Governance.css'

// Default baseline data
const DEFAULT_QUEUE = [
  {
    id: 'q-1',
    agent: 'Billing Specialist',
    action: 'Issue Customer Refund',
    details: 'Refund $45.00 to user@example.com for order #1029 (Exceeds $30 auto-threshold)',
    riskLevel: 'high',
    status: 'pending',
    timestamp: new Date().toISOString(),
    callerPhone: '+251 91 123 4567',
    sessionId: 'call_sess_8941a',
    payload: {
      orderId: 1029,
      amount: 45.00,
      currency: 'USD',
      customerEmail: 'user@example.com',
      reason: 'Package delayed beyond SLA policy (> 5 business days)'
    },
    reasoningTrace: 'Agent checked carrier tracking, confirmed delay exceeds SLA policy. Policy requires human confirmation for refunds exceeding $30 threshold.'
  },
  {
    id: 'q-2',
    agent: 'Telephony Security Bot',
    action: 'Block Inbound IP Subnet',
    details: 'Detected 500 automated call spikes from 192.168.1.0/24 within 3 minutes',
    riskLevel: 'critical',
    status: 'pending',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    callerPhone: 'SIP Trunk #4 (Inbound)',
    sessionId: 'sec_event_4492',
    payload: {
      subnet: '192.168.1.0/24',
      spikesPerMin: 166.7,
      carrierRoute: 'Ethio Telecom Gateway 2',
      durationSeconds: 180
    },
    reasoningTrace: 'Pattern matches automated telephony brute-force flood. Autonomous temporary rate-limit engaged; permanent IP block requires supervisor sign-off.'
  },
  {
    id: 'q-3',
    agent: 'Knowledge Base Sync',
    action: 'Deprecate Legacy FAQ Document',
    details: 'Replace "2024_Return_Policy.pdf" with "2026_Global_Return_Terms.pdf"',
    riskLevel: 'medium',
    status: 'pending',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    callerPhone: 'System Automation',
    sessionId: 'rag_sync_9918',
    payload: {
      deprecatedDoc: '2024_Return_Policy.pdf',
      newDoc: '2026_Global_Return_Terms.pdf',
      chunkCount: 148,
      vectorNamespace: 'tenant_default_kb'
    },
    reasoningTrace: 'New legal revision uploaded by compliance team. Document deprecation deletes 148 vector embeddings in Qdrant/pgvector.'
  }
]

const DEFAULT_POLICIES = [
  {
    id: 'p-1',
    name: 'PII & Financial Data Redaction',
    desc: 'Automatically mask SSN, credit card numbers, and passwords in transcripts and logs.',
    enabled: true,
    category: 'Privacy',
    parameters: {
      maskCreditCard: true,
      maskSSN: true,
      maskPasswords: true,
      redactionToken: '[REDACTED]'
    }
  },
  {
    id: 'p-2',
    name: 'Profanity & Toxicity Shield',
    desc: 'Intercept abusive language and smoothly transition to neutral escalation scripts.',
    enabled: true,
    category: 'Safety',
    parameters: {
      toxicityThreshold: 0.75,
      autoEscalateAfterWarnings: 2,
      escalationSkill: 'de_escalation_v2'
    }
  },
  {
    id: 'p-3',
    name: 'Off-Topic Boundary Enforcement',
    desc: 'Prevent AI agents from discussing topics outside defined knowledge base scope.',
    enabled: true,
    category: 'Compliance',
    parameters: {
      allowedDomains: ['Order Status', 'Returns & Refunds', 'Billing', 'Hours of Operation'],
      fallbackScript: 'I specialize in Markova services. Let me connect you with an account manager for other inquiries.'
    }
  },
  {
    id: 'p-4',
    name: 'Competitor Mention Blocker',
    desc: 'Restrict agents from agreeing with or evaluating competitor pricing claims.',
    enabled: true,
    category: 'Compliance',
    parameters: {
      blockedCompetitors: ['CompetitorX', 'VoiceAI Direct', 'LegacyCall Inc.'],
      action: 'Neutral Pivot Script'
    }
  },
  {
    id: 'p-5',
    name: 'Max Spend Cap Per Call',
    desc: 'Trigger human transfer if an individual call duration exceeds 15 minutes.',
    enabled: false,
    category: 'Cost Control',
    parameters: {
      maxMinutes: 15,
      warningAtMinute: 13,
      destinationQueue: 'Senior Escalation Queue'
    }
  },
  {
    id: 'p-6',
    name: 'Autonomous Refund Cap ($50.00)',
    desc: 'Require human approval for any agent action involving funds > $50.00.',
    enabled: true,
    category: 'Financial',
    parameters: {
      capAmountUSD: 50.00,
      dailyMaxPerCustomerUSD: 100.00,
      requireSupervisorApprovalAbove: 50.00
    }
  }
]

const DEFAULT_AUDITS = [
  {
    id: 'h-1',
    agent: 'Inbound Support Agent',
    query: 'Does Markova support PSTN SIP trunks in EMEA?',
    response: 'Yes, Markova supports native SIP peering across EU and African data centers with statutory SLA guarantees.',
    confidence: 0.98,
    hallucinationScore: 0.01,
    status: 'Passed',
    timestamp: new Date().toLocaleTimeString(),
    vectorDistance: 0.042,
    retrievedChunks: [
      {
        source: 'telephony_architecture_2026.pdf',
        snippet: 'Markova supports native SIP peering into Tier-1 carrier backbones including Ethio Telecom and European data centers with 99.98% SLA.'
      }
    ]
  },
  {
    id: 'h-2',
    agent: 'Sales Qualifier',
    query: 'Can I get a 90% discount for non-profit organizations?',
    response: 'Special non-profit pricing is available upon review by our enterprise sales team.',
    confidence: 0.94,
    hallucinationScore: 0.03,
    status: 'Passed',
    timestamp: new Date(Date.now() - 1800000).toLocaleTimeString(),
    vectorDistance: 0.088,
    retrievedChunks: [
      {
        source: 'pricing_and_discount_rules.docx',
        snippet: 'Non-profit and educational institutions can apply for custom tier concessions through sales review. Maximum automated discount is 0% without approval.'
      }
    ]
  },
  {
    id: 'h-3',
    agent: 'Technical Telephony Bot',
    query: 'What codec is used for WebRTC live audio streaming?',
    response: 'Calls use Opus 48kHz stereo dynamically adapted down to 16kHz mono narrowband for low-bandwidth cellular environments.',
    confidence: 0.99,
    hallucinationScore: 0.005,
    status: 'Passed',
    timestamp: new Date(Date.now() - 3600000).toLocaleTimeString(),
    vectorDistance: 0.021,
    retrievedChunks: [
      {
        source: 'sip_webrtc_codecs_spec.md',
        snippet: 'Live audio stream uses WebSocket / WebRTC with Opus fullband codec (48kHz) down to narrowband fallback for cellular stability.'
      }
    ]
  }
]

const Governance = () => {
  const toast = useToast()

  // Active navigation tab
  const [activeTab, setActiveTab] = useState('approvals')

  // Storage-backed state: Queue
  const [queue, setQueue] = useState(() => {
    try {
      const saved = localStorage.getItem('markova_gov_queue')
      return saved ? JSON.parse(saved) : DEFAULT_QUEUE
    } catch {
      return DEFAULT_QUEUE
    }
  })

  // Storage-backed state: Policies
  const [policies, setPolicies] = useState(() => {
    try {
      const saved = localStorage.getItem('markova_gov_policies')
      return saved ? JSON.parse(saved) : DEFAULT_POLICIES
    } catch {
      return DEFAULT_POLICIES
    }
  })

  // Storage-backed state: Audits
  const [hallucinationLogs, setHallucinationLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('markova_gov_audits')
      return saved ? JSON.parse(saved) : DEFAULT_AUDITS
    } catch {
      return DEFAULT_AUDITS
    }
  })

  // Storage-backed state: Emergency Kill-Switch
  const [killSwitch, setKillSwitch] = useState(() => {
    try {
      const saved = localStorage.getItem('markova_gov_killswitch')
      return saved ? JSON.parse(saved) : { engaged: false, timestamp: null, reason: '' }
    } catch {
      return { engaged: false, timestamp: null, reason: '' }
    }
  })

  // Storage-backed state: SLA Configuration
  const [slaConfig, setSlaConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('markova_gov_sla_config')
      return saved ? JSON.parse(saved) : {
        latencyThresholdMs: 200,
        sentimentThreshold: 2.0,
        carrierPeeringActive: true
      }
    } catch {
      return {
        latencyThresholdMs: 200,
        sentimentThreshold: 2.0,
        carrierPeeringActive: true
      }
    }
  })

  // Filter and search states
  const [approvalFilter, setApprovalFilter] = useState('all') // all | pending | approved | rejected
  const [approvalSearch, setApprovalSearch] = useState('')

  const [policyCategory, setPolicyCategory] = useState('all') // all | Privacy | Safety | Compliance | Cost Control | Financial
  const [policySearch, setPolicySearch] = useState('')

  const [auditFilter, setAuditFilter] = useState('all') // all | passed | flagged
  const [auditSearch, setAuditSearch] = useState('')

  // Interactive diagnostic states
  const [isAuditing, setIsAuditing] = useState(false)
  const [isReindexing, setIsReindexing] = useState(false)
  const [staleDocsCount, setStaleDocsCount] = useState(1)
  const [isTestingCarriers, setIsTestingCarriers] = useState(false)
  const [carrierPings, setCarrierPings] = useState({
    ethioTelecom: { status: 'Operational', latency: '38 ms', loss: '0.00%' },
    twilio: { status: 'Operational', latency: '72 ms', loss: '0.00%' },
    openai: { status: 'Operational', latency: '112 ms', loss: '0.00%' },
    elevenLabs: { status: 'Operational', latency: '95 ms', loss: '0.00%' }
  })

  // Modals state
  const [selectedApproval, setSelectedApproval] = useState(null)
  const [showSimulateModal, setShowSimulateModal] = useState(false)
  const [selectedPolicyConfig, setSelectedPolicyConfig] = useState(null)
  const [showNewPolicyModal, setShowNewPolicyModal] = useState(false)
  const [selectedAudit, setSelectedAudit] = useState(null)
  const [showKillSwitchModal, setShowKillSwitchModal] = useState(false)
  const [showDisengageModal, setShowDisengageModal] = useState(false)
  const [showSlaConfigModal, setShowSlaConfigModal] = useState(false)

  // Simulation form state
  const [simForm, setSimForm] = useState({
    agent: 'Billing Specialist',
    action: 'Issue Customer Refund',
    details: 'Refund $120.00 to premium_client@markova.et (Flagged > $50 cap)',
    riskLevel: 'high',
    callerPhone: '+251 92 888 7766'
  })

  // New policy form state
  const [newPolicyForm, setNewPolicyForm] = useState({
    name: '',
    category: 'Safety',
    desc: '',
    enabled: true
  })

  // Synchronize state changes to localStorage
  useEffect(() => {
    localStorage.setItem('markova_gov_queue', JSON.stringify(queue))
  }, [queue])

  useEffect(() => {
    localStorage.setItem('markova_gov_policies', JSON.stringify(policies))
  }, [policies])

  useEffect(() => {
    localStorage.setItem('markova_gov_audits', JSON.stringify(hallucinationLogs))
  }, [hallucinationLogs])

  useEffect(() => {
    localStorage.setItem('markova_gov_killswitch', JSON.stringify(killSwitch))
  }, [killSwitch])

  useEffect(() => {
    localStorage.setItem('markova_gov_sla_config', JSON.stringify(slaConfig))
  }, [slaConfig])

  // Top Metrics calculation
  const pendingApprovalsCount = useMemo(() => queue.filter(q => q.status === 'pending').length, [queue])
  const activePoliciesCount = useMemo(() => policies.filter(p => p.enabled).length, [policies])

  // Filtered lists
  const filteredQueue = useMemo(() => {
    return queue.filter(item => {
      const matchesFilter = approvalFilter === 'all' || item.status === approvalFilter
      const matchesSearch =
        item.agent.toLowerCase().includes(approvalSearch.toLowerCase()) ||
        item.action.toLowerCase().includes(approvalSearch.toLowerCase()) ||
        item.details.toLowerCase().includes(approvalSearch.toLowerCase())
      return matchesFilter && matchesSearch
    })
  }, [queue, approvalFilter, approvalSearch])

  const filteredPolicies = useMemo(() => {
    return policies.filter(p => {
      const matchesCat = policyCategory === 'all' || p.category === policyCategory
      const matchesSearch =
        p.name.toLowerCase().includes(policySearch.toLowerCase()) ||
        p.desc.toLowerCase().includes(policySearch.toLowerCase())
      return matchesCat && matchesSearch
    })
  }, [policies, policyCategory, policySearch])

  const filteredAudits = useMemo(() => {
    return hallucinationLogs.filter(log => {
      const matchesFilter = auditFilter === 'all' || log.status.toLowerCase() === auditFilter.toLowerCase()
      const matchesSearch =
        log.agent.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.query.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.response.toLowerCase().includes(auditSearch.toLowerCase())
      return matchesFilter && matchesSearch
    })
  }, [hallucinationLogs, auditFilter, auditSearch])

  // Handlers
  const handleApprove = (id) => {
    setQueue(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              status: 'approved',
              resolvedBy: 'Demo Developer (Supervisor)',
              resolvedAt: new Date().toISOString()
            }
          : item
      )
    )
    toast.success('Action approved & executed in production pipeline', 'Approved & Executed')
    if (selectedApproval?.id === id) {
      setSelectedApproval(null)
    }
  }

  const handleReject = (id, reason = 'Rejected by Supervisor') => {
    setQueue(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              status: 'rejected',
              rejectionReason: reason,
              resolvedBy: 'Demo Developer (Supervisor)',
              resolvedAt: new Date().toISOString()
            }
          : item
      )
    )
    toast.error('Action blocked by supervisor. Notification sent to agent.', 'Action Rejected')
    if (selectedApproval?.id === id) {
      setSelectedApproval(null)
    }
  }

  const handleReopen = (id) => {
    setQueue(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              status: 'pending',
              resolvedBy: undefined,
              resolvedAt: undefined
            }
          : item
      )
    )
    toast.info('Approval request reopened for review', 'Queue Updated')
  }

  const handleCreateSimulatedApproval = (e) => {
    e.preventDefault()
    if (!simForm.action.trim()) return

    const newReq = {
      id: `q-${Date.now()}`,
      agent: simForm.agent,
      action: simForm.action,
      details: simForm.details,
      riskLevel: simForm.riskLevel,
      status: 'pending',
      timestamp: new Date().toISOString(),
      callerPhone: simForm.callerPhone,
      sessionId: `sim_sess_${Math.floor(Math.random() * 9000 + 1000)}`,
      payload: {
        simulated: true,
        source: 'Supervisor Sandbox Simulator',
        timestamp: new Date().toISOString()
      },
      reasoningTrace: `Agent encountered threshold condition for ${simForm.action}. Supervisor manual sign-off required.`
    }

    setQueue(prev => [newReq, ...prev])
    setShowSimulateModal(false)
    toast.success(`New high-risk request added to approval queue`, 'Simulation Created')
  }

  const togglePolicy = (id) => {
    setPolicies(prev =>
      prev.map(p => {
        if (p.id === id) {
          const nextState = !p.enabled
          if (nextState) {
            toast.success(`Guardrail "${p.name}" is now enforced`, 'Policy Activated')
          } else {
            toast.info(`Guardrail "${p.name}" disabled`, 'Policy Deactivated')
          }
          return { ...p, enabled: nextState }
        }
        return p
      })
    )
  }

  const handleSavePolicyConfig = (updatedPolicy) => {
    setPolicies(prev => prev.map(p => (p.id === updatedPolicy.id ? updatedPolicy : p)))
    setSelectedPolicyConfig(null)
    toast.success(`Parameters for "${updatedPolicy.name}" updated`, 'Configuration Saved')
  }

  const handleCreatePolicy = (e) => {
    e.preventDefault()
    if (!newPolicyForm.name.trim()) return

    const newPolicy = {
      id: `p-${Date.now()}`,
      name: newPolicyForm.name,
      category: newPolicyForm.category,
      desc: newPolicyForm.desc || 'Custom safety boundary defined by organization administrator.',
      enabled: newPolicyForm.enabled,
      parameters: { custom: true }
    }

    setPolicies(prev => [...prev, newPolicy])
    setShowNewPolicyModal(false)
    setNewPolicyForm({ name: '', category: 'Safety', desc: '', enabled: true })
    toast.success(`Guardrail policy "${newPolicy.name}" created`, 'Policy Created')
  }

  const handleResetPolicies = () => {
    setPolicies(DEFAULT_POLICIES)
    toast.success('Safety guardrail policies restored to standard baseline', 'Policies Reset')
  }

  // Live RAG audit simulation
  const handleRunRAGAudit = () => {
    setIsAuditing(true)
    setTimeout(() => {
      const sampleQueries = [
        {
          agent: 'Inbound Support Agent',
          query: 'Can Markova AI transfer callers to WhatsApp if cellular reception is degraded?',
          response: 'Yes, if speech quality degrades below 3.0 MOS score, the agent sends an instant SMS link containing the session conversation over WhatsApp.',
          confidence: 0.97,
          hallucinationScore: 0.015,
          status: 'Passed',
          vectorDistance: 0.038,
          retrievedChunks: [
            {
              source: 'omnichannel_failover_spec.pdf',
              snippet: 'When telemetry detects packet loss > 12% or MOS < 3.0, callers receive automated SMS and WhatsApp link continuation.'
            }
          ]
        },
        {
          agent: 'Billing Specialist',
          query: 'Is Telebirr payment supported for automated telephony top-ups?',
          response: 'Yes, Telebirr SuperApp QR and CBE Birr USSD integrations are fully supported for automated airtime and seat billing.',
          confidence: 0.99,
          hallucinationScore: 0.008,
          status: 'Passed',
          vectorDistance: 0.024,
          retrievedChunks: [
            {
              source: 'ethiopia_telecom_payments.pdf',
              snippet: 'Direct Telebirr and CBE Birr payment gateway endpoints are provisioned for all Ethiopian call center tenants.'
            }
          ]
        }
      ]

      const picked = sampleQueries[Math.floor(Math.random() * sampleQueries.length)]
      const newAudit = {
        id: `h-${Date.now()}`,
        ...picked,
        timestamp: new Date().toLocaleTimeString()
      }

      setHallucinationLogs(prev => [newAudit, ...prev])
      setIsAuditing(false)
      toast.success('RAG Grounding Audit complete: Zero hallucinations detected', 'Audit Verified')
    }, 1200)
  }

  // Re-indexing stale documents
  const handleReindexKnowledge = () => {
    setIsReindexing(true)
    setTimeout(() => {
      setIsReindexing(false)
      setStaleDocsCount(0)
      toast.success('Vector embeddings re-indexed with pgvector across all active documents', 'Knowledge Synced')
    }, 1500)
  }

  // Carrier Ping diagnostic
  const handlePingCarriers = () => {
    setIsTestingCarriers(true)
    setTimeout(() => {
      setIsTestingCarriers(false)
      setCarrierPings({
        ethioTelecom: { status: 'Operational', latency: `${Math.floor(Math.random() * 10 + 35)} ms`, loss: '0.00%' },
        twilio: { status: 'Operational', latency: `${Math.floor(Math.random() * 15 + 70)} ms`, loss: '0.00%' },
        openai: { status: 'Operational', latency: `${Math.floor(Math.random() * 20 + 105)} ms`, loss: '0.00%' },
        elevenLabs: { status: 'Operational', latency: `${Math.floor(Math.random() * 15 + 90)} ms`, loss: '0.00%' }
      })
      toast.success('Carrier peering telemetry validated: 100% operational', 'Peering Verified')
    }, 1000)
  }

  // Kill Switch engage
  const handleEngageKillSwitch = () => {
    const newState = {
      engaged: true,
      timestamp: new Date().toISOString(),
      reason: 'Manual supervisor emergency override'
    }
    setKillSwitch(newState)
    setShowKillSwitchModal(false)
    toast.error('EMERGENCY KILL-SWITCH ENGAGED. All incoming telephony routing directly to backup PSTN.', 'Kill-Switch Active')
  }

  // Kill Switch disengage
  const handleDisengageKillSwitch = () => {
    const newState = {
      engaged: false,
      timestamp: null,
      reason: ''
    }
    setKillSwitch(newState)
    setShowDisengageModal(false)
    toast.success('Emergency kill-switch disengaged. AI Agents resumed production call handling.', 'Normal Telephony Restored')
  }

  // Export Audits CSV
  const handleExportAuditsCSV = () => {
    try {
      const headers = ['ID', 'Agent', 'Query', 'AI Response', 'Confidence', 'Hallucination Score', 'Status', 'Timestamp']
      const rows = hallucinationLogs.map(l => [
        l.id,
        `"${(l.agent || '').replace(/"/g, '""')}"`,
        `"${(l.query || '').replace(/"/g, '""')}"`,
        `"${(l.response || '').replace(/"/g, '""')}"`,
        `${(l.confidence * 100).toFixed(1)}%`,
        l.hallucinationScore,
        l.status,
        `"${l.timestamp || ''}"`
      ])

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', `markova_governance_audits_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('Governance audit logs exported as CSV', 'Export Downloaded')
    } catch (err) {
      toast.error('Could not generate CSV export', 'Export Failed')
    }
  }

  return (
    <div className={`governance-page ${killSwitch.engaged ? 'kill-switch-active' : ''}`}>
      {/* Emergency Alert Banner if Kill-Switch is Active */}
      {killSwitch.engaged && (
        <div className="gov-emergency-banner">
          <div className="banner-left">
            <Zap size={22} className="emergency-icon-pulse" />
            <div>
              <strong>CRITICAL: EMERGENCY AGENT KILL-SWITCH IS ENGAGED</strong>
              <p>
                All AI telephony bots are paused. Inbound calls are currently routed to backup PSTN / IVR fallback.
                Engaged at {new Date(killSwitch.timestamp).toLocaleTimeString()}.
              </p>
            </div>
          </div>
          <button className="disengage-banner-btn" onClick={() => setShowDisengageModal(true)}>
            <RotateCcw size={16} /> Disengage Kill-Switch
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="governance-header">
        <div>
          <div className="title-row">
            <h1>AI Governance & Safety Command</h1>
            <span className="live-shield-pill">
              <Shield size={14} /> Enterprise Guardrails
            </span>
          </div>
          <p className="subtitle">
            Human-in-the-loop oversight, guardrail compliance, hallucination tracking, and SLA safety controls.
          </p>
        </div>

        <div className="header-actions">
          {killSwitch.engaged ? (
            <div className="system-status-badge critical" onClick={() => setShowDisengageModal(true)}>
              <AlertTriangle size={16} className="text-red-400" />
              <span>KILL-SWITCH ACTIVE (CRITICAL)</span>
            </div>
          ) : (
            <div className="system-status-badge online">
              <CheckCircle2 size={16} className="text-green-400" />
              <span>Governance Engine Online</span>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Metrics Row */}
      <div className="gov-metrics-grid">
        <div
          className={`gov-metric-card amber ${activeTab === 'approvals' ? 'active-kpi' : ''}`}
          onClick={() => setActiveTab('approvals')}
          title="Click to view Human Approvals"
        >
          <div className="metric-icon-wrap">
            <AlertTriangle size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Pending Approvals</span>
            <div className="metric-val-row">
              <span className="metric-val">{pendingApprovalsCount}</span>
              {pendingApprovalsCount > 0 && <span className="action-required-badge">Action Needed</span>}
            </div>
          </div>
          <ChevronRight size={16} className="kpi-arrow" />
        </div>

        <div
          className={`gov-metric-card blue ${activeTab === 'guardrails' ? 'active-kpi' : ''}`}
          onClick={() => setActiveTab('guardrails')}
          title="Click to view Safety Guardrails"
        >
          <div className="metric-icon-wrap">
            <Shield size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Active Guardrails</span>
            <div className="metric-val-row">
              <span className="metric-val">
                {activePoliciesCount} / {policies.length}
              </span>
              <span className="kpi-sub-pill">Enforced</span>
            </div>
          </div>
          <ChevronRight size={16} className="kpi-arrow" />
        </div>

        <div
          className={`gov-metric-card green ${activeTab === 'audits' ? 'active-kpi' : ''}`}
          onClick={() => setActiveTab('audits')}
          title="Click to view Knowledge Grounding Audits"
        >
          <div className="metric-icon-wrap">
            <FileCheck size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Hallucination Rate</span>
            <div className="metric-val-row">
              <span className="metric-val text-green-400">0.02%</span>
              <span className="kpi-sub-pill success">G-Eval v4.2</span>
            </div>
          </div>
          <ChevronRight size={16} className="kpi-arrow" />
        </div>

        <div
          className={`gov-metric-card purple ${activeTab === 'slas' ? 'active-kpi' : ''}`}
          onClick={() => setActiveTab('slas')}
          title="Click to view Service SLAs & Operational Risk"
        >
          <div className="metric-icon-wrap">
            <Activity size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">SLA Compliance</span>
            <div className="metric-val-row">
              <span className="metric-val">99.98%</span>
              <span className="kpi-sub-pill purple">&lt;200ms Latency</span>
            </div>
          </div>
          <ChevronRight size={16} className="kpi-arrow" />
        </div>
      </div>

      {/* Tab Navigation Bar */}
      <div className="gov-tabs-container">
        <button
          className={`gov-tab ${activeTab === 'approvals' ? 'active' : ''}`}
          onClick={() => setActiveTab('approvals')}
        >
          <Shield size={16} /> Human Approvals
          {pendingApprovalsCount > 0 && <span className="gov-badge-count">{pendingApprovalsCount}</span>}
        </button>

        <button
          className={`gov-tab ${activeTab === 'guardrails' ? 'active' : ''}`}
          onClick={() => setActiveTab('guardrails')}
        >
          <Lock size={16} /> Guardrails & Safety
          <span className="gov-badge-subcount">{activePoliciesCount} on</span>
        </button>

        <button
          className={`gov-tab ${activeTab === 'audits' ? 'active' : ''}`}
          onClick={() => setActiveTab('audits')}
        >
          <FileCheck size={16} /> Hallucination & Audits
          <span className="gov-badge-subcount">{hallucinationLogs.length} logs</span>
        </button>

        <button
          className={`gov-tab ${activeTab === 'slas' ? 'active' : ''}`}
          onClick={() => setActiveTab('slas')}
        >
          <Activity size={16} /> Service SLAs & Risk
          {killSwitch.engaged && <span className="gov-badge-count red">Active Stop</span>}
        </button>
      </div>

      {/* Tab Content Wrapper */}
      <div className="gov-content-wrapper">
        {/* ================================================================= */}
        {/* Tab 1: Human Approvals Queue */}
        {/* ================================================================= */}
        {activeTab === 'approvals' && (
          <div className="approvals-section">
            <div className="section-header-toolbar">
              <div className="section-intro">
                <h2>Human-in-the-Loop Action Approvals</h2>
                <p>Review high-risk actions requested by AI Agents before execution in live telephony.</p>
              </div>

              <div className="toolbar-actions">
                <button
                  className="gov-btn-secondary"
                  onClick={() => setShowSimulateModal(true)}
                  title="Simulate high-risk action request from an agent"
                >
                  <Plus size={15} /> Simulate Agent Action
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="gov-filter-bar">
              <div className="gov-search-input-wrap">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search requests by agent, action title, or details..."
                  value={approvalSearch}
                  onChange={(e) => setApprovalSearch(e.target.value)}
                  className="gov-search-input"
                />
                {approvalSearch && (
                  <button className="clear-search-btn" onClick={() => setApprovalSearch('')}>
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="filter-pills-row">
                <button
                  className={`filter-pill ${approvalFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setApprovalFilter('all')}
                >
                  All ({queue.length})
                </button>
                <button
                  className={`filter-pill ${approvalFilter === 'pending' ? 'active' : ''}`}
                  onClick={() => setApprovalFilter('pending')}
                >
                  Pending ({pendingApprovalsCount})
                </button>
                <button
                  className={`filter-pill ${approvalFilter === 'approved' ? 'active' : ''}`}
                  onClick={() => setApprovalFilter('approved')}
                >
                  Approved ({queue.filter(q => q.status === 'approved').length})
                </button>
                <button
                  className={`filter-pill ${approvalFilter === 'rejected' ? 'active' : ''}`}
                  onClick={() => setApprovalFilter('rejected')}
                >
                  Rejected ({queue.filter(q => q.status === 'rejected').length})
                </button>
              </div>
            </div>

            {/* Queue Cards Grid */}
            {filteredQueue.length === 0 ? (
              <div className="gov-empty-state">
                <UserCheck size={40} className="empty-icon text-muted" />
                <h3>No approval requests match your criteria</h3>
                <p>
                  {approvalSearch || approvalFilter !== 'all'
                    ? 'Try adjusting your search terms or filter selection.'
                    : 'All agent actions are currently cleared and running smoothly.'}
                </p>
                <button className="gov-btn-secondary mt-3" onClick={() => setShowSimulateModal(true)}>
                  <Plus size={14} /> Simulate Test Request
                </button>
              </div>
            ) : (
              <div className="queue-cards-grid">
                {filteredQueue.map(item => (
                  <div
                    key={item.id}
                    className={`gov-card approval-card ${item.status !== 'pending' ? 'resolved' : ''} ${item.riskLevel}`}
                  >
                    <div className="card-header-row">
                      <div className="agent-title-wrap">
                        <TerminalSquare size={18} className="agent-icon" />
                        <div>
                          <strong>{item.agent}</strong>
                          <span className="session-tag">Session: {item.sessionId}</span>
                        </div>
                      </div>

                      <div className="card-header-tags">
                        <span className={`risk-pill ${item.riskLevel}`}>
                          <AlertTriangle size={12} /> {item.riskLevel.toUpperCase()} RISK
                        </span>
                      </div>
                    </div>

                    <div className="card-body">
                      <h3>{item.action}</h3>
                      <p>{item.details}</p>

                      <div className="card-meta-row">
                        <span className="time-stamp">
                          <Clock size={13} /> Requested {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                        {item.callerPhone && (
                          <span className="phone-tag">
                            <Radio size={13} /> {item.callerPhone}
                          </span>
                        )}
                        <button
                          className="view-payload-btn"
                          onClick={() => setSelectedApproval(item)}
                        >
                          <Eye size={13} /> Inspect Payload
                        </button>
                      </div>
                    </div>

                    {item.status === 'pending' ? (
                      <div className="card-action-bar">
                        <button
                          className="gov-btn reject"
                          onClick={() => handleReject(item.id)}
                        >
                          <X size={16} /> Reject Action
                        </button>
                        <button
                          className="gov-btn approve"
                          onClick={() => handleApprove(item.id)}
                        >
                          <Check size={16} /> Approve & Execute
                        </button>
                      </div>
                    ) : (
                      <div className="card-resolved-bar">
                        <div className={`status-banner ${item.status}`}>
                          {item.status === 'approved' ? (
                            <>
                              <CheckCircle2 size={16} /> Action Approved & Executed
                              <span className="resolved-by">by {item.resolvedBy || 'Supervisor'}</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle size={16} /> Action Blocked by Supervisor
                              <span className="resolved-by">({item.rejectionReason || 'Policy Threshold'})</span>
                            </>
                          )}
                        </div>
                        <button
                          className="gov-btn-ghost"
                          onClick={() => handleReopen(item.id)}
                          title="Reopen request in queue"
                        >
                          <RotateCcw size={14} /> Reopen
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* Tab 2: Safety Guardrails & Policies */}
        {/* ================================================================= */}
        {activeTab === 'guardrails' && (
          <div className="guardrails-section">
            <div className="section-header-toolbar">
              <div className="section-intro">
                <h2>AI Agent Safety Guardrails</h2>
                <p>Configure automated system boundaries, PII redaction filters, and enterprise compliance rules.</p>
              </div>

              <div className="toolbar-actions">
                <button
                  className="gov-btn-ghost"
                  onClick={handleResetPolicies}
                  title="Reset all policies to standard recommended baseline"
                >
                  <RotateCcw size={14} /> Reset to Baseline
                </button>
                <button
                  className="gov-btn-secondary"
                  onClick={() => setShowNewPolicyModal(true)}
                >
                  <Plus size={15} /> Add Custom Policy
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="gov-filter-bar">
              <div className="gov-search-input-wrap">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Filter policies by name or rule description..."
                  value={policySearch}
                  onChange={(e) => setPolicySearch(e.target.value)}
                  className="gov-search-input"
                />
                {policySearch && (
                  <button className="clear-search-btn" onClick={() => setPolicySearch('')}>
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="filter-pills-row">
                {['all', 'Privacy', 'Safety', 'Compliance', 'Financial', 'Cost Control'].map(cat => (
                  <button
                    key={cat}
                    className={`filter-pill ${policyCategory === cat ? 'active' : ''}`}
                    onClick={() => setPolicyCategory(cat)}
                  >
                    {cat === 'all' ? `All (${policies.length})` : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Policies Grid */}
            <div className="policies-grid">
              {filteredPolicies.map(p => (
                <div key={p.id} className={`gov-card policy-card ${p.enabled ? 'is-enabled' : 'is-disabled'}`}>
                  <div className="policy-main">
                    <div className="policy-header">
                      <span className={`category-chip ${p.category.toLowerCase().replace(/\s+/g, '-')}`}>
                        {p.category}
                      </span>
                      <h3>{p.name}</h3>
                    </div>
                    <p>{p.desc}</p>

                    <div className="policy-footer-actions">
                      <button
                        className="policy-config-btn"
                        onClick={() => setSelectedPolicyConfig(p)}
                      >
                        <Sliders size={13} /> Configure Parameters
                      </button>
                    </div>
                  </div>

                  <div className="policy-toggle-wrap">
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={p.enabled}
                        onChange={() => togglePolicy(p.id)}
                      />
                      <span className="toggle-slider" />
                    </label>
                    <span className={`status-label ${p.enabled ? 'active' : 'disabled'}`}>
                      {p.enabled ? 'Enforced' : 'Disabled'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* Tab 3: Knowledge Grounding & Hallucination Audits */}
        {/* ================================================================= */}
        {activeTab === 'audits' && (
          <div className="audits-section">
            <div className="section-header-toolbar">
              <div className="section-intro">
                <h2>Knowledge Grounding & Hallucination Audits</h2>
                <p>Automated evaluation checking RAG vector grounding accuracy, semantic drift, and citation fidelity.</p>
              </div>

              <div className="toolbar-actions">
                <button
                  className="gov-btn-ghost"
                  onClick={handleExportAuditsCSV}
                  title="Export evaluation logs to CSV"
                >
                  <Download size={15} /> Export CSV
                </button>
                <button
                  className="gov-btn-secondary"
                  onClick={handleRunRAGAudit}
                  disabled={isAuditing}
                >
                  <RefreshCw size={15} className={isAuditing ? 'spin-anim' : ''} />
                  {isAuditing ? 'Evaluating Grounding...' : 'Run RAG Grounding Audit'}
                </button>
              </div>
            </div>

            {/* Audits Summary Metric Cards */}
            <div className="audits-summary-row">
              <div className="gov-card audit-stat-box">
                <span className="label">Knowledge Verification Score</span>
                <span className="value text-green-400">99.8%</span>
                <span className="subtext">Vector cosine distance &lt; 0.15 threshold</span>
              </div>
              <div className="gov-card audit-stat-box">
                <span className="label">Evaluation Engine</span>
                <span className="value text-blue-400">G-Eval v4.2</span>
                <span className="subtext">Real-time vector sampling active</span>
              </div>
              <div className="gov-card audit-stat-box">
                <div className="stat-box-split">
                  <div>
                    <span className="label">Stale Document Warnings</span>
                    <span className={`value ${staleDocsCount > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                      {staleDocsCount} {staleDocsCount === 1 ? 'Document' : 'Documents'}
                    </span>
                    <span className="subtext">
                      {staleDocsCount > 0 ? 'Requires vector re-indexing' : 'All embeddings synchronized'}
                    </span>
                  </div>
                  {staleDocsCount > 0 && (
                    <button
                      className="reindex-btn"
                      onClick={handleReindexKnowledge}
                      disabled={isReindexing}
                    >
                      <Database size={13} className={isReindexing ? 'spin-anim' : ''} />
                      {isReindexing ? 'Re-indexing...' : 'Re-index Chunks'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="gov-filter-bar">
              <div className="gov-search-input-wrap">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search logs by agent name, customer query, or response..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="gov-search-input"
                />
                {auditSearch && (
                  <button className="clear-search-btn" onClick={() => setAuditSearch('')}>
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="filter-pills-row">
                <button
                  className={`filter-pill ${auditFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setAuditFilter('all')}
                >
                  All ({hallucinationLogs.length})
                </button>
                <button
                  className={`filter-pill ${auditFilter === 'passed' ? 'active' : ''}`}
                  onClick={() => setAuditFilter('passed')}
                >
                  Passed ({hallucinationLogs.filter(l => l.status === 'Passed').length})
                </button>
                <button
                  className={`filter-pill ${auditFilter === 'flagged' ? 'active' : ''}`}
                  onClick={() => setAuditFilter('flagged')}
                >
                  Flagged (0)
                </button>
              </div>
            </div>

            {/* Evaluation Logs Table Card */}
            <div className="gov-card audit-logs-card">
              <div className="table-header-row">
                <h3>Recent Grounding Evaluation Logs</h3>
                <span className="table-count-label">{filteredAudits.length} sampled evaluations</span>
              </div>

              <div className="logs-table-wrapper">
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Customer Query</th>
                      <th>AI Response</th>
                      <th>Confidence</th>
                      <th>Grounding Score</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAudits.map(log => (
                      <tr key={log.id}>
                        <td className="font-semibold agent-cell">
                          <TerminalSquare size={14} className="agent-icon-table" />
                          {log.agent}
                        </td>
                        <td className="query-cell">{log.query}</td>
                        <td className="response-cell">{log.response}</td>
                        <td>
                          <span className="confidence-pill">
                            {(log.confidence * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td>
                          <span className="distance-pill">
                            {log.vectorDistance ? `${log.vectorDistance} dist` : '0.038 dist'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill ${log.status.toLowerCase()}`}>
                            <CheckCircle2 size={13} /> {log.status}
                          </span>
                        </td>
                        <td>
                          <button
                            className="inspect-rag-btn"
                            onClick={() => setSelectedAudit(log)}
                            title="Inspect retrieved vector chunks & citation source"
                          >
                            <Eye size={13} /> Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* Tab 4: Service SLAs & Operational Risk */}
        {/* ================================================================= */}
        {activeTab === 'slas' && (
          <div className="slas-section">
            <div className="section-header-toolbar">
              <div className="section-intro">
                <h2>Service SLAs & Operational Risk Controls</h2>
                <p>Real-time telemetry, WebSocket audio latency thresholds, carrier peering, and emergency kill-switch controls.</p>
              </div>

              <div className="toolbar-actions">
                <button
                  className="gov-btn-ghost"
                  onClick={() => setShowSlaConfigModal(true)}
                >
                  <Settings2 size={15} /> Configure Thresholds
                </button>
                <button
                  className="gov-btn-secondary"
                  onClick={handlePingCarriers}
                  disabled={isTestingCarriers}
                >
                  <RefreshCw size={15} className={isTestingCarriers ? 'spin-anim' : ''} />
                  {isTestingCarriers ? 'Pinging Carriers...' : 'Ping & Verify Carriers'}
                </button>
              </div>
            </div>

            {/* SLA Telemetry Cards Grid */}
            <div className="sla-cards-grid">
              {/* Card 1: Latency */}
              <div className="gov-card sla-card">
                <div className="sla-card-header">
                  <div className="sla-icon-wrap blue">
                    <Activity size={20} />
                  </div>
                  <div>
                    <h3>Telephony Audio Latency</h3>
                    <span className="sla-sub">Opus WebSocket Stream</span>
                  </div>
                </div>
                <div className="sla-card-body">
                  <div className="sla-value-row">
                    <div className="sla-value">118 ms</div>
                    <span className="sla-badge green">Within SLA</span>
                  </div>
                  <p className="text-muted">Target SLA: &lt; {slaConfig.latencyThresholdMs} ms roundtrip audio latency</p>
                  <div className="progress-bar-track">
                    <div className="progress-fill green" style={{ width: '59%' }} />
                  </div>
                  <div className="progress-labels">
                    <span>0 ms</span>
                    <span>Target: 200 ms</span>
                    <span>Max: 500 ms</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Auto Escalation */}
              <div className="gov-card sla-card">
                <div className="sla-card-header">
                  <div className="sla-icon-wrap green">
                    <UserCheck size={20} />
                  </div>
                  <div>
                    <h3>Auto-Human Escalation Trigger</h3>
                    <span className="sla-sub">Sentiment Analysis Queue</span>
                  </div>
                </div>
                <div className="sla-card-body">
                  <div className="sla-value-row">
                    <div className="sla-value">Sentiment &lt; {slaConfig.sentimentThreshold.toFixed(1)} / 5.0</div>
                    <span className="status-pill active">
                      <CheckCircle2 size={13} /> Active Trigger
                    </span>
                  </div>
                  <p className="text-muted">
                    Automatically routes live caller to supervisor queue upon customer frustration signals.
                  </p>
                  <div className="escalation-triggers-list">
                    <span className="trigger-chip">• Frustration Tone Detected</span>
                    <span className="trigger-chip">• Repeated Silence &gt; 5s</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Kill-Switch */}
              <div className={`gov-card sla-card emergency ${killSwitch.engaged ? 'is-engaged' : ''}`}>
                <div className="sla-card-header">
                  <div className="sla-icon-wrap red">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h3>Emergency Agent Kill-Switch</h3>
                    <span className="sla-sub">Global Telephony Failover</span>
                  </div>
                </div>
                <div className="sla-card-body">
                  {killSwitch.engaged ? (
                    <>
                      <div className="emergency-active-state">
                        <AlertTriangle size={18} className="text-red-400" />
                        <strong>KILL-SWITCH CURRENTLY ACTIVE</strong>
                      </div>
                      <p className="text-muted">
                        All AI agents are currently paused. All incoming traffic is routed to secondary PSTN / IVR trunk.
                      </p>
                      <button
                        className="disengage-btn"
                        onClick={() => setShowDisengageModal(true)}
                      >
                        <RotateCcw size={16} /> Disengage & Restore AI Routing
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-muted">
                        Instantly pause all active AI telephony bots and route incoming calls to backup IVR trunk.
                      </p>
                      <button
                        className="emergency-btn"
                        onClick={() => setShowKillSwitchModal(true)}
                      >
                        <AlertTriangle size={16} /> Engage Kill-Switch
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Carrier Telephony Peering Grid */}
            <div className="carrier-peering-section">
              <div className="carrier-header-row">
                <div>
                  <h3>Upstream Carrier Telephony Peering Health</h3>
                  <p>Real-time status of SIP trunks, speech models, and audio gateway bridges.</p>
                </div>
                <span className="peering-uptime-pill">
                  <Server size={14} /> 99.98% Network Uptime
                </span>
              </div>

              <div className="carrier-grid">
                <div className="gov-card carrier-card">
                  <div className="carrier-top">
                    <div className="carrier-name-wrap">
                      <span className="carrier-indicator green" />
                      <strong>Ethio Telecom (ECA PSTN Trunk)</strong>
                    </div>
                    <span className="carrier-status green">{carrierPings.ethioTelecom.status}</span>
                  </div>
                  <div className="carrier-metrics">
                    <div className="metric-col">
                      <span className="m-label">Roundtrip Latency</span>
                      <span className="m-val">{carrierPings.ethioTelecom.latency}</span>
                    </div>
                    <div className="metric-col">
                      <span className="m-label">Packet Loss</span>
                      <span className="m-val">{carrierPings.ethioTelecom.loss}</span>
                    </div>
                    <div className="metric-col">
                      <span className="m-label">Protocol</span>
                      <span className="m-val">SIP over TLS</span>
                    </div>
                  </div>
                </div>

                <div className="gov-card carrier-card">
                  <div className="carrier-top">
                    <div className="carrier-name-wrap">
                      <span className="carrier-indicator green" />
                      <strong>Twilio Voice Bridge</strong>
                    </div>
                    <span className="carrier-status green">{carrierPings.twilio.status}</span>
                  </div>
                  <div className="carrier-metrics">
                    <div className="metric-col">
                      <span className="m-label">Roundtrip Latency</span>
                      <span className="m-val">{carrierPings.twilio.latency}</span>
                    </div>
                    <div className="metric-col">
                      <span className="m-label">Packet Loss</span>
                      <span className="m-val">{carrierPings.twilio.loss}</span>
                    </div>
                    <div className="metric-col">
                      <span className="m-label">Regions</span>
                      <span className="m-val">EU-Central & AF</span>
                    </div>
                  </div>
                </div>

                <div className="gov-card carrier-card">
                  <div className="carrier-top">
                    <div className="carrier-name-wrap">
                      <span className="carrier-indicator green" />
                      <strong>OpenAI Realtime Voice Engine</strong>
                    </div>
                    <span className="carrier-status green">{carrierPings.openai.status}</span>
                  </div>
                  <div className="carrier-metrics">
                    <div className="metric-col">
                      <span className="m-label">Inference TTFT</span>
                      <span className="m-val">{carrierPings.openai.latency}</span>
                    </div>
                    <div className="metric-col">
                      <span className="m-label">Model Endpoint</span>
                      <span className="m-val">gpt-4o-realtime</span>
                    </div>
                    <div className="metric-col">
                      <span className="m-label">Connection</span>
                      <span className="m-val">WebSocket WSS</span>
                    </div>
                  </div>
                </div>

                <div className="gov-card carrier-card">
                  <div className="carrier-top">
                    <div className="carrier-name-wrap">
                      <span className="carrier-indicator green" />
                      <strong>ElevenLabs Low-Latency TTS</strong>
                    </div>
                    <span className="carrier-status green">{carrierPings.elevenLabs.status}</span>
                  </div>
                  <div className="carrier-metrics">
                    <div className="metric-col">
                      <span className="m-label">Synthesis Latency</span>
                      <span className="m-val">{carrierPings.elevenLabs.latency}</span>
                    </div>
                    <div className="metric-col">
                      <span className="m-label">Codec Output</span>
                      <span className="m-val">PCM 24kHz / Opus</span>
                    </div>
                    <div className="metric-col">
                      <span className="m-label">Availability</span>
                      <span className="m-val">99.99%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* MODAL 1: Inspect Approval Payload & Reasoning */}
      {/* =================================================================== */}
      {selectedApproval && (
        <div className="gov-modal-overlay" onClick={() => setSelectedApproval(null)}>
          <div className="gov-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="gov-modal-header">
              <div className="modal-title-wrap">
                <TerminalSquare size={20} className="modal-icon" />
                <div>
                  <h3>Inspect High-Risk Action Payload</h3>
                  <span className="modal-sub">Request ID: {selectedApproval.id}</span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedApproval(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="gov-modal-body">
              <div className="modal-section">
                <label className="modal-label">Requested Action & Agent</label>
                <div className="modal-info-box">
                  <strong>{selectedApproval.action}</strong>
                  <p className="mt-1 text-muted">Agent: {selectedApproval.agent}</p>
                </div>
              </div>

              <div className="modal-section">
                <label className="modal-label">Agent Reasoning Chain</label>
                <div className="reasoning-box">
                  {selectedApproval.reasoningTrace || 'Autonomous agent triggered policy threshold.'}
                </div>
              </div>

              <div className="modal-section">
                <label className="modal-label">Action Execution Payload (JSON)</label>
                <pre className="payload-json-box">
                  {JSON.stringify(selectedApproval.payload || {}, null, 2)}
                </pre>
              </div>

              <div className="modal-meta-grid">
                <div>
                  <span className="meta-lbl">Session ID:</span>
                  <span className="meta-val">{selectedApproval.sessionId}</span>
                </div>
                <div>
                  <span className="meta-lbl">Risk Tier:</span>
                  <span className={`risk-pill ${selectedApproval.riskLevel}`}>
                    {selectedApproval.riskLevel?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="meta-lbl">Timestamp:</span>
                  <span className="meta-val">{new Date(selectedApproval.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="gov-modal-footer">
              {selectedApproval.status === 'pending' ? (
                <>
                  <button
                    className="gov-btn reject"
                    onClick={() => handleReject(selectedApproval.id)}
                  >
                    <X size={16} /> Reject Action
                  </button>
                  <button
                    className="gov-btn approve"
                    onClick={() => handleApprove(selectedApproval.id)}
                  >
                    <Check size={16} /> Approve & Execute
                  </button>
                </>
              ) : (
                <button
                  className="gov-btn-secondary"
                  onClick={() => setSelectedApproval(null)}
                >
                  Close Inspection
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: Simulate High-Risk Action Request */}
      {/* =================================================================== */}
      {showSimulateModal && (
        <div className="gov-modal-overlay" onClick={() => setShowSimulateModal(false)}>
          <div className="gov-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="gov-modal-header">
              <div className="modal-title-wrap">
                <Plus size={20} className="modal-icon" />
                <div>
                  <h3>Simulate Agent Action Request</h3>
                  <span className="modal-sub">Create a test request to test human-in-the-loop workflows</span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowSimulateModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSimulatedApproval}>
              <div className="gov-modal-body">
                <div className="form-group">
                  <label className="form-label">Select Agent</label>
                  <select
                    className="gov-form-select"
                    value={simForm.agent}
                    onChange={(e) => setSimForm({ ...simForm, agent: e.target.value })}
                  >
                    <option value="Billing Specialist">Billing Specialist</option>
                    <option value="Telephony Security Bot">Telephony Security Bot</option>
                    <option value="Knowledge Base Sync">Knowledge Base Sync</option>
                    <option value="Customer Retention Bot">Customer Retention Bot</option>
                    <option value="Outbound Campaign Bot">Outbound Campaign Bot</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Action Title *</label>
                  <input
                    type="text"
                    className="gov-form-input"
                    value={simForm.action}
                    onChange={(e) => setSimForm({ ...simForm, action: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Action Details & Justification *</label>
                  <textarea
                    rows={3}
                    className="gov-form-textarea"
                    value={simForm.details}
                    onChange={(e) => setSimForm({ ...simForm, details: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Risk Level</label>
                    <select
                      className="gov-form-select"
                      value={simForm.riskLevel}
                      onChange={(e) => setSimForm({ ...simForm, riskLevel: e.target.value })}
                    >
                      <option value="medium">Medium Risk</option>
                      <option value="high">High Risk</option>
                      <option value="critical">Critical Risk</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Caller / Session Reference</label>
                    <input
                      type="text"
                      className="gov-form-input"
                      value={simForm.callerPhone}
                      onChange={(e) => setSimForm({ ...simForm, callerPhone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="gov-modal-footer">
                <button
                  type="button"
                  className="gov-btn-ghost"
                  onClick={() => setShowSimulateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="gov-btn-secondary">
                  <Plus size={15} /> Inject Test Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: Configure Policy Parameters */}
      {/* =================================================================== */}
      {selectedPolicyConfig && (
        <div className="gov-modal-overlay" onClick={() => setSelectedPolicyConfig(null)}>
          <div className="gov-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="gov-modal-header">
              <div className="modal-title-wrap">
                <Sliders size={20} className="modal-icon" />
                <div>
                  <h3>Configure Guardrail: {selectedPolicyConfig.name}</h3>
                  <span className="modal-sub">Category: {selectedPolicyConfig.category}</span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedPolicyConfig(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="gov-modal-body">
              <div className="form-group">
                <label className="form-label">Policy Description</label>
                <textarea
                  rows={2}
                  className="gov-form-textarea"
                  value={selectedPolicyConfig.desc}
                  onChange={(e) => setSelectedPolicyConfig({ ...selectedPolicyConfig, desc: e.target.value })}
                />
              </div>

              {/* Dynamic Parameter Fields */}
              {selectedPolicyConfig.category === 'Financial' && (
                <div className="form-group">
                  <label className="form-label">Autonomous Refund Cap ($ USD)</label>
                  <input
                    type="number"
                    step="5"
                    className="gov-form-input"
                    value={selectedPolicyConfig.parameters?.capAmountUSD || 50}
                    onChange={(e) =>
                      setSelectedPolicyConfig({
                        ...selectedPolicyConfig,
                        parameters: {
                          ...selectedPolicyConfig.parameters,
                          capAmountUSD: parseFloat(e.target.value) || 0
                        }
                      })
                    }
                  />
                  <span className="form-help">Any refund exceeding this amount triggers a human supervisor approval.</span>
                </div>
              )}

              {selectedPolicyConfig.category === 'Cost Control' && (
                <div className="form-group">
                  <label className="form-label">Max Call Duration (Minutes)</label>
                  <input
                    type="number"
                    step="1"
                    className="gov-form-input"
                    value={selectedPolicyConfig.parameters?.maxMinutes || 15}
                    onChange={(e) =>
                      setSelectedPolicyConfig({
                        ...selectedPolicyConfig,
                        parameters: {
                          ...selectedPolicyConfig.parameters,
                          maxMinutes: parseInt(e.target.value, 10) || 15
                        }
                      })
                    }
                  />
                  <span className="form-help">Automatically transfers caller to human support queue once threshold is reached.</span>
                </div>
              )}

              {selectedPolicyConfig.category === 'Compliance' && (
                <div className="form-group">
                  <label className="form-label">Protected Entity / Competitor Keywords (Comma-separated)</label>
                  <input
                    type="text"
                    className="gov-form-input"
                    value={
                      Array.isArray(selectedPolicyConfig.parameters?.blockedCompetitors)
                        ? selectedPolicyConfig.parameters.blockedCompetitors.join(', ')
                        : 'CompetitorX, VoiceAI Direct, LegacyCall'
                    }
                    onChange={(e) =>
                      setSelectedPolicyConfig({
                        ...selectedPolicyConfig,
                        parameters: {
                          ...selectedPolicyConfig.parameters,
                          blockedCompetitors: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        }
                      })
                    }
                  />
                  <span className="form-help">Agent will pivot smoothly without evaluating competitor claims.</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Enforcement Status</label>
                <div className="flex-row items-center gap-3">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={selectedPolicyConfig.enabled}
                      onChange={(e) => setSelectedPolicyConfig({ ...selectedPolicyConfig, enabled: e.target.checked })}
                    />
                    <span className="toggle-slider" />
                  </label>
                  <span className="text-sm font-semibold">
                    {selectedPolicyConfig.enabled ? 'Enforced in Real-Time Telephony' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            <div className="gov-modal-footer">
              <button
                type="button"
                className="gov-btn-ghost"
                onClick={() => setSelectedPolicyConfig(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="gov-btn-secondary"
                onClick={() => handleSavePolicyConfig(selectedPolicyConfig)}
              >
                Save Policy Parameters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 4: Add Custom Guardrail Policy */}
      {/* =================================================================== */}
      {showNewPolicyModal && (
        <div className="gov-modal-overlay" onClick={() => setShowNewPolicyModal(false)}>
          <div className="gov-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="gov-modal-header">
              <div className="modal-title-wrap">
                <Plus size={20} className="modal-icon" />
                <div>
                  <h3>Add Custom Guardrail Policy</h3>
                  <span className="modal-sub">Define real-time conversational constraints</span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowNewPolicyModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePolicy}>
              <div className="gov-modal-body">
                <div className="form-group">
                  <label className="form-label">Policy Name *</label>
                  <input
                    type="text"
                    className="gov-form-input"
                    placeholder="e.g. VIP Customer De-escalation Protocol"
                    value={newPolicyForm.name}
                    onChange={(e) => setNewPolicyForm({ ...newPolicyForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="gov-form-select"
                    value={newPolicyForm.category}
                    onChange={(e) => setNewPolicyForm({ ...newPolicyForm, category: e.target.value })}
                  >
                    <option value="Safety">Safety</option>
                    <option value="Privacy">Privacy</option>
                    <option value="Compliance">Compliance</option>
                    <option value="Financial">Financial</option>
                    <option value="Cost Control">Cost Control</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Policy Rule & Description *</label>
                  <textarea
                    rows={3}
                    className="gov-form-textarea"
                    placeholder="Describe what the agent must do or avoid when this policy is triggered..."
                    value={newPolicyForm.desc}
                    onChange={(e) => setNewPolicyForm({ ...newPolicyForm, desc: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <div className="flex-row items-center gap-3">
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={newPolicyForm.enabled}
                        onChange={(e) => setNewPolicyForm({ ...newPolicyForm, enabled: e.target.checked })}
                      />
                      <span className="toggle-slider" />
                    </label>
                    <span className="text-sm font-semibold">Enable Immediately Upon Creation</span>
                  </div>
                </div>
              </div>

              <div className="gov-modal-footer">
                <button
                  type="button"
                  className="gov-btn-ghost"
                  onClick={() => setShowNewPolicyModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="gov-btn-secondary">
                  Create Guardrail
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 5: Inspect RAG Grounding Log */}
      {/* =================================================================== */}
      {selectedAudit && (
        <div className="gov-modal-overlay" onClick={() => setSelectedAudit(null)}>
          <div className="gov-modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="gov-modal-header">
              <div className="modal-title-wrap">
                <FileCheck size={20} className="modal-icon text-green-400" />
                <div>
                  <h3>RAG Vector Grounding Inspection</h3>
                  <span className="modal-sub">Evaluation ID: {selectedAudit.id} • Sampled at {selectedAudit.timestamp}</span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedAudit(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="gov-modal-body">
              <div className="audit-detail-grid">
                <div className="audit-detail-box">
                  <label className="modal-label">Customer Query</label>
                  <p className="font-semibold text-main">{selectedAudit.query}</p>
                </div>

                <div className="audit-detail-box">
                  <label className="modal-label">Agent Response</label>
                  <p className="font-semibold text-main">{selectedAudit.response}</p>
                </div>
              </div>

              <div className="metrics-pill-row mt-3">
                <div className="metric-pill-item">
                  <span className="lbl">Model Confidence:</span>
                  <span className="val text-green-400">{(selectedAudit.confidence * 100).toFixed(1)}%</span>
                </div>
                <div className="metric-pill-item">
                  <span className="lbl">Vector Cosine Distance:</span>
                  <span className="val text-blue-400">{selectedAudit.vectorDistance || '0.038'} (Threshold: &lt; 0.15)</span>
                </div>
                <div className="metric-pill-item">
                  <span className="lbl">Status:</span>
                  <span className="status-pill passed">
                    <CheckCircle2 size={13} /> {selectedAudit.status}
                  </span>
                </div>
              </div>

              <div className="modal-section mt-4">
                <label className="modal-label">Retrieved pgvector Knowledge Base Chunks</label>
                <div className="retrieved-chunks-list">
                  {selectedAudit.retrievedChunks && selectedAudit.retrievedChunks.length > 0 ? (
                    selectedAudit.retrievedChunks.map((chunk, idx) => (
                      <div key={idx} className="chunk-card">
                        <div className="chunk-source-header">
                          <FileText size={14} className="text-amber-400" />
                          <strong>Source: {chunk.source}</strong>
                        </div>
                        <p className="chunk-snippet">"{chunk.snippet}"</p>
                      </div>
                    ))
                  ) : (
                    <div className="chunk-card">
                      <div className="chunk-source-header">
                        <FileText size={14} className="text-amber-400" />
                        <strong>Source: tenant_general_faq_v2.pdf</strong>
                      </div>
                      <p className="chunk-snippet">
                        "Document chunk verified with 100% lexical match against customer query context."
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="gov-modal-footer">
              <button
                className="gov-btn-secondary"
                onClick={() => setSelectedAudit(null)}
              >
                Close Grounding Deep-Dive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 6: Emergency Kill-Switch Confirmation */}
      {/* =================================================================== */}
      {showKillSwitchModal && (
        <div className="gov-modal-overlay" onClick={() => setShowKillSwitchModal(false)}>
          <div className="gov-modal-content danger-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gov-modal-header danger-header">
              <div className="modal-title-wrap">
                <AlertTriangle size={24} className="modal-icon-danger" />
                <div>
                  <h3>Engage Emergency Telephony Kill-Switch?</h3>
                  <span className="modal-sub">CRITICAL SYSTEM OVERRIDE</span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowKillSwitchModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="gov-modal-body">
              <div className="danger-warning-box">
                <p>
                  <strong>Immediate Effect:</strong> All active AI telephony agents will be instantly paused.
                  Any live calls will be gracefully transferred to backup human IVR or PSTN queue.
                </p>
                <p className="mt-2">
                  No automated outbound campaigns will dial until the kill-switch is manually disengaged by a supervisor.
                </p>
              </div>

              <div className="form-group mt-3">
                <label className="form-label">Authorized Supervisor Confirmation</label>
                <input
                  type="text"
                  className="gov-form-input"
                  value="Demo Developer (Account Owner)"
                  disabled
                />
              </div>
            </div>

            <div className="gov-modal-footer">
              <button
                className="gov-btn-ghost"
                onClick={() => setShowKillSwitchModal(false)}
              >
                Cancel & Keep AI Running
              </button>
              <button
                className="emergency-confirm-btn"
                onClick={handleEngageKillSwitch}
              >
                <Zap size={16} /> Yes, Engage Emergency Kill-Switch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 7: Disengage Emergency Kill-Switch Confirmation */}
      {/* =================================================================== */}
      {showDisengageModal && (
        <div className="gov-modal-overlay" onClick={() => setShowDisengageModal(false)}>
          <div className="gov-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="gov-modal-header">
              <div className="modal-title-wrap">
                <RotateCcw size={22} className="modal-icon text-green-400" />
                <div>
                  <h3>Disengage Kill-Switch & Resume AI Telephony</h3>
                  <span className="modal-sub">Restore Normal Operations</span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowDisengageModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="gov-modal-body">
              <p className="text-muted">
                Disengaging the emergency kill-switch will restore automated call answering and outbound calling for all active AI agents.
              </p>
              <div className="modal-info-box mt-3">
                <span className="text-sm font-semibold">Active Agents Ready:</span>
                <span className="text-sm text-green-400 ml-2">4 Agents verified healthy</span>
              </div>
            </div>

            <div className="gov-modal-footer">
              <button
                className="gov-btn-ghost"
                onClick={() => setShowDisengageModal(false)}
              >
                Keep Kill-Switch Engaged
              </button>
              <button
                className="gov-btn approve"
                onClick={handleDisengageKillSwitch}
              >
                <Check size={16} /> Disengage & Restore AI Telephony
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 8: SLA & Telemetry Configuration */}
      {/* =================================================================== */}
      {showSlaConfigModal && (
        <div className="gov-modal-overlay" onClick={() => setShowSlaConfigModal(false)}>
          <div className="gov-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="gov-modal-header">
              <div className="modal-title-wrap">
                <Settings2 size={20} className="modal-icon" />
                <div>
                  <h3>Configure Service SLAs & Alerts</h3>
                  <span className="modal-sub">Adjust telephony latency thresholds & sentiment triggers</span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowSlaConfigModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="gov-modal-body">
              <div className="form-group">
                <label className="form-label">Telephony Audio Latency SLA Target (ms)</label>
                <input
                  type="number"
                  step="10"
                  className="gov-form-input"
                  value={slaConfig.latencyThresholdMs}
                  onChange={(e) =>
                    setSlaConfig({
                      ...slaConfig,
                      latencyThresholdMs: parseInt(e.target.value, 10) || 200
                    })
                  }
                />
                <span className="form-help">Current WebSocket stream is clocking at 118 ms.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Auto-Human Escalation Sentiment Score (1.0 to 5.0)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="5.0"
                  className="gov-form-input"
                  value={slaConfig.sentimentThreshold}
                  onChange={(e) =>
                    setSlaConfig({
                      ...slaConfig,
                      sentimentThreshold: parseFloat(e.target.value) || 2.0
                    })
                  }
                />
                <span className="form-help">Calls dropping below this real-time sentiment score auto-route to human supervisor.</span>
              </div>
            </div>

            <div className="gov-modal-footer">
              <button
                className="gov-btn-ghost"
                onClick={() => setShowSlaConfigModal(false)}
              >
                Cancel
              </button>
              <button
                className="gov-btn-secondary"
                onClick={() => {
                  setShowSlaConfigModal(false)
                  toast.success('SLA thresholds updated successfully', 'Thresholds Saved')
                }}
              >
                Save SLA Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Governance
