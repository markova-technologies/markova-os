// Live call events for the waveform strip and call list.
//
// The orchestrator exposes one company-scoped socket at
// /ws/flow-monitor/{company_id}?token=<jwt>, proxied by the gateway at /ws.
// There is no dashboard-wide polling endpoint, so when the socket is down we
// stay quiet rather than inventing activity.

const RECONNECT_BASE_MS = 2000
const RECONNECT_MAX_MS = 30000

class RealTimeService {
  constructor() {
    this.ws = null
    this.listeners = {}
    this.attempts = 0
    this.reconnectTimer = null
    this.intentionallyClosed = false
  }

  get socketUrl() {
    const base = import.meta.env.VITE_API_URL || window.location.origin
    return base.replace(/^http/, 'ws')
  }

  companyId() {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      return user.companyId || user.company_id || null
    } catch {
      return null
    }
  }

  connect() {
    const companyId = this.companyId()
    const token = localStorage.getItem('token')
    if (!companyId || !token || this.ws) return

    this.intentionallyClosed = false
    const url = `${this.socketUrl}/ws/flow-monitor/${companyId}?token=${encodeURIComponent(token)}`

    try {
      this.ws = new WebSocket(url)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      this.attempts = 0
      this.emit('connected')
    }

    this.ws.onmessage = (event) => {
      let payload
      try {
        payload = JSON.parse(event.data)
      } catch {
        return
      }
      this.emit('event', payload)
      if (payload.type) this.emit(payload.type, payload)
    }

    this.ws.onclose = () => {
      this.ws = null
      this.emit('disconnected')
      if (!this.intentionallyClosed) this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      if (this.ws) this.ws.close()
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.attempts, RECONNECT_MAX_MS)
    this.attempts += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  disconnect() {
    this.intentionallyClosed = true
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.attempts = 0
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  on(event, handler) {
    this.listeners[event] = this.listeners[event] || []
    this.listeners[event].push(handler)
  }

  off(event, handler) {
    this.listeners[event] = (this.listeners[event] || []).filter((h) => h !== handler)
  }

  emit(event, payload) {
    ;(this.listeners[event] || []).forEach((handler) => {
      try {
        handler(payload)
      } catch {
        /* a broken listener must not take the socket down */
      }
    })
  }
}

const realTimeService = new RealTimeService()
export default realTimeService
