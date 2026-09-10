import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Play,
  Trash2,
  Sparkles,
  Check,
  ExternalLink,
  Eye,
  Sliders,
  Volume2,
  RotateCcw,
  Info,
  Clock,
  Radio,
  Edit3
} from 'lucide-react'
import { 
  listTeams, 
  createTeam, 
  deleteTeam,
  getCommander, 
  listAgents, 
  createAgent, 
  updateAgent, 
  deleteAgent,
  getAgentVersions, 
  rollbackAgent, 
  listKnowledgeSources, 
  getAgentKnowledge,
  connectKnowledgeToAgent,
  disconnectKnowledgeFromAgent,
  listTools, 
  getAgentTools,
  connectToolToAgent,
  disconnectToolFromAgent,
  getAgentAnalytics,
  deployAgent,
  getAgentVoicePreview
} from '../api/client'
import { VOICE_PROVIDERS, MODEL_PROVIDERS, STT_PROVIDERS } from '../constants/voiceModelRegistry'
import { generatePromptSuggestions } from '../utils/promptSuggester'
import { useToast } from '../contexts/ToastContext'
import { useAgentTestSession } from '../hooks/useAgentTestSession'
import './AgentStudio.css'

const AgentStudio = () => {
  const navigate = useNavigate()
  const { success, error: showError, info, warning } = useToast()
  
  // Teams & Agents state
  const [teams, setTeams] = useState([])
  const [agents, setAgents] = useState({})
  const [activeTeam, setActiveTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingAgent, setEditingAgent] = useState(null)
  const [builderTab, setBuilderTab] = useState('prompt')
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')

  // Sub-tabs data state
  const [companyKnowledge, setCompanyKnowledge] = useState([])
  const [connectedKnowledge, setConnectedKnowledge] = useState([])
  const [companyTools, setCompanyTools] = useState([])
  const [connectedTools, setConnectedTools] = useState([])
  const [agentStats, setAgentStats] = useState(null)
  const [agentVersions, setAgentVersions] = useState([])
  
  // Prompt Suggester UI state
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedVersionPreview, setSelectedVersionPreview] = useState(null)

  // Voice Preview state
  const [isPlayingPreview, setIsPlayingPreview] = useState(false)
  const [audioInstance, setAudioInstance] = useState(null)

  // Voice Sandbox Simulator state
  const [isVoiceSandboxOpen, setIsVoiceSandboxOpen] = useState(false)
  const [sandboxInput, setSandboxInput] = useState('')
  const [speechRecognition, setSpeechRecognition] = useState(null)
  const [isListeningForSpeech, setIsListeningForSpeech] = useState(false)

  const {
    isConnected: isCallActive,
    isConnecting,
    transcript: sandboxTranscript,
    audioRef,
    startSession,
    endSession,
    sendText
  } = useAgentTestSession(editingAgent?.id)

  // ── 1. Fetch Teams & Agents (Auto-Commander Enabled) ─────────────────────
  // ── 1. Fetch Teams & Agents (Auto-Commander Guaranteed) ───────────────────
  const loadStudioData = async () => {
    setLoading(true)
    try {
      // 1. Fetch teams first (guarantees backend ensureCommanderAgent executes)
      const teamsRes = await listTeams().catch(() => ({ data: [] }));
      
      // 2. Fetch agents (guaranteed to include commander agent)
      const agentsRes = await listAgents().catch(() => ({ data: [] }));

      let fetchedTeams = (teamsRes.data || []).map(t => ({
        id: t.id,
        name: t.name,
        icon: t.type === 'commander' ? ShieldAlert : Users,
        count: t.count || 0,
        isCommander: t.type === 'commander'
      }));

      let rawAgents = agentsRes.data || [];

      // Guarantee Commander team exists in UI
      let commanderTeam = fetchedTeams.find(t => t.isCommander);
      if (!commanderTeam) {
        commanderTeam = {
          id: 'commander-team-id',
          name: 'Commander Agent',
          icon: ShieldAlert,
          count: 1,
          isCommander: true
        };
        fetchedTeams = [
          commanderTeam,
          { id: 'standard-team-id', name: 'Customer Care & Sales', icon: Users, count: 0, isCommander: false },
          ...fetchedTeams
        ];
      }

      // Guarantee Commander Agent (Almaz) exists in UI
      const hasCommander = rawAgents.some(a => a.isCommander || a.name?.toLowerCase().includes('commander'));
      if (!hasCommander) {
        const fallbackCommander = {
          id: 'commander-almaz-default',
          name: 'Almaz - Commander Agent',
          prompt: `You are Almaz, the primary Commander and Orchestrator AI for this enterprise call center.\nYour role is to warmly greet customers in Amharic (ሰላም! እንኳን ወደ ድርጅታችን ደህና መጡ), understand their inquiry, identify their needs, and provide clear assistance or direct their request to the appropriate department.\nAlways maintain a professional, respectful, and helpful Ethiopian conversational tone. Keep spoken responses concise, natural, and friendly.`,
          voice_provider: 'edge_tts',
          voice_id: 'am-ET-MekdesNeural',
          model_provider: 'groq',
          model_id: 'llama-3.3-70b-versatile',
          team_id: commanderTeam.id,
          temperature: 0.3,
          stt_provider: 'elevenlabs_scribe',
          status: 'active',
          isCommander: true
        };
        rawAgents.unshift(fallbackCommander);
      }

      setTeams(fetchedTeams);

      const mappedAgents = {};
      rawAgents.forEach(a => {
        const isCmd = a.isCommander || a.name?.toLowerCase().includes('commander');
        const teamId = a.team_id || (isCmd ? commanderTeam.id : (fetchedTeams[0]?.id || 'general'));
        if (!mappedAgents[teamId]) mappedAgents[teamId] = [];
        mappedAgents[teamId].push({
          ...a,
          status: 'active',
          isCommander: isCmd || fetchedTeams.find(t => t.id === teamId)?.isCommander
        });
      });

      setAgents(mappedAgents);

      // Re-calculate team agent counts
      setTeams(prev => prev.map(t => ({
        ...t,
        count: (mappedAgents[t.id] || []).length
      })));

      // Always activate the Commander team by default
      setActiveTeam(commanderTeam.id);

    } catch (err) {
      console.error("Failed to load agent studio data:", err);
      showError("Failed to load AI teams and agents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudioData();
  }, []);

  // ── 2. Load Agent Sub-Tab Data When Editing Agent Changes ────────────────
  useEffect(() => {
    if (editingAgent && !editingAgent.isNew && editingAgent.id) {
      const fetchTabData = async () => {
        try {
          const [
            allKnowRes, 
            connKnowRes, 
            allToolsRes, 
            connToolsRes, 
            statsRes, 
            versionsRes
          ] = await Promise.all([
            listKnowledgeSources().catch(() => ({ data: [] })),
            getAgentKnowledge(editingAgent.id).catch(() => ({ data: [] })),
            listTools().catch(() => ({ data: [] })),
            getAgentTools(editingAgent.id).catch(() => ({ data: [] })),
            getAgentAnalytics(editingAgent.id).catch(() => ({ data: null })),
            getAgentVersions(editingAgent.id).catch(() => ({ data: [] }))
          ]);

          setCompanyKnowledge(allKnowRes.data || []);
          setConnectedKnowledge(connKnowRes.data || []);
          setCompanyTools(allToolsRes.data || []);
          setConnectedTools(connToolsRes.data || []);
          setAgentStats(statsRes.data || { totalCalls: 0, avgDuration: '0s', successRate: '100%', totalTurns: 0 });
          setAgentVersions(versionsRes.data || []);
        } catch (e) {
          console.error("Failed to fetch sub-tab data:", e);
        }
      };
      fetchTabData();
    } else {
      // New agent defaults
      setConnectedKnowledge([]);
      setConnectedTools([]);
      setAgentStats(null);
      setAgentVersions([]);
    }
  }, [editingAgent?.id]);

  // Dynamic Prompt Suggestions based on agent name and connected sources
  const promptSuggestions = useMemo(() => {
    return generatePromptSuggestions(editingAgent?.name || '', connectedKnowledge);
  }, [editingAgent?.name, connectedKnowledge]);

  // ── 3. Voice Preview Player ──────────────────────────────────────────────
  const handlePlayVoicePreview = async () => {
    if (!editingAgent?.id) {
      showError("Please save the agent before playing a voice preview.");
      return;
    }
    if (isPlayingPreview && audioInstance) {
      audioInstance.pause();
      setIsPlayingPreview(false);
      return;
    }
    try {
      setIsPlayingPreview(true);
      const res = await getAgentVoicePreview(editingAgent.id, "ሰላም፣ እኔ አልማዝ ነኝ። እንዴት ልርዳዎት?");
      const audioBlob = new Blob([res.data], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      setAudioInstance(audio);
      audio.onended = () => {
        setIsPlayingPreview(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setIsPlayingPreview(false);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (err) {
      console.error("Voice preview failed:", err);
      showError("Failed to generate voice preview. Make sure voice credentials are valid.");
      setIsPlayingPreview(false);
    }
  };

  const handleExportVoiceConfig = () => {
    if (!editingAgent) return;
    const config = {
      agentId: editingAgent.id,
      agentName: editingAgent.name,
      voiceProvider: editingAgent.voice_provider || 'edge_tts',
      voiceId: editingAgent.voice_id || 'am-ET-MekdesNeural',
      modelProvider: editingAgent.model_provider || 'groq',
      modelId: editingAgent.model_id || 'llama-3.3-70b-versatile',
      temperature: editingAgent.temperature ?? 0.3,
      sttProvider: editingAgent.stt_provider || 'elevenlabs_scribe',
      exportedAt: new Date().toISOString(),
      platform: "Markova OS v2.0 Production"
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `agent_${(editingAgent.name || 'config').toLowerCase().replace(/\s+/g, '_')}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── 4. Voice Sandbox Simulator ───────────────────────────────────────────
  const startSandboxCall = async () => {
    if (!editingAgent?.id) {
      showError("Please save the agent before testing in the Voice Sandbox.");
      return;
    }
    try {
      await startSession();
    } catch (e) {
      showError("Failed to connect to test session.");
    }
  };

  const endSandboxCall = () => {
    endSession();
    if (speechRecognition) {
      speechRecognition.stop();
    }
    setIsListeningForSpeech(false);
  };

  const handleUserSandboxInput = (userInputText) => {
    if (!userInputText.trim()) return;
    sendText(userInputText);
    setSandboxInput('');
  };

  const startSpeechRecognition = () => {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
      showError("Speech recognition is not supported in this browser. Please type your message.");
      return;
    }

    const recognition = new Speech();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'am-ET'; // Default Amharic recognition if browser supports

    recognition.onstart = () => {
      setIsListeningForSpeech(true);
    };

    recognition.onresult = (event) => {
      const speechResult = event.results[0][0].transcript;
      handleUserSandboxInput(speechResult);
    };

    recognition.onerror = (event) => {
      console.error(event.error);
      setIsListeningForSpeech(false);
    };

    recognition.onend = () => {
      setIsListeningForSpeech(false);
    };

    recognition.start();
    setSpeechRecognition(recognition);
  };

  // ── 5. Create Team ───────────────────────────────────────────────────────
  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      const res = await createTeam({ name: newTeamName.trim(), type: 'standard' });
      const created = {
        id: res.data?.id || Date.now().toString(),
        name: newTeamName.trim(),
        icon: Users,
        count: 0,
        isCommander: false
      };
      setTeams(prev => [...prev, created]);
      setActiveTeam(created.id);
      setIsCreateTeamOpen(false);
      setNewTeamName('');
      success(`Team "${created.name}" created successfully!`);
    } catch (e) {
      console.error(e);
      showError("Failed to create team.");
    }
  };

  // ── 6. Save Agent (Create or Update) ──────────────────────────────────────
  const handleSave = async () => {
    if (!editingAgent.name?.trim()) {
      showError("Agent name is required.");
      return;
    }
    if (!editingAgent.prompt?.trim()) {
      showError("System prompt is required.");
      return;
    }

    try {
      const payload = {
        name: editingAgent.name,
        prompt: editingAgent.prompt,
        team_id: editingAgent.team_id || activeTeam,
        voice_provider: editingAgent.voice_provider || 'edge_tts',
        voice_id: editingAgent.voice_id || 'am-ET-MekdesNeural',
        model_provider: editingAgent.model_provider || 'groq',
        model_id: editingAgent.model_id || 'llama-3.3-70b-versatile',
        temperature: editingAgent.temperature !== undefined ? parseFloat(editingAgent.temperature) : 0.3,
        stt_provider: editingAgent.stt_provider || 'elevenlabs_scribe',
        language: 'am'
      };

      if (editingAgent.isNew || (editingAgent.id && String(editingAgent.id).startsWith('commander-'))) {
        const res = await createAgent(payload);
        success("Agent created successfully!");
        
        // Refresh agents
        await loadStudioData();
        setEditingAgent(res.data);
      } else {
        const res = await updateAgent(editingAgent.id, payload);
        success("Agent configuration saved successfully!");
        
        // Refresh versions tab
        const vers = await getAgentVersions(editingAgent.id).catch(() => ({ data: [] }));
        setAgentVersions(vers.data || []);
        setEditingAgent(res.data);
        
        // Update local state in grid
        setAgents(prev => {
          const updated = { ...prev };
          const teamId = editingAgent.team_id || activeTeam;
          if (updated[teamId]) {
            updated[teamId] = updated[teamId].map(a => a.id === editingAgent.id ? { ...a, ...res.data } : a);
          }
          return updated;
        });
      }
    } catch (e) {
      console.error("Save agent failed:", e);
      showError("Failed to save agent. " + (e.response?.data?.error || e.message));
    }
  };

  // ── 7. Deploy to Orchestrator ────────────────────────────────────────────
  const handleDeploy = async () => {
    if (!editingAgent?.id) {
      showError("Please save the agent before deploying.");
      return;
    }
    try {
      await deployAgent(editingAgent.id);
      success("Agent deployed to Voice Orchestrator successfully!");
    } catch (e) {
      console.error("Failed to deploy agent:", e);
      showError("Failed to deploy agent: " + (e.response?.data?.detail || e.message));
    }
  };

  // ── 8. Delete Agent ──────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!editingAgent?.id) return;
    if (window.confirm(`Are you sure you want to delete "${editingAgent.name}"?`)) {
      try {
        await deleteAgent(editingAgent.id);
        success("Agent deleted successfully");
        setEditingAgent(null);
        await loadStudioData();
      } catch (e) {
        showError("Failed to delete agent.");
      }
    }
  };

  // ── 9. Knowledge Bridge Toggle (Option A) ────────────────────────────────
  const handleToggleKnowledge = async (sourceId) => {
    if (!editingAgent?.id) {
      showError("Please save the agent before connecting knowledge sources.");
      return;
    }

    const isConnected = connectedKnowledge.some(k => k.id === sourceId);
    try {
      if (isConnected) {
        await disconnectKnowledgeFromAgent(editingAgent.id, sourceId);
        setConnectedKnowledge(prev => prev.filter(k => k.id !== sourceId));
        info("Knowledge source detached.");
      } else {
        await connectKnowledgeToAgent(editingAgent.id, sourceId);
        const sourceObj = companyKnowledge.find(k => k.id === sourceId);
        if (sourceObj) {
          setConnectedKnowledge(prev => [...prev, sourceObj]);
        }
        success("Knowledge source connected (Option A — RAG Pending Activation).");
      }
    } catch (e) {
      console.error("Knowledge toggle error:", e);
      showError("Failed to update knowledge connection.");
    }
  };

  // ── 10. Tools Bridge Toggle ──────────────────────────────────────────────
  const handleToggleTool = async (toolId) => {
    if (!editingAgent?.id) {
      showError("Please save the agent before connecting tools.");
      return;
    }

    const isConnected = connectedTools.some(t => t.id === toolId);
    try {
      if (isConnected) {
        await disconnectToolFromAgent(editingAgent.id, toolId);
        setConnectedTools(prev => prev.filter(t => t.id !== toolId));
        info("Tool disconnected from agent.");
      } else {
        await connectToolToAgent(editingAgent.id, toolId);
        const toolObj = companyTools.find(t => t.id === toolId);
        if (toolObj) {
          setConnectedTools(prev => [...prev, toolObj]);
        }
        success("Webhook tool connected to agent.");
      }
    } catch (e) {
      console.error("Tool toggle error:", e);
      showError("Failed to update tool connection.");
    }
  };

  // ── 11. Rollback Version ─────────────────────────────────────────────────
  const handleRollback = async (versionId) => {
    if (!editingAgent?.id) return;
    if (window.confirm("Are you sure you want to rollback to this configuration?")) {
      try {
        const res = await rollbackAgent(editingAgent.id, versionId);
        setEditingAgent(res.data);
        const vers = await getAgentVersions(editingAgent.id);
        setAgentVersions(vers.data || []);
        success("Agent successfully rolled back to selected version!");
      } catch (e) {
        console.error("Rollback failed:", e);
        showError("Failed to rollback agent version.");
      }
    }
  };

  const currentAgents = agents[activeTeam] || [];

  // ── Render: Teams Sidebar ────────────────────────────────────────────────
  const renderTeamList = () => (
    <div className="teams-sidebar">
      <div className="teams-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2><Users size={18} /> AI Teams</h2>
        <button 
          onClick={() => setIsCreateTeamOpen(true)} 
          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
          title="Create New Team"
        >
          <Plus size={16} />
        </button>
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
  );

  // ── Render: Agent Grid ───────────────────────────────────────────────────
  const renderAgentGrid = () => (
    <div className="studio-main">
      <div className="studio-header">
        <div className="studio-title">
          <h1>{teams.find(t => t.id === activeTeam)?.name || 'AI Agents'}</h1>
          <p>Manage, test, and deploy intelligent voice agents assigned to this team.</p>
        </div>
      </div>
      <div className="studio-content">
        <div className="agents-grid">
          {/* Create New Card */}
          <div 
            className="agent-card create-card" 
            onClick={() => setEditingAgent({ 
              name: 'New Agent', 
              isNew: true, 
              team_id: activeTeam,
              voice_provider: 'edge_tts',
              voice_id: 'am-ET-MekdesNeural',
              model_provider: 'groq',
              model_id: 'llama-3.3-70b-versatile',
              temperature: 0.3,
              stt_provider: 'elevenlabs_scribe',
              prompt: ''
            })}
          >
            <div className="create-icon">
              <Plus size={24} />
            </div>
            <div className="agent-info">
              <h3>Create Agent</h3>
              <p>Add a new Amharic or bilingual voice specialist</p>
            </div>
          </div>

          {/* Existing Agent Cards */}
          {currentAgents.map((agent, i) => (
            <motion.div 
              key={agent.id}
              className={`agent-card ${agent.isCommander ? 'commander-card' : ''}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => setEditingAgent(agent)}
            >
              <div className="agent-status">
                <div className={`status-dot ${agent.status || 'active'}`}></div>
                {agent.status === 'active' ? 'Live' : 'Draft'}
              </div>
              <div className="agent-icon-wrapper">
                {agent.isCommander ? <ShieldAlert size={24} /> : <Bot size={24} />}
              </div>
              <div className="agent-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <h3 style={{ margin: 0 }}>{agent.name}</h3>
                  {agent.isCommander && (
                    <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', background: 'rgba(139, 92, 246, 0.2)', color: '#c4b5fd', border: '1px solid rgba(139, 92, 246, 0.4)' }}>
                      Commander
                    </span>
                  )}
                </div>
                <p>{(agent.prompt || '').substring(0, 65)}...</p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <button 
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                  onClick={(e) => { e.stopPropagation(); setEditingAgent(agent); }}
                >
                  <Edit3 size={13} /> Edit Agent
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {isCreateTeamOpen && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="modal-content" style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem', width: '400px', border: '1px solid var(--border-main)' }}>
              <h3>Create New AI Team</h3>
              <input 
                type="text" 
                placeholder="Team Name (e.g. GM Sales, Tech Support)" 
                value={newTeamName} 
                onChange={e => setNewTeamName(e.target.value)} 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-main)', color: 'white', border: '1px solid var(--border-main)', margin: '1rem 0' }} 
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => setIsCreateTeamOpen(false)} style={{ padding: '0.5rem 1rem', background: 'transparent', border: 'none', color: 'var(--gray)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleCreateTeam} style={{ padding: '0.5rem 1rem', background: 'var(--primary)', border: 'none', color: 'white', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>Create Team</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // ── Render: Builder View ─────────────────────────────────────────────────
  const renderBuilder = () => {
    const tabs = [
      { id: 'prompt', label: 'Prompt', icon: BrainCircuit },
      { id: 'voice', label: 'Voice', icon: Mic },
      { id: 'model', label: 'Model', icon: Settings },
      { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
      { id: 'integrations', label: 'Integrations', icon: Plug },
      { id: 'analytics', label: 'Analytics', icon: Activity },
      { id: 'history', label: 'Version History', icon: History }
    ];

    const currentVoiceProvider = editingAgent.voice_provider || 'edge_tts';
    const currentVoiceId = editingAgent.voice_id || 'am-ET-MekdesNeural';
    const currentModelProvider = editingAgent.model_provider || 'groq';
    const currentModelId = editingAgent.model_id || 'llama-3.3-70b-versatile';
    const currentTemperature = editingAgent.temperature ?? 0.3;
    const currentSTT = editingAgent.stt_provider || 'elevenlabs_scribe';

    return (
      <motion.div 
        className="agent-builder"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 50 }}
      >
        <div className="builder-header">
          <button className="back-btn" onClick={() => setEditingAgent(null)} title="Back to Teams">
            <ArrowLeft size={20} />
          </button>
          <div className="builder-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h2>{editingAgent.name || 'Untitled Agent'}</h2>
              {editingAgent.isCommander && (
                <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '0.35rem', background: 'rgba(139, 92, 246, 0.25)', color: '#c4b5fd', border: '1px solid rgba(139, 92, 246, 0.4)' }}>
                  Commander Master
                </span>
              )}
            </div>
            <p>{editingAgent.isCommander ? 'Master Call Center Orchestrator & Dispatcher' : 'Specialized AI Voice Agent'}</p>
          </div>
          <div className="builder-actions">
            <button className="btn btn-secondary" onClick={() => navigate('/app/agent-builder')}>
              <Settings size={16} /> Visual Flow
            </button>
            {!editingAgent.isNew && (
              <button className="btn btn-secondary" style={{ color: '#ef4444', borderColor: 'var(--border-main)' }} onClick={handleDelete}>
                <Trash2 size={16} /> Delete
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setIsVoiceSandboxOpen(true)}>
              <Play size={16} /> Test Voice
            </button>
            <button className="btn btn-secondary" onClick={handleSave}>
              <Save size={16} /> Save
            </button>
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
            
            {/* ── Sub-Tab 1: Prompt ──────────────────────────────────────── */}
            {builderTab === 'prompt' && (
              <motion.div className="panel-group" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="prompt-header-bar">
                  <label style={{ margin: 0 }}>System Prompt (Identity, Ethiopian Dialect & Behavior)</label>
                  <button 
                    type="button" 
                    className="prompt-suggestions-trigger"
                    onClick={() => setShowSuggestions(!showSuggestions)}
                  >
                    <Sparkles size={14} />
                    <span>{showSuggestions ? 'Hide Suggestions' : '✨ AI Prompt Suggestions'}</span>
                  </button>
                </div>

                <textarea 
                  value={editingAgent.prompt || ''}
                  onChange={e => setEditingAgent({ ...editingAgent, prompt: e.target.value })}
                  placeholder="You are Almaz, a professional customer service voice agent..."
                  rows={8}
                />

                {/* Quick 1-Click Suggestion Pills */}
                <div className="prompt-quick-chips">
                  <span style={{ fontSize: '0.75rem', color: '#71717a', alignSelf: 'center', marginRight: '0.25rem' }}>Quick presets:</span>
                  {promptSuggestions.slice(0, 4).map(s => (
                    <button
                      key={s.id}
                      type="button"
                      className="prompt-chip"
                      onClick={() => {
                        setEditingAgent({ ...editingAgent, prompt: s.prompt });
                        success(`Applied "${s.title}" preset`);
                      }}
                    >
                      <Plus size={12} /> {s.title.split(' ')[0]} {s.tag}
                    </button>
                  ))}
                </div>

                {/* Expandable Suggestions Tray */}
                <AnimatePresence>
                  {showSuggestions && (
                    <motion.div 
                      className="suggestions-tray"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.92rem' }}>
                          <Sparkles size={16} /> Recommended Prompt Archetypes for "{editingAgent.name}"
                        </h4>
                        <span style={{ fontSize: '0.75rem', color: '#71717a' }}>Generated from agent persona & knowledge sources</span>
                      </div>

                      {promptSuggestions.map(s => (
                        <div key={s.id} className="suggestion-card">
                          <div className="suggestion-content">
                            <div className="suggestion-title-row">
                              <span className="suggestion-title">{s.title}</span>
                              <span className="suggestion-badge">{s.tag}</span>
                            </div>
                            <div className="suggestion-desc">{s.description}</div>
                          </div>
                          <button
                            type="button"
                            className="btn-use-suggestion"
                            onClick={() => {
                              setEditingAgent({ ...editingAgent, prompt: s.prompt });
                              setShowSuggestions(false);
                              success(`Applied prompt: ${s.title}`);
                            }}
                          >
                            Use Prompt
                          </button>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ── Sub-Tab 2: Voice ───────────────────────────────────────── */}
            {builderTab === 'voice' && (
              <motion.div className="panel-group" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div>
                  <label>1. Voice Infrastructure Provider</label>
                  <p style={{ margin: '0.25rem 0 0.75rem 0', fontSize: '0.8rem', color: '#71717a' }}>
                    Select the neural speech synthesis provider available in Markova's telephony stack.
                  </p>
                  
                  <div className="options-grid">
                    {Object.values(VOICE_PROVIDERS).map(prov => {
                      const isSelected = currentVoiceProvider === prov.id;
                      return (
                        <div 
                          key={prov.id}
                          className={`option-select-card ${isSelected ? 'active' : ''}`}
                          onClick={() => {
                            const firstVoice = prov.voices[0]?.id || 'am-ET-MekdesNeural';
                            setEditingAgent({
                              ...editingAgent,
                              voice_provider: prov.id,
                              voice_id: firstVoice
                            });
                          }}
                        >
                          <div className="option-header">
                            <span className="option-title">
                              {prov.name}
                            </span>
                            <span className="option-tag">{prov.badge}</span>
                          </div>
                          <p className="option-desc">{prov.description}</p>
                          <div className="option-footer">
                            <span>{prov.voices.length} Profiles Available</span>
                            {isSelected && <Check size={16} />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem' }}>
                  <label>2. Voice Profile (Acoustic Identity)</label>
                  <p style={{ margin: '0.25rem 0 0.75rem 0', fontSize: '0.8rem', color: '#71717a' }}>
                    Filtered to verified acoustic voices for <strong>{VOICE_PROVIDERS[currentVoiceProvider]?.name}</strong>.
                  </p>

                  <div className="options-grid">
                    {(VOICE_PROVIDERS[currentVoiceProvider]?.voices || []).map(v => {
                      const isSelected = currentVoiceId === v.id;
                      return (
                        <div 
                          key={v.id}
                          className={`option-select-card ${isSelected ? 'active' : ''}`}
                          onClick={() => setEditingAgent({ ...editingAgent, voice_id: v.id })}
                        >
                          <div className="option-header">
                            <span className="option-title">
                              <span>{v.flag}</span> {v.name}
                            </span>
                            <span className="option-tag">{v.gender}</span>
                          </div>
                          <p className="option-desc">{v.tag} ({v.lang})</p>
                          <div className="option-footer">
                            <span>{v.recommended ? '⭐ Recommended' : 'Verified Profile'}</span>
                            {isSelected && <Check size={16} />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    onClick={handlePlayVoicePreview}
                    style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.75rem' }}
                  >
                    <Volume2 size={16} /> {isPlayingPreview ? 'Pause Audio Preview' : 'Play Live Voice Preview (Amharic)'}
                  </button>
                  
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    onClick={handleExportVoiceConfig}
                    style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.75rem' }}
                  >
                    Export Voice Config JSON
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Sub-Tab 3: Model ───────────────────────────────────────── */}
            {builderTab === 'model' && (
              <motion.div className="panel-group" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div>
                  <label>1. Core LLM Processing Engine</label>
                  <p style={{ margin: '0.25rem 0 0.75rem 0', fontSize: '0.8rem', color: '#71717a' }}>
                    Select the model powering conversational reasoning and Amharic response generation.
                  </p>

                  <div className="options-grid">
                    {Object.values(MODEL_PROVIDERS).flatMap(prov => 
                      prov.models.map(m => {
                        const isSelected = currentModelProvider === prov.id && currentModelId === m.id;
                        return (
                          <div
                            key={`${prov.id}-${m.id}`}
                            className={`option-select-card ${isSelected ? 'active' : ''}`}
                            onClick={() => setEditingAgent({
                              ...editingAgent,
                              model_provider: prov.id,
                              model_id: m.id
                            })}
                          >
                            <div className="option-header">
                              <span className="option-title">
                                {m.name}
                              </span>
                              <span className="option-tag">{m.speed}</span>
                            </div>
                            <p className="option-desc">{prov.name} — {m.quality}</p>
                            <div className="option-footer">
                              <span>{m.badge}</span>
                              {isSelected && <Check size={16} />}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>2. Temperature ({currentTemperature})</label>
                    <span style={{ fontSize: '0.8rem', color: '#10b981' }}>
                      {currentTemperature <= 0.2 ? 'Strict & Deterministic' : currentTemperature <= 0.6 ? 'Balanced Phone Conversation' : 'Creative / Exploratory'}
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05" 
                    value={currentTemperature} 
                    onChange={e => setEditingAgent({ ...editingAgent, temperature: parseFloat(e.target.value) })} 
                    style={{ width: '100%', margin: '0.75rem 0 0.25rem 0' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#71717a' }}>
                    <span>0.0 (Strict / Banking & Orders)</span>
                    <span>0.3 (Standard Ethiopian Voice)</span>
                    <span>1.0 (Creative)</span>
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem' }}>
                  <label>3. Speech-to-Text (STT) Transcription Pipeline</label>
                  <p style={{ margin: '0.25rem 0 0.75rem 0', fontSize: '0.8rem', color: '#71717a' }}>
                    Ear of the AI agent. ElevenLabs Scribe v2 won the Amharic phone benchmark (63.5% WER).
                  </p>

                  <div className="options-grid">
                    {STT_PROVIDERS.map(stt => {
                      const isSelected = currentSTT === stt.id;
                      return (
                        <div
                          key={stt.id}
                          className={`option-select-card ${isSelected ? 'active' : ''}`}
                          onClick={() => setEditingAgent({ ...editingAgent, stt_provider: stt.id })}
                        >
                          <div className="option-header">
                            <span className="option-title">{stt.name}</span>
                            <span className="option-tag">{stt.latency}</span>
                          </div>
                          <p className="option-desc">{stt.description}</p>
                          <div className="option-footer">
                            <span>{stt.badge}</span>
                            {isSelected && <Check size={16} />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Sub-Tab 4: Knowledge (Option A - RAG Pending) ──────────── */}
            {builderTab === 'knowledge' && (
              <motion.div className="panel-group" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>Connected Knowledge Sources</h3>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#71717a' }}>
                      Connect enterprise documents and product catalogs (e.g. GM Furniture Catalog) to this agent.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate('/app/knowledge')}
                    style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <BookOpen size={14} /> Knowledge Center <ExternalLink size={12} />
                  </button>
                </div>

                {companyKnowledge.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.75rem', border: '1px dashed var(--border-main)' }}>
                    <BookOpen size={32} style={{ color: '#71717a', marginBottom: '0.5rem' }} />
                    <p style={{ margin: 0, color: '#a1a1aa' }}>No knowledge sources created yet.</p>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={() => navigate('/app/knowledge')}
                      style={{ marginTop: '0.75rem', fontSize: '0.82rem' }}
                    >
                      Create Knowledge Source
                    </button>
                  </div>
                ) : (
                  <div className="bridge-list">
                    {companyKnowledge.map(source => {
                      const isConnected = connectedKnowledge.some(k => k.id === source.id);
                      return (
                        <div key={source.id} className={`bridge-item-card ${isConnected ? 'connected' : ''}`}>
                          <div className="bridge-item-info">
                            <div className="bridge-icon-box">
                              <BookOpen size={20} />
                            </div>
                            <div className="bridge-details">
                              <h4>
                                {source.name}
                                {isConnected && (
                                  <span className="rag-pending-badge">
                                    <Clock size={11} /> Option A: RAG Pending
                                  </span>
                                )}
                              </h4>
                              <p>Type: {source.type || 'Document'} • Status: {source.status || 'Active'}</p>
                            </div>
                          </div>

                          <label className="switch">
                            <input 
                              type="checkbox" 
                              checked={isConnected} 
                              onChange={() => handleToggleKnowledge(source.id)} 
                            />
                            <span className="slider"></span>
                          </label>
                        </div>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Sub-Tab 5: Integrations ─────────────────────────────────── */}
            {builderTab === 'integrations' && (
              <motion.div className="panel-group" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>Connected Webhook Tools</h3>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#71717a' }}>
                      Grant this agent authority to trigger external systems (SMS, CRM, ERP, Order Status) during calls.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate('/app/tools')}
                    style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Plug size={14} /> Integration Hub <ExternalLink size={12} />
                  </button>
                </div>

                {companyTools.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.75rem', border: '1px dashed var(--border-main)' }}>
                    <Plug size={32} style={{ color: '#71717a', marginBottom: '0.5rem' }} />
                    <p style={{ margin: 0, color: '#a1a1aa' }}>No tools registered in this organization.</p>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={() => navigate('/app/tools')}
                      style={{ marginTop: '0.75rem', fontSize: '0.82rem' }}
                    >
                      Add Webhook Tool
                    </button>
                  </div>
                ) : (
                  <div className="bridge-list">
                    {companyTools.map(tool => {
                      const isConnected = connectedTools.some(t => t.id === tool.id);
                      return (
                        <div key={tool.id} className={`bridge-item-card ${isConnected ? 'connected' : ''}`}>
                          <div className="bridge-item-info">
                            <div className="bridge-icon-box">
                              <Plug size={20} />
                            </div>
                            <div className="bridge-details">
                              <h4>
                                {tool.name}
                                <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', background: 'rgba(255,255,255,0.08)', color: '#10b981' }}>
                                  {tool.method || 'POST'}
                                </span>
                              </h4>
                              <p>{tool.description || tool.webhook_url}</p>
                            </div>
                          </div>

                          <label className="switch">
                            <input 
                              type="checkbox" 
                              checked={isConnected} 
                              onChange={() => handleToggleTool(tool.id)} 
                            />
                            <span className="slider"></span>
                          </label>
                        </div>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Sub-Tab 6: Analytics ────────────────────────────────────── */}
            {builderTab === 'analytics' && (
              <motion.div className="panel-group" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>Agent Performance Analytics</h3>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#71717a' }}>
                      Real-time call volume, conversation metrics, and resolution rate for "{editingAgent.name}".
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate('/app/analytics')}
                    style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Activity size={14} /> Full Analytics <ExternalLink size={12} />
                  </button>
                </div>

                {agentStats ? (
                  <div className="stats-cards-grid" style={{ marginTop: '1rem' }}>
                    <div className="stat-metric-card">
                      <span className="stat-label">Total Inbound Calls</span>
                      <span className="stat-value" style={{ color: 'var(--primary)' }}>{agentStats.totalCalls}</span>
                      <span className="stat-subtext">Lifetime handled</span>
                    </div>

                    <div className="stat-metric-card">
                      <span className="stat-label">Avg Call Duration</span>
                      <span className="stat-value" style={{ color: '#10b981' }}>{agentStats.avgDuration}</span>
                      <span className="stat-subtext">Per phone interaction</span>
                    </div>

                    <div className="stat-metric-card">
                      <span className="stat-label">Resolution Rate</span>
                      <span className="stat-value" style={{ color: '#8b5cf6' }}>{agentStats.successRate}</span>
                      <span className="stat-subtext">Without customer drop</span>
                    </div>

                    <div className="stat-metric-card">
                      <span className="stat-label">Conversation Turns</span>
                      <span className="stat-value" style={{ color: '#06b6d4' }}>{agentStats.totalTurns}</span>
                      <span className="stat-subtext">Speech turns processed</span>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: '#71717a' }}>Loading live analytics data...</p>
                )}
              </motion.div>
            )}

            {/* ── Sub-Tab 7: Version History ──────────────────────────────── */}
            {builderTab === 'history' && (
              <motion.div className="panel-group" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>Prompt & Engine Version History</h3>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#71717a' }}>
                    Rollback to any previous deployment snapshot instantly. Every save creates an immutable version.
                  </p>
                </div>

                {agentVersions.length === 0 ? (
                  <p style={{ color: '#71717a' }}>No prior version snapshots recorded.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
                    {agentVersions.map(v => (
                      <div key={v.id} className="version-item-card">
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                              Version {v.version}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#71717a' }}>
                              {new Date(v.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.78rem', color: '#a1a1aa' }}>
                            Model: {v.model_provider}/{v.model_id} • Voice: {v.voice_provider}/{v.voice_id} • {(v.prompt || '').length} chars
                          </p>
                        </div>

                        <div className="version-actions">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setSelectedVersionPreview(v)}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <Eye size={13} /> Preview
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleRollback(v.id)}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                          >
                            <RotateCcw size={13} /> Rollback
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

          </div>
        </div>
      </motion.div>
    );
  };

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

      {/* ── Version Prompt Preview Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {selectedVersionPreview && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(6px)',
              zIndex: 1200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div 
              className="modal-content"
              style={{
                background: '#111b15',
                padding: '2rem',
                borderRadius: '1.25rem',
                width: '600px',
                maxHeight: '80vh',
                border: '1px solid #1f3b2b',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <History size={18} color="#10b981" /> Preview Version {selectedVersionPreview.version}
                </h3>
                <button 
                  onClick={() => setSelectedVersionPreview(null)}
                  style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer' }}
                >
                  &times;
                </button>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#71717a' }}>
                Saved: {new Date(selectedVersionPreview.created_at).toLocaleString()} • Engine: {selectedVersionPreview.model_provider}
              </div>

              <textarea 
                readOnly
                value={selectedVersionPreview.prompt || ''}
                style={{
                  width: '100%',
                  height: '240px',
                  background: '#090e0b',
                  border: '1px solid #1f3b2b',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  color: '#e4e4e7',
                  fontFamily: 'inherit',
                  fontSize: '0.88rem',
                  resize: 'none'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedVersionPreview(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ background: '#10b981', borderColor: '#10b981' }}
                  onClick={() => {
                    const vId = selectedVersionPreview.id;
                    setSelectedVersionPreview(null);
                    handleRollback(vId);
                  }}
                >
                  <RotateCcw size={14} /> Rollback to this version
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Voice Sandbox Simulator Modal ───────────────────────────────── */}
      <AnimatePresence>
        {isVoiceSandboxOpen && (
          <motion.div 
            className="modal-overlay" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            style={{ 
              position: 'fixed', 
              inset: 0, 
              background: 'rgba(0,0,0,0.75)', 
              backdropFilter: 'blur(8px)',
              zIndex: 1100, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}
          >
            <motion.div 
              className="modal-content"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              style={{ 
                background: '#111b15', 
                padding: '2.5rem', 
                borderRadius: '1.5rem', 
                width: '520px', 
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid #1f3b2b',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ background: '#10b981', padding: '0.5rem', borderRadius: '0.75rem', color: '#111b15' }}>
                    <Mic size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, color: 'white', fontSize: '1.25rem' }}>Voice Sandbox Simulator</h3>
                    <p style={{ margin: 0, color: '#888', fontSize: '0.8rem' }}>Live test for {editingAgent?.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => { endSandboxCall(); setIsVoiceSandboxOpen(false); }} 
                  style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer' }}
                >
                  &times;
                </button>
              </div>

              {!isCallActive ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 0', gap: '1.5rem' }}>
                  <div className="agent-icon-wrapper" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #10b981' }}>
                    <Bot size={40} color="#10b981" />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <h4 style={{ color: 'white', margin: '0 0 0.5rem 0' }}>Ready to launch voice test?</h4>
                    <p style={{ color: '#888', fontSize: '0.85rem', margin: 0, padding: '0 1rem' }}>
                      Connects directly to the orchestrator test bridge using {editingAgent?.name}'s system prompt, voice ({editingAgent?.voice_id || 'am-ET-MekdesNeural'}), and model.
                    </p>
                  </div>
                  <button 
                    onClick={startSandboxCall}
                    className="btn btn-primary"
                    style={{ background: '#10b981', borderColor: '#10b981', padding: '0.75rem 2rem', borderRadius: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 600 }}
                  >
                    <Play size={18} /> Start Voice Trial
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                  {/* Call Status Header */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1f3b2b', padding: '0.75rem 1rem', borderRadius: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ color: '#10b981', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                      <span className="dot" style={{ background: '#10b981', width: '8px', height: '8px', borderRadius: '50%' }}></span> Simulated Call Active
                    </span>
                    <button 
                      onClick={endSandboxCall}
                      style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.4rem 1rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      End Call
                    </button>
                  </div>

                  {/* Audio Element & Visualizer */}
                  <audio ref={audioRef} autoPlay style={{ display: 'none' }} />
                  {(isConnecting || isListeningForSpeech) && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', margin: '0.75rem 0', height: '24px', alignItems: 'center' }}>
                      {[...Array(6)].map((_, i) => (
                        <div 
                          key={i} 
                          style={{ 
                            width: '4px', 
                            height: '100%', 
                            background: isListeningForSpeech ? '#ef4444' : '#10b981', 
                            borderRadius: '2px',
                            animation: `soundWave 1.2s ease-in-out infinite alternate ${i * 0.2}s` 
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Sandbox Chat/Speech Log */}
                  <div style={{ flex: 1, background: '#090e0b', border: '1px solid #1f3b2b', borderRadius: '0.75rem', padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '200px', maxHeight: '300px', marginBottom: '1rem' }}>
                    {sandboxTranscript.map((msg, i) => (
                      <div 
                        key={i} 
                        style={{ 
                          alignSelf: msg.speaker === 'agent' ? 'flex-start' : 'flex-end',
                          background: msg.speaker === 'agent' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                          border: msg.speaker === 'agent' ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(59,130,246,0.2)',
                          color: msg.speaker === 'agent' ? '#10b981' : '#60a5fa',
                          padding: '0.65rem 0.95rem',
                          borderRadius: '0.75rem',
                          maxWidth: '85%',
                          fontSize: '0.88rem',
                          lineHeight: '1.4'
                        }}
                      >
                        <strong style={{ display: 'block', fontSize: '0.72rem', marginBottom: '0.2rem', textTransform: 'uppercase' }}>
                          {msg.speaker}
                        </strong>
                        {msg.text}
                      </div>
                    ))}
                  </div>

                  {/* Controls */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="text" 
                      placeholder="Type message to agent in Amharic or English..." 
                      value={sandboxInput}
                      onChange={e => setSandboxInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleUserSandboxInput(sandboxInput)}
                      style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '0.75rem', background: '#090e0b', border: '1px solid #1f3b2b', color: 'white', fontSize: '0.9rem' }}
                    />
                    
                    <button 
                      onClick={() => handleUserSandboxInput(sandboxInput)}
                      style={{ background: '#10b981', color: '#111b15', border: 'none', padding: '0 1.25rem', borderRadius: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Send
                    </button>

                    <button 
                      onClick={startSpeechRecognition}
                      style={{ 
                        background: isListeningForSpeech ? '#ef4444' : 'rgba(255,255,255,0.05)', 
                        color: 'white', 
                        border: '1px solid #1f3b2b', 
                        padding: '0 0.75rem', 
                        borderRadius: '0.75rem', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Speak via Microphone"
                    >
                      <Mic size={18} />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AgentStudio
