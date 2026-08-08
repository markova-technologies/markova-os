import React, { useEffect } from 'react'

/**
 * Redirects to the API gateway's built-in Swagger UI docs site.
 */
const DocsSite = () => {
  useEffect(() => {
    window.location.href = '/docs'
  }, [])
  return <div style={{ padding: '2rem', textAlign: 'center' }}>Redirecting to API Documentation...</div>
}

export default DocsSite
