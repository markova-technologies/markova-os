import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Globe, 
  Bot, 
  FileText, 
  Link as LinkIcon, 
  Database, 
  RefreshCw,
  MoreVertical,
  Plus,
  Book,
  FileSpreadsheet,
  UploadCloud,
  X
} from 'lucide-react'
import api from '../api/client'
import './KnowledgeCenter.css'

const KnowledgeCenter = () => {
  const [activeTab, setActiveTab] = useState('global')
  const [activeTeamId, setActiveTeamId] = useState('sales')
  const [teams, setTeams] = useState([])
  const [globalSources, setGlobalSources] = useState([])
  const [teamSources, setTeamSources] = useState([])
  const [loading, setLoading] = useState(true)

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addType, setAddType] = useState(null) // 'file', 'url', 'sheets', 'drive'
  const [uploadProgress, setUploadProgress] = useState(0)

  // Form states
  const [urlInput, setUrlInput] = useState('')
  const [sheetId, setSheetId] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    fetchTeams()
    fetchSources()
  }, [])

  useEffect(() => {
    if (activeTab === 'team') fetchSources()
  }, [activeTeamId, activeTab])

  const fetchTeams = async () => {
    try {
      const res = await api.get('/builder/teams').catch(() => ({ data: [] }))
      if (res.data) setTeams(res.data)
    } catch(e) {}
  }

  const fetchSources = async () => {
    setLoading(true)
    try {
      if (activeTab === 'global') {
        const res = await api.get('/knowledge/sources?level=global').catch(() => ({ data: [] }))
        setGlobalSources(res.data || [])
      } else {
        const res = await api.get(`/knowledge/sources?level=team&teamId=${activeTeamId}`).catch(() => ({ data: [] }))
        setTeamSources(res.data || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async (id, isGlobal) => {
    const updateState = isGlobal ? setGlobalSources : setTeamSources
    updateState(prev => prev.map(src => src.id === id ? { ...src, status: 'Syncing...', sync: 'Just now' } : src))
    
    try {
      await api.post(`/knowledge/sources/${id}/sync`).catch(() => {})
      setTimeout(() => {
        updateState(prev => prev.map(src => src.id === id ? { ...src, status: 'Synced', sync: 'Just now' } : src))
      }, 2000)
    } catch (e) {
      updateState(prev => prev.map(src => src.id === id ? { ...src, status: 'Failed' } : src))
    }
  }

  const getIconForType = (type) => {
    const t = type.toLowerCase()
    if (t.includes('pdf') || t.includes('doc')) return FileText
    if (t.includes('web') || t.includes('url')) return Globe
    if (t.includes('sheet') || t.includes('csv')) return FileSpreadsheet
    if (t.includes('notion')) return Book
    return Database
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadProgress(10);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('level', activeTab);
    if (activeTab === 'team') formData.append('teamId', activeTeamId);

    const interval = setInterval(() => {
      setUploadProgress(p => p < 90 ? p + 10 : p);
    }, 200);

    try {
      await api.post('/knowledge/sources/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      }).catch(() => {});
      clearInterval(interval);
      setUploadProgress(100);
      setTimeout(() => {
        setIsAddModalOpen(false);
        setUploadProgress(0);
        fetchSources();
      }, 500);
    } catch(err) {
      clearInterval(interval);
      setUploadProgress(0);
      alert('Upload failed');
    }
  }

  const handleAddUrl = async () => {
    if (!urlInput) return;
    try {
      await api.post('/knowledge/sources', {
        type: 'website',
        name: new URL(urlInput).hostname,
        url: urlInput,
        level: activeTab,
        teamId: activeTab === 'team' ? activeTeamId : null
      }).catch(() => {});
      setIsAddModalOpen(false);
      setUrlInput('');
      fetchSources();
    } catch(e) {
      alert('Failed to add URL');
    }
  }

  const handleAddSheet = async () => {
    if (!sheetId) return;
    try {
      await api.post('/knowledge/sources', {
        type: 'google_sheets',
        name: `Sheet: ${sheetId.substring(0, 8)}...`,
        config: { sheetId },
        level: activeTab,
        teamId: activeTab === 'team' ? activeTeamId : null
      }).catch(() => {});
      setIsAddModalOpen(false);
      setSheetId('');
      fetchSources();
    } catch(e) {
      alert('Failed to add Sheet');
    }
  }

  const renderAddModal = () => (
    <AnimatePresence>
      {isAddModalOpen && (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content" style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem', width: '500px', border: '1px solid var(--border-main)', position: 'relative' }}>
            <button onClick={() => { setIsAddModalOpen(false); setAddType(null); }} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--gray)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ marginTop: 0, color: 'var(--text-main)' }}>Add Data Source ({activeTab === 'global' ? 'Global' : 'Team'})</h3>
            
            {!addType ? (
              <div className="source-types-grid" style={{ marginTop: '1.5rem' }}>
                <div className="source-type-card" onClick={() => setAddType('file')} style={{ cursor: 'pointer' }}>
                  <div className="st-icon"><FileText size={20} /></div>
                  <div className="st-info"><h4>Upload Files</h4><p>PDF, DOCX, TXT</p></div>
                </div>
                <div className="source-type-card" onClick={() => setAddType('url')} style={{ cursor: 'pointer' }}>
                  <div className="st-icon"><LinkIcon size={20} /></div>
                  <div className="st-info"><h4>Website URL</h4><p>Crawl domains</p></div>
                </div>
                <div className="source-type-card" onClick={() => setAddType('sheets')} style={{ cursor: 'pointer' }}>
                  <div className="st-icon"><FileSpreadsheet size={20} /></div>
                  <div className="st-info"><h4>Google Sheets</h4><p>Sync live data</p></div>
                </div>
                <div className="source-type-card" onClick={() => setAddType('drive')} style={{ cursor: 'pointer' }}>
                  <div className="st-icon"><Database size={20} /></div>
                  <div className="st-info"><h4>Google Drive</h4><p>Sync folders</p></div>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '1.5rem' }}>
                <button onClick={() => setAddType(null)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  &larr; Back to options
                </button>
                
                {addType === 'file' && (
                  <div 
                    className="upload-zone" 
                    onClick={() => fileInputRef.current?.click()}
                    style={{ border: '2px dashed var(--border-main)', borderRadius: '8px', padding: '3rem 1rem', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-main)' }}
                  >
                    <UploadCloud size={48} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
                    <p style={{ color: 'var(--text-main)', margin: '0 0 0.5rem 0' }}>Drag & drop files here</p>
                    <p style={{ color: 'var(--gray)', fontSize: '0.85rem', margin: 0 }}>or click to browse (PDF, DOCX, TXT)</p>
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
                    {uploadProgress > 0 && (
                      <div style={{ marginTop: '1.5rem', background: 'var(--bg-card)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--primary)', width: `${uploadProgress}%`, transition: 'width 0.2s' }}></div>
                      </div>
                    )}
                  </div>
                )}

                {addType === 'url' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>Website URL</label>
                    <input type="url" placeholder="https://example.com" value={urlInput} onChange={e => setUrlInput(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-main)', color: 'white', border: '1px solid var(--border-main)', marginBottom: '1rem' }} />
                    <button onClick={handleAddUrl} className="btn-primary" style={{ width: '100%' }}>Start Crawling</button>
                  </div>
                )}

                {addType === 'sheets' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>Google Sheet ID</label>
                    <input type="text" placeholder="1BxiMVs0XRY..." value={sheetId} onChange={e => setSheetId(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-main)', color: 'white', border: '1px solid var(--border-main)', marginBottom: '1rem' }} />
                    <p style={{ color: 'var(--gray)', fontSize: '0.8rem', marginBottom: '1rem' }}>Ensure your service account has access to this sheet.</p>
                    <button onClick={handleAddSheet} className="btn-primary" style={{ width: '100%' }}>Connect Sheet</button>
                  </div>
                )}
                
                {addType === 'drive' && (
                  <div>
                    <p style={{ color: 'var(--gray)' }}>Google Drive integration requires OAuth setup in settings first.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  const renderSourceTypes = () => (
    <div className="source-types-grid" onClick={() => { setAddType(null); setIsAddModalOpen(true); }} style={{ cursor: 'pointer' }}>
      <div className="source-type-card"><div className="st-icon"><FileText size={20} /></div><div className="st-info"><h4>Upload Files</h4><p>PDF, DOCX, TXT, CSV</p></div></div>
      <div className="source-type-card"><div className="st-icon"><LinkIcon size={20} /></div><div className="st-info"><h4>Website URL</h4><p>Crawl specific domains</p></div></div>
      <div className="source-type-card"><div className="st-icon"><FileSpreadsheet size={20} /></div><div className="st-info"><h4>Google Sheets</h4><p>Sync live data</p></div></div>
      <div className="source-type-card"><div className="st-icon"><Database size={20} /></div><div className="st-info"><h4>Database</h4><p>PostgreSQL, MySQL</p></div></div>
    </div>
  )

  const renderSourcesList = (sources, isGlobal = true) => (
    <div className="data-sources-list">
      {sources.length === 0 && !loading && <p style={{ color: 'var(--gray)', padding: '1rem' }}>No sources connected yet.</p>}
      {loading && <p style={{ color: 'var(--gray)', padding: '1rem' }}>Loading sources...</p>}
      {sources.map((src, i) => {
        const Icon = getIconForType(src.type);
        return (
          <motion.div 
            className="data-source-item" 
            key={src.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="ds-left">
              <div className="ds-icon-wrapper">
                <Icon size={20} />
              </div>
              <div className="ds-details">
                <h4>{src.name}</h4>
                <div className="ds-meta">
                  <span>{src.type}</span>
                  <span>•</span>
                  <span><RefreshCw size={12} /> Last synced: {src.sync || 'Never'}</span>
                  {src.size && <><span>•</span><span>{src.size}</span></>}
                </div>
              </div>
            </div>
            <div className="ds-actions">
              <div className="ds-status">
                {src.status === 'Synced' && <div className="dot" style={{background: '#10b981', width: 8, height: 8, borderRadius: '50%', display: 'inline-block', marginRight: 6}}></div>}
                {src.status === 'Syncing...' && <RefreshCw size={12} className="spinning" style={{marginRight: 6}} />}
                {src.status}
              </div>
              <button className="btn-secondary" style={{padding: '0.25rem 0.75rem', fontSize: '0.8rem'}} onClick={() => handleSync(src.id, isGlobal)}>
                <RefreshCw size={12} /> Sync
              </button>
              <button className="btn-icon"><MoreVertical size={16} /></button>
            </div>
          </motion.div>
        )
      })}
    </div>
  )

  return (
    <div className="knowledge-center">
      <div className="kc-header">
        <div className="kc-title-row">
          <div className="kc-title">
            <h1>Knowledge Center</h1>
            <p>Manage the data and documents your AI workforce uses to answer questions.</p>
          </div>
          <div className="kc-actions">
            <button className="btn btn-primary" onClick={() => { setAddType(null); setIsAddModalOpen(true); }}><Plus size={16} /> Add Data Source</button>
          </div>
        </div>
        <div className="kc-tabs">
          <button className={`kc-tab ${activeTab === 'global' ? 'active' : ''}`} onClick={() => setActiveTab('global')}>
            <Globe size={16} /> Global Company Knowledge
          </button>
          <button className={`kc-tab ${activeTab === 'team' ? 'active' : ''}`} onClick={() => setActiveTab('team')}>
            <Bot size={16} /> Team-Specific Knowledge
          </button>
        </div>
      </div>

      <div className="kc-main">
        <AnimatePresence mode="wait">
          {activeTab === 'global' && (
            <motion.div key="global" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
              <h3 className="kc-section-title">Add New Source</h3>
              {renderSourceTypes()}
              <h3 className="kc-section-title" style={{ marginTop: '2rem' }}>Active Global Sources</h3>
              <p style={{ color: 'var(--gray)', fontSize: '0.85rem', marginBottom: '1rem', marginTop: '-0.5rem' }}>This knowledge is automatically available to the Commander Agent and all teams.</p>
              {renderSourcesList(globalSources, true)}
            </motion.div>
          )}

          {activeTab === 'team' && (
            <motion.div key="team" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <div className="agent-filter-row" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <select className="agent-select" value={activeTeamId} onChange={e => setActiveTeamId(e.target.value)} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-main)' }}>
                  {teams.length > 0 ? teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  )) : (
                    <>
                      <option value="sales">Sales Team</option>
                      <option value="support">Support Team</option>
                      <option value="ops">Operations Team</option>
                    </>
                  )}
                </select>
                <span style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>Assign knowledge exclusively to this team.</span>
              </div>
              <h3 className="kc-section-title">Add New Source for Team</h3>
              {renderSourceTypes()}
              <h3 className="kc-section-title" style={{ marginTop: '2rem' }}>Active Team Sources</h3>
              {renderSourcesList(teamSources, false)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {renderAddModal()}
    </div>
  )
}

export default KnowledgeCenter
