import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Bot,
  History,
  Plus,
  Save,
  ShieldCheck,
  Sliders,
  Edit3,
  Trash2,
} from 'lucide-react'
import {
  listAgents,
  createAgent,
  updateAgent,
  deleteAgent,
  getAgentVersions,
  rollbackAgent,
  testCallAgent,
} from '../api/client'
import { useEnvironment } from '../contexts/EnvironmentContext'
import { useToast } from '../contexts/ToastContext'
import Waveform from '../components/Waveform'
import './AgentStudio.css'

const LANGUAGES = [
  { value: 'am', label: 'Amharic' },
  { value: 'om', label: 'Afaan Oromo' },
  { value: 'ti', label: 'Tigrinya' },
  { value: 'en', label: 'English' },
]

const VOICES = [
  { value: 'am-ET-MekdesNeural', label: 'Mekdes — Amharic, warm' },
  { value: 'am-ET-AmehaNeural', label: 'Ameha — Amharic, steady' },
  { value: 'en-US-JennyNeural', label: 'Jenny — English, neutral' },
]

const MODELS = [
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B — fast, good Amharic' },
  { value: 'gpt-4o-mini', label: 'GPT-4o mini — balanced' },
]

const emptyAgent = () => ({
  name: '',
  prompt: 'You are the voice of a small business in Addis Ababa. Answer callers politely, in their language, and keep replies short.',
  language: 'am',
  voice_config: { provider: 'edge', voice_id: 'am-ET-MekdesNeural' },
  model_config: { provider: 'groq', model_id: 'llama-3.3-70b-versatile' },
})

// Platform guarantee, not a setting. See MARKOVA_UI_FULL_BRIEF §5 and the ethics requirements.
const AiDisclosureNotice = () => (
  <div className="as-disclosure">
    <ShieldCheck size={16} />
    <p>
      Every call opens with your agent stating it is an AI assistant, in the caller’s language.
      This is built into the platform and cannot be turned off.
    </p>
  </div>
)

const AgentStudio = () => {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [tab, setTab] = useState('configuration')
  const [advanced, setAdvanced] = useState(false)
  const [saving, setSaving] = useState(false)
  const [versions, setVersions] = useState([])
  const [testNumber, setTestNumber] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const { environment } = useEnvironment()
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { data } = await listAgents()
      setAgents(Array.isArray(data) ? data : [])
    } catch {
      setLoadError('We couldn’t load your agents. Refresh to try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!editing?.id) { setVersions([]); return }
    getAgentVersions(editing.id)
      .then(({ data }) => setVersions(Array.isArray(data) ? data : []))
      .catch(() => setVersions([]))
  }, [editing?.id])

  const openAgent = (agent) => {
    setEditing({
      ...agent,
      voice_config: agent.voice_config || { provider: 'edge', voice_id: agent.voice_id || VOICES[0].value },
      model_config: agent.model_config || { provider: 'groq', model_id: agent.model_id || MODELS[0].value },
    })
    setTab('configuration')
    setTestResult(null)
  }

  const handleSave = async () => {
    if (!editing.name.trim()) {
      toast.error('Give your agent a name before saving.', 'Name required')
      return
    }
    setSaving(true)
    const payload = {
      name: editing.name.trim(),
      prompt: editing.prompt,
      language: editing.language,
      voice_config: editing.voice_config,
      model_config: editing.model_config,
    }
    try {
      if (editing.id) {
        await updateAgent(editing.id, payload)
        toast.success('Configuration saved.', 'Agent saved')
      } else {
        const { data } = await createAgent(payload)
        setEditing({ ...editing, id: data.id })
        toast.success('Agent created.', 'Agent created')
      }
      load()
    } catch {
      toast.error('We couldn’t save this agent. Try again in a moment.', 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (agent) => {
    if (!window.confirm(`Delete ${agent.name}? Numbers pointed at it stop answering.`)) return
    try {
      await deleteAgent(agent.id)
      toast.success('Agent deleted.', 'Agent deleted')
      if (editing?.id === agent.id) setEditing(null)
      load()
    } catch {
      toast.error('We couldn’t delete this agent. Try again in a moment.', 'Delete failed')
    }
  }

  const handleRollback = async (version) => {
    try {
      await rollbackAgent(editing.id, version.id)
      toast.success(`Rolled back to version ${version.version}.`, 'Version restored')
      load()
    } catch {
      toast.error('We couldn’t roll back to that version.', 'Rollback failed')
    }
  }

  const handleTestCall = async (e) => {
    e.preventDefault()
    if (!editing?.id) return
    setTesting(true)
    setTestResult(null)
    try {
      const { data } = await testCallAgent(editing.id, testNumber.trim())
      setTestResult(data)
      toast.success(`Calling ${testNumber.trim()} now.`, 'Call placed')
    } catch (err) {
      const detail = err.response?.status === 403
        ? 'Test calls run in sandbox only. Switch to Sandbox and use a mk_test_ key.'
        : 'The test call didn’t go through. Check the number and try again.'
      toast.error(detail, 'Call not placed')
    } finally {
      setTesting(false)
    }
  }

  // ── List view ───────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div className="agent-studio">
        <header className="page-header">
          <div>
            <h1>Agents</h1>
            <p>Each agent is a voice that answers one of your numbers.</p>
          </div>
          <button className="btn-primary" onClick={() => openAgent(emptyAgent())}>
            <Plus size={16} /> New agent
          </button>
        </header>

        {loadError && <div className="as-error">{loadError}</div>}

        {loading ? (
          <div className="as-grid">
            {[0, 1, 2].map((i) => <div className="as-card as-card-skeleton" key={i} />)}
          </div>
        ) : agents.length === 0 ? (
          <div className="as-empty">
            <Bot size={28} />
            <h2>No agents yet</h2>
            <p>Create one, point a number at it, and place a test call to hear it answer.</p>
            <button className="btn-primary" onClick={() => openAgent(emptyAgent())}>
              <Plus size={16} /> Create your first agent
            </button>
          </div>
        ) : (
          <div className="as-grid">
            {agents.map((agent, i) => (
              <motion.div
                className="as-card"
                key={agent.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <div className="as-card-icon"><Bot size={20} /></div>
                <h3>{agent.name}</h3>
                <p className="as-card-prompt">{(agent.prompt || '').slice(0, 90)}</p>
                <div className="as-card-meta">
                  <span className="as-lang">
                    {LANGUAGES.find((l) => l.value === agent.language)?.label || agent.language || 'Amharic'}
                  </span>
                  {agent.created_at && (
                    <span className="as-date">{new Date(agent.created_at).toLocaleDateString()}</span>
                  )}
                </div>
                <div className="as-card-actions">
                  <button className="btn-secondary" onClick={() => openAgent(agent)}>
                    <Edit3 size={14} /> Edit
                  </button>
                  <button className="as-delete" onClick={() => handleDelete(agent)} title="Delete agent">
                    <Trash2 size={15} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Detail view ─────────────────────────────────────────────────────────
  return (
    <div className="agent-studio">
      <header className="as-builder-head">
        <button className="as-back" onClick={() => setEditing(null)} aria-label="Back to agents">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1>{editing.name || 'New agent'}</h1>
          <p>{editing.id ? 'Agent configuration' : 'Create a new agent'}</p>
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={16} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </header>

      <nav className="as-tabs">
        <button className={tab === 'configuration' ? 'active' : ''} onClick={() => setTab('configuration')}>
          <Sliders size={15} /> Configuration
        </button>
        <button
          className={tab === 'versions' ? 'active' : ''}
          onClick={() => setTab('versions')}
          disabled={!editing.id}
        >
          <History size={15} /> Versions
        </button>
        <button
          className={tab === 'test' ? 'active' : ''}
          onClick={() => setTab('test')}
          disabled={!editing.id}
        >
          <Bot size={15} /> Test call
        </button>
      </nav>

      {tab === 'configuration' && (
        <section className="as-panel">
          <AiDisclosureNotice />

          <label className="as-field">
            <span>Name</span>
            <input
              type="text"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="Front desk"
            />
          </label>

          <label className="as-field">
            <span>What your agent should do</span>
            <textarea
              rows={7}
              value={editing.prompt || ''}
              onChange={(e) => setEditing({ ...editing, prompt: e.target.value })}
              placeholder="Answer questions about opening hours, prices, and delivery."
            />
          </label>

          <label className="as-field">
            <span>Language</span>
            <select
              value={editing.language || 'am'}
              onChange={(e) => setEditing({ ...editing, language: e.target.value })}
            >
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </label>

          <label className="as-field">
            <span>Voice</span>
            <select
              value={editing.voice_config?.voice_id || VOICES[0].value}
              onChange={(e) => setEditing({
                ...editing,
                voice_config: { ...editing.voice_config, voice_id: e.target.value },
              })}
            >
              {VOICES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </label>

          <button className="as-advanced-toggle" onClick={() => setAdvanced((a) => !a)}>
            {advanced ? 'Hide advanced settings' : 'Show advanced settings'}
          </button>

          {advanced && (
            <div className="as-advanced">
              <label className="as-field">
                <span>Model</span>
                <select
                  value={editing.model_config?.model_id || MODELS[0].value}
                  onChange={(e) => setEditing({
                    ...editing,
                    model_config: { ...editing.model_config, model_id: e.target.value },
                  })}
                >
                  {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </label>
              <label className="as-field">
                <span>Model provider</span>
                <input
                  type="text"
                  className="mono"
                  value={editing.model_config?.provider || 'groq'}
                  onChange={(e) => setEditing({
                    ...editing,
                    model_config: { ...editing.model_config, provider: e.target.value },
                  })}
                />
              </label>
            </div>
          )}
        </section>
      )}

      {tab === 'versions' && (
        <section className="as-panel">
          {versions.length === 0 ? (
            <p className="as-panel-empty">No saved versions yet. Every save you make from here adds one.</p>
          ) : (
            <ul className="as-versions">
              {versions.map((v) => (
                <li key={v.id}>
                  <span className="mono">v{v.version}</span>
                  <span className="as-version-date">
                    {v.created_at ? new Date(v.created_at).toLocaleString() : ''}
                  </span>
                  <button className="btn-secondary" onClick={() => handleRollback(v)}>Restore</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'test' && (
        <section className="as-panel as-test">
          <Waveform active={testing} env={environment} size="callscreen" />

          {environment === 'live' ? (
            <p className="as-panel-empty">
              Test calls run in sandbox only, so nothing is billed. Switch to Sandbox in the top strip to place one.
            </p>
          ) : (
            <>
              <p className="as-test-blurb">
                We’ll call a number you control so you can hear your agent. Sandbox only — nothing is billed.
              </p>
              <form className="as-test-form" onSubmit={handleTestCall}>
                <input
                  type="tel"
                  className="mono"
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
                  placeholder="+251911000000"
                  required
                />
                <button type="submit" disabled={testing || !testNumber.trim()}>
                  {testing ? 'Placing call…' : 'Place test call'}
                </button>
              </form>
              {testResult && (
                <div className="as-test-result">
                  <span className="mono">{testResult.id}</span>
                  <span>Call placed. Answer your phone to hear the agent.</span>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}

export default AgentStudio
