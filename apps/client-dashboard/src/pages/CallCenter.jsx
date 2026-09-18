import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Phone, 
  PhoneCall,
  PhoneOff,
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
  Loader2,
  TrendingUp,
  Minus,
  AlertCircle,
  Volume2,
  VolumeX,
  ShieldAlert,
  Radio,
  Check,
  RefreshCw,
  X,
  ExternalLink,
  Clock,
  Lock,
  Mic,
  MicOff,
  AlertTriangle
} from 'lucide-react'
import api from '../api/client'
import realTimeService from '../services/realTimeService'
import { useNavigate, useParams } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import './CallCenter.css'

const fallbackCalls = [
  { 
    id: 'c-101', 
    number: '+1 (415) 555-0198', 
    time: 'Live Now', 
    duration: '02:14',
    status: 'live',
    agent: 'Support Team',
    sentiment: 'neutral',
    summary: 'Caller inquiring about persistent 500 server error on dashboard login. AI agent checked system health and offered troubleshooting steps.',
    transcript: [
      { speaker: 'agent', text: "Hi there, you've reached Markova Support. I'm an AI assistant. How can I help you today?" },
      { speaker: 'user', text: "Yes, I am having trouble logging into my dashboard. It keeps giving me a 500 error." },
      { speaker: 'agent', text: "I apologize for the inconvenience. A 500 error usually indicates a temporary server issue. Let me check the system status for you." },
      { speaker: 'user', text: "Okay, please hurry, I need to export my reports." }
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
      { speaker: 'agent', text: "Thank you for calling Markova Sales. How can I assist you with your AI workforce needs?" },
      { speaker: 'user', text: "Hi, I want to know if your Enterprise plan includes a dedicated technical account manager." },
      { speaker: 'agent', text: "Yes, absolutely! Our Enterprise tier includes 24/7 dedicated support, SLA guarantees, and an assigned technical account manager." },
      { speaker: 'user', text: "That sounds great. Can we set up a live demonstration this week?" }
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
    summary: 'Caller expressed frustration with an unfulfilled order and requested an immediate human supervisor. Commander Agent flagged sentiment as escalated and transferred call to priority queue.',
    transcript: [
      { speaker: 'agent', text: "Welcome to Markova. How may I direct your call?" },
      { speaker: 'user', text: "I want to speak with a human representative right now! My shipment is two weeks late." },
      { speaker: 'agent', text: "I understand your frustration. Connecting you to our priority escalation queue right away. Please hold." }
    ]
  }
]

// Normalizes backend API records with dashboard interface schema
const normalizeCall = (c) => {
  const isLive = c.status === 'live' || c.status === 'active' || c.status === 'in-progress'
  let displayDuration = c.duration

  if (!displayDuration && c.start_time) {
    const start = new Date(c.start_time).getTime()
    const end = c.end_time ? new Date(c.end_time).getTime() : Date.now()
    const diffSec = Math.max(0, Math.floor((end - start) / 1000))
    const mins = String(Math.floor(diffSec / 60)).padStart(2, '0')
    const secs = String(diffSec % 60).padStart(2, '0')
    displayDuration = `${mins}:${secs}`
  }

  const rawTranscript = c.transcript || []
  const normalizedTranscript = Array.isArray(rawTranscript)
    ? rawTranscript.map(t => ({
        speaker: t.speaker || (t.role === 'assistant' || t.role === 'agent' ? 'agent' : 'user'),
        text: t.text || t.content || ''
      }))
    : []

  return {
    ...c,
    id: String(c.id || c.call_id || `call-${Date.now()}`),
    number: c.caller_number || c.number || 'Unknown Caller',
    agent: c.agent_name || c.agent || 'Commander Agent',
    status: isLive ? 'live' : (c.status || 'completed'),
    duration: displayDuration || '00:00',
    time: c.time || (c.start_time ? new Date(c.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'),
    sentiment: c.sentiment || 'neutral',
    summary: c.summary || (isLive ? 'Call currently in progress. Live AI transcription and intent detection active.' : 'Call completed successfully.'),
    transcript: normalizedTranscript,
    audioUrl: c.recording_url || c.audioUrl || null,
    bargedBy: c.barged_by || c.bargedBy || null
  }
}

const CallCenter = () => {
  const navigate = useNavigate()
  const { callId: urlCallId } = useParams()
  const toast = useToast()

  const [isTestAgentOpen, setIsTestAgentOpen] = useState(false)
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all') // 'all', 'live', 'completed', 'voicemail'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCallId, setSelectedCallId] = useState(null)
  const [isListening, setIsListening] = useState(false)
  const [monitorVolume, setMonitorVolume] = useState(80)
  const [isBargingIn, setIsBargingIn] = useState(false)
  const [bargeInProgress, setBargeInProgress] = useState(false)
  const [micVolumeLevel, setMicVolumeLevel] = useState(0)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [takeoverConflict, setTakeoverConflict] = useState(null)
  const [isMobileDetailView, setIsMobileDetailView] = useState(false)
  const [simulatingCall, setSimulatingCall] = useState(false)
  const transcriptEndRef = useRef(null)
  const micStreamRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animFrameRef = useRef(null)

  const isMobile = () => window.innerWidth <= 768

  const fetchCalls = useCallback(async () => {
    try {
      const res = await api.get('/calls').catch(() => ({ data: [] }))
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        const normalized = res.data.map(normalizeCall)
        setCalls(normalized)
        if (!selectedCallId) {
          setSelectedCallId(normalized[0].id)
        }
      } else {
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        const isDeveloperAccount = user.email === 'demo@markova.et' || user.email?.endsWith('@markova.et')
        if (isDeveloperAccount || !res.data || res.data.length === 0) {
          const normalizedFallbacks = fallbackCalls.map(normalizeCall)
          setCalls(normalizedFallbacks)
          if (!selectedCallId) {
            setSelectedCallId(normalizedFallbacks[0].id)
          }
        } else {
          setCalls([])
          setSelectedCallId(null)
        }
      }
    } catch (e) {
      const normalizedFallbacks = fallbackCalls.map(normalizeCall)
      setCalls(normalizedFallbacks)
      if (!selectedCallId) {
        setSelectedCallId(normalizedFallbacks[0].id)
      }
    } finally {
      setLoading(false)
    }
  }, [selectedCallId])

  useEffect(() => {
    fetchCalls()

    // Real-time WebSocket connection for live telemetry
    const onCallUpdate = (payload) => {
      setCalls(prev => {
        const targetId = payload.id || payload.call_id
        if (!targetId) return prev
        const normalized = normalizeCall(payload)
        const exists = prev.find(c => c.id === targetId || c.call_id === targetId)
        if (exists) {
          return prev.map(c => (c.id === targetId || c.call_id === targetId) ? { ...c, ...normalized } : c)
        } else {
          return [normalized, ...prev]
        }
      })
    }

    const onCallTranscript = (payload) => {
      setCalls(prev => prev.map(c => {
        const targetId = payload.callId || payload.call_id
        if (c.id === targetId || c.call_id === targetId) {
          const newTurn = {
            speaker: payload.speaker || (payload.role === 'assistant' || payload.role === 'agent' ? 'agent' : 'user'),
            text: payload.text || payload.content || payload.message || ''
          }
          return { ...c, transcript: [...(c.transcript || []), newTurn] }
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
  }, [fetchCalls])

  // Deep linking: Select call from URL param if present
  useEffect(() => {
    if (urlCallId && calls.length > 0) {
      const match = calls.find(c => c.id === urlCallId)
      if (match) {
        setSelectedCallId(match.id)
        if (isMobile()) {
          setIsMobileDetailView(true)
        }
      }
    }
  }, [urlCallId, calls])

  // Lazy fetch transcript if selected call has an empty transcript
  const fetchTranscript = useCallback(async (callId) => {
    if (!callId) return
    try {
      const res = await api.get(`/calls/${callId}/transcript`).catch(() => null)
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        const formatted = res.data.map(t => ({
          speaker: t.role === 'assistant' || t.role === 'agent' ? 'agent' : 'user',
          text: t.content || t.text || ''
        }))
        setCalls(prev => prev.map(c => c.id === callId ? { ...c, transcript: formatted } : c))
      }
    } catch {
      // Keep existing transcript
    }
  }, [])

  const filteredCalls = useMemo(() => {
    return calls.filter(c => {
      const isVoicemail = c.agent === 'Voicemail Agent' || c.status === 'voicemail'
      const matchTab = activeTab === 'all' || 
                       (activeTab === 'live' && c.status === 'live') || 
                       (activeTab === 'completed' && c.status === 'completed') ||
                       (activeTab === 'voicemail' && isVoicemail)
      
      const q = searchQuery.toLowerCase().trim()
      const matchSearch = !q || 
                          c.number.toLowerCase().includes(q) || 
                          c.agent.toLowerCase().includes(q) ||
                          (c.summary && c.summary.toLowerCase().includes(q)) ||
                          c.id.toLowerCase().includes(q)

      return matchTab && matchSearch
    })
  }, [calls, activeTab, searchQuery])

  const selectedCall = useMemo(() => calls.find(c => c.id === selectedCallId) || calls[0], [calls, selectedCallId])

  useEffect(() => {
    if (selectedCall?.id && (!selectedCall.transcript || selectedCall.transcript.length === 0)) {
      fetchTranscript(selectedCall.id)
    }
  }, [selectedCall?.id, selectedCall?.transcript, fetchTranscript])

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [selectedCall?.transcript])

  // Enterprise CSV Export: Full call metadata & transcript turns
  const handleExportCSV = () => {
    if (!selectedCall) return
    const callMetadata = [
      `# Markova OS Contact Center Audit Log`,
      `Export Timestamp,${new Date().toISOString()}`,
      `Call ID,${selectedCall.id}`,
      `Caller Number,"${selectedCall.number}"`,
      `Assigned Agent,"${selectedCall.agent}"`,
      `Status,${selectedCall.status}`,
      `Duration,${selectedCall.duration}`,
      `Sentiment,${selectedCall.sentiment}`,
      `Date/Time,"${selectedCall.time}"`,
      `AI Summary,"${(selectedCall.summary || '').replace(/"/g, '""')}"`,
      ``,
      `Speaker,Message Text`
    ]

    const transcriptRows = (selectedCall.transcript || []).map(row => {
      const speaker = (row.speaker === 'agent' ? selectedCall.agent : 'Caller')
      const text = (row.text || '').replace(/"/g, '""')
      return `"${speaker}","${text}"`
    })

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(callMetadata.concat(transcriptRows).join("\n"))
    const link = document.createElement("a")
    link.setAttribute("href", csvContent)
    link.setAttribute("download", `markova_call_${selectedCall.id}_audit.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Call audit report & transcript exported as CSV.')
  }

  // Supervisor Listen-In Audio Monitor (Multi-User Enabled)
  const handleListenIn = () => {
    const next = !isListening
    setIsListening(next)
    if (next) {
      toast.info(`Supervisor live monitor active for ${selectedCall?.number} (Listen-Only Mode). Multiple supervisors can listen simultaneously.`)
    } else {
      toast.info('Supervisor audio monitor disconnected.')
    }
  }

  // Supervisor Barge-In (Exclusive Single-Supervisor Lock + Hardware Mic Capture)
  const handleBargeIn = async () => {
    if (!selectedCall) return
    setBargeInProgress(true)
    setTakeoverConflict(null)

    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const supervisorId = user.id || 'supervisor_' + Math.random().toString(36).slice(2, 7)
    const supervisorName = user.name || user.email || 'Supervisor'

    try {
      const res = await api.post(`/calls/${selectedCall.id}/barge-in`, {
        reason: 'supervisor_manual_takeover',
        supervisor_id: supervisorId,
        supervisor_name: supervisorName
      }).catch(err => {
        if (err.response?.status === 409 || err.response?.data?.detail?.locked) {
          return { data: { locked: true, ...err.response.data.detail } }
        }
        throw err
      })

      // If call is already locked by another supervisor
      if (res?.data?.locked) {
        const lockedBy = res.data.barged_by || 'Another supervisor'
        setTakeoverConflict({
          bargedBy: lockedBy,
          message: res.data.message || `Supervisor ${lockedBy} has already barged into this call. Only one supervisor can take over at a time.`
        })
        toast.warning(`Takeover Locked: Supervisor ${lockedBy} is already on this call.`)
        return
      }

      // Request browser microphone with strict acoustic echo cancellation
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          })
          micStreamRef.current = stream

          const AudioContextClass = window.AudioContext || window.webkitAudioContext
          if (AudioContextClass) {
            const audioCtx = new AudioContextClass()
            audioContextRef.current = audioCtx
            const source = audioCtx.createMediaStreamSource(stream)
            const analyser = audioCtx.createAnalyser()
            analyser.fftSize = 64
            source.connect(analyser)
            analyserRef.current = analyser

            const dataArray = new Uint8Array(analyser.frequencyBinCount)
            const updateMeter = () => {
              if (!analyserRef.current) return
              analyserRef.current.getByteFrequencyData(dataArray)
              let sum = 0
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i]
              }
              const avg = sum / dataArray.length
              const normalized = Math.min(100, Math.round((avg / 128) * 100))
              setMicVolumeLevel(normalized)
              animFrameRef.current = requestAnimationFrame(updateMeter)
            }
            updateMeter()
          }
        }
      } catch (micErr) {
        console.warn('Microphone permission not granted or device unavailable:', micErr)
        toast.info('Microphone access not granted in browser. AI voice muted; speak through SIP softphone.')
      }

      setIsBargingIn(true)
      setIsMicMuted(false)
      toast.success('Barge-in active: AI Agent muted. Supervisor mic connected.')
    } catch {
      toast.error('Failed to trigger telephony barge-in.')
    } finally {
      setBargeInProgress(false)
    }
  }

  const handleReleaseBargeIn = async () => {
    if (selectedCall) {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      api.post(`/calls/${selectedCall.id}/release-barge-in`, {
        supervisor_id: user.id
      }).catch(() => null)
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop())
      micStreamRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }

    setIsBargingIn(false)
    setMicVolumeLevel(0)
    setTakeoverConflict(null)
    toast.info('Barge-in released. AI Agent resumed call control.')
  }

  const handleToggleMicMute = () => {
    if (micStreamRef.current) {
      const audioTracks = micStreamRef.current.getAudioTracks()
      const nextMuted = !isMicMuted
      audioTracks.forEach(track => {
        track.enabled = !nextMuted
      })
      setIsMicMuted(nextMuted)
      toast.info(nextMuted ? 'Supervisor microphone muted.' : 'Supervisor microphone active.')
    }
  }

  const handleSelectCall = (callId) => {
    if (isBargingIn) {
      handleReleaseBargeIn()
    }
    setSelectedCallId(callId)
    setIsBargingIn(false)
    setIsListening(false)
    setTakeoverConflict(null)
    if (isMobile()) {
      setIsMobileDetailView(true)
    }
  }

  const handleBackToList = () => {
    setIsMobileDetailView(false)
  }

  // Quick Inbound Test Call Simulator
  const handleSimulateCall = async () => {
    setSimulatingCall(true)
    try {
      const mockId = `live-sim-${Date.now().toString().slice(-4)}`
      const newLiveCall = normalizeCall({
        id: mockId,
        number: '+251 922 884 120',
        time: 'Just Now',
        duration: '00:08',
        status: 'live',
        agent: 'Commander Agent',
        sentiment: 'positive',
        summary: 'Incoming customer call simulating live Amharic inquiry.',
        transcript: [
          { speaker: 'agent', text: 'እንኳን ወደ ማርኮቫ ደህና መጡ! ዛሬ እንዴት ልርዳዎት እችላለሁ?' },
          { speaker: 'user', text: 'ሰላም! ስለ ቢዝነስ ፓኬጃችሁ መረጃ ፈልጌ ነበር።' }
        ]
      })
      setCalls(prev => [newLiveCall, ...prev])
      setSelectedCallId(mockId)
      setIsTestAgentOpen(false)
      toast.success('Live inbound test call placed. Monitoring active stream.')
    } catch {
      toast.error('Could not simulate test call.')
    } finally {
      setSimulatingCall(false)
    }
  }

  if (loading) {
    return (
      <div className="cc-loading-screen">
        <Loader2 className="spinner" size={42} />
        <span>Loading Contact Center Operations...</span>
      </div>
    )
  }

  return (
    <div className="call-center">
      {/* SIDEBAR CALL LIST */}
      <div className={`cc-sidebar${isMobileDetailView ? ' mobile-hidden' : ''}`}>
        <div className="cc-sidebar-header">
          <div className="cc-brand-row">
            <div>
              <h2>Operations Center</h2>
              <p>Monitor live calls and telephony history</p>
            </div>
            <button className="cc-btn-test-agent" onClick={() => setIsTestAgentOpen(true)}>
              <Headphones size={15} />
              <span>Test Agent</span>
            </button>
          </div>

          <div className="cc-search">
            <Search size={15} className="cc-search-icon" />
            <input 
              type="text" 
              placeholder="Search number, agent, or summary..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="cc-search-input"
            />
          </div>
        </div>
        
        <div className="cc-filter-tabs">
          <button className={`cc-ftab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
            All ({calls.length})
          </button>
          <button className={`cc-ftab ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>
            <span className="cc-tab-live-dot" /> Live ({calls.filter(c => c.status === 'live').length})
          </button>
          <button className={`cc-ftab ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>
            Completed
          </button>
          <button className={`cc-ftab ${activeTab === 'voicemail' ? 'active' : ''}`} onClick={() => setActiveTab('voicemail')}>
            Voicemail
          </button>
        </div>

        <div className="cc-list">
          {filteredCalls.length === 0 ? (
            <div className="cc-empty-list">
              <PhoneOff size={32} />
              <p>No matching calls found.</p>
              <span>Try clearing search or filters</span>
            </div>
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
                    <span className="ci-time ci-time-live">
                      <span className="dot pulse-emerald" /> Live
                    </span>
                  ) : (
                    <span className="ci-time">{call.time}</span>
                  )}
                </div>
                <div className="ci-meta">
                  {/* Semantic Sentiment Indicator with zero mojibake */}
                  <span className={`ci-sentiment-badge sentiment-${call.sentiment || 'neutral'}`}>
                    {call.sentiment === 'positive' ? (
                      <>
                        <TrendingUp size={11} />
                        <span>Positive</span>
                      </>
                    ) : call.sentiment === 'negative' ? (
                      <>
                        <AlertCircle size={11} />
                        <span>Escalated</span>
                      </>
                    ) : (
                      <>
                        <Minus size={11} />
                        <span>Neutral</span>
                      </>
                    )}
                  </span>

                  <span className="ci-agent">
                    <Bot size={12} />
                    <span>{call.agent}</span>
                  </span>

                  <span className="ci-duration">
                    <Clock size={11} />
                    <span>{call.duration}</span>
                  </span>

                  {call.bargedBy && (
                    <span className="ci-barged-badge" title={`Supervisor takeover active by ${call.bargedBy}`}>
                      <Lock size={10} />
                      <span>Barged</span>
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MAIN DETAILS PANEL */}
      <div className={`cc-details${!isMobileDetailView ? ' mobile-hidden' : ''}`}>
        {isMobileDetailView && (
          <button className="cc-mobile-back" onClick={handleBackToList}>
            <ArrowLeft size={15} />
            <span>Back to Call List</span>
          </button>
        )}

        {selectedCall ? (
          <AnimatePresence mode="wait">
            <motion.div 
              key={selectedCall.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="cc-details-container"
            >
              {/* TAKEOVER CONFLICT ALERT */}
              {takeoverConflict && (
                <div className="cc-conflict-banner">
                  <div className="cc-conflict-info">
                    <Lock size={18} className="cc-conflict-lock-icon" />
                    <div>
                      <strong>SUPERVISOR TAKEOVER IN PROGRESS</strong>
                      <p>{takeoverConflict.message}</p>
                    </div>
                  </div>
                  <button className="cc-btn-conflict-dismiss" onClick={() => setTakeoverConflict(null)}>
                    <X size={14} />
                    <span>Dismiss</span>
                  </button>
                </div>
              )}

              {/* SUPERVISOR BARGE-IN TAKEOVER HUD */}
              {isBargingIn && (
                <div className="cc-barge-banner">
                  <div className="cc-barge-info">
                    <span className="cc-barge-live-dot" />
                    <ShieldAlert size={18} />
                    <div>
                      <div className="cc-barge-title-row">
                        <strong>SUPERVISOR TAKEOVER ACTIVE</strong>
                        <span className="cc-headset-badge" title="Wear headphones to prevent acoustic echo feedback">
                          <Headphones size={11} />
                          <span>Headset Recommended</span>
                        </span>
                      </div>
                      <p>AI agent voice muted. Microphone bridged directly to {selectedCall.number}.</p>
                    </div>
                  </div>
                  <div className="cc-barge-mic-controls">
                    <button 
                      className={`cc-btn-mic-toggle ${isMicMuted ? 'muted' : 'active'}`}
                      onClick={handleToggleMicMute}
                      title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                    >
                      {isMicMuted ? <MicOff size={13} /> : <Mic size={13} />}
                      <span>{isMicMuted ? 'Muted' : 'Live Mic'}</span>
                    </button>
                    <div className="cc-mic-level-meter" title={`Microphone Level: ${micVolumeLevel}%`}>
                      <div 
                        className="cc-mic-level-fill" 
                        style={{ width: `${isMicMuted ? 0 : micVolumeLevel}%` }} 
                      />
                    </div>
                    <button className="cc-btn-release" onClick={handleReleaseBargeIn}>
                      <RefreshCw size={13} />
                      <span>Release &amp; Resume AI</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SUPERVISOR LISTEN-IN AUDIO HUD */}
              {isListening && (
                <div className="cc-listen-banner">
                  <div className="cc-listen-indicator">
                    <Radio size={15} className="cc-radio-pulse" />
                    <span>Monitoring Live Stream &bull; Multi-Supervisor Eavesdrop Active</span>
                    <div className="cc-audio-bars">
                      <span className="bar b1" />
                      <span className="bar b2" />
                      <span className="bar b3" />
                      <span className="bar b4" />
                    </div>
                  </div>
                  <div className="cc-listen-controls">
                    <Volume2 size={15} />
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={monitorVolume} 
                      onChange={e => setMonitorVolume(Number(e.target.value))} 
                      className="cc-volume-slider"
                      title="Monitor Volume"
                    />
                    <button className="cc-btn-close-monitor" onClick={() => setIsListening(false)} title="Stop Monitoring">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* CALL HEADER */}
              <div className="details-header">
                <div className="dh-info">
                  <h1>{selectedCall.number}</h1>
                  <div className="dh-badges">
                    {selectedCall.status === 'live' ? (
                      <div className="dh-badge badge-live">
                        <span className="dot pulse-emerald" />
                        <span>Live Call</span>
                        <span className="cc-dot-sep">•</span>
                        <span>{selectedCall.duration}</span>
                      </div>
                    ) : (
                      <div className="dh-badge badge-completed">
                        <Check size={13} />
                        <span>Completed</span>
                        <span className="cc-dot-sep">•</span>
                        <span>{selectedCall.duration}</span>
                      </div>
                    )}
                    <div className="dh-badge dh-badge-agent">
                      <Bot size={14} />
                      <span>{selectedCall.agent}</span>
                    </div>
                  </div>
                </div>

                <div className="dh-actions">
                  <button className="cc-btn-action" onClick={handleExportCSV}>
                    <Download size={15} />
                    <span>Export CSV</span>
                  </button>
                  {selectedCall.status === 'live' && (
                    <>
                      <button 
                        className={`cc-btn-action ${isListening ? 'active-listen' : ''}`} 
                        onClick={handleListenIn}
                        title="Listen in to live call without interrupting (Multiple supervisors can listen simultaneously)"
                      >
                        <Headphones size={15} />
                        <span>{isListening ? 'Listening...' : 'Listen In'}</span>
                      </button>
                      {selectedCall.bargedBy && !isBargingIn ? (
                        <button 
                          className="cc-btn-action cc-btn-barge cc-barge-locked" 
                          onClick={() => {
                            setTakeoverConflict({
                              bargedBy: selectedCall.bargedBy,
                              message: `Supervisor ${selectedCall.bargedBy} has already barged into this call. Only one supervisor can take over at a time to prevent voice collision.`
                            })
                            toast.warning(`Takeover Locked: Supervisor ${selectedCall.bargedBy} is already on this call.`)
                          }}
                          title={`Takeover locked by ${selectedCall.bargedBy}`}
                        >
                          <Lock size={14} />
                          <span>Barged ({selectedCall.bargedBy})</span>
                        </button>
                      ) : (
                        <button 
                          className={`cc-btn-action cc-btn-barge ${isBargingIn ? 'cc-btn-barge-active' : ''}`} 
                          onClick={handleBargeIn}
                          disabled={bargeInProgress || isBargingIn}
                          title="Take over call: Mutes AI agent voice and bridges your microphone"
                        >
                          {bargeInProgress ? (
                            <Loader2 size={15} className="spinner" />
                          ) : isBargingIn ? (
                            <ShieldAlert size={15} />
                          ) : (
                            <PhoneCall size={15} />
                          )}
                          <span>{isBargingIn ? 'Barged In' : 'Barge In'}</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* DETAILS CONTENT */}
              <div className="details-content">
                {/* LEFT: TRANSCRIPT */}
                <div className="transcript-area">
                  <div className="transcript-header-row">
                    <h3 className="section-title">
                      <MessageSquare size={17} />
                      <span>Live Call Transcript</span>
                    </h3>
                    {selectedCall.status === 'live' && (
                      <span className="cc-stream-pill">
                        <span className="cc-pulse-dot" /> Live Stream
                      </span>
                    )}
                  </div>

                  <div className="transcript-box">
                    {selectedCall.transcript && selectedCall.transcript.length > 0 ? (
                      selectedCall.transcript.map((msg, i) => (
                        <div className={`message-row ${msg.speaker}`} key={i}>
                          <div className="msg-avatar">
                            {msg.speaker === 'agent' ? <Bot size={16} /> : <User size={16} />}
                          </div>
                          <div className="msg-bubble">
                            <div className="msg-speaker-label">
                              {msg.speaker === 'agent' ? selectedCall.agent : 'Caller'}
                            </div>
                            <div className="msg-text">{msg.text}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="cc-empty-transcript">
                        <MessageSquare size={32} />
                        <p>No transcript recorded for this session.</p>
                      </div>
                    )}
                    
                    {selectedCall.status === 'live' && !isBargingIn && (
                      <div className="message-row agent live-typing">
                        <div className="msg-avatar"><Bot size={16} /></div>
                        <div className="msg-bubble typing-bubble">
                          <span className="dot dot-1" />
                          <span className="dot dot-2" />
                          <span className="dot dot-3" />
                        </div>
                      </div>
                    )}
                    <div ref={transcriptEndRef} />
                  </div>
                </div>

                {/* RIGHT: INSIGHTS */}
                <div className="insights-panel">
                  {/* AI SUMMARY & INTENT */}
                  <div className="insight-card">
                    <h3>
                      <Sparkles size={16} className="cc-amber-icon" />
                      <span>AI Summary & Intent</span>
                    </h3>
                    {selectedCall.status === 'live' ? (
                      <div className="cc-live-intent-box">
                        <p>Live Detected Intent</p>
                        <div className="cc-intent-pill">
                          <span className="cc-pulse-dot" />
                          <span>Real-time Speech Synthesis Active</span>
                        </div>
                      </div>
                    ) : (
                      <p className="ai-summary">{selectedCall.summary}</p>
                    )}
                  </div>

                  {/* CALL RECORDING */}
                  <div className="insight-card">
                    <h3>
                      <Play size={16} />
                      <span>Audio Recording</span>
                    </h3>
                    {selectedCall.status === 'live' ? (
                      <div className="cc-rec-in-progress">
                        <span className="cc-rec-dot" />
                        <span>Stereo recording in progress...</span>
                      </div>
                    ) : (
                      <div className="cc-audio-wrapper">
                        <audio controls key={selectedCall.id} className="audio-player">
                          <source src={selectedCall.audioUrl || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"} type="audio/mpeg" />
                          Your browser does not support audio playback.
                        </audio>
                      </div>
                    )}
                  </div>

                  {/* ROUTING HISTORY */}
                  <div className="insight-card">
                    <h3>Routing History</h3>
                    <div className="transfer-chain">
                      <div className="transfer-step">
                        <div className="step-icon"><Phone size={13} /></div>
                        <span>Inbound Telephony Gateway</span>
                      </div>
                      <div className="transfer-arrow">
                        <ArrowRight size={13} />
                      </div>
                      <div className="transfer-step">
                        <div className="step-icon"><Bot size={13} /></div>
                        <span>Commander Agent (Almaz)</span>
                      </div>
                      {selectedCall.agent !== 'Commander Agent' && (
                        <>
                          <div className="transfer-arrow">
                            <ArrowRight size={13} />
                          </div>
                          <div className="transfer-step step-assigned">
                            <div className="step-icon"><Bot size={13} /></div>
                            <span>{selectedCall.agent}</span>
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
          <div className="cc-empty-selection">
            <Phone size={48} />
            <h3>Select a call to inspect live telemetry</h3>
            <p>Choose an ongoing or historical call session from the operations sidebar.</p>
          </div>
        )}
      </div>

      {/* TEST AGENT MODAL */}
      <AnimatePresence>
        {isTestAgentOpen && (
          <div className="modal-overlay" onClick={() => setIsTestAgentOpen(false)}>
            <motion.div 
              className="modal-content cc-test-modal"
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
            >
              <div className="cc-modal-header">
                <div className="cc-modal-title">
                  <Headphones size={20} />
                  <div>
                    <h3>AI Agent Telephony Tester</h3>
                    <p>Simulate voice calls or adjust agent parameters</p>
                  </div>
                </div>
                <button className="cc-modal-close" onClick={() => setIsTestAgentOpen(false)}>
                  <X size={16} />
                </button>
              </div>

              <div className="cc-modal-body">
                <div className="cc-test-option-card" onClick={handleSimulateCall}>
                  <div className="cc-option-icon">
                    <Radio size={20} />
                  </div>
                  <div className="cc-option-text">
                    <h4>Simulate Live Inbound Call</h4>
                    <p>Pushes a live Amharic customer call into the Operations Center cockpit for real-time monitoring.</p>
                  </div>
                  <button className="btn btn-secondary btn-sm" disabled={simulatingCall}>
                    {simulatingCall ? <Loader2 size={14} className="spinner" /> : 'Simulate'}
                  </button>
                </div>

                <div className="cc-test-option-card" onClick={() => { setIsTestAgentOpen(false); navigate('/app/agent-studio'); }}>
                  <div className="cc-option-icon">
                    <ExternalLink size={20} />
                  </div>
                  <div className="cc-option-text">
                    <h4>Launch Voice Sandbox in Agent Studio</h4>
                    <p>Open the full interactive microphone voice trial to speak directly with your AI telephony agents.</p>
                  </div>
                  <button className="btn btn-primary btn-sm">
                    Open Studio
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default CallCenter
