import React, { useEffect, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { DocsLink } from '../docsBase'

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
      try {
        window.Redoc.init(
          '/openapi.yaml',
          {
            scrollYOffset: '.redoc-topbar',
            hideDownloadButton: true,
            expandResponses: '200,201',
            requiredPropsFirst: true,
            sortPropsAlphabetically: true,
            nativeScrollbars: true,
            theme: {
              colors: {
                primary: { main: '#e8a33d' },
                text: { primary: '#0f172a', secondary: '#475569' },
                http: {
                  get: '#16a34a',
                  post: '#2563eb',
                  put: '#d97706',
                  delete: '#dc2626',
                },
              },
              typography: {
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                headings: { fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontWeight: '700' },
                code: { fontFamily: "'JetBrains Mono', ui-monospace, monospace" },
              },
              sidebar: {
                backgroundColor: '#f8fafc',
                textColor: '#334155',
                activeTextColor: '#0f172a',
              },
              rightPanel: {
                backgroundColor: '#18181b',
                textColor: '#ffffff',
              },
            },
          },
          hostRef.current,
        )
      } catch (err) {
        console.error('Failed to init Redoc:', err)
        if (!cancelled) setFailed(true)
      }
    }

    if (window.Redoc) {
      render()
      return () => {
        cancelled = true
      }
    }

    const existing = document.querySelector(`script[src="${REDOC_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', render)
      existing.addEventListener('error', () => !cancelled && setFailed(true))
    } else {
      const script = document.createElement('script')
      script.src = REDOC_SRC
      script.async = true
      script.addEventListener('load', render)
      script.addEventListener('error', () => !cancelled && setFailed(true))
      document.body.appendChild(script)
    }

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="redoc-host">
      <div className="redoc-topbar">
        <DocsLink to="/">
          <ArrowLeft size={14} /> Back to docs
        </DocsLink>
        <a href="/openapi.yaml" download="openapi.yaml">
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
