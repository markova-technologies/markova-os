import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  Info,
  Key,
  Phone,
  PhoneCall,
  Plus,
} from 'lucide-react'
import { listAgents, listCalls, getUsage } from '../api/client'
import { useEnvironment } from '../contexts/EnvironmentContext'
import Skeleton from '../components/Skeleton'
import './CommandCenter.css'

const PLAN_LABEL = { basic: 'Basic', starter: 'Basic', pro: 'Pro', plus: 'Plus' }

const formatMinutes = (n) => (Math.round((n || 0) * 10) / 10).toLocaleString()

const relativeTime = (iso) => {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  return new Date(iso).toLocaleDateString()
}

const CommandCenter = () => {
  const navigate = useNavigate()
  const { environment } = useEnvironment()
  const [agents, setAgents] = useState([])
  const [calls, setCalls] = useState([])
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
  })()
  const plan = (user.plan || 'basic').toLowerCase()
  const isBasic = plan === 'basic' || plan === 'starter'

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [agentsRes, callsRes, usageRes] = await Promise.all([
          listAgents(),
          listCalls(),
          getUsage(),
        ])
        if (cancelled) return
        setAgents(Array.isArray(agentsRes.data) ? agentsRes.data : [])
        setCalls(Array.isArray(callsRes.data) ? callsRes.data : [])
        setUsage(usageRes.data || null)
        setLoadError(null)
      } catch {
        if (!cancelled) setLoadError('We couldn’t load your dashboard. Refresh to try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const timer = setInterval(load, 30000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [environment])

  const activeCalls = calls.filter((c) => c.status === 'active').length
  const minutesUsed = usage?.call_minutes || 0
  const minutesLimit = usage?.minutes_limit || usage?.limit || null
  const pctUsed = minutesLimit ? Math.min(100, (minutesUsed / minutesLimit) * 100) : null
  const recentCalls = calls.slice(0, 5)

  const stats = [
    { title: 'Calls happening now', value: activeCalls, icon: PhoneCall },
    { title: 'Agents', value: agents.length, icon: Bot },
    { title: 'Calls this period', value: calls.length, icon: Phone },
  ]

  return (
    <div className="command-center">
      <motion.header
        className="cc-header"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1>Overview</h1>
          <p>
            {environment === 'live'
              ? 'You’re in live mode — these are real calls and real spend.'
              : 'You’re in sandbox — test freely, nothing here is billed.'}
          </p>
        </div>
        <div className="cc-quick-actions">
          <button className="btn-quick primary" onClick={() => navigate('/agent-studio')}>
            <Plus size={15} /> Create agent
          </button>
          <button className="btn-quick" onClick={() => navigate('/numbers')}>
            <Phone size={15} /> Provision a number
          </button>
          <button className="btn-quick" onClick={() => navigate('/keys')}>
            <Key size={15} /> View keys
          </button>
        </div>
      </motion.header>

      {loadError && <div className="cc-error">{loadError}</div>}

      <motion.div
        className="cc-stats-grid"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        {stats.map((stat) => (
          <div className="stat-card" key={stat.title}>
            <div className="stat-header">
              <stat.icon size={15} />
              <span className="stat-title">{stat.title}</span>
            </div>
            {loading
              ? <Skeleton variant="text" height="34px" width="60%" />
              : <div className="stat-value">{stat.value}</div>}
          </div>
        ))}

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Minutes used</span>
          </div>
          {loading ? (
            <Skeleton variant="text" height="34px" width="60%" />
          ) : (
            <>
              <div className="stat-value">
                {formatMinutes(minutesUsed)}
                {minutesLimit && <span className="stat-limit"> / {formatMinutes(minutesLimit)}</span>}
              </div>
              {pctUsed !== null && (
                <div className="cc-meter"><span style={{ width: `${pctUsed}%` }} /></div>
              )}
            </>
          )}
        </div>
      </motion.div>

      <div className="cc-main-grid">
        <motion.section
          className="cc-section"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="cc-section-header">
            <h3 className="cc-section-title">Recent calls</h3>
            <Link to="/call-center">View all</Link>
          </div>

          {loading ? (
            <div className="cc-skeleton-list">
              {[0, 1, 2].map((i) => <Skeleton key={i} variant="text" height="46px" />)}
            </div>
          ) : recentCalls.length === 0 ? (
            <div className="cc-empty">
              <p>No calls yet — create an agent and place a test call to see it here.</p>
              <button className="btn-quick primary" onClick={() => navigate('/agent-studio')}>
                <Plus size={15} /> Create agent
              </button>
            </div>
          ) : (
            <ul className="cc-call-list">
              {recentCalls.map((call) => (
                <li key={call.id}>
                  <Link to={`/call-center/${call.id}`}>
                    <span className="cc-call-number mono">{call.caller_number || 'Unknown caller'}</span>
                    <span className="cc-call-agent">{call.agent_name || '—'}</span>
                    <span className="cc-call-time">{relativeTime(call.start_time)}</span>
                    <span className={`cc-call-status ${call.status}`}>{call.status}</span>
                    <ArrowRight size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        <motion.section
          className="cc-section"
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="cc-section-header">
            <h3 className="cc-section-title">Your plan</h3>
            <Link to="/billing">Compare plans</Link>
          </div>
          <p className="cc-plan-name">{PLAN_LABEL[plan] || 'Basic'}</p>

          {isBasic && (
            <div className="cc-plan-note">
              <Info size={15} />
              <p>
                On Basic, your agent answers callers but doesn’t carry out actions in your other
                systems. Calls where an action was recognised are marked in the call detail, so you
                can see what Pro would have handled before deciding to move up.
              </p>
            </div>
          )}
        </motion.section>
      </div>
    </div>
  )
}

export default CommandCenter
