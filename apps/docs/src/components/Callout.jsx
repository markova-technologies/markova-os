import React from 'react'
import { AlertTriangle, Info, FlaskConical } from 'lucide-react'

const ICONS = {
  note: Info,
  sandbox: FlaskConical,
  live: AlertTriangle,
}

const Callout = ({ kind = 'note', children }) => {
  const Icon = ICONS[kind] || Info
  return (
    <div className={`callout callout-${kind}`}>
      <span className="callout-icon">
        <Icon size={16} />
      </span>
      <div>{children}</div>
    </div>
  )
}

export default Callout
