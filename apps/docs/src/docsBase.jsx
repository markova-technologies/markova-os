import React, { createContext, useContext } from 'react'
import { Link, NavLink } from 'react-router-dom'

const DocsBaseContext = createContext('')

export const DocsBaseProvider = ({ base = '', children }) => (
  <DocsBaseContext.Provider value={base || ''}>{children}</DocsBaseContext.Provider>
)

export const useDocsBase = () => useContext(DocsBaseContext)

/** Join docs base (`''` or `/docs`) with an absolute docs path (`/quickstart`). */
export const docsPath = (base, path = '/') => {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (!base) return normalized
  if (normalized === '/') return base
  return `${base}${normalized}`
}

export const DocsLink = ({ to, ...props }) => {
  const base = useDocsBase()
  return <Link to={docsPath(base, to)} {...props} />
}

export const DocsNavLink = ({ to, end, ...props }) => {
  const base = useDocsBase()
  return <NavLink to={docsPath(base, to)} end={end} {...props} />
}
