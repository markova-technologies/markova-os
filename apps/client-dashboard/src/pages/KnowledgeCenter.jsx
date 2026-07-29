import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Briefcase,
  FileText,
  MessageSquare,
  ScrollText,
  Search,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'
import {
  listKnowledgeSources,
  createKnowledgeSource,
  listKnowledgeDocuments,
  uploadKnowledgeDocument,
  searchKnowledge,
} from '../api/client'
import { useToast } from '../contexts/ToastContext'
import './KnowledgeCenter.css'

// Guided intake categories (Brief §5) — a business fills these in, not a blank upload box.
const CATEGORIES = [
  {
    key: 'business-info',
    name: 'Business information',
    icon: Briefcase,
    blurb: 'Hours, locations, services, prices — the facts callers ask for most.',
  },
  {
    key: 'policies-faqs',
    name: 'Policies and FAQs',
    icon: ScrollText,
    blurb: 'Returns, delivery, warranty, payment terms, and your common questions.',
  },
  {
    key: 'tone',
    name: 'Tone and language',
    icon: MessageSquare,
    blurb: 'How your agent should sound: formal or friendly, Amharic or English.',
  },
  {
    key: 'sample-scripts',
    name: 'Sample scripts',
    icon: FileText,
    blurb: 'Real call examples your agent should follow when handling a request.',
  },
]

// No backend endpoint stores this consent yet, so it is recorded per browser account.
const consentKey = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return `markova_knowledge_consent_${user.companyId || user.company_id || 'self'}`
  } catch {
    return 'markova_knowledge_consent_self'
  }
}

const ConsentGate = ({ onAccept }) => {
  const [checked, setChecked] = useState(false)

  return (
    <div className="kc-consent">
      <div className="kc-consent-card">
        <div className="kc-consent-icon"><ShieldCheck size={22} /></div>
        <h2>Before you upload anything</h2>
        <p>
          What you add here trains your own agent and nothing else. Read this once, then it stays out of your way.
        </p>
        <ul className="kc-consent-list">
          <li>Your documents are stored against your company only, and every search is filtered to your company.</li>
          <li>Your content is never used to improve a shared model. We do not offer that option.</li>
          <li>Your agent reads this material to answer callers. Do not upload anything you would not want it to say out loud.</li>
          <li>You can delete a source at any time, which removes it from what your agent can retrieve.</li>
        </ul>
        <label className="kc-consent-check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>I understand how this material will be used.</span>
        </label>
        <button className="btn-primary" disabled={!checked} onClick={onAccept}>
          Agree and continue
        </button>
      </div>
    </div>
  )
}

const KnowledgeCenter = () => {
  const [consented, setConsented] = useState(() => localStorage.getItem(consentKey()) === 'true')
  const [sources, setSources] = useState([])
  const [documents, setDocuments] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [uploadingKey, setUploadingKey] = useState(null)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState(null)
  const pendingCategory = useRef(null)
  const fileInputRef = useRef(null)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { data } = await listKnowledgeSources()
      const list = Array.isArray(data) ? data : []
      setSources(list)
      const docEntries = await Promise.all(
        list.map(async (src) => {
          try {
            const res = await listKnowledgeDocuments(src.id)
            return [src.id, Array.isArray(res.data) ? res.data : []]
          } catch {
            return [src.id, []]
          }
        })
      )
      setDocuments(Object.fromEntries(docEntries))
    } catch {
      setLoadError('We couldn’t load your knowledge sources. Refresh to try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (consented) load()
  }, [consented, load])

  const acceptConsent = () => {
    localStorage.setItem(consentKey(), 'true')
    setConsented(true)
  }

  const sourceForCategory = (category) =>
    sources.find((s) => s.name === category.name)

  const pickFile = (category) => {
    pendingCategory.current = category
    fileInputRef.current?.click()
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const category = pendingCategory.current
    if (!file || !category) return

    setUploadingKey(category.key)
    try {
      let source = sourceForCategory(category)
      if (!source) {
        const created = await createKnowledgeSource({ name: category.name, type: 'upload' })
        source = created.data
      }
      const formData = new FormData()
      formData.append('file', file)
      await uploadKnowledgeDocument(source.id, formData)
      toast.success(`${file.name} added to ${category.name}.`, 'File added')
      await load()
    } catch {
      toast.error('That file didn’t upload. Check the format and try again.', 'Upload failed')
    } finally {
      setUploadingKey(null)
      pendingCategory.current = null
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try {
      const { data } = await searchKnowledge(query.trim(), 5)
      setSearchResults(Array.isArray(data?.results) ? data.results : [])
    } catch {
      toast.error('The test search didn’t run. Try again in a moment.', 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  if (!consented) return <ConsentGate onAccept={acceptConsent} />

  const totalDocs = Object.values(documents).reduce((n, d) => n + d.length, 0)

  return (
    <div className="knowledge-center">
      <header className="page-header">
        <h1>Knowledge</h1>
        <p>Give your agent the material it needs to answer callers accurately.</p>
      </header>

      <input type="file" ref={fileInputRef} onChange={handleFile} style={{ display: 'none' }} accept=".txt,.md,.csv,.pdf,.doc,.docx" />

      {loadError && <div className="kc-error">{loadError}</div>}

      <section className="kc-categories">
        {CATEGORIES.map((category) => {
          const Icon = category.icon
          const source = sourceForCategory(category)
          const docs = source ? documents[source.id] || [] : []
          const busy = uploadingKey === category.key

          return (
            <motion.div
              className="kc-category"
              key={category.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="kc-category-head">
                <span className="kc-category-icon"><Icon size={18} /></span>
                <div>
                  <h3>{category.name}</h3>
                  <p>{category.blurb}</p>
                </div>
              </div>

              {loading ? (
                <div className="kc-skeleton" />
              ) : docs.length === 0 ? (
                <p className="kc-category-empty">Nothing here yet — add a file so your agent can use it.</p>
              ) : (
                <ul className="kc-doc-list">
                  {docs.map((doc) => (
                    <li key={doc.id}>
                      <FileText size={14} />
                      <span className="kc-doc-name mono">{doc.file_name}</span>
                      <span className={`kc-doc-status ${doc.status || 'uploaded'}`}>{doc.status || 'uploaded'}</span>
                    </li>
                  ))}
                </ul>
              )}

              <button className="btn-secondary kc-add" onClick={() => pickFile(category)} disabled={busy}>
                <UploadCloud size={15} /> {busy ? 'Adding…' : 'Add Knowledge'}
              </button>
            </motion.div>
          )
        })}
      </section>

      <section className="kc-test">
        <h2>Test what your agent would find</h2>
        <p>Ask the same thing a caller would. This searches only your material.</p>
        <form className="kc-test-form" onSubmit={handleSearch}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What time do you close on Saturday?"
          />
          <button type="submit" disabled={searching || !query.trim()}>
            <Search size={15} /> {searching ? 'Searching…' : 'Run test search'}
          </button>
        </form>

        {searchResults !== null && (
          searchResults.length === 0 ? (
            <p className="kc-test-empty">
              {totalDocs === 0
                ? 'Nothing to search yet — add a file above first.'
                : 'Your agent found nothing for that. Add material that answers it.'}
            </p>
          ) : (
            <ul className="kc-test-results">
              {searchResults.map((r) => (
                <li key={r.chunk_id}>
                  <div className="kc-test-meta">
                    <span className="mono">{r.source_name || r.file_name}</span>
                    {typeof r.score === 'number' && <span className="kc-test-score">{r.score.toFixed(2)}</span>}
                  </div>
                  <p>{r.content}</p>
                </li>
              ))}
            </ul>
          )
        )}
      </section>
    </div>
  )
}

export default KnowledgeCenter
