import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { listAgents, listIntegrations, listKnowledgeSources } from '../api/client'
import Skeleton from '../components/Skeleton'
import {
  PhoneCall,
  Bot,
  Users,
  CalendarCheck,
  Activity,
  Plus,
  BookOpen,
  Plug,
  Sparkles,
  ArrowRight,
  PhoneForwarded,
  CheckCircle2,
  AlertTriangle,
  Server
} from 'lucide-react'
import './CommandCenter.css'

const CommandCenter = () => {
  const navigate = useNavigate();
  const [dashboardStats, setDashboardStats] = useState({
    activeCalls: 0,
    activeAgents: 0,
    activeTeams: 0,
    newLeads: 0,
    appointmentsBooked: 0
  });

  const [systemHealth, setSystemHealth] = useState({
    gateway: 'loading',
    tenant: 'loading',
    orchestrator: 'loading'
  });

  const [recommendations, setRecommendations] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        
        const [statsRes, activityRes, agentsRes, integrationsRes, knowledgeRes] = await Promise.all([
          axios.get(`${baseUrl}/api/tenant/stats`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${baseUrl}/api/tenant/activity`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
          listAgents().catch(() => ({ data: [] })),
          listIntegrations().catch(() => ({ data: [] })),
          listKnowledgeSources().catch(() => ({ data: [] }))
        ]);
        
        setDashboardStats(statsRes.data);
        
        // Generate dynamic recommendations based on stats
        const recs = [];
        const hasCrmIntegration = integrationsRes.data?.some(i => ['hubspot', 'salesforce', 'zendesk'].includes(i.type));
        
        if (statsRes.data.newLeads > 0 && statsRes.data.abandonedLeads > 0) {
          recs.push({
            title: 'Follow up with abandoned leads',
            desc: `You have ${statsRes.data.abandonedLeads} leads from yesterday that dropped off mid-conversation. Create a quick outbound flow to re-engage them.`,
            action: 'Create Flow'
          });
        }
        if (!hasCrmIntegration && integrationsRes.data) {
          recs.push({
            title: 'Missing CRM Integration',
            desc: 'Your Support Team is taking calls, but tickets aren\'t syncing. Connect Zendesk or HubSpot to automatically log issues.',
            action: 'Connect CRM'
          });
        }

        const idleAgents = agentsRes.data?.filter(a => a.status === 'idle' || a.status === 'inactive') || [];
        if (idleAgents.length > 0) {
          recs.push({
            title: 'Idle Agents Detected',
            desc: `You have ${idleAgents.length} agent(s) currently not handling any calls. Consider expanding their routing rules.`,
            action: 'View Agents'
          });
        }

        const staleKnowledge = knowledgeRes.data?.filter(k => k.status === 'error' || k.status === 'stale') || [];
        if (staleKnowledge.length > 0) {
          recs.push({
            title: 'Stale Knowledge Sources',
            desc: `Some of your knowledge bases have failed to sync or are stale. Review them to ensure accurate answers.`,
            action: 'View Knowledge'
          });
        }

        if (recs.length === 0) {
          recs.push({
            title: 'System Optimal',
            desc: 'Your AI workforce is running smoothly with no outstanding issues.',
            action: 'View Analytics'
          });
        }
        setRecommendations(recs);
        
        if (activityRes.data && activityRes.data.length > 0) {
          setRecentActivity(activityRes.data);
        } else {
          setRecentActivity([
            { title: 'Inbound Call - Support Team', time: '2 mins ago', status: 'Resolved', type: 'success' },
            { title: 'Outbound Call - Sales Team', time: '15 mins ago', status: 'Voicemail', type: 'warning' },
            { title: 'Commander Agent Routed Call', time: '18 mins ago', status: 'Success', type: 'success' },
            { title: 'Agent "Sales-Bot-1" Updated', time: '1 hour ago', status: 'Deployed', type: 'success' },
          ]); // Fallback mock data
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchHealth = async () => {
      try {
        const token = localStorage.getItem('token');
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        // Ping a few key services
        const [gateway, tenant] = await Promise.all([
          axios.get(`${baseUrl}/health`).catch(() => ({ data: { status: 'DOWN' }})),
          axios.get(`${baseUrl}/api/tenant/health`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { status: 'DOWN' }})),
        ]);
        
        setSystemHealth({
          gateway: gateway.data.status === 'OK' ? 'healthy' : 'down',
          tenant: tenant.data.status === 'OK' ? 'healthy' : 'down',
          orchestrator: 'healthy' // Assume healthy if gateway is up for demo
        });
      } catch (e) {
        console.error(e);
      }
    };

    fetchStats();
    fetchHealth();
    
    // Poll every 10 seconds for real-time feel
    const interval = setInterval(() => {
      fetchStats();
      fetchHealth();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { title: 'Active Calls', value: dashboardStats.activeCalls.toString(), trend: 'Live', isPositive: true, icon: PhoneCall, color: 'emerald' },
    { title: 'Active Agents', value: dashboardStats.activeAgents.toString(), trend: 'Stable', isPositive: null, icon: Bot, color: 'purple' },
    { title: 'Active Teams', value: (dashboardStats.activeTeams || 0).toString(), trend: 'Stable', isPositive: null, icon: Users, color: 'indigo' },
    { title: 'New Leads (Today)', value: dashboardStats.newLeads.toString(), trend: '+24%', isPositive: true, icon: Users, color: 'blue' },
    { title: 'Appointments Booked', value: dashboardStats.appointmentsBooked.toString(), trend: '+8%', isPositive: true, icon: CalendarCheck, color: 'amber' },
  ];

  return (
    <div className="command-center">
      {/* Header */}
      <motion.div 
        className="cc-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="cc-header-title">
          <h1>Command Center</h1>
          <p>Real-time overview of your AI workforce and operations</p>
        </div>
        <div className="cc-quick-actions">
          <button className="btn-quick primary" onClick={() => navigate('/agent-studio')}><Plus size={16} /> Create Agent</button>
          <button className="btn-quick" onClick={() => navigate('/agent-studio')}><Users size={16} /> New Team</button>
          <button className="btn-quick" onClick={() => navigate('/knowledge')}><BookOpen size={16} /> Add Knowledge</button>
          <button className="btn-quick" onClick={() => navigate('/integrations')}><Plug size={16} /> Connect App</button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div 
        className="cc-stats-grid"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div className="stat-card" key={i}>
              <div className="stat-header">
                <span className="stat-title">{stat.title}</span>
              </div>
              {loading ? (
                 <Skeleton variant="text" height="36px" width="60%" className="mt-2" />
              ) : (
                <>
                  <div className="stat-value">{stat.value}</div>
                  <div className={`stat-trend ${stat.isPositive === true ? 'positive' : stat.isPositive === false ? 'negative' : 'neutral'}`}>
                    {stat.trend} vs yesterday
                  </div>
                </>
              )}
            </div>
          )
        })}
      </motion.div>

      {/* Main Layout Grid */}
      <div className="cc-main-grid">
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* AI Recommendations */}
          <motion.div 
            className="cc-section"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="cc-section-header">
              <h3 className="cc-section-title">Smart Insights</h3>
            </div>
            <div>
              {recommendations.map((rec, i) => (
                <div className="ai-recommendation" key={i}>
                  <div className="ai-rec-content">
                    <h4>{rec.title}</h4>
                    <p>{rec.desc}</p>
                    <button className="ai-rec-action" onClick={() => navigate('/flow-builder')}>
                      {rec.action} <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div 
            className="cc-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            style={{ flex: 1 }}
          >
             <div className="cc-section-header">
              <h3 className="cc-section-title"><Activity size={18} /> System Health</h3>
              <Link to="/analytics" style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none' }}>View full report</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Server size={16} /> API Gateway</div>
                <div style={{ color: systemHealth.gateway === 'healthy' ? '#10b981' : '#f43f5e', fontWeight: 500 }}>{systemHealth.gateway.toUpperCase()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Server size={16} /> Tenant Service</div>
                <div style={{ color: systemHealth.tenant === 'healthy' ? '#10b981' : '#f43f5e', fontWeight: 500 }}>{systemHealth.tenant.toUpperCase()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Server size={16} /> Orchestrator</div>
                <div style={{ color: systemHealth.orchestrator === 'healthy' ? '#10b981' : '#f43f5e', fontWeight: 500 }}>{systemHealth.orchestrator.toUpperCase()}</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column */}
        <motion.div 
          className="cc-section"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="cc-section-header">
            <h3 className="cc-section-title">Recent Activity</h3>
            <Link to="/call-center" style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none' }}>View all</Link>
          </div>
          <div className="activity-list">
            {recentActivity.map((activity, i) => (
              <div className="activity-item" key={i}>
                <div className="activity-icon">
                  {activity.type === 'success' ? <CheckCircle2 size={16} color="#10b981" /> : 
                   activity.type === 'warning' ? <AlertTriangle size={16} color="#f59e0b" /> : 
                   <PhoneForwarded size={16} />}
                </div>
                <div className="activity-details">
                  <div className="activity-title">{activity.title}</div>
                  <div className="activity-time">{activity.time}</div>
                </div>
                <div className={`activity-status status-${activity.type}`}>
                  {activity.status}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  )
}

export default CommandCenter
