import React, { useState, useEffect } from 'react'
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
  Info
} from 'lucide-react'
import { getGovernanceSummary } from '../api/client'
import './Governance.css'

const Governance = () => {
  const [activeTab, setActiveTab] = useState('approvals')

  // Mock initial approval queue
  const [queue, setQueue] = useState([
    {
      id: 'q-1',
      agent: 'Billing Specialist',
      action: 'Issue Customer Refund',
      details: 'Refund $45.00 to user@example.com for order #1029 (Exceeds $30 auto-threshold)',
      riskLevel: 'high',
      status: 'pending',
      timestamp: new Date().toISOString()
    },
    {
      id: 'q-2',
      agent: 'Telephony Security Bot',
      action: 'Block Inbound IP Subnet',
      details: 'Detected 500 automated call spikes from 192.168.1.0/24 within 3 minutes',
      riskLevel: 'critical',
      status: 'pending',
      timestamp: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'q-3',
      agent: 'Knowledge Base Sync',
      action: 'Deprecate Legacy FAQ Document',
      details: 'Replace "2024_Return_Policy.pdf" with "2026_Global_Return_Terms.pdf"',
      riskLevel: 'medium',
      status: 'pending',
      timestamp: new Date(Date.now() - 7200000).toISOString()
    }
  ])

  // Safety Guardrail Policies state
  const [policies, setPolicies] = useState([
    {
      id: 'p-1',
      name: 'PII & Financial Data Redaction',
      desc: 'Automatically mask SSN, credit card numbers, and passwords in transcripts and logs.',
      enabled: true,
      category: 'Privacy'
    },
    {
      id: 'p-2',
      name: 'Profanity & Toxicity Shield',
      desc: 'Intercept abusive language and smoothly transition to neutral escalation scripts.',
      enabled: true,
      category: 'Safety'
    },
    {
      id: 'p-3',
      name: 'Off-Topic Boundary Enforcement',
      desc: 'Prevent AI agents from discussing topics outside defined knowledge base scope.',
      enabled: true,
      category: 'Compliance'
    },
    {
      id: 'p-4',
      name: 'Competitor Mention Blocker',
      desc: 'Restrict agents from agreeing with or evaluating competitor pricing claims.',
      enabled: true,
      category: 'Compliance'
    },
    {
      id: 'p-5',
      name: 'Max Spend Cap Per Call',
      desc: 'Trigger human transfer if an individual call duration exceeds 15 minutes.',
      enabled: false,
      category: 'Cost Control'
    },
    {
      id: 'p-6',
      name: 'Autonomous Refund Cap ($50.00)',
      desc: 'Require human approval for any agent action involving funds > $50.00.',
      enabled: true,
      category: 'Financial'
    }
  ])

  // Hallucination & Audit log data
  const [hallucinationLogs] = useState([
    {
      id: 'h-1',
      agent: 'Inbound Support Agent',
      query: 'Does Markova support PSTN SIP trunks in EMEA?',
      response: 'Yes, Markova supports native SIP peering across EU data centers with SLA guarantees.',
      confidence: 0.98,
      hallucinationScore: 0.01,
      status: 'Passed'
    },
    {
      id: 'h-2',
      agent: 'Sales Qualifier',
      query: 'Can I get a 90% discount for non-profit organizations?',
      response: 'Special non-profit pricing is available upon review by our sales team.',
      confidence: 0.94,
      hallucinationScore: 0.03,
      status: 'Passed'
    }
  ])

  const [metrics, setMetrics] = useState({ agents: 0, keys: 0 })

  useEffect(() => {
    getGovernanceSummary()
      .then(({ data }) => {
        setMetrics({
          agents: data.agents?.length || 4,
          keys: data.keys?.length || 3
        })
      })
      .catch(() => {
        setMetrics({ agents: 4, keys: 3 })
      })
  }, [])

  const handleAction = (id, newStatus) => {
    setQueue(prev =>
      prev.map(item => (item.id === id ? { ...item, status: newStatus } : item))
    )
  }

  const togglePolicy = (id) => {
    setPolicies(prev =>
      prev.map(p => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    )
  }

  const pendingApprovalsCount = queue.filter(q => q.status === 'pending').length
  const activePoliciesCount = policies.filter(p => p.enabled).length

  return (
    <div className="governance-page">
      {/* Top Header */}
      <div className="governance-header">
        <div>
          <h1>AI Governance & Safety Command</h1>
          <p className="subtitle">
            Human-in-the-loop oversight, guardrail compliance, hallucination tracking, and SLA safety controls.
          </p>
        </div>

        <div className="system-status-badge">
          <CheckCircle2 size={16} className="text-green-400" />
          <span>Governance Engine Online</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="gov-metrics-grid">
        <div className="gov-metric-card amber">
          <div className="metric-icon-wrap">
            <AlertTriangle size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Pending Approvals</span>
            <span className="metric-val">{pendingApprovalsCount}</span>
          </div>
        </div>

        <div className="gov-metric-card blue">
          <div className="metric-icon-wrap">
            <Shield size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Active Guardrails</span>
            <span className="metric-val">{activePoliciesCount} / {policies.length}</span>
          </div>
        </div>

        <div className="gov-metric-card green">
          <div className="metric-icon-wrap">
            <FileCheck size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Hallucination Rate</span>
            <span className="metric-val text-green-400">0.02%</span>
          </div>
        </div>

        <div className="gov-metric-card purple">
          <div className="metric-icon-wrap">
            <Activity size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">SLA Compliance</span>
            <span className="metric-val">99.98%</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="gov-tabs-container">
        <button
          className={`gov-tab ${activeTab === 'approvals' ? 'active' : ''}`}
          onClick={() => setActiveTab('approvals')}
        >
          <Shield size={16} /> Human Approvals
          {pendingApprovalsCount > 0 && (
            <span className="gov-badge-count">{pendingApprovalsCount}</span>
          )}
        </button>

        <button
          className={`gov-tab ${activeTab === 'guardrails' ? 'active' : ''}`}
          onClick={() => setActiveTab('guardrails')}
        >
          <Lock size={16} /> Guardrails & Safety
        </button>

        <button
          className={`gov-tab ${activeTab === 'audits' ? 'active' : ''}`}
          onClick={() => setActiveTab('audits')}
        >
          <FileCheck size={16} /> Hallucination & Audits
        </button>

        <button
          className={`gov-tab ${activeTab === 'slas' ? 'active' : ''}`}
          onClick={() => setActiveTab('slas')}
        >
          <Activity size={16} /> Service SLAs & Risk
        </button>
      </div>

      {/* Tab Content */}
      <div className="gov-content-wrapper">
        {/* Tab 1: Human Approvals Queue */}
        {activeTab === 'approvals' && (
          <div className="approvals-section">
            <div className="section-intro">
              <h2>Human-in-the-Loop Action Approvals</h2>
              <p>Review high-risk actions requested by AI Agents before execution.</p>
            </div>

            <div className="queue-cards-grid">
              {queue.map(item => (
                <div
                  key={item.id}
                  className={`gov-card approval-card ${item.status !== 'pending' ? 'resolved' : ''}`}
                >
                  <div className="card-header-row">
                    <div className="agent-title-wrap">
                      <TerminalSquare size={18} className="agent-icon" />
                      <strong>{item.agent}</strong>
                    </div>

                    <span className={`risk-pill ${item.riskLevel}`}>
                      <AlertTriangle size={12} /> {item.riskLevel.toUpperCase()} RISK
                    </span>
                  </div>

                  <div className="card-body">
                    <h3>{item.action}</h3>
                    <p>{item.details}</p>
                    <span className="time-stamp">
                      <Clock size={13} /> Requested {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {item.status === 'pending' ? (
                    <div className="card-action-bar">
                      <button
                        className="gov-btn reject"
                        onClick={() => handleAction(item.id, 'rejected')}
                      >
                        <X size={16} /> Reject Action
                      </button>
                      <button
                        className="gov-btn approve"
                        onClick={() => handleAction(item.id, 'approved')}
                      >
                        <Check size={16} /> Approve & Execute
                      </button>
                    </div>
                  ) : (
                    <div className={`status-banner ${item.status}`}>
                      {item.status === 'approved' ? (
                        <>
                          <CheckCircle2 size={16} /> Action Approved & Executed
                        </>
                      ) : (
                        <>
                          <AlertCircle size={16} /> Action Rejected by Supervisor
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Safety Guardrails */}
        {activeTab === 'guardrails' && (
          <div className="guardrails-section">
            <div className="section-intro">
              <h2>AI Agent Safety Guardrails</h2>
              <p>Configure automated system boundaries and compliance policy filters.</p>
            </div>

            <div className="policies-grid">
              {policies.map(p => (
                <div key={p.id} className="gov-card policy-card">
                  <div className="policy-main">
                    <div className="policy-header">
                      <span className="category-chip">{p.category}</span>
                      <h3>{p.name}</h3>
                    </div>
                    <p>{p.desc}</p>
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

        {/* Tab 3: Hallucination & Knowledge Audits */}
        {activeTab === 'audits' && (
          <div className="audits-section">
            <div className="section-intro">
              <h2>Knowledge Grounding & Hallucination Audits</h2>
              <p>Automated evaluation checking RAG vector grounding accuracy and response fidelity.</p>
            </div>

            <div className="audits-summary-row">
              <div className="gov-card audit-stat-box">
                <span className="label">Knowledge Verification Score</span>
                <span className="value text-green-400">99.8%</span>
                <span className="subtext">Vector distance threshold &lt; 0.15</span>
              </div>
              <div className="gov-card audit-stat-box">
                <span className="label">Evaluation Engine</span>
                <span className="value text-blue-400">G-Eval v4.2</span>
                <span className="subtext">Real-time sampling active</span>
              </div>
              <div className="gov-card audit-stat-box">
                <span className="label">Stale Document Warnings</span>
                <span className="value text-amber-400">1 Document</span>
                <span className="subtext">Requires re-indexing</span>
              </div>
            </div>

            <div className="gov-card audit-logs-card">
              <h3>Recent Evaluation Logs</h3>
              <div className="logs-table-wrapper">
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Customer Query</th>
                      <th>AI Response</th>
                      <th>Confidence</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hallucinationLogs.map(log => (
                      <tr key={log.id}>
                        <td className="font-semibold">{log.agent}</td>
                        <td className="text-muted">{log.query}</td>
                        <td className="text-muted">{log.response}</td>
                        <td>
                          <span className="confidence-pill">
                            {(log.confidence * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td>
                          <span className="status-pill passed">
                            <CheckCircle2 size={13} /> {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Service SLAs & Operational Risk */}
        {activeTab === 'slas' && (
          <div className="slas-section">
            <div className="section-intro">
              <h2>Service SLAs & Operational Risk Controls</h2>
              <p>Real-time telemetry, latency thresholds, and emergency kill-switch controls.</p>
            </div>

            <div className="sla-cards-grid">
              <div className="gov-card sla-card">
                <div className="sla-card-header">
                  <Activity size={20} className="icon-blue" />
                  <h3>Telephony Audio Latency</h3>
                </div>
                <div className="sla-card-body">
                  <div className="sla-value">118 ms</div>
                  <p className="text-muted">Target SLA: &lt; 200 ms (WebSocket Opus Stream)</p>
                  <div className="progress-bar-track">
                    <div className="progress-fill green" style={{ width: '59%' }} />
                  </div>
                </div>
              </div>

              <div className="gov-card sla-card">
                <div className="sla-card-header">
                  <UserCheck size={20} className="icon-green" />
                  <h3>Auto-Human Escalation Trigger</h3>
                </div>
                <div className="sla-card-body">
                  <div className="sla-value">Sentiment &lt; 2.0 / 5.0</div>
                  <p className="text-muted">Automatically routes live call to supervisor queue</p>
                  <span className="status-pill active">
                    <CheckCircle2 size={13} /> Active Trigger
                  </span>
                </div>
              </div>

              <div className="gov-card sla-card emergency">
                <div className="sla-card-header">
                  <Zap size={20} className="icon-red" />
                  <h3>Emergency Agent Kill-Switch</h3>
                </div>
                <div className="sla-card-body">
                  <p className="text-muted">
                    Instantly pause all active AI telephony bots and route incoming calls to backup IVR.
                  </p>
                  <button className="emergency-btn">
                    <AlertTriangle size={16} /> Engage Kill-Switch
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Governance
