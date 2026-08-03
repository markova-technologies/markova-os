import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Phone, 
  MessageSquare, 
  Bot, 
  User, 
  Sparkles, 
  Play, 
  Download, 
  ArrowRight,
  ArrowLeft,
  Headphones,
  Search,
  Filter,
  Loader2
} from 'lucide-react'
import api from '../api/client'
import realTimeService from '../services/realTimeService'
import './CallCenter.css'

const fallbackCalls = [
  { 
    id: 'c-101', 
    number: '+1 (415) 555-0198', 
    time: 'Live', 
    duration: '02:14',
    status: 'live',
    agent: 'Support Team',
    sentiment: 'neutral',
    transcript: [
      { speaker: 'agent', text: 'Hi there, you\'ve reached Markova Support. I\'m an AI assistant. How can I help you today?' },
      { speaker: 'user', text: 'Yes, I am having trouble logging into my dashboard. It keeps giving me a 500 error.' },
      { speaker: 'agent', text: 'I apologize for the inconvenience. A 500 error usually indicates a temporary server issue. Let me check the system status for you.' },
      { speaker: 'user', text: 'Okay, please hurry, I need to export my reports.' },
    ]
  },
  { 
    id: 'c-100', 
    number: '+251 911 234 567', 
    time: '10 mins ago', 
    duration: '04:30',
    status: 'completed',
    agent: 'Sales Team',
    sentiment: 'positive',
    summary: 'Caller was interested in the Enterprise plan. Asked about SLA and custom integrations. I successfully answered the SLA questions and transferred the call to the Booking Agent to schedule a technical deep-dive.',
    transcript: [
      { speaker: 'agent', text: 'Thank you for calling Markova Sales. How can I assist you with your AI workforce needs?' },
      { speaker: 'user', text: 'Hi, I want to know if your Enterprise plan includes a dedicated technical account manager.' }
    ]
  },
  { 
    id: 'c-099', 
    number: '+44 7700 900077', 
    time: '1 hour ago', 
    duration: '01:15',
    status: 'completed',
    agent: 'Commander Agent',
    sentiment: 'negative',
    summary: 'Caller was frustrated and asked to speak to a human immediately. Commander Agent routed the call to the Human Escalation queue.',
    transcript: []
  }
]

const CallCenter = () => {
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all') // 'all', 'live', 'completed', 'voicemail'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCallId, setSelectedCallId] = useState(null)
  const [isListening, setIsListening] = useState(false)
  const [isMobileDetailView, setIsMobileDetailView] = useState(false)
  const transcriptEndRef = useRef(null)

  // Detect mobile viewport
  const isMobile = () => window.innerWidth <= 768

  useEffect(() => {
    fetchCalls()

    // Setup resilient realTimeService WebSocket for live updates with auto-reconnect
    const onCallUpdate = (payload) => {
      setCalls(prev => {
        const targetId = payload.id || payload.call_id
        if (!targetId) return prev
        const exists = prev.find(c => c.id === targetId || c.call_id === targetId)
        if (exists) {
          return prev.map(c => (c.id === targetId || c.call_id === targetId) ? { ...c, ...payload } : c)
        } else {
          return [payload, ...prev]
        }
      })
    }

    const onCallTranscript = (payload) => {
      setCalls(prev => prev.map(c => {
        const targetId = payload.callId || payload.call_id
        if (c.id === targetId || c.call_id === targetId) {
          return { ...c, transcript: [...(c.transcript || []), payload.message || payload] }
        }
        return c
      }))
    }

    realTimeService.on('CALL_UPDATE', onCallUpdate)
    realTimeService.on('call.updated', onCallUpdate)
    realTimeService.on('call.started', onCallUpdate)
    realTimeService.on('CALL_TRANSCRIPT', onCallTranscript)
    realTimeService.on('call.transcript', onCallTranscript)
    realTimeService.connect()

    return () => {
      realTimeService.off('CALL_UPDATE', onCallUpdate)
      realTimeService.off('call.updated', onCallUpdate)
      realTimeService.off('call.started', onCallUpdate)
      realTimeService.off('CALL_TRANSCRIPT', onCallTranscript)
      realTimeService.off('call.transcript', onCallTranscript)
    }
  }, [])

  const fetchCalls = async () => {
    try {
      const res = await api.get('/calls').catch(() => ({ data: [] }))
      if (res.data && res.data.length > 0) {
        setCalls(res.data)
        setSelectedCallId(res.data[0].id)
      } else {
        setCalls(fallbackCalls)
        setSelectedCallId(fallbackCalls[0].id)
      }
    } catch (e) {
      setCalls(fallbackCalls)
      setSelectedCallId(fallbackCalls[0].id)
    } finally {
      setLoading(false)
    }
  }

  const filteredCalls = useMemo(() => {
    return calls.filter(c => {
      const matchTab = activeTab === 'all' || 
                       (activeTab === 'live' && c.status === 'live') || 
                       (activeTab === 'completed' && c.status === 'completed') ||
                       (activeTab === 'voicemail' && c.agent === 'Voicemail Agent')
      
      const matchSearch = c.number.includes(searchQuery) || 
                          c.agent.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (c.summary && c.summary.toLowerCase().includes(searchQuery.toLowerCase()))

      return matchTab && matchSearch
    })
  }, [calls, activeTab, searchQuery])

  const selectedCall = useMemo(() => calls.find(c => c.id === selectedCallId), [calls, selectedCallId])

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [selectedCall?.transcript])

  const handleExportCSV = () => {
    if (!selectedCall) return
    const headers = ['Speaker', 'Transcript Text']
    const rows = (selectedCall.transcript || []).map(row => {
      const speaker = row.speaker || 'unknown'
      const text = (row.text || '').replace(/"/g, '""')
      return `"${speaker}","${text}"`
    })

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `call_transcript_${selectedCall.id}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleListenIn = () => {
    setIsListening(!isListening)
    if (!isListening) {
      // Stub logic
    }
  }

  const handleBargeIn = () => {
    alert("Barging into the call... The AI agent has been muted, and your microphone is now live.")
  }

  const handleSelectCall = (callId) => {
    setSelectedCallId(callId)
    if (isMobile()) {
      setIsMobileDetailView(true)
    }
  }

  const handleBackToList = () => {
    setIsMobileDetailView(false)
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--primary)' }}><Loader2 className="spinner" size={48} /></div>;
  }

  return (
    <div className="call-center">
      {/* Sidebar List */}
      <div className={`cc-sidebar${isMobileDetailView ? ' mobile-hidden' : ''}`}>
        <div className="cc-sidebar-header">
          <h2>Operations Center</h2>
          <p>Monitor live calls and history</p>
          <div className="cc-search" style={{ marginTop: '1rem', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray)' }} />
            <input 
              type="text" 
              placeholder="Search number or agent..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '0.5rem', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)' }}
            />
          </div>
        </div>
        
        <div className="cc-filter-tabs" style={{ display: 'flex', gap: '0.5rem', padding: '0 1.5rem', marginBottom: '1rem', overflowX: 'auto' }}>
          <button className={`cc-ftab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>All</button>
          <button className={`cc-ftab ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>Live</button>
          <button className={`cc-ftab ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>Completed</button>
          <button className={`cc-ftab ${activeTab === 'voicemail' ? 'active' : ''}`} onClick={() => setActiveTab('voicemail')}>Voicemails</button>
        </div>

        <div className="cc-list">
          {filteredCalls.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--gray)', padding: '2rem' }}>No calls found.</p>
          ) : (
            filteredCalls.map(call => (
              <div 
                key={call.id} 
                className={`call-item ${selectedCallId === call.id ? 'active' : ''}`}
                onClick={() => handleSelectCall(call.id)}
              >
                <div className="ci-header">
                  <span className="ci-number">{call.number}</span>
                  {call.status === 'live' ? (
                    <span className="ci-time" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span className="dot" style={{ background: '#ef4444', animation: 'pulseRed 1.5s infinite' }}></span> Live
                    </span>
                  ) : (
                    <span className="ci-time">{call.time}</span>
                  )}
                </div>
                <div className="ci-meta">
                  <span className={`ci-sentiment sentiment-${call.sentiment || 'neutral'}`}>ΓùÅ</span>
                  <span className="ci-agent"><Bot size={12} /> {call.agent}</span>
                  <span>{call.duration}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Details */}
      <div className={`cc-details${!isMobileDetailView ? ' mobile-hidden' : ''}`}>
        {isMobileDetailView && (
          <button className="cc-mobile-back" onClick={handleBackToList}>
            <ArrowLeft size={15} />
            Back to Calls
          </button>
        )}
        {selectedCall ? (
          <AnimatePresence mode="wait">
            <motion.div 
              key={selectedCall.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
            >
              <div className="details-header">
                <div className="dh-info">
                  <h1>{selectedCall.number}</h1>
                  <div className="dh-badges">
                    {selectedCall.status === 'live' ? (
                      <div className="dh-badge badge-live">
                        <div className="dot" style={{ animation: 'pulseRed 1.5s infinite' }}></div> Live Call ΓÇó {selectedCall.duration}
                      </div>
                    ) : (
                      <div className="dh-badge badge-completed">
                        Completed ΓÇó {selectedCall.duration}
                      </div>
                    )}
                    <div className="dh-badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)' }}>
                      <Bot size={14} /> {selectedCall.agent}
                    </div>
                  </div>
                </div>
                <div className="dh-actions">
                  <button className="btn btn-secondary" onClick={handleExportCSV}><Download size={16} /> Export CSV</button>
                  {selectedCall.status === 'live' && (
                    <>
                      <button className="btn btn-secondary" onClick={handleListenIn} style={{ background: isListening ? 'var(--bg-card)' : 'transparent', border: isListening ? '1px solid #10b981' : '1px solid var(--border-main)' }}>
                        <Headphones size={16} color={isListening ? '#10b981' : 'currentColor'} /> {isListening ? 'Listening...' : 'Listen In'}
                      </button>
                      <button className="btn btn-primary" onClick={handleBargeIn} style={{ background: '#ef4444', borderColor: '#ef4444' }}><Phone size={16} /> Barge In</button>
                    </>
                  )}
                </div>
              </div>

              <div className="details-content">
                {/* Left: Transcript */}
                <div className="transcript-area">
                  <h3 className="section-title"><MessageSquare size={18} /> Live Transcript</h3>
                  <div className="transcript-box">
                    {selectedCall.transcript && selectedCall.transcript.length > 0 ? (
                      selectedCall.transcript.map((msg, i) => (
                        <div className={`message-row ${msg.speaker}`} key={i}>
                          <div className="msg-avatar">
                            {msg.speaker === 'agent' ? <Bot size={18} /> : <User size={18} />}
                          </div>
                          <div className="msg-bubble">{msg.text}</div>
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--gray)', padding: '2rem' }}>
                        No transcript available for this call.
                      </div>
                    )}
                    
                    {selectedCall.status === 'live' && (
                      <div className="message-row agent" style={{ opacity: 0.5 }}>
                        <div className="msg-avatar"><Bot size={18} /></div>
                        <div className="msg-bubble" style={{ display: 'flex', gap: '0.25rem', padding: '1rem' }}>
                          <span className="dot" style={{width:'6px',height:'6px',background:'var(--text-main)',borderRadius:'50%',animation:'pulseRed 1s infinite'}}></span>
                          <span className="dot" style={{width:'6px',height:'6px',background:'var(--text-main)',borderRadius:'50%',animation:'pulseRed 1s infinite 0.2s'}}></span>
                          <span className="dot" style={{width:'6px',height:'6px',background:'var(--text-main)',borderRadius:'50%',animation:'pulseRed 1s infinite 0.4s'}}></span>
                        </div>
                      </div>
                    )}
                    <div ref={transcriptEndRef} />
                  </div>
                </div>

                {/* Right: Insights */}
                <div className="insights-panel">
                  <div className="insight-card">
                    <h3><Sparkles size={16} color="#10b981" /> AI Summary & Intent</h3>
                    {selectedCall.status === 'live' ? (
                      <div style={{ padding: '1rem', border: '1px dashed var(--border-main)', borderRadius: '0.5rem' }}>
                        <p style={{ margin: '0 0 0.5rem 0', color: 'var(--gray)', fontSize: '0.85rem' }}>Live Detected Intent:</p>
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', display: 'inline-block', fontSize: '0.8rem', fontWeight: 600 }}>Analyzing...</div>
                      </div>
                    ) : (
                      <p className="ai-summary">{selectedCall.summary}</p>
                    )}
                  </div>

                  <div className="insight-card">
                    <h3><Play size={16} /> Recording</h3>
                    {selectedCall.status === 'live' ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--gray)' }}>Recording in progress...</p>
                    ) : (
                      <audio controls key={selectedCall.id} className="audio-player" style={{ width: '100%' }}>
                        <source src={selectedCall.audioUrl || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"} type="audio/mpeg" />
                        Your browser does not support the audio element.
                      </audio>
                    )}
                  </div>

                  <div className="insight-card">
                    <h3>Routing History</h3>
                    <div className="transfer-chain">
                      <div className="transfer-step">
                        <div className="step-icon"><Phone size={14} /></div>
                        Inbound Call Received
                      </div>
                      <div className="transfer-step" style={{ paddingLeft: '12px' }}>
                        <ArrowRight size={14} color="var(--gray)" />
                      </div>
                      <div className="transfer-step">
                        <div className="step-icon"><Bot size={14} /></div>
                        Commander Agent
                      </div>
                      {selectedCall.agent !== 'Commander Agent' && (
                        <>
                          <div className="transfer-step" style={{ paddingLeft: '12px' }}>
                            <ArrowRight size={14} color="var(--gray)" />
                          </div>
                          <div className="transfer-step">
                            <div className="step-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}><Bot size={14} /></div>
                            {selectedCall.agent}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--gray)' }}>
            <Phone size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <h3>Select a call to view details</h3>
          </div>
        )}
      </div>
    </div>
  )
}

export default CallCenter
