import { createContext, useContext, useState, useEffect } from 'react'

// Sandbox vs Live (Brief §3) — a real mode switch, not a cosmetic badge.
// Drives the Coral Pulse <-> Slate Wire shift on key action buttons and the
// waveform tone. Persisted so a refresh doesn't silently drop you back to
// sandbox mid-session. Going live is always an explicit user choice here —
// nothing in this app flips it automatically.
const EnvironmentContext = createContext()

export const useEnvironment = () => {
  const ctx = useContext(EnvironmentContext)
  if (!ctx) throw new Error('useEnvironment must be used within EnvironmentProvider')
  return ctx
}

export const EnvironmentProvider = ({ children }) => {
  const [environment, setEnvironmentState] = useState(
    () => localStorage.getItem('markova_environment') || 'test'
  )
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-environment', environment)
  }, [environment])

  const setEnvironment = (next) => {
    if (next === environment) return
    setTransitioning(true)
    setTimeout(() => {
      setEnvironmentState(next)
      localStorage.setItem('markova_environment', next)
      setTransitioning(false)
    }, 220) // brief transition — crossing into real telephony spend is a deliberate moment
  }

  const isLive = environment === 'live'

  return (
    <EnvironmentContext.Provider value={{ environment, isLive, setEnvironment, transitioning }}>
      {children}
    </EnvironmentContext.Provider>
  )
}
