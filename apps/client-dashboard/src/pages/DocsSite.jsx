import React from 'react'
import DocsApp from '../../../../apps/docs/src/DocsApp'
import '../../../../apps/docs/src/styles/tokens.css'
import '../../../../apps/docs/src/styles/docs.css'

/**
 * Full docs site embedded under /docs/* — public, no login (same gate as /pricing).
 */
const DocsSite = () => <DocsApp base="/docs" />

export default DocsSite
