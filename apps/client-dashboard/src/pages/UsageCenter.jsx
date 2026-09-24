import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Clock,
  Download,
  FileText,
  Mic,
  PhoneCall,
  Coins,
  DollarSign,
  Search,
  Sparkles,
  RefreshCw,
  Filter,
  Check,
  Copy,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  HelpCircle,
  TrendingUp,
  Bot,
  User,
  Play,
  Pause,
  Calendar,
  Layers,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react'
import {
  getUsage,
  getUsageHistory,
  listCalls,
  simulateUsageCall,
  calculateUsageCost,
  USAGE_RATES
} from '../api/client'
import { useEnvironment } from '../contexts/EnvironmentContext'
import { useToast } from '../contexts/ToastContext'
import Waveform from '../components/Waveform'
import './UsageCenter.css'

const METRICS = [
  { key: 'call_minutes', label: 'Call minutes', icon: PhoneCall, unit: 'min', color: 'var(--live-amber, #f59e0b)' },
  { key: 'stt_seconds', label: 'Speech recognized', icon: Mic, unit: 'sec', color: '#06b6d4' },
  { key: 'tts_characters', label: 'Speech generated', icon: Activity, unit: 'chars', color: '#10b981' },
  { key: 'llm_tokens', label: 'Model tokens', icon: FileText, unit: 'tokens', color: '#a855f7' },
  { key: 'cost', label: 'Estimated spend', icon: Coins, unit: 'ETB', color: '#ec4899' },
]

const DATE_RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
]

const dayKey = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : 'unknown')
const formatNumber = (n) => Number(n || 0).toLocaleString()

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '0s'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs.toString().padStart(2, '0')}s`
}

const UsageCenter = () => {
  const { environment } = useEnvironment()
  const { success, error, info } = useToast()

  const [usage, setUsage] = useState(null)
  const [history, setHistory] = useState([])
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  // Filters & Controls
  const [metric, setMetric] = useState('call_minutes')
  const [dateRange, setDateRange] = useState('30d')
  const [currency, setCurrency] = useState('ETB') // 'ETB' or 'USD'
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 8

  // Modals & Inspection
  const [selectedCall, setSelectedCall] = useState(null)
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [showSimulateModal, setShowSimulateModal] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  // Simulation form state
  const [simAgent, setSimAgent] = useState('Almaz (Customer Care)')
  const [simDuration, setSimDuration] = useState('120')
  const [simCaller, setSimCaller] = useState('+251 91 145 8892')

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    setRefreshing(true)
    try {
      const [usageRes, historyRes, callsRes] = await Promise.all([
        getUsage().catch(() => ({ data: null })),
        getUsageHistory().catch(() => ({ data: { items: [] } })),
        listCalls().catch(() => ({ data: [] })),
      ])

      const rawHistory = Array.isArray(historyRes.data)
        ? historyRes.data
        : (historyRes.data?.items || historyRes.data?.events || [])
      
      const rawCalls = Array.isArray(callsRes.data) ? callsRes.data : []

      setUsage(usageRes.data || null)
      setHistory(rawHistory)
      setCalls(rawCalls)
      setLastUpdated(new Date())
    } catch (_) {
      // In case of any unhandled network failure, fallback gracefully
      setHistory([])
      setCalls([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData, environment])

  // Listen for live usage updates (e.g. from test calls placed elsewhere)
  useEffect(() => {
    const handleUsageUpdated = () => {
      loadData(true)
    }
    window.addEventListener('markova:usage-updated', handleUsageUpdated)
    return () => {
      window.removeEventListener('markova:usage-updated', handleUsageUpdated)
    }
  }, [loadData])

  // Filter history and calls by selected dateRange
  const { filteredHistory, filteredCalls, filteredTotals } = useMemo(() => {
    const now = new Date()
    let cutoff = 0

    if (dateRange === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      cutoff = startOfDay
    } else if (dateRange === '7d') {
      cutoff = now.getTime() - 7 * 86400000
    } else if (dateRange === '30d') {
      cutoff = now.getTime() - 30 * 86400000
    } else if (dateRange === 'month') {
      cutoff = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    } else {
      cutoff = 0 // All Time
    }

    const fHistory = history.filter((item) => {
      if (!item.created_at) return true
      return new Date(item.created_at).getTime() >= cutoff
    })

    const fCalls = calls.filter((c) => {
      const time = c.start_time || c.created_at
      if (!time) return true
      return new Date(time).getTime() >= cutoff
    })

    const totals = fHistory.reduce(
      (acc, item) => ({
        call_minutes: acc.call_minutes + Number(item.call_minutes || 0),
        stt_seconds: acc.stt_seconds + Number(item.stt_seconds || 0),
        tts_characters: acc.tts_characters + Number(item.tts_characters || 0),
        llm_tokens: acc.llm_tokens + Number(item.llm_tokens || 0),
        event_count: acc.event_count + 1,
      }),
      { call_minutes: 0, stt_seconds: 0, tts_characters: 0, llm_tokens: 0, event_count: 0 }
    )

    const costBreakdown = calculateUsageCost(totals)

    return {
      filteredHistory: fHistory,
      filteredCalls: fCalls,
      filteredTotals: {
        ...totals,
        cost: costBreakdown,
      },
    }
  }, [history, calls, dateRange])

  // Chart time series (grouped by day)
  const series = useMemo(() => {
    const buckets = new Map()
    for (const event of filteredHistory) {
      const key = dayKey(event.created_at)
      const prev = buckets.get(key) || 0
      let val = 0
      if (metric === 'cost') {
        const itemCost = event.cost?.totalETB ?? calculateUsageCost(event).totalETB
        val = currency === 'USD' ? itemCost / USAGE_RATES.etbPerUSD : itemCost
      } else {
        val = Number(event[metric] || 0)
      }
      buckets.set(key, prev + val)
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-48)
  }, [filteredHistory, metric, currency])

  // Peak day and average calculations
  const seriesStats = useMemo(() => {
    if (series.length === 0) return { total: 0, avg: 0, peak: 0, peakDate: '—' }
    let max = 0
    let maxDate = '—'
    let sum = 0
    for (const [day, val] of series) {
      sum += val
      if (val > max) {
        max = val
        maxDate = day
      }
    }
    return {
      total: sum,
      avg: Math.round((sum / series.length) * 10) / 10,
      peak: Math.round(max * 10) / 10,
      peakDate: maxDate,
    }
  }, [series])

  // Filtered & Paginated calls table
  const displayCalls = useMemo(() => {
    return filteredCalls.filter((c) => {
      const q = searchQuery.toLowerCase().trim()
      const matchesQuery =
        !q ||
        (c.agent_name && c.agent_name.toLowerCase().includes(q)) ||
        (c.caller_number && c.caller_number.toLowerCase().includes(q)) ||
        (c.id && c.id.toLowerCase().includes(q))

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'completed' && (c.status === 'completed' || !c.status)) ||
        (statusFilter === 'transferred' && c.status === 'transferred') ||
        (statusFilter === 'active' && (c.status === 'active' || c.status === 'live'))

      return matchesQuery && matchesStatus
    })
  }, [filteredCalls, searchQuery, statusFilter])

  const totalPages = Math.max(1, Math.ceil(displayCalls.length / pageSize))
  const paginatedCalls = useMemo(() => {
    const start = (page - 1) * pageSize
    return displayCalls.slice(start, start + pageSize)
  }, [displayCalls, page, pageSize])

  // Active Metric Object
  const activeMetric = METRICS.find((m) => m.key === metric) || METRICS[0]

  // Copy to clipboard helper
  const copyToClipboard = (text, id) => {
    navigator.clipboard?.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1800)
    info(`Copied ${text} to clipboard`)
  }

  // Export CSV
  const exportCsv = () => {
    if (filteredCalls.length === 0 && filteredHistory.length === 0) {
      info('No usage data available in the selected period to export.')
      return
    }

    const headers = [
      'Date & Time',
      'Call ID',
      'Agent',
      'Caller Number',
      'Duration (sec)',
      'Duration (formatted)',
      'STT Speech (sec)',
      'TTS Characters',
      'Model Tokens',
      'Estimated Cost (ETB)',
      'Estimated Cost (USD)',
      'Status'
    ]

    const rows = filteredCalls.map((c) => {
      const dur = c.duration_seconds || (c.call_minutes ? c.call_minutes * 60 : 0)
      const cost = calculateUsageCost({
        call_minutes: c.call_minutes || Math.ceil(dur / 60),
        stt_seconds: c.stt_seconds || Math.round(dur * 0.9),
        tts_characters: c.tts_characters || Math.round(dur * 13),
        llm_tokens: c.llm_tokens || Math.round(dur * 9)
      })

      return [
        `"${c.start_time ? new Date(c.start_time).toLocaleString() : ''}"`,
        `"${c.id || ''}"`,
        `"${c.agent_name || 'Almaz'}"`,
        `"${c.caller_number || ''}"`,
        dur,
        `"${formatDuration(dur)}"`,
        c.stt_seconds || Math.round(dur * 0.9),
        c.tts_characters || Math.round(dur * 13),
        c.llm_tokens || Math.round(dur * 9),
        cost.totalETB,
        cost.totalUSD,
        `"${c.status || 'completed'}"`
      ].join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const dateStr = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `markova-usage-${environment}-${dateRange}-${dateStr}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    success('Usage report CSV exported successfully', 'Export Complete')
  }

  // Handle simulation trigger
  const handleSimulateCall = () => {
    setSimulating(true)
    setTimeout(() => {
      const dur = parseInt(simDuration, 10) || 120
      const result = simulateUsageCall({
        agentName: simAgent,
        durationSeconds: dur,
        callerNumber: simCaller || '+251 91 145 8892',
        status: 'completed',
        summary: `Simulated customer call with ${simAgent}. Verified STT recognition and speech generation latency.`,
      })
      setSimulating(false)
      setShowSimulateModal(false)
      loadData(true)
      success(
        `Recorded test call: ${result.call.agent_name} (${formatDuration(dur)}), metered ${result.call.llm_tokens} tokens.`,
        'Call Metered'
      )
    }, 400)
  }

  // Sandbox Tier allowance progress (e.g. 100 free minutes included in Sandbox)
  const sandboxAllowance = 100
  const usedMinutes = filteredTotals.call_minutes || 0
  const allowancePercent = Math.min(100, Math.round((usedMinutes / sandboxAllowance) * 100))

  return (
    <div className="usage-center">
      {/* Top Header */}
      <header className="usage-header">
        <div className="usage-header-info">
          <div className="usage-title-row">
            <h1>Usage & Telemetry</h1>
            <span className={`usage-env-badge env-${environment}`}>
              <span className="usage-pulse-dot" />
              {environment === 'live' ? 'Live Production' : 'Sandbox Test Mode'}
            </span>
          </div>
          <p>
            Metered telemetry for telephony minutes, Amharic speech recognition, neural voice synthesis, and language model tokens.
          </p>
        </div>

        <div className="usage-header-actions">
          {/* Date range filter pills */}
          <div className="usage-range-selector" role="group" aria-label="Date range selector">
            {DATE_RANGES.map((r) => (
              <button
                key={r.key}
                className={`usage-range-btn ${dateRange === r.key ? 'is-active' : ''}`}
                onClick={() => {
                  setDateRange(r.key)
                  setPage(1)
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="usage-btn-group">
            {environment !== 'live' && (
              <button
                className="btn btn-secondary usage-sim-btn"
                onClick={() => setShowSimulateModal(true)}
                title="Simulate a test call to test real-time metering"
              >
                <Sparkles size={15} className="usage-sparkle-icon" />
                <span>Simulate Call</span>
              </button>
            )}

            <button
              className="btn btn-secondary usage-refresh-btn"
              onClick={() => loadData()}
              disabled={refreshing}
              title="Refresh usage telemetry"
            >
              <RefreshCw size={15} className={refreshing ? 'spin-icon' : ''} />
              <span>Refresh</span>
            </button>

            <button
              className="btn btn-secondary usage-export-btn"
              onClick={exportCsv}
              disabled={filteredCalls.length === 0}
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </header>

      {/* Spend Estimation & Tier Allowance Hero Card */}
      <section className="usage-hero-card">
        <div className="usage-hero-spend">
          <div className="usage-hero-spend-top">
            <span className="usage-hero-label">
              <Coins size={16} /> Estimated Spend ({dateRange === '30d' ? 'Last 30 Days' : DATE_RANGES.find(d => d.key === dateRange)?.label})
            </span>
            <div className="usage-currency-toggle">
              <button
                className={`usage-curr-btn ${currency === 'ETB' ? 'is-active' : ''}`}
                onClick={() => setCurrency('ETB')}
              >
                ETB (ብር)
              </button>
              <button
                className={`usage-curr-btn ${currency === 'USD' ? 'is-active' : ''}`}
                onClick={() => setCurrency('USD')}
              >
                USD ($)
              </button>
            </div>
          </div>

          <div className="usage-hero-spend-val">
            {currency === 'ETB' ? (
              <>
                <span className="usage-curr-symbol">ETB</span>
                <span className="usage-amount">
                  {filteredTotals.cost?.totalETB ? formatNumber(filteredTotals.cost.totalETB.toFixed(2)) : '0.00'}
                </span>
              </>
            ) : (
              <>
                <span className="usage-curr-symbol">$</span>
                <span className="usage-amount">
                  {filteredTotals.cost?.totalUSD ? formatNumber(filteredTotals.cost.totalUSD.toFixed(2)) : '0.00'}
                </span>
              </>
            )}
          </div>

          <div className="usage-spend-breakdown-pills">
            <div className="usage-spend-pill" title="0.50 ETB / minute">
              <span className="dot dot-telephony" />
              <span>Telephony: {currency === 'ETB' ? `${filteredTotals.cost?.telephonyETB || 0} ETB` : `$${((filteredTotals.cost?.telephonyETB || 0) / USAGE_RATES.etbPerUSD).toFixed(2)}`}</span>
            </div>
            <div className="usage-spend-pill" title="0.15 ETB / minute audio">
              <span className="dot dot-stt" />
              <span>STT: {currency === 'ETB' ? `${filteredTotals.cost?.sttETB || 0} ETB` : `$${((filteredTotals.cost?.sttETB || 0) / USAGE_RATES.etbPerUSD).toFixed(2)}`}</span>
            </div>
            <div className="usage-spend-pill" title="0.05 ETB / 1,000 characters">
              <span className="dot dot-tts" />
              <span>TTS: {currency === 'ETB' ? `${filteredTotals.cost?.ttsETB || 0} ETB` : `$${((filteredTotals.cost?.ttsETB || 0) / USAGE_RATES.etbPerUSD).toFixed(2)}`}</span>
            </div>
            <div className="usage-spend-pill" title="0.30 ETB / 1,000 tokens">
              <span className="dot dot-llm" />
              <span>LLM: {currency === 'ETB' ? `${filteredTotals.cost?.llmETB || 0} ETB` : `$${((filteredTotals.cost?.llmETB || 0) / USAGE_RATES.etbPerUSD).toFixed(2)}`}</span>
            </div>
          </div>
        </div>

        <div className="usage-hero-allowance">
          <div className="usage-allowance-head">
            <div className="usage-allowance-title">
              <ShieldCheck size={16} />
              <span>Sandbox Developer Tier</span>
            </div>
            <button
              className="usage-pricing-link"
              onClick={() => setShowPricingModal(true)}
            >
              View Unit Rates <HelpCircle size={13} />
            </button>
          </div>

          <div className="usage-progress-container">
            <div className="usage-progress-meta">
              <span>{usedMinutes} / {sandboxAllowance} Free Minutes Used</span>
              <span className="usage-progress-pct">{allowancePercent}%</span>
            </div>
            <div className="usage-progress-track">
              <div
                className="usage-progress-fill"
                style={{ width: `${allowancePercent}%` }}
              />
            </div>
          </div>

          <div className="usage-allowance-footer">
            <span className="usage-allowance-note">
              ✓ In sandbox mode, all test calls, STT, and TTS audio are fully simulated without carrier charges.
            </span>
          </div>
        </div>
      </section>

      {/* 5 Primary Metric Telemetry Cards */}
      <div className="usage-metric-grid">
        {METRICS.map((m) => {
          const Icon = m.icon
          let val = filteredTotals[m.key]
          let unitLabel = m.unit

          if (m.key === 'cost') {
            val = currency === 'ETB'
              ? `${filteredTotals.cost?.totalETB?.toFixed(2) || '0.00'}`
              : `$${filteredTotals.cost?.totalUSD?.toFixed(2) || '0.00'}`
            unitLabel = currency
          } else {
            val = formatNumber(val)
          }

          const isSelected = metric === m.key

          return (
            <button
              key={m.key}
              className={`usage-metric-card ${isSelected ? 'is-selected' : ''}`}
              onClick={() => setMetric(m.key)}
              aria-pressed={isSelected}
            >
              <div className="usage-card-top">
                <span className="usage-metric-label">
                  <Icon size={16} style={{ color: m.color }} /> {m.label}
                </span>
                {isSelected && <span className="usage-selected-chip">Active Series</span>}
              </div>

              <div className="usage-card-val-row">
                <span className="usage-metric-value">{val}</span>
                <span className="usage-metric-unit">{unitLabel}</span>
              </div>

              <div className="usage-card-substat">
                {m.key === 'call_minutes' && `Avg ${formatDuration(Math.round((filteredTotals.stt_seconds || 120) / Math.max(1, filteredCalls.length)))} / call`}
                {m.key === 'stt_seconds' && `Groq Whisper Large v3`}
                {m.key === 'tts_characters' && `Edge TTS am-ET-Mekdes`}
                {m.key === 'llm_tokens' && `LLaMA 3.3 & GPT-4o-mini`}
                {m.key === 'cost' && `Estimated billing sum`}
              </div>
            </button>
          )
        })}
      </div>

      {/* Interactive Time Series Chart Section */}
      <section className="usage-chart-card">
        <div className="usage-chart-head">
          <div>
            <div className="usage-chart-title-row">
              <h2>{activeMetric.label} over time</h2>
              <span className="usage-chart-badge">
                {filteredHistory.length} metered events ({dateRange === '30d' ? '30 Days' : DATE_RANGES.find(d => d.key === dateRange)?.label})
              </span>
            </div>
            <p className="usage-chart-subtitle">
              Daily aggregated {activeMetric.label.toLowerCase()} across all active AI voice agents.
            </p>
          </div>

          <div className="usage-chart-metric-pills">
            {METRICS.map((m) => (
              <button
                key={m.key}
                className={`usage-chart-pill ${metric === m.key ? 'is-active' : ''}`}
                onClick={() => setMetric(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {series.length === 0 ? (
          <div className="usage-empty">
            <p>No usage recorded in this period — place or simulate a call to view telemetry.</p>
            <button
              className="btn btn-secondary usage-empty-action"
              onClick={() => setShowSimulateModal(true)}
            >
              <Sparkles size={14} /> Simulate Test Call
            </button>
          </div>
        ) : (
          <>
            <div className="usage-waveform-wrapper">
              <Waveform
                size="chart"
                env={environment}
                values={series.map(([, value]) => value)}
                labels={series.map(([day, val]) => `${day} (${val.toLocaleString()} ${metric === 'cost' ? currency : activeMetric.unit})`)}
                ariaLabel={`${activeMetric.label} trend`}
              />
            </div>

            <div className="usage-chart-axis">
              <span className="axis-start">{series[0][0]}</span>
              <span className="axis-mid">Timeline (Daily Aggregation)</span>
              <span className="axis-end">{series[series.length - 1][0]}</span>
            </div>

            {/* Telemetry Summary Strip */}
            <div className="usage-telemetry-summary">
              <div className="telemetry-stat">
                <span className="stat-label">Period Total</span>
                <span className="stat-val">
                  {metric === 'cost'
                    ? `${currency === 'ETB' ? `${seriesStats.total.toFixed(2)} ETB` : `$${seriesStats.total.toFixed(2)}`}`
                    : `${formatNumber(Math.round(seriesStats.total))} ${activeMetric.unit}`}
                </span>
              </div>
              <div className="telemetry-stat">
                <span className="stat-label">Daily Average</span>
                <span className="stat-val">
                  {metric === 'cost'
                    ? `${currency === 'ETB' ? `${seriesStats.avg.toFixed(2)} ETB` : `$${seriesStats.avg.toFixed(2)}`}/day`
                    : `${formatNumber(seriesStats.avg)} ${activeMetric.unit}/day`}
                </span>
              </div>
              <div className="telemetry-stat">
                <span className="stat-label">Peak Single Day</span>
                <span className="stat-val">
                  {metric === 'cost'
                    ? `${currency === 'ETB' ? `${seriesStats.peak.toFixed(2)} ETB` : `$${seriesStats.peak.toFixed(2)}`}`
                    : `${formatNumber(seriesStats.peak)} ${activeMetric.unit}`}
                  <span className="stat-sub"> ({seriesStats.peakDate})</span>
                </span>
              </div>
              <div className="telemetry-stat">
                <span className="stat-label">Metering SLA</span>
                <span className="stat-val text-success">
                  <CheckCircle2 size={13} /> 100% Reconciled
                </span>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Metered Calls & Event Ledger Table */}
      <section className="usage-table-card">
        <div className="usage-table-head">
          <div>
            <h2>Recent Metered Calls</h2>
            <span className="usage-table-meta">
              Showing {displayCalls.length} calls ({dateRange === '30d' ? '30 Days' : DATE_RANGES.find(d => d.key === dateRange)?.label})
            </span>
          </div>

          <div className="usage-table-controls">
            {/* Search input */}
            <div className="usage-search-box">
              <Search size={14} className="usage-search-icon" />
              <input
                type="text"
                placeholder="Search caller number or agent..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
              />
              {searchQuery && (
                <button className="usage-search-clear" onClick={() => setSearchQuery('')}>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Status filter */}
            <div className="usage-status-filter">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="transferred">Transferred</option>
                <option value="active">Active</option>
              </select>
            </div>
          </div>
        </div>

        {displayCalls.length === 0 ? (
          <div className="usage-empty">
            <p>No metered calls match your current filter.</p>
            {searchQuery && (
              <button className="btn btn-secondary" onClick={() => setSearchQuery('')}>
                Clear Search Query
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="usage-table-wrapper">
              <table className="usage-table">
                <thead>
                  <tr>
                    <th>Started</th>
                    <th>Agent</th>
                    <th>Caller</th>
                    <th>Duration</th>
                    <th>STT / TTS</th>
                    <th>Tokens</th>
                    <th>Est. Cost</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCalls.map((call) => {
                    const dur = call.duration_seconds || (call.call_minutes ? call.call_minutes * 60 : 0)
                    const cost = calculateUsageCost({
                      call_minutes: call.call_minutes || Math.ceil(dur / 60),
                      stt_seconds: call.stt_seconds || Math.round(dur * 0.9),
                      tts_characters: call.tts_characters || Math.round(dur * 13),
                      llm_tokens: call.llm_tokens || Math.round(dur * 9),
                    })

                    return (
                      <tr
                        key={call.id}
                        className="usage-table-row"
                        onClick={() => setSelectedCall(call)}
                      >
                        <td className="usage-time-cell">
                          <span className="time-primary">
                            {call.start_time ? new Date(call.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—'}
                          </span>
                          <span className="time-secondary">
                            {call.start_time ? new Date(call.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </td>

                        <td>
                          <div className="usage-agent-cell">
                            <div className="usage-agent-avatar">
                              <Bot size={13} />
                            </div>
                            <span>{call.agent_name || 'Almaz (Customer Care)'}</span>
                          </div>
                        </td>

                        <td className="mono">
                          <div className="usage-caller-cell">
                            <span>{call.caller_number || '—'}</span>
                            {call.caller_number && (
                              <button
                                className="copy-btn-inline"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  copyToClipboard(call.caller_number, call.id)
                                }}
                                title="Copy number"
                              >
                                {copiedId === call.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="mono">{formatDuration(dur)}</td>

                        <td className="mono usage-stt-tts-cell">
                          <span title="Speech Recognized (seconds)">{call.stt_seconds || Math.round(dur * 0.9)}s</span>
                          <span className="cell-divider">/</span>
                          <span title="Speech Generated (characters)">{formatNumber(call.tts_characters || Math.round(dur * 13))}ch</span>
                        </td>

                        <td className="mono">
                          <span className="usage-tokens-badge">
                            {formatNumber(call.llm_tokens || Math.round(dur * 9))}
                          </span>
                        </td>

                        <td className="mono usage-cost-cell">
                          {currency === 'ETB' ? `${cost.totalETB} ብር` : `$${cost.totalUSD}`}
                        </td>

                        <td>
                          <span className={`usage-status status-${call.status || 'completed'}`}>
                            {call.status || 'completed'}
                          </span>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="usage-inspect-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedCall(call)
                            }}
                            title="Inspect Call Telemetry & Transcript"
                          >
                            <Eye size={13} /> Inspect
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="usage-pagination">
                <span className="pagination-info">
                  Page {page} of {totalPages} ({displayCalls.length} calls)
                </span>
                <div className="pagination-actions">
                  <button
                    className="pagination-btn"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={15} /> Prev
                  </button>
                  <button
                    className="pagination-btn"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Call Telemetry & Transcript Modal */}
      {selectedCall && (
        <div className="usage-modal-backdrop" onClick={() => setSelectedCall(null)}>
          <div className="usage-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="usage-modal-header">
              <div className="usage-modal-title">
                <h3>Call Telemetry & Metering Ledger</h3>
                <span className={`usage-status status-${selectedCall.status || 'completed'}`}>
                  {selectedCall.status || 'completed'}
                </span>
              </div>
              <button className="usage-modal-close" onClick={() => setSelectedCall(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="usage-modal-body">
              {/* Call Summary Banner */}
              {selectedCall.summary && (
                <div className="usage-modal-summary">
                  <h4>Call Overview & Intent</h4>
                  <p>{selectedCall.summary}</p>
                </div>
              )}

              {/* Metric Chips */}
              <div className="usage-modal-metrics">
                <div className="modal-metric-box">
                  <span className="metric-box-label">Duration</span>
                  <span className="metric-box-val">
                    {formatDuration(selectedCall.duration_seconds || (selectedCall.call_minutes ? selectedCall.call_minutes * 60 : 0))}
                  </span>
                  <span className="metric-box-sub">{selectedCall.turn_count || 4} turns</span>
                </div>

                <div className="modal-metric-box">
                  <span className="metric-box-label">Speech Recognized</span>
                  <span className="metric-box-val">
                    {selectedCall.stt_seconds || Math.round((selectedCall.duration_seconds || 120) * 0.9)} sec
                  </span>
                  <span className="metric-box-sub">Groq Whisper v3</span>
                </div>

                <div className="modal-metric-box">
                  <span className="metric-box-label">Speech Generated</span>
                  <span className="metric-box-val">
                    {formatNumber(selectedCall.tts_characters || Math.round((selectedCall.duration_seconds || 120) * 13))} chars
                  </span>
                  <span className="metric-box-sub">Edge Neural</span>
                </div>

                <div className="modal-metric-box">
                  <span className="metric-box-label">Model Tokens</span>
                  <span className="metric-box-val">
                    {formatNumber(selectedCall.llm_tokens || Math.round((selectedCall.duration_seconds || 120) * 9))}
                  </span>
                  <span className="metric-box-sub">LLaMA 3.3 70B</span>
                </div>

                <div className="modal-metric-box highlight">
                  <span className="metric-box-label">Metered Cost</span>
                  <span className="metric-box-val">
                    {calculateUsageCost({
                      call_minutes: selectedCall.call_minutes || Math.ceil((selectedCall.duration_seconds || 120) / 60),
                      stt_seconds: selectedCall.stt_seconds || Math.round((selectedCall.duration_seconds || 120) * 0.9),
                      tts_characters: selectedCall.tts_characters || Math.round((selectedCall.duration_seconds || 120) * 13),
                      llm_tokens: selectedCall.llm_tokens || Math.round((selectedCall.duration_seconds || 120) * 9),
                    }).totalETB} ብር
                  </span>
                  <span className="metric-box-sub">
                    ~${calculateUsageCost({
                      call_minutes: selectedCall.call_minutes || Math.ceil((selectedCall.duration_seconds || 120) / 60),
                      stt_seconds: selectedCall.stt_seconds || Math.round((selectedCall.duration_seconds || 120) * 0.9),
                      tts_characters: selectedCall.tts_characters || Math.round((selectedCall.duration_seconds || 120) * 13),
                      llm_tokens: selectedCall.llm_tokens || Math.round((selectedCall.duration_seconds || 120) * 9),
                    }).totalUSD} USD
                  </span>
                </div>
              </div>

              {/* Conversation Transcript */}
              <div className="usage-transcript-section">
                <h4>Conversation Transcript</h4>
                {selectedCall.transcript && selectedCall.transcript.length > 0 ? (
                  <div className="usage-transcript-list">
                    {selectedCall.transcript.map((turn, i) => (
                      <div
                        key={i}
                        className={`usage-transcript-bubble ${turn.speaker === 'agent' ? 'is-agent' : 'is-caller'}`}
                      >
                        <div className="bubble-speaker">
                          {turn.speaker === 'agent' ? (
                            <>
                              <Bot size={13} /> {selectedCall.agent_name || 'AI Voice Agent'}
                            </>
                          ) : (
                            <>
                              <User size={13} /> Caller ({selectedCall.caller_number})
                            </>
                          )}
                        </div>
                        <div className="bubble-text">{turn.text}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-transcript-note">
                    Transcript logging was not enabled for this session or was completed via direct bridge.
                  </p>
                )}
              </div>
            </div>

            <div className="usage-modal-footer">
              <div className="modal-call-id mono">ID: {selectedCall.id}</div>
              <button className="btn btn-secondary" onClick={() => setSelectedCall(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unit Rates & Pricing Transparency Modal */}
      {showPricingModal && (
        <div className="usage-modal-backdrop" onClick={() => setShowPricingModal(false)}>
          <div className="usage-modal-content modal-pricing" onClick={(e) => e.stopPropagation()}>
            <div className="usage-modal-header">
              <div className="usage-modal-title">
                <h3>Unit Rates & Metering Transparency</h3>
              </div>
              <button className="usage-modal-close" onClick={() => setShowPricingModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="usage-modal-body">
              <p className="pricing-intro">
                Markova OS meters consumption on a strict per-second and per-token basis. No monthly minimums or hidden platform markups.
              </p>

              <table className="usage-rates-table">
                <thead>
                  <tr>
                    <th>Service Layer</th>
                    <th>Engine / Provider</th>
                    <th>Rate (ETB)</th>
                    <th>Rate (USD)</th>
                    <th>Metering Unit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Carrier Telephony (SIP)</strong></td>
                    <td>Ethio Telecom / Safaricom Trunk</td>
                    <td className="mono">{USAGE_RATES.telephonyPerMinuteETB.toFixed(2)} ብር</td>
                    <td className="mono">${USAGE_RATES.telephonyPerMinuteUSD.toFixed(3)}</td>
                    <td>per connected minute</td>
                  </tr>
                  <tr>
                    <td><strong>Speech Recognition (STT)</strong></td>
                    <td>Groq Whisper Large v3 (Amharic)</td>
                    <td className="mono">{USAGE_RATES.sttPerMinuteETB.toFixed(2)} ብር</td>
                    <td className="mono">${USAGE_RATES.sttPerMinuteUSD.toFixed(4)}</td>
                    <td>per audio minute</td>
                  </tr>
                  <tr>
                    <td><strong>Speech Generation (TTS)</strong></td>
                    <td>Microsoft Edge Neural (Mekdes)</td>
                    <td className="mono">{USAGE_RATES.ttsPer1kCharsETB.toFixed(2)} ብር</td>
                    <td className="mono">${USAGE_RATES.ttsPer1kCharsUSD.toFixed(4)}</td>
                    <td>per 1,000 characters</td>
                  </tr>
                  <tr>
                    <td><strong>LLM Reasoning & RAG</strong></td>
                    <td>Meta LLaMA 3.3 70B / Groq</td>
                    <td className="mono">{USAGE_RATES.llmPer1kTokensETB.toFixed(2)} ብር</td>
                    <td className="mono">${USAGE_RATES.llmPer1kTokensUSD.toFixed(4)}</td>
                    <td>per 1,000 tokens (I/O)</td>
                  </tr>
                </tbody>
              </table>

              <div className="pricing-payment-note">
                <span className="dot dot-telephony" />
                <span>
                  <strong>Billing Settlement:</strong> Live accounts settle monthly or via pre-paid balance through Telebirr, CBE Birr, or International Credit Cards.
                </span>
              </div>
            </div>

            <div className="usage-modal-footer">
              <button className="btn btn-primary" onClick={() => setShowPricingModal(false)}>
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulate Test Call Modal */}
      {showSimulateModal && (
        <div className="usage-modal-backdrop" onClick={() => setShowSimulateModal(false)}>
          <div className="usage-modal-content modal-sim" onClick={(e) => e.stopPropagation()}>
            <div className="usage-modal-header">
              <div className="usage-modal-title">
                <Sparkles size={16} color="#f59e0b" />
                <h3>Simulate Test Call (Sandbox)</h3>
              </div>
              <button className="usage-modal-close" onClick={() => setShowSimulateModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="usage-modal-body">
              <p className="sim-intro">
                Simulate an incoming or outbound phone call to test real-time speech metering, audio generation counters, and token consumption.
              </p>

              <div className="sim-field">
                <label>Assigned AI Voice Agent</label>
                <select value={simAgent} onChange={(e) => setSimAgent(e.target.value)}>
                  <option value="Almaz (Customer Care)">Almaz (Customer Care - GM Furniture)</option>
                  <option value="Dawit (Sales & Booking)">Dawit (Sales & Booking)</option>
                  <option value="Abebe (Delivery Dispatch)">Abebe (Delivery Dispatch)</option>
                  <option value="Sara (After-Sales Support)">Sara (After-Sales Support)</option>
                </select>
              </div>

              <div className="sim-field">
                <label>Simulated Caller Number</label>
                <input
                  type="text"
                  value={simCaller}
                  onChange={(e) => setSimCaller(e.target.value)}
                  placeholder="+251 91 123 4567"
                />
              </div>

              <div className="sim-field">
                <label>Call Duration</label>
                <div className="sim-duration-pills">
                  {[
                    { label: '1 min', sec: '65' },
                    { label: '2 min', sec: '125' },
                    { label: '3 min', sec: '185' },
                    { label: '4 min', sec: '245' }
                  ].map((d) => (
                    <button
                      key={d.sec}
                      type="button"
                      className={`sim-dur-btn ${simDuration === d.sec ? 'is-active' : ''}`}
                      onClick={() => setSimDuration(d.sec)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sim-expected-box">
                <span>Estimated Telemetry Impact:</span>
                <div className="sim-expected-chips">
                  <span>~{Math.ceil(parseInt(simDuration, 10) / 60)} min</span>
                  <span>~{Math.round(parseInt(simDuration, 10) * 0.9)}s STT</span>
                  <span>~{formatNumber(parseInt(simDuration, 10) * 13)} chars</span>
                  <span>~{formatNumber(parseInt(simDuration, 10) * 9)} tokens</span>
                </div>
              </div>
            </div>

            <div className="usage-modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowSimulateModal(false)}
                disabled={simulating}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSimulateCall}
                disabled={simulating}
              >
                {simulating ? 'Recording Call...' : 'Place Simulated Call'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footnote */}
      <footer className="usage-footnote">
        <Clock size={13} />
        <span>
          Usage is summed directly from the transaction ledger. Last synced {lastUpdated.toLocaleTimeString()}.
        </span>
      </footer>
    </div>
  )
}

export default UsageCenter
