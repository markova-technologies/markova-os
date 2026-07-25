import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { 
  Users, 
  Building2, 
  Target, 
  Calendar, 
  Search, 
  Filter, 
  Plus, 
  X,
  Phone,
  Mail,
  Sparkles,
  MessageSquare,
  Briefcase,
  Loader2
} from 'lucide-react'
import './CRM.css'

const CRM = () => {
  const [activeTab, setActiveTab] = useState('contacts')
  const [contacts, setContacts] = useState([])
  const [companies, setCompanies] = useState([
    { id: '1', name: 'Acme Corp', industry: 'Software', employees: '50-200', value: '$120,000' },
    { id: '2', name: 'Global Tech', industry: 'Manufacturing', employees: '1000+', value: '$450,000' }
  ])
  const [opportunities, setOpportunities] = useState([
    { id: '1', title: 'Enterprise AI Rollout', company: 'Acme Corp', stage: 'Negotiation', amount: '$120,000', closeDate: '2026-08-15' },
    { id: '2', title: 'Support Automation', company: 'Global Tech', stage: 'Discovery', amount: '$45,000', closeDate: '2026-09-01' }
  ])
  const [appointments, setAppointments] = useState([
    { id: '1', title: 'Technical Deep Dive', contact: 'John Doe', time: 'Tomorrow, 10:00 AM', status: 'Scheduled' },
    { id: '2', title: 'Pricing Review', contact: 'Jane Smith', time: 'Next Week, 2:00 PM', status: 'Pending' }
  ])

  const [selectedContact, setSelectedContact] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newRecordData, setNewRecordData] = useState({})

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/crm/leads`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] }));
        
        // Map backend leads to frontend format
        const mappedContacts = res.data.map(lead => ({
          id: lead.id,
          name: `${lead.first_name} ${lead.last_name}`.trim() || 'Unknown',
          company: lead.company || 'Unknown',
          email: lead.email || '',
          phone: lead.phone || '',
          status: lead.status || 'new',
          source: lead.source,
          role: lead.role,
          interest: lead.service_interest,
          message: lead.message,
          lastContact: new Date(lead.created_at).toLocaleDateString(),
        }));
        
        if (mappedContacts.length === 0) {
          mappedContacts.push({
            id: 'mock-1', name: 'Alice Walker', company: 'Acme Corp', email: 'alice@acme.com', phone: '+1 555-0192', status: 'qualified',
            source: 'Web Chat', role: 'CTO', interest: 'AI Voice Agents', message: 'Looking to automate our frontline support.', lastContact: 'Today'
          })
        }

        setContacts(mappedContacts);
        if (mappedContacts.length > 0) {
          setSelectedContact(mappedContacts[0]);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch CRM leads:', error);
        setIsLoading(false);
      }
    };
    fetchLeads();
  }, []);

  const handleAddRecord = () => {
    setIsAddModalOpen(false)
    setNewRecordData({})
    alert(`Added new ${activeTab.slice(0,-1)} successfully!`)
  }

  const renderContactsTable = () => (
    <table className="crm-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Company</th>
          <th>Status</th>
          <th>Last Contact</th>
        </tr>
      </thead>
      <tbody>
        {isLoading ? (
          <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray)' }}><Loader2 className="spinner" size={24} style={{display:'inline-block'}}/> Loading contacts...</td></tr>
        ) : contacts.length === 0 ? (
          <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray)' }}>No contacts found.</td></tr>
        ) : (
          contacts.map(c => (
            <tr key={c.id} className={`crm-row ${selectedContact?.id === c.id ? 'active' : ''}`} onClick={() => setSelectedContact(c)}>
              <td>
                <div className="crm-cell-user">
                  <div className="crm-avatar">{c.name.charAt(0).toUpperCase()}</div>
                  <div className="crm-cell-name">{c.name}</div>
                </div>
              </td>
              <td className="crm-cell-company">{c.company}</td>
              <td><span className={`crm-badge ${c.status}`}>{c.status.toUpperCase()}</span></td>
              <td style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>{c.lastContact}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  )

  const renderCompaniesTable = () => (
    <table className="crm-table">
      <thead>
        <tr>
          <th>Company Name</th>
          <th>Industry</th>
          <th>Employees</th>
          <th>Pipeline Value</th>
        </tr>
      </thead>
      <tbody>
        {companies.map(c => (
          <tr key={c.id} className="crm-row">
            <td style={{ fontWeight: 500 }}>{c.name}</td>
            <td style={{ color: 'var(--gray)' }}>{c.industry}</td>
            <td style={{ color: 'var(--gray)' }}>{c.employees}</td>
            <td style={{ color: '#10b981', fontWeight: 600 }}>{c.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  const renderOpportunitiesTable = () => (
    <table className="crm-table">
      <thead>
        <tr>
          <th>Opportunity Name</th>
          <th>Company</th>
          <th>Stage</th>
          <th>Amount</th>
          <th>Close Date</th>
        </tr>
      </thead>
      <tbody>
        {opportunities.map(o => (
          <tr key={o.id} className="crm-row">
            <td style={{ fontWeight: 500 }}>{o.title}</td>
            <td>{o.company}</td>
            <td><span className="crm-badge qualified">{o.stage}</span></td>
            <td style={{ color: '#10b981', fontWeight: 600 }}>{o.amount}</td>
            <td style={{ color: 'var(--gray)' }}>{o.closeDate}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  const renderAppointmentsTable = () => (
    <table className="crm-table">
      <thead>
        <tr>
          <th>Meeting Title</th>
          <th>Contact</th>
          <th>Time</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {appointments.map(a => (
          <tr key={a.id} className="crm-row">
            <td style={{ fontWeight: 500 }}>{a.title}</td>
            <td>{a.contact}</td>
            <td style={{ color: 'var(--gray)' }}>{a.time}</td>
            <td><span className={`crm-badge ${a.status === 'Scheduled' ? 'qualified' : 'new'}`}>{a.status}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <div className="crm-page">
      <div className="crm-header">
        <div className="crm-title-row">
          <div className="crm-title">
            <h1>Customers & CRM</h1>
            <p>Manage your Contacts, Companies, Opportunities, and AI Interaction History.</p>
          </div>
          <div className="crm-actions">
            <button className="btn btn-secondary"><Filter size={16} /> Filters</button>
            <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}><Plus size={16} /> Add {activeTab.slice(0, -1).replace(/^\w/, c => c.toUpperCase())}</button>
          </div>
        </div>
        
        <div className="crm-tabs" style={{ display: 'flex', overflowX: 'auto' }}>
          <button className={`crm-tab ${activeTab === 'contacts' ? 'active' : ''}`} onClick={() => { setActiveTab('contacts'); setSelectedContact(contacts[0]); }}><Users size={16} /> Contacts / Leads</button>
          <button className={`crm-tab ${activeTab === 'companies' ? 'active' : ''}`} onClick={() => { setActiveTab('companies'); setSelectedContact(null); }}><Building2 size={16} /> Companies</button>
          <button className={`crm-tab ${activeTab === 'opportunities' ? 'active' : ''}`} onClick={() => { setActiveTab('opportunities'); setSelectedContact(null); }}><Target size={16} /> Opportunities</button>
          <button className={`crm-tab ${activeTab === 'appointments' ? 'active' : ''}`} onClick={() => { setActiveTab('appointments'); setSelectedContact(null); }}><Calendar size={16} /> Appointments</button>
        </div>
      </div>

      <div className="crm-main">
        {/* List Area */}
        <div className="crm-list-area">
          <div className="crm-list-toolbar">
            <div className="crm-search">
              <Search size={16} />
              <input type="text" placeholder={`Search ${activeTab}...`} />
            </div>
          </div>
          
          <div className="crm-table-container">
            {activeTab === 'contacts' && renderContactsTable()}
            {activeTab === 'companies' && renderCompaniesTable()}
            {activeTab === 'opportunities' && renderOpportunitiesTable()}
            {activeTab === 'appointments' && renderAppointmentsTable()}
          </div>
        </div>

        {/* Detail Panel */}
        <AnimatePresence>
          {activeTab === 'contacts' && selectedContact && (
            <motion.div 
              className="crm-detail-panel"
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            >
              <div className="cd-header">
                <div className="cd-profile">
                  <div className="cd-avatar">{selectedContact.name.charAt(0)}</div>
                  <div className="cd-info">
                    <h2>{selectedContact.name}</h2>
                    <p>{selectedContact.company}</p>
                  </div>
                </div>
                <button className="btn-icon" onClick={() => setSelectedContact(null)}><X size={20} /></button>
              </div>

              <div className="cd-content">
                <div className="cd-section">
                  <h3>Contact Info</h3>
                  <div className="cd-grid">
                    <div className="cd-field">
                      <span className="label">Email</span>
                      <span className="val">{selectedContact.email || 'N/A'}</span>
                    </div>
                    <div className="cd-field">
                      <span className="label">Phone</span>
                      <span className="val">{selectedContact.phone || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="cd-section">
                  <h3><Sparkles size={16} color="#10b981" style={{display:'inline', verticalAlign:'text-bottom', marginRight:'0.25rem'}}/> AI Insights</h3>
                  <div className="ai-insight-box">
                    <p>
                      <strong>Source:</strong> {selectedContact.source === 'voiceflow_amharic' ? 'Amharic AI Demo' : selectedContact.source || 'Direct Import'}<br/>
                      <strong>Role:</strong> {selectedContact.role || 'N/A'} <span style={{fontSize:'0.8rem', color:'var(--gray)'}}>(Extracted)</span><br/>
                      <strong>Interest:</strong> {selectedContact.interest || 'N/A'} <span style={{fontSize:'0.8rem', color:'var(--gray)'}}>(Extracted)</span>
                    </p>
                    {selectedContact.message && (
                      <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontStyle: 'italic', borderLeft: '3px solid #10b981' }}>
                        "{selectedContact.message}"
                      </div>
                    )}
                  </div>
                </div>

                <div className="cd-section">
                  <h3>Interaction Timeline</h3>
                  <div className="cd-timeline">
                    <div className="timeline-item">
                      <div className="tl-icon" style={{ background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Phone size={14} /></div>
                      <div className="tl-content">
                        <div className="tl-time">Today, 10:45 AM</div>
                        <p className="tl-text">Inbound call handled by <strong style={{ color: '#3b82f6' }}>Sales Agent</strong>. Duration: 04:30.</p>
                      </div>
                    </div>
                    <div className="timeline-item">
                      <div className="tl-icon" style={{ background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Calendar size={14} /></div>
                      <div className="tl-content">
                        <div className="tl-time">Today, 10:50 AM</div>
                        <p className="tl-text">Demo appointment scheduled by <strong style={{ color: '#10b981' }}>Booking Agent</strong>.</p>
                      </div>
                    </div>
                    <div className="timeline-item">
                      <div className="tl-icon" style={{ background: '#8b5cf6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MessageSquare size={14} /></div>
                      <div className="tl-content">
                        <div className="tl-time">Yesterday</div>
                        <p className="tl-text">Customer opened WhatsApp marketing message sent by <strong style={{ color: '#8b5cf6' }}>Marketing Agent</strong>.</p>
                      </div>
                    </div>
                    <div className="timeline-item">
                      <div className="tl-icon" style={{ background: 'var(--gray)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={14} /></div>
                      <div className="tl-content">
                        <div className="tl-time">{selectedContact.lastContact}</div>
                        <p className="tl-text">Lead profile created in CRM via {selectedContact.source === 'voiceflow_amharic' ? 'Amharic AI Demo' : selectedContact.source || 'System'}.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div className="modal-content" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem', width: '400px', border: '1px solid var(--border-main)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Add {activeTab.slice(0, -1).replace(/^\w/, c => c.toUpperCase())}</h3>
                <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--gray)', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <input type="text" placeholder="Name or Title..." style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-main)', background: 'var(--bg-main)', color: 'white' }} />
                <input type="text" placeholder="Details..." style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-main)', background: 'var(--bg-main)', color: 'white' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => setIsAddModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'transparent', border: 'none', color: 'var(--gray)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleAddRecord} style={{ padding: '0.5rem 1rem', background: '#10b981', border: 'none', color: 'white', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>Save Record</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default CRM
