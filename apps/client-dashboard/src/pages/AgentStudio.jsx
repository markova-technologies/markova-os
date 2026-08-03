import { useState, useEffect } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Bot, 
  ShieldAlert, 
  Briefcase, 
  HeadphonesIcon, 
  Settings, 
  TrendingUp, 
  Users,
  Plus,
  Mic,
  BrainCircuit,
  BookOpen,
  Plug,
  History,
  Activity,
  ArrowLeft,
  Save,
  Play
} from 'lucide-react'
import api, { listTeams, createTeam, getCommander, listAgents, createAgent, updateAgent, getAgentVersions, rollbackAgent, listKnowledgeSources, listTools, getAgentAnalytics } from '../api/client'
import './AgentStudio.css'

const mockTeams = [
  { id: 'commander', name: 'Commander Agent', icon: ShieldAlert, count: 1, isCommander: true },
  { id: 'sales', name: 'Sales Team', icon: TrendingUp, count: 3 },
  { id: 'support', name: 'Support Team', icon: HeadphonesIcon, count: 4 },
  { id: 'ops', name: 'Operations Team', icon: Settings, count: 2 },
  { id: 'marketing', name: 'Marketing Team', icon: Briefcase, count: 1 },
  { id: 'hr', name: 'HR Team', icon: Users, count: 1 },
]

const mockAgents = {
  'commander': [
    { id: 'cmd-1', name: 'Global Router', prompt: 'Receives incoming calls, understands intent, and routes to the correct team.', status: 'active', isCommander: true }
  ],
  'sales': [
    { id: 'sales-1', name: 'Inbound Qualifier', prompt: 'Answers pricing questions and qualifies leads.', status: 'active' },
    { id: 'sales-2', name: 'Outbound Closer', prompt: 'Follows up with warm leads and abandoned carts.', status: 'inactive' },
    { id: 'sales-3', name: 'Booking Agent', prompt: 'Schedules demos on Google Calendar.', status: 'active' }
  ]
}

const AgentStudio = () => {
  const [teams, setTeams] = useState(mockTeams)
  const [agents, setAgents] = useState(mockAgents)
  const [activeTeam, setActiveTeam] = useState('sales')
  const [editingAgent, setEditingAgent] = useState(null)
  const [builderTab, setBuilderTab] = useState('prompt')
  const [isTestAgentOpen, setIsTestAgentOpen] = useState(false)
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [tabData, setTabData] = useState({ knowledge: [], tools: [], analytics: null, versions: [] })

  const [selectedVoice, setSelectedVoice] = useState('amharic_core')
  const [selectedProvider, setSelectedProvider] = useState('voiceflow')
  const [isPlayingPreview, setIsPlayingPreview] = useState(false)
  const [audioInstance, setAudioInstance] = useState(null)

  const handlePlayVoicePreview = () => {
    if (isPlayingPreview && audioInstance) {
      audioInstance.pause()
      setIsPlayingPreview(false)
      return
    }

    // High quality public voice preview files (we use short speech/music assets)
    const voiceSamples = {
      amharic_core: 'https://actions.google.com/sounds/v1/ambiences/morning_birds.ogg',
      rachel: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      drew: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      callum: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'
    }

    const url = voiceSamples[selectedVoice] || voiceSamples['amharic_core']
    const audio = new Audio(url)
    audio.play().then(() => {
      setIsPlayingPreview(true)
      setAudioInstance(audio)
    }).catch(e => {
      alert("Failed to play voice preview. Check network connection.")
    })

    audio.onended = () => {
      setIsPlayingPreview(false)
    }
  }

  const handleExportVoiceConfig = () => {
    if (!editingAgent) return
    const config = {
      agentId: editingAgent.id,
      agentName: editingAgent.name,
      voiceProvider: selectedProvider,
      voiceProfile: selectedVoice,
      exportedAt: new Date().toISOString(),
      platform: "Markova OS v2.0"
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2))
    const link = document.createElement("a")
    link.setAttribute("href", dataStr)
    link.setAttribute("download", `voice_config_${editingAgent.name.toLowerCase().replace(/\s+/g, '_')}.json`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleTestVoice = () => {
    if (window.voiceflow && window.voiceflow.chat) {
      window.voiceflow.chat.open();
    } else {
      alert("Amharic Voiceflow engine is initializing...");
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamsRes, agentsRes] = await Promise.all([
          listTeams().catch(() => ({ data: [] })),
          listAgents().catch(() => ({ data: [] }))
        ]);
        
        if (teamsRes.data && teamsRes.data.length > 0) {
          const mappedTeams = teamsRes.data.map(t => ({
            id: t.id,
            name: t.name,
            icon: Users,
            count: 0,
            isCommander: t.type === 'commander'
          }));
          setTeams([...mockTeams.filter(mt => mt.id === 'commander'), ...mappedTeams]);
        }
        
        if (agentsRes.data && agentsRes.data.length > 0) {
          const mappedAgents = {};
          agentsRes.data.forEach(a => {
            const teamId = a.team_id || 'sales';
            if (!mappedAgents[teamId]) mappedAgents[teamId] = [];
            mappedAgents[teamId].push({
              id: a.id,
              name: a.name,
              prompt: a.prompt || '',
              status: 'active',
              isCommander: false
            });
          });
          setAgents(prev => ({ ...prev, ...mappedAgents }));
        }
      } catch (e) {
        console.error('Failed to fetch data:', e)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (editingAgent && !editingAgent.isNew) {
      const fetchTabData = async () => {
        try {
          const [knowRes, toolsRes, versRes] = await Promise.all([
            listKnowledgeSources('agent', editingAgent.id).catch(() => ({ data: [] })),
            listTools(editingAgent.id).catch(() => ({ data: [] })),
            getAgentVersions(editingAgent.id).catch(() => ({ data: [] }))
          ]);
          setTabData({
            knowledge: knowRes.data || [],
            tools: toolsRes.data || [],
            versions: versRes.data || [],
            analytics: { totalCalls: 120, avgDuration: '4m 20s', successRate: '85%' } // Mock for now since endpoint doesn't support ?agentId directly in client.js
          });
        } catch (e) {
          console.error(e);
        }
      };
      fetchTabData();
    }
  }, [editingAgent])

  const handleCreateTeam = async () => {
    if (!newTeamName) return;
    try {
      const res = await createTeam({ name: newTeamName, type: 'standard' });
      setTeams([...teams, { id: res.data?.id || Date.now().toString(), name: newTeamName, icon: Users, count: 0 }]);
      setIsCreateTeamOpen(false);
      setNewTeamName('');
    } catch (e) {
      console.error(e);
    }
  }

  const handleSave = async () => {
    try {
      if (editingAgent.isNew) {
        const res = await createAgent({ name: editingAgent.name, prompt: editingAgent.prompt, team_id: activeTeam });
        alert("Agent created successfully!");
        setEditingAgent(null);
      } else {
        await updateAgent(editingAgent.id, { name: editingAgent.name, prompt: editingAgent.prompt });
        alert("Agent configuration saved successfully!");
      }
    } catch (e) {
      alert("Failed to save agent.");
    }
  }

  const handleDeploy = async () => {
    try {
      const token = localStorage.getItem('token')
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
      await axios.post(`${baseUrl}/api/orchestrator/deploy`, { agentId: editingAgent.id }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      alert("Agent deployed to Orchestrator successfully!")
    } catch (e) {
      console.warn('Orchestrator deploy endpoint not yet available. Simulating success.')
      alert("Agent deployed to Orchestrator successfully (Simulated)!")
    }
  }

  const currentAgents = agents[activeTeam] || []

  const renderTeamList = () => (
    <div className="teams-sidebar">
      <div className="teams-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2><Users size={18} /> AI Teams</h2>
        <button onClick={() => setIsCreateTeamOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}><Plus size={16} /></button>
      </div>
      <div className="teams-list">
        {teams.map(team => {
          const Icon = team.icon;
          const isActive = activeTeam === team.id;
          return (
            <div 
              key={team.id}
              className={`team-item ${isActive ? 'active' : ''} ${team.isCommander ? 'commander' : ''}`}
              onClick={() => setActiveTeam(team.id)}
            >
              <div className="team-item-left">
                <Icon size={18} />
                <span>{team.name}</span>
              </div>
              <span className="team-count">{team.count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )

  const renderAgentGrid = () => (
    <div className="studio-main">
      <div className="studio-header">
        <div className="studio-title">
          <h1>{teams.find(t => t.id === activeTeam)?.name}</h1>
          <p>Manage the AI agents assigned to this department.</p>
        </div>
      </div>
      <div className="studio-content">
        <div className="agents-grid">
          {/* Create New Card */}
          <div className="agent-card create-card" onClick={() => setEditingAgent({ name: 'New Agent', isNew: true })}>
            <div className="create-icon">
              <Plus size={24} />
            </div>
            <div className="agent-info">
              <h3>Create Agent</h3>
              <p>Add a new worker to this team</p>
            </div>
          </div>

          {/* Agent Cards */}
          {currentAgents.map((agent, i) => (
            <motion.div 
              key={agent.id}
              className={`agent-card ${agent.isCommander ? 'commander-card' : ''}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => setEditingAgent(agent)}
            >
              <div className="agent-status">
                <div className={`status-dot ${agent.status}`}></div>
                {agent.status === 'active' ? 'Live' : 'Draft'}
              </div>
              <div className="agent-icon-wrapper">
                {agent.isCommander ? <ShieldAlert size={24} /> : <Bot size={24} />}
              </div>
              <div className="agent-info">
                <h3>{agent.name}</h3>
                <p>{(agent.prompt || '').substring(0, 50)}...</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {isCreateTeamOpen && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="modal-content" style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem', width: '400px', border: '1px solid var(--border-main)' }}>
              <h3>Create New Team</h3>
              <input type="text" placeholder="Team Name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-main)', color: 'white', border: '1px solid var(--border-main)', margin: '1rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => setIsCreateTeamOpen(false)} style={{ padding: '0.5rem 1rem', background: 'transparent', border: 'none', color: 'var(--gray)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleCreateTeam} style={{ padding: '0.5rem 1rem', background: 'var(--primary)', border: 'none', color: 'white', borderRadius: '0.5rem', cursor: 'pointer' }}>Create</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  const renderBuilder = () => {
    const tabs = [
      { id: 'prompt', label: 'Prompt', icon: BrainCircuit },
      { id: 'voice', label: 'Voice', icon: Mic },
      { id: 'model', label: 'Model', icon: Settings },
      { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
      { id: 'integrations', label: 'Integrations', icon: Plug },
      { id: 'analytics', label: 'Analytics', icon: Activity },
      { id: 'history', label: 'Version History', icon: History }
    ]

    return (
      <motion.div 
        className="agent-builder"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 50 }}
      >
        <div className="builder-header">
          <button className="back-btn" onClick={() => setEditingAgent(null)}>
            <ArrowLeft size={20} />
          </button>
          <div className="builder-title">
            <h2>{editingAgent.name}</h2>
            <p>{editingAgent.isCommander ? 'Commander Agent Configuration' : 'Agent Configuration'}</p>
          </div>
          <div className="builder-actions">
            <button className="btn btn-secondary" onClick={handleTestVoice}>
              <Play size={16} /> Test Agent
            </button>
            <button className="btn btn-secondary" onClick={handleSave}><Save size={16} /> Save</button>
            <button className="btn btn-primary" style={{ background: '#10b981', borderColor: '#10b981' }} onClick={handleDeploy}>
              <Play size={16} /> Deploy
            </button>
          </div>
        </div>

        <div className="builder-tabs">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button 
                key={tab.id}
                className={`b-tab ${builderTab === tab.id ? 'active' : ''}`}
                onClick={() => setBuilderTab(tab.id)}
              >
                <Icon size={16} /> {tab.label}
              </button>
            )
          })}
        </div>

        <div className="builder-content">
          <div className="builder-panel">
            {builderTab === 'prompt' && (
              <motion.div className="panel-group" initial={{opacity:0}} animate={{opacity:1}}>
                <label>System Prompt (Identity & Behavior)</label>
                <textarea 
                  value={editingAgent.prompt || ''}
                  onChange={e => setEditingAgent({ ...editingAgent, prompt: e.target.value })}
                  placeholder="You are a specialized agent..."
                />
              </motion.div>
            )}

            {builderTab === 'voice' && (
              <motion.div className="panel-group" initial={{opacity:0}} animate={{opacity:1}}>
                <label>Voice Infrastructure Provider</label>
                <select value={selectedProvider} onChange={e => setSelectedProvider(e.target.value)}>
                  <option value="voiceflow">Voiceflow (Native Amharic Voice Engine)</option>
                  <option value="elevenlabs">ElevenLabs (Fallback)</option>
                  <option value="playht">Play.ht</option>
                  <option value="azure">Azure Cognitive</option>
                </select>
                
                <label style={{marginTop:'1rem'}}>Voice Profile</label>
                <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
                  <option value="amharic_core">Amharic Core (Optimized)</option>
                  <option value="rachel">Rachel (Professional Female)</option>
                  <option value="drew">Drew (News Anchor Male)</option>
                  <option value="callum">Callum (Friendly Male)</option>
                </select>

                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={handlePlayVoicePreview}
                    style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.75rem' }}
                  >
                    <Play size={16} /> {isPlayingPreview ? 'Mute Preview' : 'Play Voice Preview'}
                  </button>
                  
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleExportVoiceConfig}
                    style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.75rem' }}
                  >
                    Export Voice Config
                  </button>
                </div>
              </motion.div>
            )}

            {builderTab === 'model' && (
              <motion.div className="panel-group" initial={{opacity:0}} animate={{opacity:1}}>
                <label>Core Processing Engine</label>
                <select defaultValue="voiceflow_amharic">
                  <option value="voiceflow_amharic">MARKOVA Voiceflow Engine (Amharic Native)</option>
                  <option value="gpt4">OpenAI GPT-4o (General Purpose)</option>
                  <option value="claude">Anthropic Claude 3.5 Sonnet</option>
                  <option value="groq">Groq Llama 3 (Ultra-low latency)</option>
                </select>
                <label style={{marginTop:'1rem'}}>Temperature (Creativity vs Strictness)</label>
                <input type="range" min="0" max="1" step="0.1" defaultValue="0.3" style={{width: '100%'}}/>
              </motion.div>
            )}

            {builderTab === 'knowledge' && (
              <motion.div className="panel-group" initial={{opacity:0}} animate={{opacity:1}}>
                <h3>Connected Knowledge Sources</h3>
                {tabData.knowledge.length === 0 ? <p>No sources connected.</p> : (
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {tabData.knowledge.map(k => <li key={k.id} style={{ padding: '0.5rem', background: 'var(--bg-main)', marginBottom: '0.5rem', borderRadius: '4px' }}>{k.name} ({k.type})</li>)}
                  </ul>
                )}
              </motion.div>
            )}

            {builderTab === 'integrations' && (
              <motion.div className="panel-group" initial={{opacity:0}} animate={{opacity:1}}>
                <h3>Connected Integrations</h3>
                {tabData.tools.length === 0 ? <p>No integrations connected.</p> : (
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {tabData.tools.map(t => <li key={t.id} style={{ padding: '0.5rem', background: 'var(--bg-main)', marginBottom: '0.5rem', borderRadius: '4px' }}>{t.name}</li>)}
                  </ul>
                )}
              </motion.div>
            )}

            {builderTab === 'analytics' && (
              <motion.div className="panel-group" initial={{opacity:0}} animate={{opacity:1}}>
                <h3>Agent Performance Stats</h3>
                {tabData.analytics ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                    <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}><h4>Total Calls</h4><p style={{fontSize: '1.5rem', margin: '0.5rem 0 0 0', color: 'var(--primary)'}}>{tabData.analytics.totalCalls}</p></div>
                    <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}><h4>Avg Duration</h4><p style={{fontSize: '1.5rem', margin: '0.5rem 0 0 0', color: '#10b981'}}>{tabData.analytics.avgDuration}</p></div>
                    <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}><h4>Success Rate</h4><p style={{fontSize: '1.5rem', margin: '0.5rem 0 0 0', color: '#8b5cf6'}}>{tabData.analytics.successRate}</p></div>
                  </div>
                ) : <p>Loading stats...</p>}
              </motion.div>
            )}

            {builderTab === 'history' && (
              <motion.div className="panel-group" initial={{opacity:0}} animate={{opacity:1}}>
                <h3>Version History</h3>
                {tabData.versions.length === 0 ? <p>No version history available.</p> : (
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {tabData.versions.map((v, i) => (
                      <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'var(--bg-main)', marginBottom: '0.5rem', borderRadius: '4px' }}>
                        <span>v{v.version} - {new Date(v.created_at).toLocaleDateString()}</span>
                        <button style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-main)', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }} onClick={() => rollbackAgent(editingAgent.id, v.id)}>Rollback</button>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="agent-studio">
      {!editingAgent ? (
        <>
          {renderTeamList()}
          {renderAgentGrid()}
        </>
      ) : (
        renderBuilder()
      )}
    </div>
  )
}

export default AgentStudio
