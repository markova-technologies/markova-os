import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bot, PhoneForwarded, Search, User } from 'lucide-react'
import {
  listCalls,
  listAgents,
  getCall,
  getCallTranscript,
  getCallRecording,
  getTransferContext,
} from '../api/client'
import { useEnvironment } from '../contexts/EnvironmentContext'
import Skeleton from '../components/Skeleton'
import './CallCenter.css'

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
]

const formatDuration = (start, end) => {
  if (!start) return '—'
  const secs = Math.max(0, Math.round(((end ? new Date(end) : new Date()) - new Date(start)) / 1000))
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
}

const CallCenter = () => {
  const { callId } = useParams()
  const navigate = useNavigate()
  const { environment } = useEnvironment()

  const [calls, setCalls] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [status, setStatus] = useState('all')
  const [agentId, setAgentId] = useState('')
  const [since, setSince] = useState('')
  const [query, setQuery] = useState('')

  const [detail, setDetail] = useState(null)
  const [transcript, setTranscript] = useState([])
  const [recording, setRecording] = useState(null)
  const [transferContext, setTransferContext] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadCalls = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (status !== 'all') params.status = status
      if (agentId) params.agent_id = agentId
      const { data } = await listCalls(params)
      setCalls(Array.isArray(data) ? data : [])
      setLoadError(null)
    } catch {
      setLoadError('We couldn’t load your calls. Refresh to try again.')
    } finally {
      setLoading(false)
    }
  }, [status, agentId])

  useEffect(() => { loadCalls() }, [loadCalls, environment])

  useEffect(() => {
    listAgents().then(({ data }) => setAgents(Array.isArray(data) ? data : [])).catch(() => setAgents([]))
  }, [])

  useEffect(() => {
    if (!callId) {
      setDetail(null)
      setTranscript([])
      setRecording(null)
      setTransferContext(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    Promise.allSettled([
      getCall(callId),
      getCallTranscript(callId),
      getCallRecording(callId),
      getTransferContext(callId),
    ]).then(([callRes, transcriptRes, recordingRes, transferRes]) => {
      if (cancelled) return
      setDetail(callRes.status === 'fulfilled' ? callRes.value.data : null)
      setTranscript(
        transcriptRes.status === 'fulfilled' && Array.isArray(transcriptRes.value.data)
          ? transcriptRes.value.data
          : []
      )
      setRecording(recordingRes.status === 'fulfilled' ? recordingRes.value.data : null)
      setTransferContext(
        transferRes.status === 'fulfilled' && transferRes.value.data?.context
          ? transferRes.value.data
          : null
      )
      setDetailLoading(false)
    })
    return () => { cancelled = true }
  }, [callId])

  const visibleCalls = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const from = since ? new Date(since).getTime() : null
    return calls.filter((c) => {
      if (from && new Date(c.start_time).getTime() < from) return false
      if (!needle) return true
      return (
        (c.caller_number || '').toLowerCase().includes(needle) ||
        (c.agent_name || '').toLowerCase().includes(needle)
      )
    })
  }, [calls, query, since])

  const recordingUrl = recording?.recording_url || detail?.recording_url

  return (
    <div className="call-center">
      <header className="page-header">
        <h1>Calls</h1>
        <p>Every call your agents handled, with the transcript of what was said.</p>
      </header>

      <div className="cl-filters">
        <div className="cl-tabs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              className={status === tab.id ? 'active' : ''}
              onClick={() => setStatus(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <select value={agentId} onChange={(e) => setAgentId(e.target.value)} aria-label="Filter by agent">
          <option value="">All agents</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        <input type="date" value={since} onChange={(e) => setSince(e.target.value)} aria-label="Calls since" />

        <div className="cl-search">
          <Search size={15} />
          <input
            type="search"
            placeholder="Search a number or agent"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {loadError && <div className="cl-error">{loadError}</div>}

      <div className="cl-layout">
        <section className="cl-list">
          {loading ? (
            [0, 1, 2, 3].map((i) => <Skeleton key={i} variant="text" height="58px" />)
          ) : visibleCalls.length === 0 ? (
            <div className="cl-empty">
              {calls.length === 0
                ? 'No calls yet — create an agent and place a test call to see it here.'
                : 'No calls match those filters. Widen the date or clear the search.'}
            </div>
          ) : (
            visibleCalls.map((call) => (
              <motion.button
                key={call.id}
                className={`cl-row ${call.id === callId ? 'selected' : ''}`}
                onClick={() => navigate(`/call-center/${call.id}`)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <span className="cl-row-number mono">{call.caller_number || 'Unknown caller'}</span>
                <span className="cl-row-agent">{call.agent_name || '—'}</span>
                <span className="cl-row-meta">
                  {call.start_time ? new Date(call.start_time).toLocaleString() : ''}
                  {' · '}
                  {formatDuration(call.start_time, call.end_time)}
                </span>
                <span className="cl-row-badges">
                  {call.sandbox && <span className="cl-badge sandbox">Test</span>}
                  <span className={`cl-badge status ${call.status}`}>{call.status}</span>
                </span>
              </motion.button>
            ))
          )}
        </section>

        <section className="cl-detail">
          {!callId ? (
            <div className="cl-empty">Pick a call to read its transcript.</div>
          ) : detailLoading ? (
            <div className="cl-skeleton-detail">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} variant="text" height="34px" />)}
            </div>
          ) : !detail ? (
            <div className="cl-empty">We couldn’t open that call. It may have been removed.</div>
          ) : (
            <>
              <div className="cl-detail-head">
                <div>
                  <h2 className="mono">{detail.caller_number || 'Unknown caller'}</h2>
                  <p>
                    {detail.agent_name || 'Agent'} · {formatDuration(detail.start_time, detail.end_time)}
                    {detail.sandbox ? ' · Sandbox call, not billed' : ''}
                  </p>
                </div>
                <span className={`cl-badge status ${detail.status}`}>{detail.status}</span>
              </div>

              {recordingUrl && (
                <audio className="cl-audio" controls src={recordingUrl}>
                  Your browser can’t play this recording. Download it instead.
                </audio>
              )}

              {transferContext && (
                <div className="cl-transfer">
                  <div className="cl-transfer-head">
                    <PhoneForwarded size={15} />
                    <strong>Handed to a person</strong>
                    {transferContext.transferred_to && (
                      <span className="mono">{transferContext.transferred_to}</span>
                    )}
                  </div>
                  {transferContext.context?.summary && <p>{transferContext.context.summary}</p>}
                </div>
              )}

              {transcript.length === 0 ? (
                <div className="cl-empty">
                  No transcript for this call
                  {detail.status === 'active' ? ' yet — it’s still in progress.' : '.'}
                </div>
              ) : (
                <ol className="cl-transcript">
                  {transcript.map((line, i) => (
                    <li key={i} className={line.role === 'assistant' ? 'agent' : line.role === 'system' ? 'system' : 'caller'}>
                      <span className="cl-speaker">
                        {line.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
                        {line.role === 'assistant' ? 'Agent' : line.role === 'system' ? 'System' : 'Caller'}
                      </span>
                      <p>{line.content}</p>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default CallCenter
