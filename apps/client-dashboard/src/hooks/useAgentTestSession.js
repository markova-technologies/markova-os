import { useState, useRef, useEffect, useCallback } from 'react'
import { startAgentTestSession } from '../api/client'

export const useAgentTestSession = (agentId) => {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [transcript, setTranscript] = useState([])
  const [error, setError] = useState(null)

  const wsRef = useRef(null)
  const audioRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const audioQueueRef = useRef([])
  const isPlayingAudioRef = useRef(false)

  // Play next audio chunk in queue
  const playNextInQueue = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingAudioRef.current = false
      return
    }

    isPlayingAudioRef.current = true
    const audioBlob = audioQueueRef.current.shift()
    const audioUrl = URL.createObjectURL(audioBlob)

    if (audioRef.current) {
      audioRef.current.src = audioUrl
      audioRef.current.onended = () => {
        URL.revokeObjectURL(audioUrl)
        playNextInQueue()
      }
      audioRef.current.onerror = () => {
        URL.revokeObjectURL(audioUrl)
        playNextInQueue()
      }
      audioRef.current.play().catch(err => {
        console.warn('Audio auto-play prevented or failed:', err)
        playNextInQueue()
      })
    }
  }, [])

  const startSession = useCallback(async (agentConfig = null) => {
    const targetId = agentId || agentConfig?.id || 'markova-commander-default'

    setIsConnecting(true)
    setError(null)
    setTranscript([])

    try {
      // 1. Initialize test session on orchestrator (passes active agent draft if provided)
      const res = await startAgentTestSession(targetId, agentConfig || {})
      const sessionId = res.data?.session_id
      if (!sessionId) {
        throw new Error('No session ID returned from test call creation.')
      }

      // 2. Connect WebSocket
      const apiBase = import.meta.env.VITE_API_URL || ''
      let wsUrl
      if (apiBase) {
        const wsProto = apiBase.startsWith('https') ? 'wss:' : 'ws:'
        const hostPart = apiBase.replace(/^https?:\/\//, '').replace(/\/+$/, '')
        wsUrl = `${wsProto}//${hostPart}/ws/agent-test/${sessionId}`
      } else {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const host = isLocal ? 'localhost:8000' : window.location.host
        wsUrl = `${proto}//${host}/ws/agent-test/${sessionId}`
      }

      const ws = new WebSocket(wsUrl)
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      ws.onopen = async () => {
        setIsConnecting(false)
        setIsConnected(true)

        // Request microphone access for direct audio streaming
        try {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            mediaStreamRef.current = stream

            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
              ? 'audio/webm;codecs=opus'
              : 'audio/webm'

            const recorder = new MediaRecorder(stream, { mimeType })
            mediaRecorderRef.current = recorder

            recorder.ondataavailable = (e) => {
              if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                e.data.arrayBuffer().then(buf => {
                  ws.send(buf)
                })
              }
            }

            // Slice audio every 2.5 seconds or on demand
            recorder.start(2500)
          }
        } catch (micErr) {
          console.warn('Microphone access denied or unavailable, text chat only:', micErr)
        }
      }

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'transcript') {
              setTranscript(prev => {
                // Prevent duplicate consecutive messages
                const last = prev[prev.length - 1]
                if (last && last.speaker === (data.role === 'user' ? 'user' : 'agent') && last.text === data.text) {
                  return prev
                }
                return [
                  ...prev,
                  {
                    speaker: data.role === 'user' ? 'user' : 'agent',
                    text: data.text
                  }
                ]
              })
            }
          } catch (e) {
            console.error('Failed to parse WebSocket text message:', e)
          }
        } else if (event.data instanceof ArrayBuffer) {
          // Binary audio chunk received from backend TTS
          const audioBlob = new Blob([event.data], { type: 'audio/mpeg' })
          audioQueueRef.current.push(audioBlob)

          if (!isPlayingAudioRef.current) {
            playNextInQueue()
          }
        }
      }

      ws.onerror = (err) => {
        console.error('WebSocket test session error:', err)
        setError('Voice test bridge error.')
      }

      ws.onclose = () => {
        setIsConnected(false)
        setIsConnecting(false)
      }
    } catch (err) {
      console.error('Failed to start test session:', err)
      setError(err.message || 'Connection failed')
      setIsConnecting(false)
      setIsConnected(false)
      throw err
    }
  }, [agentId, playNextInQueue])

  const endSession = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch (e) {}
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }

    audioQueueRef.current = []
    isPlayingAudioRef.current = false
    setIsConnected(false)
    setIsConnecting(false)
  }, [])

  const sendText = useCallback((text) => {
    if (!text || !text.trim()) return

    const trimmed = text.trim()

    // Optimistically update transcript
    setTranscript(prev => [
      ...prev,
      { speaker: 'user', text: trimmed }
    ])

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'text', text: trimmed }))
    }
  }, [])

  useEffect(() => {
    return () => {
      endSession()
    }
  }, [endSession])

  return {
    isConnected,
    isConnecting,
    transcript,
    error,
    audioRef,
    startSession,
    endSession,
    sendText
  }
}
