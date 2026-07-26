import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Clock, Download, FileText, Mic, PhoneCall } from 'lucide-react'
import { getUsage, getUsageHistory, listCalls } from '../api/client'
import { useEnvironment } from '../contexts/EnvironmentContext'
import Waveform from '../components/Waveform'
import './UsageCenter.css'

// Everything on this page comes from the usage ledger (/v1/usage, /v1/usage/history)
// and /v1/calls. Metrics the API does not measure are not shown rather than estimated.

const METRICS = [
  { key: 'call_minutes', label: 'Call minutes', icon: PhoneCall, unit: 'min' },
  { key: 'stt_seconds', label: 'Speech recognized', icon: Mic, unit: 'sec' },
  { key: 'tts_characters', label: 'Speech generated', icon: Activity, unit: 'chars' },
  { key: 'llm_tokens', label: 'Model tokens', icon: FileText, unit: 'tokens' },
]

const dayKey = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : 'unknown')

const formatNumber = (n) => Number(n || 0).toLocaleString()

const UsageCenter = () => {
  const { environment } = useEnvironment()
  const [usage, setUsage] = useState(null)
  const [history, setHistory] = useState([])
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [metric, setMetric] = useState('call_minutes')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [usageRes, historyRes, callsRes] = await Promise.all([
        getUsage(),
        getUsageHistory().catch(() => ({ data: [] })),
        listCalls().catch(() => ({ data: [] })),
      ])
      setUsage(usageRes.data)
      setHistory(Array.isArray(historyRes.data) ? historyRes.data : historyRes.data?.events || [])
      setCalls(Array.isArray(callsRes.data) ? callsRes.data : [])
    } catch {
      setLoadError("We couldn't load your usage just now. Try again in a moment.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, environment])

  // Ledger events are per-call; roll them into days so the waveform reads as a trend.
  const series = useMemo(() => {
    const buckets = new Map()
    for (const event of history) {
      const key = dayKey(event.created_at)
      const prev = buckets.get(key) || 0
      buckets.set(key, prev + Number(event[metric] || 0))
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-48)
  }, [history, metric])

  const activeMetric = METRICS.find((m) => m.key === metric) || METRICS[0]

  const exportCsv = () => {
    const header = ['date', 'call_minutes', 'stt_seconds', 'tts_characters', 'llm_tokens']
    const rows = history.map((e) =>
      [dayKey(e.created_at), e.call_minutes, e.stt_seconds, e.tts_characters, e.llm_tokens].join(',')
    )
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `markova-usage-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="usage-center">
        <header className="usage-header">
          <h1>Usage</h1>
          <p>What your agents have actually consumed this period.</p>
        </header>
        <div className="usage-skeleton-grid">
          {METRICS.map((m) => (
            <div key={m.key} className="usage-skeleton-card" />
          ))}
        </div>
        <div className="usage-skeleton-chart" />
      </div>
    )
  }

  return (
    <div className="usage-center">
      <header className="usage-header">
        <div>
          <h1>Usage</h1>
          <p>
            What your agents have actually consumed this period, metered per call in{' '}
            {environment === 'live' ? 'live' : 'sandbox'} mode.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={exportCsv} disabled={history.length === 0}>
          <Download size={16} /> Download CSV
        </button>
      </header>

      {loadError && <div className="usage-error">{loadError}</div>}

      <div className="usage-metric-grid">
        {METRICS.map((m) => {
          const Icon = m.icon
          return (
            <button
              key={m.key}
              className={`usage-metric-card ${metric === m.key ? 'is-selected' : ''}`}
              onClick={() => setMetric(m.key)}
              aria-pressed={metric === m.key}
            >
              <span className="usage-metric-label">
                <Icon size={15} /> {m.label}
              </span>
              <span className="usage-metric-value">{formatNumber(usage?.[m.key])}</span>
              <span className="usage-metric-unit">{m.unit}</span>
            </button>
          )
        })}
      </div>

      <section className="usage-chart-card">
        <div className="usage-chart-head">
          <h2>{activeMetric.label} over time</h2>
          <span className="usage-chart-meta">
            {usage?.event_count ? `${formatNumber(usage.event_count)} metered events` : 'No metered events yet'}
          </span>
        </div>

        {series.length === 0 ? (
          <div className="usage-empty">
            <p>No usage recorded yet — place a test call and it will show up here.</p>
          </div>
        ) : (
          <>
            <Waveform
              size="chart"
              env={environment}
              values={series.map(([, value]) => value)}
              labels={series.map(([day]) => day)}
              ariaLabel={`${activeMetric.label} per day`}
            />
            <div className="usage-chart-axis">
              <span>{series[0][0]}</span>
              <span>{series[series.length - 1][0]}</span>
            </div>
          </>
        )}
      </section>

      <section className="usage-table-card">
        <div className="usage-chart-head">
          <h2>Recent calls</h2>
          <span className="usage-chart-meta">{calls.length} in this period</span>
        </div>
        {calls.length === 0 ? (
          <div className="usage-empty">
            <p>No calls yet — create an agent and place a test call to see it here.</p>
          </div>
        ) : (
          <table className="usage-table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Agent</th>
                <th>Caller</th>
                <th>Status</th>
                <th>Turns</th>
              </tr>
            </thead>
            <tbody>
              {calls.slice(0, 10).map((call) => (
                <tr key={call.id}>
                  <td>{call.start_time ? new Date(call.start_time).toLocaleString() : '—'}</td>
                  <td>{call.agent_name || '—'}</td>
                  <td className="mono">{call.caller_number || '—'}</td>
                  <td>
                    <span className={`usage-status status-${call.status}`}>{call.status}</span>
                  </td>
                  <td>{call.turn_count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="usage-footnote">
        <Clock size={13} /> Usage is summed from the metering ledger, so these totals match what you are billed for.
      </p>
    </div>
  )
}

export default UsageCenter
