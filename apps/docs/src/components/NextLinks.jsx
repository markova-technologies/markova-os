import React from 'react'
import { ArrowRight } from 'lucide-react'
import { DocsLink } from '../docsBase'

const NextLinks = ({ links }) => (
  <nav className="docs-next" aria-label="Continue reading">
    {links.map((link) => (
      <DocsLink key={link.to} to={link.to}>
        {link.label} <ArrowRight size={14} />
      </DocsLink>
    ))}
  </nav>
)

export default NextLinks
