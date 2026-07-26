import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

const NextLinks = ({ links }) => (
  <nav className="docs-next" aria-label="Continue reading">
    {links.map((link) => (
      <Link key={link.to} to={link.to}>
        {link.label} <ArrowRight size={14} />
      </Link>
    ))}
  </nav>
)

export default NextLinks
