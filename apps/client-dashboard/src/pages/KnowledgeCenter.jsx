import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase,
  FileText,
  MessageSquare,
  ScrollText,
  Search,
  ShieldCheck,
  UploadCloud,
  Globe,
  HardDrive,
  X,
  BookOpen,
  Table,
  Trash2,
} from 'lucide-react'
import {
  listKnowledgeSources,
  createKnowledgeSource,
  listKnowledgeDocuments,
  uploadKnowledgeDocument,
  searchKnowledge,
  deleteKnowledgeSource,
  deleteKnowledgeDocument,
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
  const [addModalCategory, setAddModalCategory] = useState(null)
  const [modalStep, setModalStep] = useState('category') // 'category' | 'method' | 'input'
  const [selectedMethod, setSelectedMethod] = useState(null) // 'upload' | 'website' | 'notion' | 'sheets'
  const [inputUrl, setInputUrl] = useState('')
  const [submittingSource, setSubmittingSource] = useState(false)
  const [showConsentModal, setShowConsentModal] = useState(false)
  const pendingCategory = useRef(null)
  const fileInputRef = useRef(null)
  const toast = useToast()

  const openModal = () => {
    setModalStep('category')
    setAddModalCategory(null)
    setSelectedMethod(null)
    setInputUrl('')
  }

  const openModalForCategory = (category) => {
    if (!consented) {
      pendingCategory.current = category
      setShowConsentModal(true)
      return
    }
    if (category) {
      selectCategory(category)
    } else {
      openModal()
    }
  }

  const handleConsentAgree = () => {
    acceptConsent()
    setShowConsentModal(false)
    if (pendingCategory.current) {
      selectCategory(pendingCategory.current)
      pendingCategory.current = null
    } else {
      openModal()
    }
  }

  const closeModal = () => {
    setModalStep(null)
    setAddModalCategory(null)
    setSelectedMethod(null)
    setInputUrl('')
  }

  const selectCategory = (category) => {
    setAddModalCategory(category)
    setModalStep('method')
  }

  const selectMethod = (method) => {
    if (method === 'upload') {
      pickFile(addModalCategory)
      closeModal()
      return
    }
    setSelectedMethod(method)
    setInputUrl('')
    setModalStep('input')
  }

  const handleSourceSubmit = async (e) => {
    e.preventDefault()
    if (!inputUrl.trim() || !addModalCategory) return
    setSubmittingSource(true)
    try {
      await createKnowledgeSource({
        name: `${addModalCategory.name} (${selectedMethod})`,
        type: selectedMethod,
        config: { url: inputUrl.trim(), categoryKey: addModalCategory.key }
      })
      toast.success(`${selectedMethod.toUpperCase()} source added to ${addModalCategory.name}.`, 'Source added')
      await load()
      closeModal()
    } catch {
      toast.error('Could not create knowledge source. Please try again.', 'Error')
    } finally {
      setSubmittingSource(false)
    }
  }

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
    load()
  }, [load])

  const acceptConsent = () => {
    localStorage.setItem(consentKey(), 'true')
    setConsented(true)
  }

  const getItemsForCategory = (category) => {
    // Find all sources matching this category
    const catSources = sources.filter((s) => {
      if (s.config?.categoryKey === category.key) return true
      const sName = (s.name || '').toLowerCase()
      const cName = category.name.toLowerCase()
      return sName.includes(cName) || sName.includes(category.key.replace('-', ''))
    })

    const items = []
    catSources.forEach((src) => {
      if (src.type === 'upload') {
        const docs = documents[src.id] || []
        docs.forEach((doc) => {
          items.push({
            id: doc.id,
            sourceId: src.id,
            itemType: 'doc',
            name: doc.file_name,
            status: doc.status || 'uploaded',
            icon: FileText,
          })
        })
      } else {
        let icon = Globe
        if (src.type === 'notion') icon = BookOpen
        if (src.type === 'sheets') icon = Table
        items.push({
          id: src.id,
          sourceId: src.id,
          itemType: 'source',
          name: src.config?.url || src.name,
          status: src.type || 'active',
          icon: icon,
        })
      }
    })

    return items
  }

  const handleDeleteItem = async (item) => {
    try {
      if (item.itemType === 'doc') {
        await deleteKnowledgeDocument(item.sourceId, item.id)
      } else {
        await deleteKnowledgeSource(item.id)
      }
      toast.success(`Removed ${item.name} from Knowledge.`, 'Item removed')
      await load()
    } catch {
      toast.error('Could not remove item. Try again.', 'Error')
    }
  }

  const sourceForCategory = (category) =>
    sources.find((s) => s.config?.categoryKey === category.key || s.name === category.name)

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
        const created = await createKnowledgeSource({
          name: category.name,
          type: 'upload',
          config: { categoryKey: category.key }
        })
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

  const showModal = Boolean(modalStep)

  return (
    <div className="knowledge-center">
      <header className="page-header kc-page-header">
        <div>
          <h1>Knowledge</h1>
          <p>Give your agent the material it needs to answer callers accurately.</p>
        </div>
        <button className="btn-primary kc-global-add" onClick={() => openModalForCategory(null)}>
          <UploadCloud size={16} /> Add Knowledge
        </button>
      </header>

      <input type="file" ref={fileInputRef} onChange={handleFile} style={{ display: 'none' }} accept=".txt,.md,.csv,.pdf,.doc,.docx" />

      {/* Consent Gate Modal (shows only on upload if not consented yet) */}
      <AnimatePresence>
        {showConsentModal && (
          <motion.div
            className="kc-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowConsentModal(false)}
          >
            <motion.div
              className="kc-modal"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="kc-modal-header">
                <div>
                  <h2>Data Privacy Agreement</h2>
                  <p>Read this once before adding material to your agent</p>
                </div>
                <button className="kc-modal-close" onClick={() => setShowConsentModal(false)}><X size={20} /></button>
              </div>
              <div className="kc-consent-modal-body">
                <ul className="kc-consent-list">
                  <li>Your documents are stored against your company only, and every search is filtered to your company.</li>
                  <li>Your content is never used to improve a shared model. We do not offer that option.</li>
                  <li>Your agent reads this material to answer callers. Do not upload anything you would not want it to say out loud.</li>
                  <li>You can delete a source at any time, which removes it from what your agent can retrieve.</li>
                </ul>
                <div className="kc-modal-actions">
                  <button className="btn-secondary" onClick={() => setShowConsentModal(false)}>Cancel</button>
                  <button className="btn-primary" onClick={handleConsentAgree}>Agree & Continue</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Knowledge Modal - 2-step */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="kc-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div
              className="kc-modal"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Step 1: Pick Category */}
              {modalStep === 'category' && (
                <>
                  <div className="kc-modal-header">
                    <div>
                      <h2>Add Knowledge</h2>
                      <p>Choose which category to add content to</p>
                    </div>
                    <button className="kc-modal-close" onClick={closeModal}><X size={20} /></button>
                  </div>
                  <div className="kc-modal-categories">
                    {CATEGORIES.map((cat) => {
                      const CatIcon = cat.icon
                      return (
                        <button key={cat.key} className="kc-modal-cat-option" onClick={() => selectCategory(cat)}>
                          <div className="kc-modal-option-icon"><CatIcon size={22} /></div>
                          <div>
                            <span>{cat.name}</span>
                            <p>{cat.blurb}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Step 2: Pick Upload Method */}
              {modalStep === 'method' && addModalCategory && (
                <>
                  <div className="kc-modal-header">
                    <div>
                      <button className="kc-modal-back" onClick={() => setModalStep('category')}>
                        ← Back
                      </button>
                      <h2>Add to <span className="kc-modal-cat-label">{addModalCategory.name}</span></h2>
                      <p>Choose how you'd like to add content</p>
                    </div>
                    <button className="kc-modal-close" onClick={closeModal}><X size={20} /></button>
                  </div>
                  <div className="kc-modal-options">
                    <button className="kc-modal-option" onClick={() => selectMethod('upload')}>
                      <div className="kc-modal-option-icon"><FileText size={24} /></div>
                      <div>
                        <span>File Upload</span>
                        <p>Upload a .txt, .pdf, .csv, .doc or .md file from your computer</p>
                      </div>
                    </button>
                    <button className="kc-modal-option" onClick={() => selectMethod('website')}>
                      <div className="kc-modal-option-icon"><Globe size={24} /></div>
                      <div>
                        <span>Website URL</span>
                        <p>Extract facts and FAQs directly from a web page</p>
                      </div>
                    </button>
                    <button className="kc-modal-option" onClick={() => selectMethod('notion')}>
                      <div className="kc-modal-option-icon"><BookOpen size={24} /></div>
                      <div>
                        <span>Notion Page</span>
                        <p>Sync structured notes and docs from a Notion workspace</p>
                      </div>
                    </button>
                    <button className="kc-modal-option" onClick={() => selectMethod('sheets')}>
                      <div className="kc-modal-option-icon"><Table size={24} /></div>
                      <div>
                        <span>Google Sheets</span>
                        <p>Connect pricing tables or inventory spreadsheets</p>
                      </div>
                    </button>
                  </div>
                </>
              )}

              {/* Step 3: Enter URL / Link */}
              {modalStep === 'input' && addModalCategory && selectedMethod && (
                <>
                  <div className="kc-modal-header">
                    <div>
                      <button className="kc-modal-back" onClick={() => setModalStep('method')}>
                        ← Back
                      </button>
                      <h2>Connect {selectedMethod === 'website' ? 'Website' : selectedMethod === 'notion' ? 'Notion' : 'Google Sheets'}</h2>
                      <p>Enter the location for <strong>{addModalCategory.name}</strong></p>
                    </div>
                    <button className="kc-modal-close" onClick={closeModal}><X size={20} /></button>
                  </div>
                  <form className="kc-modal-form" onSubmit={handleSourceSubmit}>
                    <label className="kc-modal-label">
                      {selectedMethod === 'website' && 'Web Page URL'}
                      {selectedMethod === 'notion' && 'Notion Page or Database URL'}
                      {selectedMethod === 'sheets' && 'Google Sheets Share Link'}
                    </label>
                    <input
                      type="url"
                      required
                      placeholder={
                        selectedMethod === 'website' ? 'https://example.com/faq' :
                        selectedMethod === 'notion' ? 'https://notion.so/workspace/page-id' :
                        'https://docs.google.com/spreadsheets/d/...'
                      }
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      className="kc-modal-input"
                    />
                    <div className="kc-modal-actions">
                      <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                      <button type="submit" className="btn-primary" disabled={submittingSource || !inputUrl.trim()}>
                        {submittingSource ? 'Connecting…' : 'Add Source'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loadError && <div className="kc-error">{loadError}</div>}

      <section className="kc-categories">
        {CATEGORIES.map((category) => {
          const CatIcon = category.icon
          const items = getItemsForCategory(category)

          return (
            <motion.div
              className="kc-category"
              key={category.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="kc-category-head">
                <span className="kc-category-icon"><CatIcon size={18} /></span>
                <div>
                  <h3>{category.name}</h3>
                  <p>{category.blurb}</p>
                </div>
              </div>

              {loading ? (
                <div className="kc-skeleton" />
              ) : items.length === 0 ? (
                <div className="kc-category-empty-box">
                  <p className="kc-category-empty">Nothing here yet — add material to train your agent on {category.name.toLowerCase()}.</p>
                  <button className="btn-secondary kc-card-add" onClick={() => openModalForCategory(category)}>
                    <UploadCloud size={14} /> Add Knowledge
                  </button>
                </div>
              ) : (
                <>
                  <ul className="kc-doc-list">
                    {items.map((item) => {
                      const ItemIcon = item.icon
                      return (
                        <li key={item.id} className="kc-doc-item">
                          <div className="kc-doc-item-main">
                            <ItemIcon size={14} />
                            <span className="kc-doc-name mono">{item.name}</span>
                          </div>
                          <div className="kc-doc-item-actions">
                            <span className={`kc-doc-status ${item.status}`}>{item.status}</span>
                            <button
                              className="kc-doc-delete"
                              onClick={() => handleDeleteItem(item)}
                              title="Remove from knowledge"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  <button className="btn-secondary kc-card-add" onClick={() => openModalForCategory(category)}>
                    <Plus size={14} /> Add more
                  </button>
                </>
              )}
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
