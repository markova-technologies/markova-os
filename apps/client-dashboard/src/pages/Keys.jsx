import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Key, Plus, Trash2, Copy, Check, ShieldAlert, FlaskConical } from 'lucide-react'
import { listKeys, createKey, deleteKey } from '../api/client'
import { useEnvironment } from '../contexts/EnvironmentContext'
import { useToast } from '../contexts/ToastContext'
import './Keys.css'

const Keys = () => {
  // Which key you're about to mint follows the mode you're in, so the page can
  // never disagree with the strip at the top.
  const { environment, setEnvironment } = useEnvironment()
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState(null) // full secret, shown once
  const [copied, setCopied] = useState(false)
  const toast = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await listKeys()
      setKeys(data || [])
    } catch {
      toast.error('We couldn’t load your keys just now. Try again in a moment.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const { data } = await createKey(name.trim(), environment)
      setNewKey(data) // includes api_key
      setName('')
      load()
    } catch {
      toast.error('We couldn’t create that key. Try again in a moment.')
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(newKey.api_key)
    setCopied(true)
    toast.success('Key copied to your clipboard.')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = async (key) => {
    if (!window.confirm(`Revoke “${key.name}”? Anything using this key stops working immediately.`)) return
    try {
      await deleteKey(key.id)
      toast.success('Key revoked.')
      load()
    } catch {
      toast.error('We couldn’t revoke that key. Try again in a moment.')
    }
  }

  const sandboxKeys = keys.filter(k => k.environment === 'test')
  const liveKeys = keys.filter(k => k.environment === 'live')

  const KeyRow = ({ k }) => (
    <div className="key-row">
      <div className="key-row-main">
        <span className="key-name">{k.name}</span>
        <code className="key-prefix">{k.key_prefix}…</code>
      </div>
      <div className="key-row-meta">
        <span className={`key-status ${k.status}`}>{k.status || 'active'}</span>
        <button className="key-delete" onClick={() => handleDelete(k)} title="Revoke key">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )

  return (
    <div className="keys-page">
      <header className="page-header">
        <h1>API Keys</h1>
        <p>Use a sandbox key to build and test for free. Switch to a live key when you’re ready for real calls.</p>
      </header>

      {newKey && (
        <motion.div className="new-key-banner" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <ShieldAlert size={20} />
          <div className="new-key-body">
            <strong>Copy your key now — this is the only time you’ll see it.</strong>
            <div className="new-key-value">
              <code>{newKey.api_key}</code>
              <button onClick={handleCopy}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy'}</button>
            </div>
          </div>
          <button className="new-key-dismiss" onClick={() => setNewKey(null)}>I’ve saved it</button>
        </motion.div>
      )}

      <form className="key-create" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Name this key (e.g. Backend server)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="env-toggle">
          <button type="button" className={environment === 'test' ? 'active' : ''} onClick={() => setEnvironment('test')}>
            <FlaskConical size={15} /> Sandbox
          </button>
          <button type="button" className={`live ${environment === 'live' ? 'active' : ''}`} onClick={() => setEnvironment('live')}>
            <ShieldAlert size={15} /> Live
          </button>
        </div>
        <button type="submit" className="btn-primary" disabled={creating}>
          <Plus size={16} /> {creating ? 'Creating…' : 'Create key'}
        </button>
      </form>

      {loading ? (
        <div className="keys-loading">Loading your keys…</div>
      ) : (
        <div className="keys-sections">
          <section className="keys-section sandbox">
            <div className="keys-section-head"><FlaskConical size={18} /><h2>Sandbox keys</h2><span>mk_test_</span></div>
            {sandboxKeys.length === 0
              ? <div className="keys-empty">No sandbox keys yet — create one above to start testing for free.</div>
              : sandboxKeys.map(k => <KeyRow key={k.id} k={k} />)}
          </section>

          <section className="keys-section live">
            <div className="keys-section-head"><ShieldAlert size={18} /><h2>Live keys</h2><span>mk_live_</span></div>
            {liveKeys.length === 0
              ? <div className="keys-empty">No live keys yet. Create one when you’re ready to place real calls.</div>
              : liveKeys.map(k => <KeyRow key={k.id} k={k} />)}
          </section>
        </div>
      )}
    </div>
  )
}

export default Keys
