import React, { useState, useCallback } from 'react';
import { 
  ReactFlow, 
  MiniMap, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Save, Play, Settings, Plus, X } from 'lucide-react';
import './AgentBuilder.css';

const initialNodes = [
  { id: '1', position: { x: 250, y: 0 }, data: { label: 'Call Started' }, type: 'input' },
  { id: '2', position: { x: 250, y: 150 }, data: { label: 'Greeting Agent' } },
];
const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

const AgentBuilder = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const addNode = (type) => {
    const newNode = {
      id: `${nodes.length + 1}`,
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      data: { label: `${type} Node` },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const handleSave = () => {
    const flow = { nodes, edges };
    const serialized = JSON.stringify(flow);
    console.log("Saved flow:", serialized);
    alert("Flow saved successfully (check console)");
  };

  return (
    <div className="agent-builder-container">
      <div className="ab-header">
        <div className="ab-title">
          <h1>Visual Agent Builder</h1>
          <span className="badge">Beta</span>
        </div>
        <div className="ab-actions">
          <button className="btn btn-secondary" onClick={() => {}}><Play size={16} /> Test Flow</button>
          <button className="btn btn-primary" onClick={handleSave}><Save size={16} /> Save Agent</button>
        </div>
      </div>
      
      <div className="ab-workspace">
        <div className={`ab-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-header">
            <h3>Components</h3>
            <button className="icon-btn" onClick={() => setIsSidebarOpen(false)}><X size={16} /></button>
          </div>
          <div className="node-palette">
            <button className="palette-item" onClick={() => addNode('Prompt')}>
              <div className="pi-icon prompt-icon">P</div>
              <span>System Prompt</span>
            </button>
            <button className="palette-item" onClick={() => addNode('Condition')}>
              <div className="pi-icon condition-icon">?</div>
              <span>Condition</span>
            </button>
            <button className="palette-item" onClick={() => addNode('Action')}>
              <div className="pi-icon action-icon">⚡</div>
              <span>Action / Tool</span>
            </button>
            <button className="palette-item" onClick={() => addNode('Transfer')}>
              <div className="pi-icon transfer-icon">📞</div>
              <span>Transfer Call</span>
            </button>
          </div>
          
          <div className="sidebar-section">
            <h3>Agent Settings</h3>
            <div className="form-group">
              <label>Agent Name</label>
              <input type="text" placeholder="e.g. Sales Bot" defaultValue="My Custom Agent" />
            </div>
            <div className="form-group">
              <label>Voice Model</label>
              <select defaultValue="edge">
                <option value="edge">Edge TTS (Amharic)</option>
                <option value="openai">OpenAI (English)</option>
                <option value="elevenlabs">ElevenLabs</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="ab-canvas">
          {!isSidebarOpen && (
             <Panel position="top-left">
               <button className="btn btn-secondary btn-sm" onClick={() => setIsSidebarOpen(true)}>
                 <Plus size={16} /> Add Nodes
               </button>
             </Panel>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            attributionPosition="bottom-right"
          >
            <Controls />
            <MiniMap 
              nodeColor={(node) => {
                switch (node.type) {
                  case 'input': return '#10b981';
                  case 'output': return '#ef4444';
                  default: return '#3b82f6';
                }
              }}
              maskColor="rgba(0, 0, 0, 0.2)"
            />
            <Background variant="dots" gap={12} size={1} color="#4b5563" />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
};

export default AgentBuilder;
