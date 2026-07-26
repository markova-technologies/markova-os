import React, { useEffect, useState } from 'react'
import { FlaskConical, ShieldAlert } from 'lucide-react'
import Waveform from './Waveform'
import { useEnvironment } from '../contexts/EnvironmentContext'
import { listCalls } from '../api/client'
import realTimeService from '../services/realTimeService'
import './EnvironmentStrip.css'

const POLL_MS = 15000

// The waveform strip (Brief §1) — ambient and always present at the top of
// every authenticated page — paired with the persistent environment badge
// (Brief §3): you should never lose track of whether you're in sandbox or live.
const EnvironmentStrip = () => {
  const { environment, isLive, setEnvironment, transitioning } = useEnvironment()
  const [callActive, setCallActive] = useState(false)

  useEffect(() => {
    const onStart = () => setCallActive(true)
    const onEnd = () => setCallActive(false)
    realTimeService.on('call.started', onStart)
    realTimeService.on('call.ended', onEnd)
    realTimeService.connect()

    // The socket only carries events while a worker is publishing them, so the
    // strip also confirms against the calls list on a slow interval.
    let cancelled = false
    const poll = async () => {
      try {
        const { data } = await listCalls({ status: 'active' })
        if (!cancelled) setCallActive(Array.isArray(data) && data.length > 0)
      } catch {
        /* leave the strip idle rather than guessing */
      }
    }
    poll()
    const timer = setInterval(poll, POLL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
      realTimeService.off('call.started', onStart)
      realTimeService.off('call.ended', onEnd)
      realTimeService.disconnect()
    }
  }, [])

  return (
    <div className={`env-strip ${transitioning ? 'transitioning' : ''}`}>
      <div className="env-strip-waveform">
        <Waveform env={environment} active={callActive} size="strip" />
      </div>
      <button
        className={`env-badge ${isLive ? 'live' : 'test'}`}
        onClick={() => setEnvironment(isLive ? 'test' : 'live')}
        title={isLive ? 'Switch to sandbox' : 'Switch to live'}
      >
        {isLive ? <ShieldAlert size={14} /> : <FlaskConical size={14} />}
        {isLive ? 'Live' : 'Sandbox'}
      </button>
    </div>
  )
}

export default EnvironmentStrip
