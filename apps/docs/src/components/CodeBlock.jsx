import React, { useState } from 'react'
import { Check, Copy } from 'lucide-react'

// Every sample on this site is copy-pasteable and runnable against sandbox, so
// the copy affordance is part of the block rather than an optional extra.
// Pass `samples` as [{ label, code }] to get language tabs.
const CodeBlock = ({ code, language = 'bash', samples }) => {
  const tabs = samples || [{ label: language, code }]
  const [index, setIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const active = tabs[Math.min(index, tabs.length - 1)]

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(active.code.trim())
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="codeblock">
      <div className="codeblock-tabs">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            className={`codeblock-tab ${i === index ? 'is-active' : ''}`}
            onClick={() => setIndex(i)}
            aria-pressed={i === index}
          >
            {tab.label}
          </button>
        ))}
        <button
          className={`codeblock-copy ${copied ? 'is-copied' : ''}`}
          onClick={copy}
          aria-label={`Copy ${active.label} sample`}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <code>{active.code.trim()}</code>
      </pre>
    </div>
  )
}

export default CodeBlock
