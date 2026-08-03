import React, { useState, useEffect } from 'react'
import { AlertTriangle, ShieldAlert, CheckCircle2, X } from 'lucide-react'
import realTimeService from '../services/realTimeService'
import './SystemHealthBar.css'

const POLL_INTERVAL_MS = 30000

const SystemHealthBar = () => {
  const [healthData, setHealthData] = useState({ status: 'ok', services: {} })
  const [activeAlerts, setActiveAlerts] = useState([])
  const [isDismissed, setIsDismissed] = useState(false)

  const fetchHealth = async () => {
    try {
      const orchestratorUrl = import.meta.env.VITE_ORCHESTRATOR_URL || 'http://localhost:6000'
      const response = await fetch(`${orchestratorUrl}/health/detailed`)
      if (response.ok) {
        const data = await response.json()
        setHealthData(data)
      }
    } catch (err) {
      // In development or when directly unreachable, avoid throwing disruptive visual alarms unless confirmed
      console.debug('Health check reachability error:', err)
    }
  }

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, POLL_INTERVAL_MS)

    // Real-time system critical event listeners ("The User Must Know")
    const addAlert = (event, type, title, desc) => {
      setIsDismissed(false)
      setActiveAlerts(prev => [
        { id: Date.now() + Math.random(), type, title, desc, timestamp: new Date() },
        ...prev.slice(0, 4)
      ])
    }

    const onSttFailure = (payload) => addAlert('stt', 'critical', 'STT Cascade Failure', `All speech recognition engines failed on call ${payload.call_sid}.`)
    const onLlmFailure = (payload) => addAlert('llm', 'warning', 'AI Response Error', `LLM error detected (${payload.provider}): ${payload.error}`)
    const onQuotaExceeded = (payload) => addAlert('quota', 'warning', 'STT Quota Notice', 'Primary voice recognition quota reached; falling back to Whisper.')

    realTimeService.on('system.stt.cascade_failure', onSttFailure)
    realTimeService.on('system.llm.failure', onLlmFailure)
    realTimeService.on('stt.quota.exceeded', onQuotaExceeded)
    realTimeService.connect()

    return () => {
      clearInterval(interval)
      realTimeService.off('system.stt.cascade_failure', onSttFailure)
      realTimeService.off('system.llm.failure', onLlmFailure)
      realTimeService.off('stt.quota.exceeded', onQuotaExceeded)
    }
  }, [])

  const dismissAlert = (id) => {
    setActiveAlerts(prev => prev.filter(a => a.id !== id))
  }

  const isDbDegraded = healthData.services?.database === 'degraded'
  const isRedisDegraded = healthData.services?.redis === 'degraded'
  const hasCriticalAlerts = activeAlerts.some(a => a.type === 'critical')
  const hasWarningAlerts = activeAlerts.some(a => a.type === 'warning')

  // Clean UI when everything is functioning optimally
  if (!isDbDegraded && !isRedisDegraded && activeAlerts.length === 0) {
    return null
  }

  if (isDismissed && !isDbDegraded) {
    return null
  }

  const bannerClass = (isDbDegraded || hasCriticalAlerts) ? 'health-banner-red' : 'health-banner-yellow'

  return (
    <div className={`system-health-bar ${bannerClass}`}>
      <div className="health-bar-content">
        {isDbDegraded || hasCriticalAlerts ? (
          <ShieldAlert className="health-icon red-icon" size={18} />
        ) : (
          <AlertTriangle className="health-icon yellow-icon" size={18} />
        )}
        <div className="health-messages">
          {isDbDegraded && (
            <span className="health-item font-semibold">
              🔴 Database reachability degraded — Call routing and persistence may experience delays or fallbacks.
            </span>
          )}
          {isRedisDegraded && !isDbDegraded && (
            <span className="health-item font-semibold">
              🟡 Redis connection degraded — System running safely on in-memory state fallback.
            </span>
          )}
          {activeAlerts.map((alert) => (
            <div key={alert.id} className="alert-badge">
              <strong>{alert.title}:</strong> {alert.desc}
              <button className="dismiss-alert-btn" onClick={() => dismissAlert(alert.id)} title="Dismiss alert">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <button className="banner-dismiss-btn" onClick={() => setIsDismissed(true)} title="Hide health notification">
        <X size={16} />
      </button>
    </div>
  )
}

export default SystemHealthBar
