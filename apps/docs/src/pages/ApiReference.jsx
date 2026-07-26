import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

// Generated directly from the repo-root openapi.yaml (copied into public/ by
// `npm run sync:openapi`) — this page never hand-documents an endpoint the
// spec doesn't already describe. Redoc is loaded from a CDN script rather
// than bundled, since it only renders on this one full-width route.
const REDOC_SRC = 'https://cdn.jsdelivr.net/npm/redoc@2/bundles/redoc.standalone.js'

const ApiReference = () => {
  const hostRef = useRef(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    const render = () => {
      if (cancelled || !hostRef.current || !window.Redoc) return
      window.Redoc.init(
        '/openapi.yaml',
        {
          theme: {
            colors: {
              primary: { main: '#e8a33d' },
              text: { primary: '#12172b' },
            },
            typography: {
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              headings: { fontFamily: "'Space Grotesk', 'Inter', sans-serif" },
              code: { fontFamily: "'JetBrains Mono', ui-monospace, monospace" },
            },
            sidebar: { backgroundColor: '#f5f6f3' },
          },
          hideDownloadButton: false,
          expandResponses: '200,201',
        },
        hostRef.current,
      )
    }

    if (window.Redoc) {
      render()
      return () => {
        cancelled = true
      }
    }

    const existing = document.querySelector(`script[src="${REDOC_SRC}"]`)
    const script = existing || document.createElement('script')
    script.src = REDOC_SRC
    script.async = true
    script.addEventListener('load', render)
    script.addEventListener('error', () => !cancelled && setFailed(true))
    if (!existing) document.body.appendChild(script)

    return () => {
      cancelled = true
      script.removeEventListener('load', render)
    }
  }, [])

  return (
    <div className="redoc-host">
      <div className="redoc-topbar">
        <Link to="/">
          <ArrowLeft size={14} /> Back to docs
        </Link>
        <a href="/openapi.yaml" download>
          Download openapi.yaml
        </a>
      </div>

      {failed ? (
        <div className="redoc-fallback">
          <p className="docs-page-kicker">Reference</p>
          <h1>API reference</h1>
          <p className="lead">
            The interactive reference couldn't load from the CDN just now. The full spec is still
            available directly — open it in a browser or feed it to any OpenAPI tool:
          </p>
          <p>
            <a href="/openapi.yaml">/openapi.yaml</a>
          </p>
        </div>
      ) : (
        <div ref={hostRef} />
      )}
    </div>
  )
}

export default ApiReference
