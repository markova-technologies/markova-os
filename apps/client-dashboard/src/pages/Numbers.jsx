import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Phone, Search, Plus, Trash2, FlaskConical } from 'lucide-react'
import { searchNumbers, listNumbers, provisionNumber, updateNumber, deleteNumber, listAgents } from '../api/client'
import { useToast } from '../contexts/ToastContext'
import './Numbers.css'

const Numbers = () => {
  const [numbers, setNumbers] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [country, setCountry] = useState('ET')
  const [areaCode, setAreaCode] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const toast = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const [nums, ags] = await Promise.all([
        listNumbers().catch(() => ({ data: [] })),
        listAgents().catch(() => ({ data: [] })),
      ])
      setNumbers(nums.data || [])
      setAgents(ags.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSearch = async (e) => {
    e.preventDefault()
    setSearching(true)
    try {
      const { data } = await searchNumbers({ country, area_code: areaCode || undefined })
      setResults(Array.isArray(data) ? data : data.numbers || data.results || [])
    } catch {
      toast.error('We couldn’t search for numbers just now. Try again in a moment.')
    } finally {
      setSearching(false)
    }
  }

  const handleProvision = async (num) => {
    const phone = num.phone_number || num.number || num
    try {
      await provisionNumber({ phone_number: phone, provider: num.provider })
      toast.success('Number provisioned.')
      setResults(r => r.filter(x => (x.phone_number || x.number || x) !== phone))
      load()
    } catch {
      toast.error('We couldn’t provision that number. Try again in a moment.')
    }
  }

  const handleAssign = async (num, agentId) => {
    try {
      await updateNumber(num.id, { agent_id: agentId || null })
      toast.success(agentId ? 'Agent assigned to this number.' : 'Agent unassigned.')
      setNumbers(ns => ns.map(n => n.id === num.id ? { ...n, agent_id: agentId } : n))
    } catch {
      toast.error('We couldn’t update this number. Try again in a moment.')
    }
  }

  const handleRelease = async (num) => {
    if (!window.confirm(`Release ${num.phone_number}? Calls to it stop routing to your agent.`)) return
    try {
      await deleteNumber(num.id)
      toast.success('Number released.')
      load()
    } catch {
      toast.error('We couldn’t release that number. Try again in a moment.')
    }
  }

  return (
    <div className="numbers-page">
      <header className="page-header">
        <h1>Numbers</h1>
        <p>Find a phone number, provision it, and point it at one of your agents.</p>
      </header>

      <form className="num-search" onSubmit={handleSearch}>
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="ET">Ethiopia (ET)</option>
          <option value="US">United States (US)</option>
          <option value="GB">United Kingdom (GB)</option>
        </select>
        <input type="text" placeholder="Area code or pattern (optional)" value={areaCode} onChange={(e) => setAreaCode(e.target.value)} />
        <button type="submit" disabled={searching}><Search size={16} /> {searching ? 'Searching…' : 'Search'}</button>
      </form>

      {results && (
        <div className="num-results">
          {results.length === 0
            ? <div className="num-empty">No numbers matched that search. Try a different area code.</div>
            : results.map((num, i) => {
                const phone = num.phone_number || num.number || num
                return (
                  <div className="num-result-row" key={phone + i}>
                    <span className="num-phone">{phone}</span>
                    <button className="num-provision" onClick={() => handleProvision(num)}><Plus size={15} /> Provision</button>
                  </div>
                )
              })}
        </div>
      )}

      <section className="num-list">
        <h2>Your numbers</h2>
        {loading ? (
          <div className="num-empty">Loading your numbers…</div>
        ) : numbers.length === 0 ? (
          <div className="num-empty">No numbers yet — search above and provision one to route calls to an agent.</div>
        ) : (
          numbers.map(num => (
            <motion.div className="num-row" key={num.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="num-row-main">
                <Phone size={16} />
                <span className="num-phone">{num.phone_number}</span>
                {num.sandbox && <span className="num-sandbox"><FlaskConical size={12} /> Test</span>}
              </div>
              <div className="num-row-actions">
                <select value={num.agent_id || ''} onChange={(e) => handleAssign(num, e.target.value)}>
                  <option value="">Unassigned</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <span className={`num-status ${num.status || 'active'}`}>{num.status || 'active'}</span>
                <button className="num-release" onClick={() => handleRelease(num)} title="Release number"><Trash2 size={16} /></button>
              </div>
            </motion.div>
          ))
        )}
      </section>
    </div>
  )
}

export default Numbers
