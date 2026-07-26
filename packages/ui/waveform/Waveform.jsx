import React from 'react'
import './Waveform.css'

// Markova's one signature element (Brief §1) — reused as: the top nav strip
// (idle/active), the test-call screen, and the usage chart's visual grammar.
//
// Two independent signals:
//  - `env`: which mode you're in — 'test' (Slate Wire, calm) or 'live' (Coral Pulse,
//    the one place a slightly alarming color is correct).
//  - `active`: a call is happening right now — always renders in Live Amber
//    ("agent is speaking"), regardless of env.
//
// `values` turns the same motif into a chart: pass real magnitudes and each bar
// becomes a data point instead of the ambient sine shape.
const BAR_COUNT = 24

const ambientShape = (count) =>
  Array.from({ length: count }, (_, i) => 0.25 + Math.abs(Math.sin((i / count) * Math.PI * 3)) * 0.65)

const normalize = (values) => {
  const nums = values.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0))
  const peak = Math.max(...nums, 0)
  // A flat-zero series still reads as a quiet line rather than collapsing to nothing.
  if (peak <= 0) return nums.map(() => 0.06)
  return nums.map((v) => 0.06 + (v / peak) * 0.94)
}

const Waveform = ({
  active = false,
  env = 'test',
  size = 'strip',
  values = null,
  labels = null,
  className = '',
  ariaLabel,
}) => {
  const isChart = Array.isArray(values) && values.length > 0
  const count = size === 'chart' ? 48 : BAR_COUNT
  const bars = isChart ? normalize(values) : ambientShape(count)

  const label =
    ariaLabel || (isChart ? 'Usage over time' : active ? 'Call in progress' : 'Idle — no active call')

  return (
    <div
      className={`waveform waveform-${size} env-${env} ${active ? 'is-active' : 'is-idle'} ${
        isChart ? 'is-data' : ''
      } ${className}`}
      role="img"
      aria-label={label}
    >
      {bars.map((base, i) => (
        <span
          key={i}
          className="waveform-bar"
          style={{ '--i': i, '--base': base }}
          title={isChart && labels?.[i] ? `${labels[i]}: ${values[i]}` : undefined}
        />
      ))}
    </div>
  )
}

export default Waveform
