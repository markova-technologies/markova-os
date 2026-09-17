import React, { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  ShieldAlert,
  FlaskConical,
  Activity,
  Terminal,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Code2,
  RefreshCw,
  X,
  Radio
} from 'lucide-react'
import { listKeys, createKey, deleteKey, revokeKey, verifyApiKey } from '../api/client'
import { useEnvironment } from '../contexts/EnvironmentContext'
import { useToast } from '../contexts/ToastContext'
import './Keys.css'

const Keys = () => {
  const { environment, setEnvironment } = useEnvironment()
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [keyEnv, setKeyEnv] = useState(environment || 'test')
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState(null) // full secret, shown once
  const [copied, setCopied] = useState(false)
  const [copiedPrefixId, setCopiedPrefixId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'test' | 'live' | 'revoked'

  // Diagnostic / Test Key Modal State
  const [testingKey, setTestingKey] = useState(null)
  const [testResult, setTestResult] = useState(null)
  const [testingLoading, setTestingLoading] = useState(false)

  // Code Snippets Drawer State
  const [snippetKey, setSnippetKey] = useState(null)
  const [snippetLanguage, setSnippetLanguage] = useState('curl') // 'curl' | 'python' | 'javascript'
  const [snippetCopied, setSnippetCopied] = useState(false)

  // Revoke / Delete Confirmation Modal State
  const [actionTarget, setActionTarget] = useState(null) // { key, action: 'revoke' | 'delete' }
  const [actionLoading, setActionLoading] = useState(false)

  const toast = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const res = await listKeys()
      setKeys(res.data || [])
    } catch {
      toast.error('We couldn’t load your keys just now. Try again in a moment.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Keep keyEnv in sync with top environment strip if user changes it
  useEffect(() => {
    setKeyEnv(environment || 'test')
  }, [environment])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await createKey(name.trim(), keyEnv)
      setNewKey(res.data) // includes api_key
      setName('')
      toast.success(`${keyEnv === 'live' ? 'Live' : 'Sandbox'} API key generated successfully.`)
      await load()
    } catch {
      toast.error('We couldn’t create that key. Try again in a moment.')
    } finally {
      setCreating(false)
    }
  }

  const handleCopySecret = () => {
    if (!newKey?.api_key) return
    navigator.clipboard.writeText(newKey.api_key)
    setCopied(true)
    toast.success('Full API secret key copied to clipboard.')
    setTimeout(() => setCopied(false), 2200)
  }

  const handleCopyPrefix = (key) => {
    navigator.clipboard.writeText(key.key_prefix)
    setCopiedPrefixId(key.id)
    toast.success('Key prefix copied to clipboard.')
    setTimeout(() => setCopiedPrefixId(null), 1800)
  }

  const handleOpenTestModal = async (k) => {
    setTestingKey(k)
    setTestResult(null)
    setTestingLoading(true)
    try {
      const result = await verifyApiKey(k.key_prefix || k.id)
      setTestResult(result)
    } catch {
      setTestResult({ valid: false, error: 'Network validation error' })
    } finally {
      setTestingLoading(false)
    }
  }

  const handleReTest = async () => {
    if (!testingKey) return
    setTestingLoading(true)
    try {
      const result = await verifyApiKey(testingKey.key_prefix || testingKey.id)
      setTestResult(result)
    } catch {
      setTestResult({ valid: false, error: 'Network validation error' })
    } finally {
      setTestingLoading(false)
    }
  }

  const handleConfirmAction = async () => {
    if (!actionTarget) return
    const { key, action } = actionTarget
    setActionLoading(true)
    try {
      if (action === 'revoke') {
        await revokeKey(key.id)
        toast.success(`Key “${key.name}” has been revoked.`)
      } else {
        await deleteKey(key.id)
        toast.success(`Key “${key.name}” permanently deleted.`)
      }
      setActionTarget(null)
      await load()
    } catch {
      toast.error(`Failed to ${action} key. Please try again.`)
    } finally {
      setActionLoading(false)
    }
  }

  // Filtered keys
  const filteredKeys = useMemo(() => {
    return keys.filter(k => {
      const matchesSearch =
        k.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.key_prefix?.toLowerCase().includes(searchQuery.toLowerCase())

      if (!matchesSearch) return false

      if (activeTab === 'all') return true
      if (activeTab === 'revoked') return k.status === 'revoked'
      if (activeTab === 'test') return k.environment === 'test' && k.status !== 'revoked'
      if (activeTab === 'live') return k.environment === 'live' && k.status !== 'revoked'
      return true
    })
  }, [keys, searchQuery, activeTab])

  // Stats computation
  const stats = useMemo(() => {
    const sandboxCount = keys.filter(k => k.environment === 'test' && k.status !== 'revoked').length
    const liveCount = keys.filter(k => k.environment === 'live' && k.status !== 'revoked').length
    const revokedCount = keys.filter(k => k.status === 'revoked').length
    return { sandboxCount, liveCount, revokedCount, total: keys.length }
  }, [keys])

  // Code snippets generation
  const getCodeSnippet = () => {
    const activeKeyToken = snippetKey?.key_prefix ? `${snippetKey.key_prefix}••••••••` : 'mk_test_your_secret_key'
    const baseUrl = typeof window !== 'undefined' ? window.location.origin.replace(':5173', ':8000') : 'https://api.markova.ai'

    if (snippetLanguage === 'curl') {
      return `# 1. List active voice agents
curl -X GET "${baseUrl}/v1/agents" \\
  -H "Authorization: Bearer ${activeKeyToken}" \\
  -H "Content-Type: application/json"

# 2. Place an outbound call
curl -X POST "${baseUrl}/v1/calls" \\
  -H "Authorization: Bearer ${activeKeyToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+251911234567",
    "agent_id": "default-commander",
    "prompt_override": "Greet the customer in Amharic"
  }'`
    }

    if (snippetLanguage === 'python') {
      return `import requests

API_KEY = "${activeKeyToken}"
BASE_URL = "${baseUrl}"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# List available agents
response = requests.get(f"{BASE_URL}/v1/agents", headers=headers)
agents = response.json()
print("Connected Agents:", agents)

# Trigger outbound call session
call_payload = {
    "to": "+251911234567",
    "agent_id": "default-commander"
}
call_res = requests.post(f"{BASE_URL}/v1/calls", json=call_payload, headers=headers)
print("Call Dispatched:", call_res.json())`
    }

    return `// Node.js / Browser SDK call example
const API_KEY = "${activeKeyToken}";
const BASE_URL = "${baseUrl}";

async function fetchAgents() {
  const res = await fetch(\`\${BASE_URL}/v1/agents\`, {
    headers: {
      "Authorization": \`Bearer \${API_KEY}\`,
      "Content-Type": "application/json"
    }
  });
  const data = await res.json();
  console.log("Agents retrieved:", data);
}

fetchAgents();`
  }

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(getCodeSnippet())
    setSnippetCopied(true)
    toast.success('Code snippet copied to clipboard.')
    setTimeout(() => setSnippetCopied(false), 2000)
  }

  return (
    <div className="keys-page">
      {/* Header with Title & Stats */}
      <header className="page-header">
        <div className="page-header-top">
          <div>
            <div className="page-badge">
              <Key size={14} /> Developer Access & Security
            </div>
            <h1>API Keys</h1>
            <p>
              Generate cryptographically secure API keys to authenticate with Markova AI REST endpoints,
              telephony bridges, webhooks, and SDKs.
            </p>
          </div>
          <button
            className="btn-refresh"
            onClick={load}
            disabled={loading}
            title="Refresh keys"
          >
            <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="keys-stats-grid">
          <div className="keys-stat-card">
            <div className="stat-icon sandbox">
              <FlaskConical size={18} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.sandboxCount}</div>
              <div className="stat-label">Active Sandbox Keys</div>
            </div>
          </div>

          <div className="keys-stat-card">
            <div className="stat-icon live">
              <Activity size={18} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.liveCount}</div>
              <div className="stat-label">Active Live Keys</div>
            </div>
          </div>

          <div className="keys-stat-card">
            <div className="stat-icon security">
              <Radio size={18} />
            </div>
            <div className="stat-content">
              <div className="stat-value">
                <span className={`status-pill ${environment === 'live' ? 'live' : 'sandbox'}`}>
                  {environment === 'live' ? 'Live Mode' : 'Sandbox Mode'}
                </span>
              </div>
              <div className="stat-label">Default Environment</div>
            </div>
          </div>
        </div>
      </header>

      {/* One-Time Full Secret Key Reveal Banner */}
      <AnimatePresence>
        {newKey && (
          <motion.div
            className="new-key-banner"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.25 }}
          >
            <div className="new-key-icon-wrap">
              <ShieldAlert size={24} />
            </div>
            <div className="new-key-body">
              <div className="new-key-headline">
                <strong>Copy your secret API key now</strong>
                <span className="badge-warning">Shown once only</span>
              </div>
              <p className="new-key-warning">
                For security reasons, we do not store this key in plaintext and cannot show it to you again.
                Store it in your environment variables or key vault immediately.
              </p>
              <div className="new-key-value">
                <code>{newKey.api_key}</code>
                <button
                  type="button"
                  className="btn-copy-secret"
                  onClick={handleCopySecret}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  <span>{copied ? 'Copied!' : 'Copy Key'}</span>
                </button>
              </div>
            </div>
            <button
              className="new-key-dismiss"
              onClick={() => setNewKey(null)}
              title="Close banner"
            >
              I’ve saved it
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Key Card Form */}
      <div className="key-create-card">
        <div className="card-title-row">
          <div className="card-title">
            <Plus size={16} />
            <h3>Generate Secret Key</h3>
          </div>
          <span className="card-hint">Keys are hashed with SHA-256 at rest</span>
        </div>

        <form className="key-create-form" onSubmit={handleCreate}>
          <div className="input-group">
            <input
              type="text"
              className="key-name-input"
              placeholder="Name this key (e.g. Production Backend, Telephony IVR, CRM Webhook)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="env-selector">
            <button
              type="button"
              className={`env-btn sandbox ${keyEnv === 'test' ? 'active' : ''}`}
              onClick={() => setKeyEnv('test')}
            >
              <FlaskConical size={14} />
              <span>Sandbox (mk_test_)</span>
            </button>
            <button
              type="button"
              className={`env-btn live ${keyEnv === 'live' ? 'active' : ''}`}
              onClick={() => setKeyEnv('live')}
            >
              <Activity size={14} />
              <span>Live (mk_live_)</span>
            </button>
          </div>

          <button
            type="submit"
            className="btn-create-key"
            disabled={creating || !name.trim()}
          >
            <Plus size={16} />
            <span>{creating ? 'Generating…' : 'Generate Key'}</span>
          </button>
        </form>
      </div>

      {/* Filter & Search Bar */}
      <div className="keys-controls-bar">
        <div className="keys-tabs">
          <button
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Keys <span className="tab-count">{keys.length}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'test' ? 'active' : ''}`}
            onClick={() => setActiveTab('test')}
          >
            Sandbox <span className="tab-count">{stats.sandboxCount}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'live' ? 'active' : ''}`}
            onClick={() => setActiveTab('live')}
          >
            Live <span className="tab-count">{stats.liveCount}</span>
          </button>
          {stats.revokedCount > 0 && (
            <button
              className={`tab-btn ${activeTab === 'revoked' ? 'active' : ''}`}
              onClick={() => setActiveTab('revoked')}
            >
              Revoked <span className="tab-count">{stats.revokedCount}</span>
            </button>
          )}
        </div>

        <div className="keys-search-box">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search keys by name or prefix…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Keys Table / List */}
      {loading ? (
        <div className="keys-loading-state">
          <div className="loading-spinner" />
          <span>Loading cryptographic keys…</span>
        </div>
      ) : filteredKeys.length === 0 ? (
        <div className="keys-empty-card">
          <div className="empty-icon-wrap">
            <Key size={32} />
          </div>
          <h3>No keys found</h3>
          <p>
            {searchQuery
              ? `No keys match your query “${searchQuery}”.`
              : activeTab === 'revoked'
              ? 'You have zero revoked keys.'
              : 'Generate your first API key above to start integrating programmatically.'}
          </p>
        </div>
      ) : (
        <div className="keys-table-card">
          <table className="keys-table">
            <thead>
              <tr>
                <th>Key Name</th>
                <th>Prefix & Token</th>
                <th>Environment</th>
                <th>Status</th>
                <th>Created</th>
                <th className="actions-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredKeys.map((k) => {
                const isRevoked = k.status === 'revoked'
                const isLive = k.environment === 'live'

                return (
                  <tr key={k.id} className={isRevoked ? 'row-revoked' : ''}>
                    <td className="key-name-col">
                      <div className="key-name-wrap">
                        <span className="key-title">{k.name}</span>
                      </div>
                    </td>

                    <td className="key-prefix-col">
                      <div className="prefix-chip">
                        <code>{k.key_prefix}••••••••</code>
                        <button
                          type="button"
                          className="btn-mini-copy"
                          onClick={() => handleCopyPrefix(k)}
                          title="Copy prefix"
                        >
                          {copiedPrefixId === k.id ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    </td>

                    <td>
                      <span className={`env-pill ${isLive ? 'live' : 'sandbox'}`}>
                        {isLive ? <Activity size={11} /> : <FlaskConical size={11} />}
                        {isLive ? 'Live' : 'Sandbox'}
                      </span>
                    </td>

                    <td>
                      <span className={`status-pill ${isRevoked ? 'revoked' : 'active'}`}>
                        <span className="dot" />
                        {isRevoked ? 'Revoked' : 'Active'}
                      </span>
                    </td>

                    <td className="key-created-col">
                      <div className="date-wrap">
                        <Clock size={12} />
                        <span>
                          {k.created_at
                            ? new Date(k.created_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })
                            : 'Active'}
                        </span>
                      </div>
                    </td>

                    <td className="actions-cell">
                      <div className="actions-wrap">
                        <button
                          type="button"
                          className="action-btn test"
                          onClick={() => handleOpenTestModal(k)}
                          title="Test connection with this key"
                        >
                          <Terminal size={14} />
                          <span>Test</span>
                        </button>

                        <button
                          type="button"
                          className="action-btn code"
                          onClick={() => setSnippetKey(k)}
                          title="View Quickstart Code Snippets"
                        >
                          <Code2 size={14} />
                          <span>Code</span>
                        </button>

                        {!isRevoked ? (
                          <button
                            type="button"
                            className="action-btn revoke"
                            onClick={() => setActionTarget({ key: k, action: 'revoke' })}
                            title="Revoke key"
                          >
                            <AlertTriangle size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="action-btn delete"
                            onClick={() => setActionTarget({ key: k, action: 'delete' })}
                            title="Permanently delete record"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Interactive API Key Diagnostic & Test Console Modal */}
      <AnimatePresence>
        {testingKey && (
          <div className="modal-backdrop" onClick={() => setTestingKey(null)}>
            <motion.div
              className="modal-box test-key-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
            >
              <div className="modal-header">
                <div className="modal-title-wrap">
                  <div className="modal-icon-wrap terminal">
                    <Terminal size={18} />
                  </div>
                  <div>
                    <h3>API Key Diagnostic Console</h3>
                    <p>Testing gateway authentication and environment routing</p>
                  </div>
                </div>
                <button
                  className="modal-close-btn"
                  onClick={() => setTestingKey(null)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="modal-content">
                <div className="key-inspect-strip">
                  <div className="inspect-item">
                    <span className="inspect-label">Target Key</span>
                    <span className="inspect-value">{testingKey.name}</span>
                  </div>
                  <div className="inspect-item">
                    <span className="inspect-label">Prefix</span>
                    <code>{testingKey.key_prefix}••••</code>
                  </div>
                  <div className="inspect-item">
                    <span className="inspect-label">Scope</span>
                    <span className={`env-pill ${testingKey.environment === 'live' ? 'live' : 'sandbox'}`}>
                      {testingKey.environment}
                    </span>
                  </div>
                </div>

                <div className="diagnostic-results">
                  {testingLoading ? (
                    <div className="diag-loading">
                      <RefreshCw size={22} className="spinning" />
                      <span>Validating HMAC handshake with API Gateway…</span>
                    </div>
                  ) : testResult ? (
                    <div className={`diag-card ${testResult.valid ? 'success' : 'error'}`}>
                      <div className="diag-head">
                        {testResult.valid ? (
                          <div className="diag-badge-success">
                            <CheckCircle2 size={18} /> Valid & Connected
                          </div>
                        ) : (
                          <div className="diag-badge-error">
                            <AlertTriangle size={18} /> Invalid or Expired Key
                          </div>
                        )}
                        {testResult.latencyMs !== undefined && (
                          <span className="diag-latency">
                            <Activity size={12} /> {testResult.latencyMs} ms
                          </span>
                        )}
                      </div>

                      <div className="diag-details">
                        <div className="diag-row">
                          <span>Workspace / Company:</span>
                          <strong>{testResult.companyName || 'Markova Enterprise'}</strong>
                        </div>
                        <div className="diag-row">
                          <span>Routing Environment:</span>
                          <strong>{testResult.environment || testingKey.environment}</strong>
                        </div>
                        <div className="diag-row">
                          <span>Assigned Tier:</span>
                          <strong>{testResult.plan || 'Production Ready'}</strong>
                        </div>
                        <div className="diag-row">
                          <span>Accessible APIs:</span>
                          <span className="diag-caps">Voice Calls, Agents, Telephony, Webhooks</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="diag-error">No response received.</div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setTestingKey(null)}
                >
                  Close Console
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleReTest}
                  disabled={testingLoading}
                >
                  <RefreshCw size={14} className={testingLoading ? 'spinning' : ''} />
                  <span>Re-test Handshake</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Developer Quickstart Code Snippets Modal */}
      <AnimatePresence>
        {snippetKey && (
          <div className="modal-backdrop" onClick={() => setSnippetKey(null)}>
            <motion.div
              className="modal-box code-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
            >
              <div className="modal-header">
                <div className="modal-title-wrap">
                  <div className="modal-icon-wrap code">
                    <Code2 size={18} />
                  </div>
                  <div>
                    <h3>Quickstart Code Integration</h3>
                    <p>Copy-paste ready snippets for key: <strong>{snippetKey.name}</strong></p>
                  </div>
                </div>
                <button
                  className="modal-close-btn"
                  onClick={() => setSnippetKey(null)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="modal-content">
                <div className="lang-tabs">
                  <button
                    className={`lang-tab ${snippetLanguage === 'curl' ? 'active' : ''}`}
                    onClick={() => setSnippetLanguage('curl')}
                  >
                    cURL (CLI)
                  </button>
                  <button
                    className={`lang-tab ${snippetLanguage === 'python' ? 'active' : ''}`}
                    onClick={() => setSnippetLanguage('python')}
                  >
                    Python (requests)
                  </button>
                  <button
                    className={`lang-tab ${snippetLanguage === 'javascript' ? 'active' : ''}`}
                    onClick={() => setSnippetLanguage('javascript')}
                  >
                    Node.js / Fetch
                  </button>
                </div>

                <div className="code-block-wrap">
                  <pre className="code-pre">
                    <code>{getCodeSnippet()}</code>
                  </pre>
                  <button
                    type="button"
                    className="btn-copy-code"
                    onClick={handleCopySnippet}
                  >
                    {snippetCopied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{snippetCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="code-tip">
                  <ShieldAlert size={14} />
                  <span>
                    In production, always authenticate using either <code>Authorization: Bearer mk_...</code> or <code>x-api-key: mk_...</code>.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSnippetKey(null)}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Revoke / Delete Confirmation Modal */}
      <AnimatePresence>
        {actionTarget && (
          <div className="modal-backdrop" onClick={() => setActionTarget(null)}>
            <motion.div
              className="modal-box confirm-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
            >
              <div className="modal-header">
                <div className="modal-icon-wrap danger">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3>
                    {actionTarget.action === 'revoke'
                      ? `Revoke “${actionTarget.key.name}”?`
                      : `Permanently Delete “${actionTarget.key.name}”?`}
                  </h3>
                  <p>
                    {actionTarget.action === 'revoke'
                      ? 'Any backend server or integration using this key will immediately be rejected with 403 Forbidden.'
                      : 'This record will be permanently deleted from the database audit log.'}
                  </p>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setActionTarget(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={handleConfirmAction}
                  disabled={actionLoading}
                >
                  {actionLoading
                    ? 'Processing…'
                    : actionTarget.action === 'revoke'
                    ? 'Yes, Revoke Key'
                    : 'Yes, Delete Permanently'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Keys
