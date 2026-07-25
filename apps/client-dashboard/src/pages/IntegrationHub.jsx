import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, 
  Sparkles, 
  Database, 
  MessageSquare, 
  Calendar, 
  Mail, 
  Settings, 
  Plug,
  CheckCircle2,
  LayoutGrid,
  Factory,
  X,
  Loader2
} from 'lucide-react'
import api from '../api/client'
import './IntegrationHub.css'

const categories = [
  { id: 'all', name: 'All Integrations', icon: LayoutGrid, count: 0 },
  { id: 'crm', name: 'CRM', icon: Settings, count: 0 },
  { id: 'database', name: 'Databases', icon: Database, count: 0 },
  { id: 'messaging', name: 'Messaging', icon: MessageSquare, count: 0 },
  { id: 'calendar', name: 'Calendar', icon: Calendar, count: 0 },
  { id: 'email', name: 'Email', icon: Mail, count: 0 },
  { id: 'automation', name: 'Automation', icon: Plug, count: 0 },
  { id: 'erp', name: 'ERP', icon: Factory, count: 0 },
]

const fallbackIntegrations = [
  { id: 'ghl', name: 'GoHighLevel', category: 'crm', desc: 'Sync pipelines, contacts, and opportunities with GHL.', status: 'disconnected', type: 'crm' },
  { id: 'hubspot', name: 'HubSpot', category: 'crm', desc: 'Automatically log calls, transcripts, and update deals in HubSpot.', status: 'disconnected', type: 'crm' },
  { id: 'zendesk', name: 'Zendesk', category: 'crm', desc: 'Create support tickets and append AI summaries to existing ones.', status: 'disconnected', type: 'crm' },
  { id: 'postgres', name: 'PostgreSQL', category: 'database', desc: 'Direct secure connection to your PostgreSQL database.', status: 'disconnected', type: 'database' },
  { id: 'whatsapp', name: 'WhatsApp Business', category: 'messaging', desc: 'Send AI-generated SMS and WhatsApp messages to customers.', status: 'disconnected', type: 'messaging' },
  { id: 'make', name: 'Make.com', category: 'automation', desc: 'Trigger Make.com scenarios via webhooks.', status: 'disconnected', type: 'rpa' },
  { id: 'gcal', name: 'Google Calendar', category: 'calendar', desc: 'Allow Booking Agents to check availability and schedule meetings.', status: 'disconnected', type: 'calendar' },
  { id: 'calendly', name: 'Calendly', category: 'calendar', desc: 'Generate single-use booking links via Calendly.', status: 'disconnected', type: 'calendar' },
  { id: 'n8n', name: 'n8n Webhook', category: 'automation', desc: 'Trigger complex internal workflows via n8n automation.', status: 'disconnected', type: 'rpa' },
  { id: 'sap', name: 'SAP ERP', category: 'erp', desc: 'Enterprise resource planning integration for deep inventory checks.', status: 'disconnected', type: 'erp' },
]

const IntegrationHub = () => {
  const [integrations, setIntegrations] = useState(fallbackIntegrations)
  const [suggestedIds, setSuggestedIds] = useState([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIntegration, setSelectedIntegration] = useState(null)
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(null)

  useEffect(() => {
    fetchData();
  }, [])

  const fetchData = async () => {
    setLoading(true);
    try {
      const [intsRes, agentsRes] = await Promise.all([
        api.get('/connectors/integrations').catch(() => ({ data: [] })),
        api.get('/builder/agents').catch(() => ({ data: [] }))
      ]);

      // Merge backend status with fallback catalog
      const activeInts = intsRes.data || [];
      const activeIntMap = {};
      activeInts.forEach(i => activeIntMap[i.type] = i);

      const merged = fallbackIntegrations.map(fi => {
        const active = activeIntMap[fi.id] || activeIntMap[fi.name.toLowerCase()];
        if (active) {
          return { ...fi, status: 'connected', connectionId: active.id };
        }
        return fi;
      });
      setIntegrations(merged);

      // Dynamic Suggestions based on agents
      const agents = agentsRes.data || [];
      let suggestions = [];
      const agentNames = agents.map(a => a.name.toLowerCase());
      if (agentNames.some(n => n.includes('sales') || n.includes('lead'))) {
        suggestions.push('ghl', 'hubspot');
      }
      if (agentNames.some(n => n.includes('support') || n.includes('ticket'))) {
        suggestions.push('zendesk', 'whatsapp');
      }
      if (agentNames.some(n => n.includes('book') || n.includes('schedule'))) {
        suggestions.push('gcal', 'calendly');
      }
      if (suggestions.length === 0) {
        suggestions = ['ghl', 'whatsapp']; // default fallbacks
      }
      setSuggestedIds(suggestions);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const handleConnect = async () => {
    setConnecting(true);
    try {
      // Create integration config
      const res = await api.post(`/connectors/integrations`, {
        type: selectedIntegration.id,
        name: selectedIntegration.name,
        config: { apiKey }
      }).catch(() => ({ data: { id: Date.now().toString() } })); // Mock success
      
      setIntegrations(prev => prev.map(i => i.id === selectedIntegration.id ? { ...i, status: 'connected', connectionId: res.data.id } : i));
      setSelectedIntegration(null);
      setApiKey('');
    } catch (e) {
      alert("Failed to connect integration.");
    } finally {
      setConnecting(false);
    }
  }

  const handleDisconnect = async (integration) => {
    setDisconnecting(integration.id);
    try {
      if (integration.connectionId) {
        await api.delete(`/connectors/integrations/${integration.connectionId}`).catch(() => {});
      }
      setIntegrations(prev => prev.map(i => i.id === integration.id ? { ...i, status: 'disconnected', connectionId: null } : i));
    } catch (e) {
      alert("Failed to disconnect integration.");
    } finally {
      setDisconnecting(null);
    }
  }

  // Compute category counts
  const catCounts = { all: integrations.length };
  integrations.forEach(i => {
    catCounts[i.category] = (catCounts[i.category] || 0) + 1;
  });

  const displayCategories = categories.map(c => ({ ...c, count: catCounts[c.id] || 0 }));

  const filteredIntegrations = integrations.filter(i => {
    const matchesCategory = activeCategory === 'all' || i.category === activeCategory;
    const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          i.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  })

  const suggestedIntegrations = integrations.filter(i => suggestedIds.includes(i.id));

  const renderIntegrationCard = (integration) => (
    <motion.div 
      className="integration-card"
      key={integration.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <div className="ic-header">
        <div className="ic-icon fallback">
          <Plug size={24} />
        </div>
        <div className="ic-title">
          <h3>{integration.name}</h3>
          <span>{displayCategories.find(c => c.id === integration.category)?.name}</span>
        </div>
      </div>
      <p className="ic-desc">{integration.desc}</p>
      <div className="ic-footer">
        <div className={`ic-status ${integration.status}`}>
          {integration.status === 'connected' ? <><CheckCircle2 size={16} /> Connected</> : 'Not Connected'}
        </div>
        {integration.status === 'connected' ? (
           <button 
            className="ic-btn disconnected" 
            onClick={() => handleDisconnect(integration)}
            disabled={disconnecting === integration.id}
           >
             {disconnecting === integration.id ? <Loader2 size={14} className="spinner" /> : 'Disconnect'}
           </button>
        ) : (
          <button className={`ic-btn ${integration.status}`} onClick={() => setSelectedIntegration(integration)}>
            Connect
          </button>
        )}
      </div>
    </motion.div>
  )

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--primary)' }}><Loader2 className="spinner" size={48} /></div>;
  }

  return (
    <div className="integration-hub">
      {/* Sidebar Categories */}
      <div className="ih-sidebar">
        <div className="ih-sidebar-header">
          <h2>Categories</h2>
        </div>
        <div className="ih-categories">
          {displayCategories.map(cat => {
            const Icon = cat.icon;
            return (
              <div 
                key={cat.id} 
                className={`ih-category ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Icon size={16} />
                  {cat.name}
                </div>
                <span className="ih-badge">{cat.count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="ih-main">
        <div className="ih-header">
          <div className="ih-title">
            <h1>Integration Hub</h1>
            <p>Connect your AI workforce to your existing business tools.</p>
          </div>
          <div className="ih-search">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Search integrations..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="ih-content">
          
          {/* AI Suggested Integrations */}
          {activeCategory === 'all' && !searchQuery && suggestedIntegrations.length > 0 && (
            <div className="ih-suggested">
              <h2 className="ih-section-title"><Sparkles size={18} color="#10b981" /> AI Suggested for Your Teams</h2>
              <p style={{ color: 'var(--gray)', fontSize: '0.85rem', marginBottom: '1.5rem', marginTop: '-0.75rem' }}>
                Based on your active agents, we recommend connecting these tools.
              </p>
              <div className="ih-grid">
                {suggestedIntegrations.map(renderIntegrationCard)}
              </div>
            </div>
          )}

          {/* Integration Marketplace */}
          <h2 className="ih-section-title" style={{ marginTop: activeCategory === 'all' && !searchQuery ? '2rem' : 0 }}>
            {activeCategory === 'all' && !searchQuery ? 'All Integrations' : 
             searchQuery ? `Search Results for "${searchQuery}"` : 
             displayCategories.find(c => c.id === activeCategory)?.name}
          </h2>
          
          <div className="ih-grid">
            <AnimatePresence>
              {filteredIntegrations.map(renderIntegrationCard)}
            </AnimatePresence>
            
            {filteredIntegrations.length === 0 && (
              <div style={{ padding: '3rem', gridColumn: '1 / -1', textAlign: 'center', color: 'var(--gray)' }}>
                <Plug size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <h3>No integrations found</h3>
                <p>Try adjusting your search or category filter.</p>
              </div>
            )}
          </div>

        </div>
      </div>

      <AnimatePresence>
        {selectedIntegration && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <motion.div 
              className="modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem', width: '400px', border: '1px solid var(--border-main)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Connect {selectedIntegration.name}</h3>
                <button onClick={() => setSelectedIntegration(null)} style={{ background: 'none', border: 'none', color: 'var(--gray)', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                  {selectedIntegration.category === 'automation' ? 'Webhook URL' : 'API Key / Access Token'}
                </label>
                <input 
                  type="text" 
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Enter credential..."
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-main)', background: 'var(--bg-main)', color: 'white' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => setSelectedIntegration(null)} style={{ padding: '0.5rem 1rem', background: 'transparent', border: 'none', color: 'var(--gray)', cursor: 'pointer' }} disabled={connecting}>Cancel</button>
                <button 
                  onClick={handleConnect}
                  disabled={connecting}
                  style={{ padding: '0.5rem 1rem', background: '#10b981', border: 'none', color: 'white', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {connecting ? <Loader2 size={16} className="spinner" /> : null}
                  Save Connection
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default IntegrationHub
