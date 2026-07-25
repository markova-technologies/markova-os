import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactFlow, { 
  Background, 
  Controls, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge,
  ReactFlowProvider,
  Handle, Position
} from 'reactflow'
import 'reactflow/dist/style.css'
import { 
  Play, 
  Save, 
  Plus, 
  MousePointer2, 
  Hand, 
  Activity,
  Bot, ShieldAlert, Plug, Zap, Bell, Shuffle, Phone, Database, Trash2, Edit2, Copy, ArrowLeft, 
  MessageCircle, Mail, HeadphonesIcon, TrendingUp, Settings, Briefcase, Users
} from 'lucide-react'
import api, { listChannels, listIntegrations, listPipelines, createPipeline, updatePipeline, deletePipeline, listTeams, listAgents } from '../api/client'
import './FlowBuilder.css'
import { useToast } from '../contexts/ToastContext'

// n8n-Style Custom Node
const CustomNode = ({ data, selected }) => {
  let bg = '#3b82f6';
  let Icon = Bot;

  // Defaults based on type
  if (data.nodeType === 'trigger') { bg = '#10b981'; Icon = Zap; }
  else if (data.nodeType === 'commander') { bg = '#f59e0b'; Icon = ShieldAlert; }
  else if (data.nodeType === 'agent') { bg = '#3b82f6'; Icon = Bot; }
  else if (data.nodeType === 'tool') { bg = '#8b5cf6'; Icon = Plug; }
  else if (data.nodeType === 'condition') { bg = '#f97316'; Icon = Shuffle; }
  else if (data.nodeType === 'notification') { bg = '#6b7280'; Icon = Bell; }
  else if (data.nodeType === 'channel') { bg = '#22c55e'; Icon = Phone; }
  else if (data.nodeType === 'integration') { bg = '#06b6d4'; Icon = Database; }

  // Smart icons based on selection
  if (data.nodeType === 'channel' && data.selectedSubType) {
    if (data.selectedSubType === 'whatsapp' || data.selectedSubType === 'telegram') Icon = MessageCircle;
    if (data.selectedSubType === 'email') Icon = Mail;
    if (data.selectedSubType === 'sip') Icon = HeadphonesIcon;
  }
  
  if ((data.nodeType === 'agent' || data.nodeType === 'commander') && data.selectedTeam) {
    if (data.selectedTeam === 'sales') Icon = TrendingUp;
    if (data.selectedTeam === 'support') Icon = HeadphonesIcon;
    if (data.selectedTeam === 'commander') Icon = ShieldAlert;
    if (data.selectedTeam === 'ops') Icon = Settings;
    if (data.selectedTeam === 'marketing') Icon = Briefcase;
    if (data.selectedTeam === 'hr') Icon = Users;
  }

  return (
    <div className={`n8n-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="react-flow__handle-left" />
      
      <div className="n8n-node-accent" style={{ background: bg }}></div>
      <div className="n8n-node-content">
        <div className="n8n-node-icon" style={{ background: bg, color: 'white' }}>
          <Icon size={18} />
        </div>
        <div className="n8n-node-text">
          <div className="n8n-node-title">{data.label}</div>
          <div className="n8n-node-subtitle">
            {data.selectedRefName || data.selectedRef || 'Not configured'}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="react-flow__handle-right" />
    </div>
  );
};

const nodeTypes = { custom: CustomNode };

let idCounter = 0;
const getId = () => `node_${Date.now()}_${idCounter++}`;

const FlowBuilderCanvas = () => {
  const reactFlowWrapper = useRef(null);
  const { success, error: showError } = useToast();

  const [viewMode, setViewMode] = useState('list'); // 'list' | 'canvas'

  const [pipelines, setPipelines] = useState([]);
  const [activePipelineId, setActivePipelineId] = useState(null);

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  
  const [logs, setLogs] = useState([]);
  
  // Data for properties panel
  const [channels, setChannels] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [teams, setTeams] = useState([]);
  const [agents, setAgents] = useState([]);
  
  const [selectedNode, setSelectedNode] = useState(null);

  // Load pipelines and references
  useEffect(() => {
    const init = async () => {
      try {
        const [pipeRes, chanRes, intRes, teamsRes, agentsRes] = await Promise.all([
          listPipelines().catch(() => ({ data: [] })),
          listChannels().catch(() => ({ data: [] })),
          listIntegrations().catch(() => ({ data: [] })),
          listTeams().catch(() => ({ data: [] })),
          listAgents().catch(() => ({ data: [] }))
        ]);

        let loadedPipelines = pipeRes.data || [];
        if (loadedPipelines.length === 0) {
          loadedPipelines = [{
            id: 'pipe_default',
            name: 'Main Inbound Flow',
            isActive: true,
            nodes: [
              { id: '1', type: 'custom', data: { label: 'Inbound Call', nodeType: 'trigger' }, position: { x: 50, y: 150 } },
              { id: '2', type: 'custom', data: { label: 'Global Router', nodeType: 'commander' }, position: { x: 350, y: 150 } }
            ],
            edges: [{ id: 'e1-2', source: '1', target: '2', type: 'smoothstep', animated: true }]
          }];
        }
        
        setPipelines(loadedPipelines);

        if (chanRes.data && chanRes.data.length > 0) {
          setChannels(chanRes.data);
        } else {
          setChannels([
            { id: 1, identifier: '+1 (555) 123-4567', subType: 'twilio' },
            { id: 2, identifier: 'sip.acme.com', subType: 'sip' }
          ]);
        }

        if (intRes.data && intRes.data.length > 0) {
          setIntegrations(intRes.data);
        } else {
          setIntegrations([
            { id: 'ghl', name: 'GoHighLevel' },
            { id: 'hubspot', name: 'HubSpot' }
          ]);
        }
        
        // Mock fallback for teams/agents if endpoints fail or empty
        const mockTeams = [
          { id: 'commander', name: 'Commander Agent' },
          { id: 'sales', name: 'Sales Team' },
          { id: 'support', name: 'Support Team' },
          { id: 'ops', name: 'Operations Team' },
          { id: 'marketing', name: 'Marketing Team' },
          { id: 'hr', name: 'HR Team' }
        ];
        
        const mockAgents = [
          { id: 'cmd-1', name: 'Global Router', team_id: 'commander' },
          { id: 'sales-1', name: 'Inbound Qualifier', team_id: 'sales' },
          { id: 'sales-2', name: 'Outbound Closer', team_id: 'sales' },
          { id: 'sales-3', name: 'Booking Agent', team_id: 'sales' },
          { id: 'sup-1', name: 'Tier 1 Support', team_id: 'support' }
        ];

        if (teamsRes.data && teamsRes.data.length > 0) {
          setTeams([{ id: 'commander', name: 'Commander Agent' }, ...teamsRes.data]);
        } else {
          setTeams(mockTeams);
        }

        if (agentsRes.data && agentsRes.data.length > 0) {
          setAgents(agentsRes.data);
        } else {
          setAgents(mockAgents);
        }
      } catch (err) {
        console.error(err);
      }
    };
    init();
  }, []);

  // Update canvas when active pipeline changes
  useEffect(() => {
    if (activePipelineId) {
      const activePipe = pipelines.find(p => p.id === activePipelineId);
      if (activePipe) {
        setNodes(activePipe.nodes || []);
        setEdges(activePipe.edges || []);
        setSelectedNode(null);
      }
    }
  }, [activePipelineId, pipelines]);

  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => {
      const newNodes = applyNodeChanges(changes, nds);
      
      const selected = newNodes.find(n => n.selected);
      if (selected && (!selectedNode || selected.id !== selectedNode.id)) {
        setSelectedNode(selected);
      } else if (!selected && selectedNode) {
        const stillSelected = newNodes.some(n => n.selected);
        if (!stillSelected) setSelectedNode(null);
      }

      return newNodes;
    });
  }, [selectedNode]);

  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  
  const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep' }, eds)), []);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (typeof type === 'undefined' || !type || !reactFlowInstance) return;

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    
    let label = `${type.charAt(0).toUpperCase() + type.slice(1)}`;
    if (type === 'channel') label = 'Channel';
    if (type === 'integration') label = 'Integration';

    const newNode = {
      id: getId(),
      type: 'custom',
      position,
      selected: false,
      data: { label, nodeType: type, selectedRef: '' },
    };

    setNodes((nds) => nds.concat(newNode));
  }, [reactFlowInstance]);

  const onPaletteClick = useCallback((type) => {
    if (typeof type === 'undefined' || !type || !reactFlowInstance) return;

    // Place new nodes slightly offset from center so they don't overlap perfectly
    const offset = Math.floor(Math.random() * 40) - 20;
    const position = reactFlowInstance.screenToFlowPosition({
      x: window.innerWidth / 2 + offset,
      y: window.innerHeight / 2 + offset,
    });
    
    let label = `${type.charAt(0).toUpperCase() + type.slice(1)}`;
    if (type === 'channel') label = 'Channel';
    if (type === 'integration') label = 'Integration';

    const newNode = {
      id: getId(),
      type: 'custom',
      position,
      selected: true, // Auto-select when clicked from palette
      data: { label, nodeType: type, selectedRef: '' },
    };

    setNodes((nds) => {
      // Unselect existing nodes
      const unselected = nds.map(n => ({ ...n, selected: false }));
      return unselected.concat(newNode);
    });
    setSelectedNode(newNode);
  }, [reactFlowInstance]);

  const handleSave = async () => {
    try {
      if (reactFlowInstance && activePipelineId) {
        const flow = reactFlowInstance.toObject();
        const updatedPipeline = {
          ...pipelines.find(p => p.id === activePipelineId),
          nodes: flow.nodes,
          edges: flow.edges
        };

        try {
          if (!activePipelineId.startsWith('pipe_default')) {
             await updatePipeline(activePipelineId, updatedPipeline);
          }
        } catch(e) {}

        setPipelines(pipes => pipes.map(p => p.id === activePipelineId ? updatedPipeline : p));
        success('Pipeline flow saved and deployed');
      }
    } catch(e) {
      showError('Error saving flow');
    }
  };

  const handleCreatePipeline = async () => {
    const newPipe = {
      id: `pipe_${Date.now()}`,
      name: 'New Routing Pipeline',
      isActive: false,
      nodes: [],
      edges: []
    };
    try {
      await createPipeline(newPipe).catch(() => {});
      setPipelines([...pipelines, newPipe]);
      setActivePipelineId(newPipe.id);
      setViewMode('canvas');
      success('Pipeline created');
    } catch (err) {
      showError('Failed to create pipeline');
    }
  };

  const handleDeletePipeline = async (id, e) => {
    e.stopPropagation();
    if (pipelines.length <= 1) return showError('Cannot delete the last pipeline');
    try {
      await deletePipeline(id).catch(() => {});
      setPipelines(pipes => pipes.filter(p => p.id !== id));
      if (activePipelineId === id) setActivePipelineId(null);
      success('Pipeline deleted');
    } catch (err) {
      showError('Failed to delete pipeline');
    }
  }

  const openCanvas = (id) => {
    setActivePipelineId(id);
    setViewMode('canvas');
  };

  const updateNodeData = (nodeId, newData) => {
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        const updated = { ...n, data: { ...n.data, ...newData } };
        setSelectedNode(updated); 
        return updated;
      }
      return n;
    }));
  };

  useEffect(() => {
    if (viewMode === 'list') return; // Don't connect WS if not viewing canvas
    
    const ws = new WebSocket(`ws://localhost:8000/ws/flow-monitor/default-company`);
    ws.onopen = () => setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: 'Connected to Live Orchestrator Feed', source: 'System' }]);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: data.msg || JSON.stringify(data), source: data.source || 'Orchestrator' }]);
        
        if (data.edgeId) {
           setEdges(eds => eds.map(e => e.id === data.edgeId ? { ...e, animated: true, style: { stroke: '#10b981', strokeWidth: 2 } } : { ...e, animated: false, style: {} }));
        }
      } catch (err) {
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: event.data, source: 'System' }]);
      }
    };
    return () => { if (ws.readyState === 1) ws.close(); };
  }, [viewMode]);

  return (
    <div className="flow-builder">
      {viewMode === 'list' ? (
        // FLOW LIST VIEW
        <>
          <div className="flow-header">
            <div className="flow-title">
              <h1>Flow Builder</h1>
              <p>Manage your visual routing pipelines</p>
            </div>
            <div className="flow-actions">
              <button className="btn btn-primary" onClick={handleCreatePipeline}><Plus size={16} /> New Flow</button>
            </div>
          </div>
          
          <div className="flow-list-container">
            <div className="flow-list-grid">
              {pipelines.map(pipe => (
                <div className="flow-card" key={pipe.id}>
                  <div className="flow-card-accent"></div>
                  <div className="flow-card-header">
                    <div className={`flow-card-status ${pipe.isActive ? 'active' : 'draft'}`}>
                      <span className="pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: pipe.isActive ? 'block' : 'none' }}></span>
                      {pipe.isActive ? 'Active' : 'Draft'}
                    </div>
                    <button style={{ background: 'none', border: 'none', color: 'var(--gray)', cursor: 'pointer' }}><Activity size={16} /></button>
                  </div>
                  
                  <div>
                    <div className="flow-card-title">{pipe.name}</div>
                    <div className="flow-card-meta">
                      <span>{pipe.nodes?.length || 0} nodes</span>
                      <span>Just now</span>
                    </div>
                  </div>

                  <div className="flow-card-actions">
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => openCanvas(pipe.id)}>
                      <Edit2 size={14} /> Edit Flow
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '0 0.5rem' }} onClick={(e) => handleDeletePipeline(pipe.id, e)}>
                      <Trash2 size={14} color="var(--danger)" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        // CANVAS EDITOR VIEW
        <>
          <div className="flow-header">
            <div className="flow-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button onClick={() => { setViewMode('list'); setActivePipelineId(null); }} className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem' }}><ArrowLeft size={16} /></button>
              <div>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {pipelines.find(p => p.id === activePipelineId)?.name}
                </h1>
                <p>Visual orchestration and real-time execution monitoring</p>
              </div>
            </div>
            <div className="flow-actions">
              <button className="btn btn-primary" onClick={handleSave}><Save size={16} /> Deploy Flow</button>
            </div>
          </div>

          <div className="flow-main" style={{ display: 'flex', height: 'calc(100vh - 85px)' }}>
            {/* Sidebar Palette */}
            <div className="palette-sidebar" style={{ width: '250px', background: 'var(--bg-card)', borderRight: '1px solid var(--border-main)', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--gray)', textTransform: 'uppercase' }}>Nodes Palette</h3>
              {[
                { type: 'channel', label: 'Channel', color: '#22c55e', icon: Phone },
                { type: 'integration', label: 'Integration', color: '#06b6d4', icon: Database },
                { type: 'trigger', label: 'Trigger', color: '#10b981', icon: Zap },
                { type: 'commander', label: 'Commander', color: '#f59e0b', icon: ShieldAlert },
                { type: 'agent', label: 'Agent', color: '#3b82f6', icon: Bot },
                { type: 'tool', label: 'Tool', color: '#8b5cf6', icon: Plug },
                { type: 'condition', label: 'Condition', color: '#f97316', icon: Shuffle },
                { type: 'notification', label: 'Notification', color: '#6b7280', icon: Bell }
              ].map(node => {
                const Icon = node.icon;
                return (
                  <div 
                    key={node.type}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', node.type);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    draggable
                    onClick={() => onPaletteClick(node.type)}
                    style={{ background: 'var(--bg-main)', padding: '0.75rem', marginBottom: '0.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: `1px solid var(--border-main)` }}
                  >
                    <div style={{ background: node.color, padding: '4px', borderRadius: '4px', color: 'white', display: 'flex' }}>
                      <Icon size={14} />
                    </div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{node.label}</span>
                  </div>
                )
              })}
            </div>

            {/* Canvas Area */}
            <div className="flow-canvas" style={{ flex: 1, position: 'relative' }} ref={reactFlowWrapper}>
              <ReactFlow 
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onInit={setReactFlowInstance}
                onDrop={onDrop}
                onDragOver={onDragOver}
                nodeTypes={nodeTypes}
                defaultEdgeOptions={{ type: 'smoothstep' }}
                fitView
              >
                <Controls />
              </ReactFlow>
            </div>

            {/* Right Sidebar: Properties & Execution Monitor */}
            <div className="execution-sidebar" style={{ width: '320px', background: 'var(--bg-card)', borderLeft: '1px solid var(--border-main)', display: 'flex', flexDirection: 'column' }}>
              
              {selectedNode ? (
                <div style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-main)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>Node Properties</h3>
                    <button onClick={() => setNodes(nds => nds.filter(n => n.id !== selectedNode.id))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} title="Delete Node"><Trash2 size={16} /></button>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--gray)', marginBottom: '0.5rem' }}>Node Label</label>
                    <input 
                      type="text" 
                      value={selectedNode.data.label || ''} 
                      onChange={e => updateNodeData(selectedNode.id, { label: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'white', borderRadius: '0.5rem' }}
                    />
                  </div>

                  {selectedNode.data.nodeType === 'channel' && (
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--gray)', marginBottom: '0.5rem' }}>Select Channel</label>
                      <select 
                        value={selectedNode.data.selectedRef || ''} 
                        onChange={e => {
                          const opt = e.target.options[e.target.selectedIndex];
                          const subType = channels.find(c => c.id.toString() === e.target.value)?.subType || '';
                          updateNodeData(selectedNode.id, { selectedRef: e.target.value, selectedRefName: opt.text, selectedSubType: subType })
                        }}
                        style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'white', borderRadius: '0.5rem' }}
                      >
                        <option value="">-- Choose Channel --</option>
                        {channels.map(ch => (
                          <option key={ch.id} value={ch.id}>{ch.identifier} ({ch.subType})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedNode.data.nodeType === 'integration' && (
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--gray)', marginBottom: '0.5rem' }}>Select Integration</label>
                      <select 
                        value={selectedNode.data.selectedRef || ''} 
                        onChange={e => {
                          const opt = e.target.options[e.target.selectedIndex];
                          updateNodeData(selectedNode.id, { selectedRef: e.target.value, selectedRefName: opt.text })
                        }}
                        style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'white', borderRadius: '0.5rem' }}
                      >
                        <option value="">-- Choose Integration --</option>
                        {integrations.map(int => (
                          <option key={int.id} value={int.id}>{int.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(selectedNode.data.nodeType === 'agent' || selectedNode.data.nodeType === 'commander') && (
                    <>
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--gray)', marginBottom: '0.5rem' }}>Select Team</label>
                        <select 
                          value={selectedNode.data.selectedTeam || ''} 
                          onChange={e => {
                            updateNodeData(selectedNode.id, { selectedTeam: e.target.value, selectedRef: '', selectedRefName: '' })
                          }}
                          style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'white', borderRadius: '0.5rem' }}
                        >
                          <option value="">-- Choose Team --</option>
                          {teams.map(team => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                          ))}
                        </select>
                      </div>

                      {selectedNode.data.selectedTeam && (
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--gray)', marginBottom: '0.5rem' }}>Select Agent</label>
                          <select 
                            value={selectedNode.data.selectedRef || ''} 
                            onChange={e => {
                              const opt = e.target.options[e.target.selectedIndex];
                              updateNodeData(selectedNode.id, { selectedRef: e.target.value, selectedRefName: opt.text })
                            }}
                            style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'white', borderRadius: '0.5rem' }}
                          >
                            <option value="">-- Choose Agent --</option>
                            {agents
                              .filter(a => a.team_id === selectedNode.data.selectedTeam || (!a.team_id && selectedNode.data.selectedTeam === 'sales'))
                              .map(a => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </>
                  )}

                </div>
              ) : (
                <>
                  <div className="exec-header" style={{ padding: '1rem', borderBottom: '1px solid var(--border-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}><Activity size={18} /> Monitor</h3>
                    <div className="exec-status" style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className="pulse" style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', display: 'inline-block' }}></span> Live
                    </div>
                  </div>
                  <div className="exec-logs" style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                    {logs.length === 0 && <div style={{ color: 'var(--gray)', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>Waiting for flow execution events...</div>}
                    {logs.slice(-50).map((log, i) => (
                      <motion.div 
                        className="log-item" 
                        key={i}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        style={{ background: 'var(--bg-main)', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '0.85rem' }}
                      >
                        <div className="log-time" style={{ color: 'var(--gray)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>{log.time}</div>
                        <div className="log-content">
                          <div className="log-msg" style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>{log.msg}</div>
                          <div className="log-meta" style={{ color: 'var(--primary)', fontSize: '0.75rem' }}>↳ {log.source}</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const FlowBuilder = () => (
  <ReactFlowProvider>
    <FlowBuilderCanvas />
  </ReactFlowProvider>
)

export default FlowBuilder
