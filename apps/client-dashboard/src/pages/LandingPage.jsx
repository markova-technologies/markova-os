import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Bot,
  Sparkles,
  CheckCircle2,
  Play,
  Database,
  Cpu,
  Layers,
  ShieldCheck,
  Zap,
  Check,
  Send,
  Workflow,
  Sliders,
  BarChart3,
  ExternalLink,
  ChevronRight,
  Activity
} from 'lucide-react'
import PublicHeader from '../components/PublicHeader'
import { ROUTES } from '../config/site'
import { enterDemoMode } from '../api/client'
import './LandingPage.css'

const LandingPage = () => {
  const navigate = useNavigate()

  // Interactive Live Chat Demo State
  const [activePromptIndex, setActivePromptIndex] = useState(0)
  const [customInput, setCustomInput] = useState('')
  const [messages, setMessages] = useState([
    { role: 'user', content: 'Is my order #4829 ready for dispatch?' },
    {
      role: 'ai',
      content:
        '🔍 Commander AI routed to Logistics Agent → Querying ERP Database...\n\n✅ Order #4829 is packaged and scheduled for carrier dispatch today at 4:30 PM. Tracking code #TRK-8831 active.'
    }
  ])
  const [isTyping, setIsTyping] = useState(false)

  // Demo Prompt Pill Options
  const samplePrompts = [
    { title: 'Order Status', query: 'Is my order ready?' },
    { title: 'Book Appointment', query: 'Schedule a call with sales demo tomorrow at 2 PM.' },
    { title: 'Refund Policy', query: 'What is the refund SLA for enterprise plans?' }
  ]

  const handleSelectPill = (index) => {
    setActivePromptIndex(index)
    const selected = samplePrompts[index]
    runDemoQuery(selected.query)
  }

  const runDemoQuery = (queryText) => {
    if (!queryText.trim() || isTyping) return
    const userMsg = { role: 'user', content: queryText }
    setMessages((prev) => [...prev, userMsg])
    setIsTyping(true)

    setTimeout(() => {
      let responseText = ''
      if (queryText.toLowerCase().includes('order') || queryText.toLowerCase().includes('ready')) {
        responseText = '⚡ Logistics AI Agent accessed ERP System → Order status verified. Ready for dispatch!'
      } else if (queryText.toLowerCase().includes('schedule') || queryText.toLowerCase().includes('appointment') || queryText.toLowerCase().includes('book')) {
        responseText = '📅 Calendar AI Agent synced → Slot confirmed for tomorrow at 2:00 PM EST. Calendar invite dispatched!'
      } else {
        responseText = '🛡️ Governance & Knowledge AI scanned policy vault → Enterprise refunds are processed within 24 hours under SLA Section 4.'
      }

      setMessages((prev) => [...prev, { role: 'ai', content: responseText }])
      setIsTyping(false)
    }, 800)
  }

  const handleSendCustom = (e) => {
    e.preventDefault()
    if (!customInput.trim()) return
    runDemoQuery(customInput)
    setCustomInput('')
  }

  const handleDemoMode = () => {
    enterDemoMode()
    navigate(ROUTES.app)
  }

  // Interactive Live Workforce Simulation State
  const [simState, setSimState] = useState('idle')

  const triggerSimulation = () => {
    setSimState('running')
    setTimeout(() => {
      setSimState('completed')
    }, 2500)
  }

  return (
    <div className="landing-page">
      {/* Shared Public Top Navigation Bar */}
      <PublicHeader />

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="hero-glow-bg" />

        <div className="landing-container" style={{ position: 'relative', zIndex: 1 }}>
          <motion.div
            className="hero-badge-pill"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Sparkles size={14} className="text-amber-400" />
            <span>Markova AI Operating System</span>
          </motion.div>

          <motion.h1
            className="hero-title-main"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
          >
            Put AI to work for <br />
            your business.
          </motion.h1>

          <motion.p
            className="hero-subhead"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            Markova gives businesses an AI workforce that can understand their operations, coordinate specialized AI workers, take real actions, and work alongside human teams.
          </motion.p>

          <motion.div
            className="hero-actions-row"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <button className="hero-btn-primary" onClick={handleDemoMode}>
              <span>See Markova in action</span>
              <ArrowRight size={18} />
            </button>
            <button className="hero-btn-secondary" onClick={handleDemoMode}>
              <Play size={16} />
              <span>See Demo</span>
            </button>
          </motion.div>

          {/* Key Metrics Cards */}
          <motion.div
            className="hero-stats-grid"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <div className="stat-card">
              <div className="stat-number">125</div>
              <div className="stat-label">Projects Automated</div>
            </div>

            <div className="stat-card">
              <div className="stat-number">240%</div>
              <div className="stat-label">ROI Increase</div>
            </div>

            <div className="stat-card">
              <div className="stat-number">24/7</div>
              <div className="stat-label">Hour Support</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Markova OS Platform Section ─────────────────────────────────── */}
      <section className="landing-pillars-section">
        <div className="landing-container">
          <div className="section-header">
            <span className="section-tag">Platform Foundation</span>
            <h2 className="section-title">Markova OS Platform</h2>
            <p className="section-subtitle">
              One OS. An Entire AI Workforce. Markova provides the foundation to seamlessly bring AI workers into your everyday business operations.
            </p>
          </div>

          <div className="pillars-grid">
            {/* Pillar 1: Agents */}
            <div className="pillar-card">
              <div>
                <div className="pillar-icon-box">
                  <Bot size={24} />
                </div>
                <h3 className="pillar-title">Agents</h3>
                <p className="pillar-desc">
                  AI workers that perform specialized roles tailored to your business needs.
                </p>
              </div>
              <Link to={ROUTES.agentStudio} className="pillar-link">
                <span>Explore Agents</span> <ChevronRight size={16} />
              </Link>
            </div>

            {/* Pillar 2: Knowledge */}
            <div className="pillar-card">
              <div>
                <div className="pillar-icon-box">
                  <Database size={24} />
                </div>
                <h3 className="pillar-title">Knowledge</h3>
                <p className="pillar-desc">
                  The deep operational information and documentation agents need to understand the business.
                </p>
              </div>
              <Link to={ROUTES.knowledge} className="pillar-link">
                <span>Sync Knowledge</span> <ChevronRight size={16} />
              </Link>
            </div>

            {/* Pillar 3: Tools */}
            <div className="pillar-card">
              <div>
                <div className="pillar-icon-box">
                  <Cpu size={24} />
                </div>
                <h3 className="pillar-title">Tools</h3>
                <p className="pillar-desc">
                  The systems, API connectors, and execution actions agents can access in real time.
                </p>
              </div>
              <Link to={ROUTES.integrations} className="pillar-link">
                <span>View Integrations</span> <ChevronRight size={16} />
              </Link>
            </div>

            {/* Pillar 4: Workflows */}
            <div className="pillar-card">
              <div>
                <div className="pillar-icon-box">
                  <Workflow size={24} />
                </div>
                <h3 className="pillar-title">Workflows</h3>
                <p className="pillar-desc">
                  How multiple autonomous agents collaborate, hand off tasks, and execute complex work.
                </p>
              </div>
              <Link to={ROUTES.app} className="pillar-link">
                <span>See Orchestration</span> <ChevronRight size={16} />
              </Link>
            </div>

            {/* Pillar 5: Control */}
            <div className="pillar-card">
              <div>
                <div className="pillar-icon-box">
                  <Sliders size={24} />
                </div>
                <h3 className="pillar-title">Control</h3>
                <p className="pillar-desc">
                  How businesses monitor, manage, audit, and govern their AI workforce safely.
                </p>
              </div>
              <Link to={ROUTES.governance} className="pillar-link">
                <span>Governance Controls</span> <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Interactive Try It Live Demo Section ───────────────────────── */}
      <section className="landing-demo-section">
        <div className="landing-container">
          <div className="section-header">
            <span className="section-tag">Live Experience</span>
            <h2 className="section-title">Chatbots answer. AI Workforces operate.</h2>
            <p className="section-subtitle">Try it live — Experience the difference</p>
          </div>

          <div className="demo-flex-layout">
            <div className="demo-left-info">
              <h3>Markova helps businesses build AI agents that can:</h3>
              <ul className="capabilities-list">
                <li className="capability-item">
                  <div className="capability-check-icon"><Check size={14} /></div>
                  <span>Understand company knowledge</span>
                </li>
                <li className="capability-item">
                  <div className="capability-check-icon"><Check size={14} /></div>
                  <span>Communicate with customers</span>
                </li>
                <li className="capability-item">
                  <div className="capability-check-icon"><Check size={14} /></div>
                  <span>Use business tools</span>
                </li>
                <li className="capability-item">
                  <div className="capability-check-icon"><Check size={14} /></div>
                  <span>Connect to existing software</span>
                </li>
                <li className="capability-item">
                  <div className="capability-check-icon"><Check size={14} /></div>
                  <span>Execute tasks</span>
                </li>
                <li className="capability-item">
                  <div className="capability-check-icon"><Check size={14} /></div>
                  <span>Work together with other AI agents</span>
                </li>
              </ul>

              <div className="demo-pills-row">
                {samplePrompts.map((p, idx) => (
                  <button
                    key={p.title}
                    className={`demo-pill ${activePromptIndex === idx ? 'active' : ''}`}
                    onClick={() => handleSelectPill(idx)}
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Terminal Simulator */}
            <div className="demo-chat-box">
              <div className="chat-box-header">
                <div className="chat-header-title">
                  <Bot size={18} />
                  <span>Markova Agent Operations Terminal</span>
                </div>
                <span className="live-pulse-badge">
                  <span className="beacon-ring" /> Active Demo
                </span>
              </div>

              <div className="chat-messages-scroll">
                {messages.map((m, index) => (
                  <div key={index} className={`chat-msg ${m.role}`}>
                    <div className="chat-msg-bubble">{m.content}</div>
                  </div>
                ))}
                {isTyping && (
                  <div className="chat-msg ai">
                    <div className="chat-msg-bubble">🤖 Orchestrating agents...</div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSendCustom} className="chat-input-row">
                <input
                  type="text"
                  className="chat-input-field"
                  placeholder="e.g. Is my order ready?"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                />
                <button type="submit" className="chat-send-btn">
                  <span>Ask AI</span>
                  <Send size={15} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ── Operating Model Section ──────────────────────────────────────── */}
      <section className="landing-opmodel-section">
        <div className="landing-container">
          <div className="section-header">
            <span className="section-tag">Architectural Design</span>
            <h2 className="section-title">The Markova Operating Model</h2>
            <p className="section-subtitle">
              AI that understands the business, not just the conversation. A normal AI assistant answers questions. Markova understands the business context, reasons about what needs to happen, acts inside business systems, coordinates AI workers, and remains accountable to humans.
            </p>
          </div>

          <div className="opmodel-steps-grid">
            <div className="op-step-card">
              <div className="op-step-num">01</div>
              <h3 className="op-step-title">Understand</h3>
              <p className="op-step-desc">Learn the business context</p>
            </div>

            <div className="op-step-card">
              <div className="op-step-num">02</div>
              <h3 className="op-step-title">Think</h3>
              <p className="op-step-desc">Route to the right agent</p>
            </div>

            <div className="op-step-card">
              <div className="op-step-num">03</div>
              <h3 className="op-step-title">Act</h3>
              <p className="op-step-desc">Execute inside your tools</p>
            </div>

            <div className="op-step-card active">
              <div className="op-step-num">04</div>
              <h3 className="op-step-title">Work Together</h3>
              <p className="op-step-desc">Live workforce visualization →</p>
            </div>

            <div className="op-step-card">
              <div className="op-step-num">05</div>
              <h3 className="op-step-title">Stay Accountable</h3>
              <p className="op-step-desc">Humans stay in control</p>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button className="hero-btn-primary" onClick={handleDemoMode}>
              <span>Explore the Full Operating Model</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* ── Live Workforce Visualization Component ───────────────────────── */}
      <section className="landing-vis-section">
        <div className="landing-container">
          <div className="section-header">
            <span className="section-tag">Real-Time Orchestration</span>
            <h2 className="section-title">Live Visualization</h2>
            <p className="section-subtitle">
              One business. A workforce of AI specialists. Watch in real time as the Commander AI receives a business objective and coordinates specialized agents to complete the work — no human intervention required.
            </p>
          </div>

          <div className="vis-card-wrapper">
            <div className="vis-objective-banner">
              <div className="vis-obj-left">
                <span className="vis-obj-tag">Business Objective:</span>
                <span>Business needs a weekly internal report</span>
              </div>
              <button
                className="hero-btn-secondary"
                style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                onClick={triggerSimulation}
              >
                <Play size={14} /> Run Simulation
              </button>
            </div>

            <div className="vis-nodes-grid">
              {/* Node 1: Commander */}
              <div className={`vis-node-box ${simState === 'running' ? 'active' : ''}`}>
                <Bot size={22} style={{ margin: '0 auto', color: '#60a5fa' }} />
                <h4 className="vis-node-title">Commander</h4>
                <div className="vis-node-status active-status">
                  {simState === 'running' ? 'Initiating report sequence...' : 'Orchestrating'}
                </div>
              </div>

              {/* Node 2: Sales Agent */}
              <div className="vis-node-box">
                <Bot size={22} style={{ margin: '0 auto', color: '#c084fc' }} />
                <h4 className="vis-node-title">Sales Agent</h4>
                <div className="vis-node-status">
                  {simState === 'running' ? 'Extracting pipeline...' : 'Idle'}
                </div>
              </div>

              {/* Node 3: Operations Agent */}
              <div className={`vis-node-box ${simState === 'running' ? 'active' : ''}`}>
                <Cpu size={22} style={{ margin: '0 auto', color: '#4ade80' }} />
                <h4 className="vis-node-title">Operations Agent</h4>
                <div className="vis-node-status active-status">
                  {simState === 'running' ? 'Aggregating metrics...' : 'Idle'}
                </div>
              </div>

              {/* Node 4: Knowledge & Tools */}
              <div className={`vis-node-box ${simState === 'running' ? 'active' : ''}`}>
                <Database size={22} style={{ margin: '0 auto', color: '#fbbf24' }} />
                <h4 className="vis-node-title">Knowledge & Tools</h4>
                <div className="vis-node-status active-status">
                  {simState === 'running' ? 'Querying database...' : 'Querying database...'}
                </div>
              </div>
            </div>

            <div className="vis-outcome-footer">
              <div>
                <span style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 600 }}>Business Outcome:</span>
                <p style={{ margin: '0.2rem 0 0 0', fontWeight: 600, color: '#ffffff' }}>
                  {simState === 'completed'
                    ? '✨ Weekly Internal Operations Report Generated & Dispatched to Executive Team.'
                    : 'Report sequence standing by. Click "Run Simulation" to watch automated execution.'}
                </p>
              </div>

              <button className="hero-btn-primary" onClick={handleDemoMode}>
                <span>Launch Dashboard Shell</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="footer-top-grid">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bot size={24} className="text-white" />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em' }}>
                  MARKOVA OS
                </span>
              </div>
              <p className="footer-brand-desc">
                Autonomous AI workforce orchestrator powering enterprise voice, knowledge, and multi-agent business operations.
              </p>
            </div>

            <div>
              <h4 className="footer-col-title">Platform</h4>
              <ul className="footer-links-list">
                <li><Link to={ROUTES.app} className="footer-link">Command Center</Link></li>
                <li><Link to={ROUTES.agentStudio} className="footer-link">Agent Studio</Link></li>
                <li><Link to={ROUTES.knowledge} className="footer-link">Knowledge Vault</Link></li>
                <li><Link to={ROUTES.integrations} className="footer-link">Integration Hub</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="footer-col-title">Resources</h4>
              <ul className="footer-links-list">
                <li><Link to={ROUTES.docs} className="footer-link">Documentation</Link></li>
                <li><Link to={ROUTES.pricing} className="footer-link">Pricing Plans</Link></li>
                <li><Link to={ROUTES.governance} className="footer-link">AI Governance</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="footer-col-title">Account</h4>
              <ul className="footer-links-list">
                <li><Link to={ROUTES.login} className="footer-link">Sign In</Link></li>
                <li><Link to={ROUTES.signup} className="footer-link">Create Account</Link></li>
                <li><button onClick={handleDemoMode} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Developer Demo</button></li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom-bar">
            <span>© 2026 Markova Technologies Inc. All rights reserved.</span>
            <span>Privacy Policy • Terms of Service • Security</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
