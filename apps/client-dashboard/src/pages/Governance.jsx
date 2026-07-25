import React, { useState } from 'react'
import { Shield, AlertTriangle, Check, X, Clock, TerminalSquare } from 'lucide-react'
import './Governance.css'

const Governance = () => {
  // Mock data representing the ApprovalQueue table in Postgres
  const [queue, setQueue] = useState([
    {
      id: 'q-1',
      agent: 'Billing Specialist',
      action: 'Issue Refund',
      details: 'Refund $45.00 to user@example.com for order #1029',
      riskLevel: 'high',
      status: 'pending',
      timestamp: new Date().toISOString()
    },
    {
      id: 'q-2',
      agent: 'Security Bot',
      action: 'Block IP Range',
      details: 'Detected 500 failed logins from 192.168.1.0/24',
      riskLevel: 'critical',
      status: 'pending',
      timestamp: new Date(Date.now() - 3600000).toISOString()
    }
  ])

  const handleAction = (id, action) => {
    setQueue(queue.map(q => q.id === id ? { ...q, status: action } : q))
  }

  return (
    <div className="governance-page">
      <header className="page-header">
        <h1>AI Governance & Approvals</h1>
        <p>Human-in-the-loop oversight for high-risk AI agent actions.</p>
      </header>

      <div className="governance-dashboard">
        <div className="metrics-row">
          <div className="metric-box">
            <span className="metric-title">Pending Approvals</span>
            <span className="metric-value text-amber-500">{queue.filter(q => q.status === 'pending').length}</span>
          </div>
          <div className="metric-box">
            <span className="metric-title">Auto-Rejected (Guardrails)</span>
            <span className="metric-value text-red-500">12</span>
          </div>
          <div className="metric-box">
            <span className="metric-title">Approved Today</span>
            <span className="metric-value text-green-500">45</span>
          </div>
        </div>

        <div className="approval-queue-section">
          <h2><Shield className="inline-icon" /> Action Approval Queue</h2>
          
          <div className="queue-list">
            {queue.map(item => (
              <div key={item.id} className={`queue-card ${item.status !== 'pending' ? 'resolved' : ''}`}>
                <div className="card-top">
                  <div className="agent-info">
                    <TerminalSquare size={20} />
                    <strong>{item.agent}</strong>
                  </div>
                  <div className={`risk-badge ${item.riskLevel}`}>
                    <AlertTriangle size={14} /> {item.riskLevel.toUpperCase()} RISK
                  </div>
                </div>
                
                <div className="action-details">
                  <h3>{item.action}</h3>
                  <p>{item.details}</p>
                  <span className="timestamp"><Clock size={12} /> {new Date(item.timestamp).toLocaleString()}</span>
                </div>

                {item.status === 'pending' ? (
                  <div className="action-buttons">
                    <button onClick={() => handleAction(item.id, 'rejected')} className="btn-reject">
                      <X size={16} /> Reject
                    </button>
                    <button onClick={() => handleAction(item.id, 'approved')} className="btn-approve">
                      <Check size={16} /> Approve & Execute
                    </button>
                  </div>
                ) : (
                  <div className={`resolution-banner ${item.status}`}>
                    {item.status === 'approved' ? 'Action Approved' : 'Action Rejected'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Governance
