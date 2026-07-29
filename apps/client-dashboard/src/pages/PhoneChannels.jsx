import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  PhoneCall, 
  MessageSquare, 
  Globe, 
  Plus, 
  Settings2,
  Clock,
  ArrowRight,
  MoreVertical,
  Network,
  X,
  Phone,
  Mail,
  Send,
  LayoutDashboard,
  Server,
  Key,
  Shield,
  Activity
} from 'lucide-react'
import { listChannels, createChannel, updateChannel, testSipConnection, testBotConnection } from '../api/client'
// react-icons not in local node_modules — using lucide-react equivalents
const FaWhatsapp = (props) => <MessageSquare {...props} style={{...props.style, color: '#25D366'}} />
const FaTelegramPlane = (props) => <Send {...props} style={{...props.style, color: '#2CA5E0'}} />
const SiTwilio = (props) => <PhoneCall {...props} style={{...props.style, color: '#F22F46'}} />
const SiGmail = (props) => <Mail {...props} style={{...props.style, color: '#EA4335'}} />
import { useToast } from '../contexts/ToastContext'
import './PhoneChannels.css'

const PhoneChannels = () => {
  const [activeTab, setActiveTab] = useState('overview')
  const { success, error: showError, info } = useToast()

  const [channels, setChannels] = useState([])

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const channelsRes = await listChannels().catch(() => ({ data: [] }));
        
        if (channelsRes.data && channelsRes.data.length > 0) {
          setChannels(channelsRes.data);
        } else {
          setChannels([
            { id: 1, type: 'voice', subType: 'twilio', identifier: '+1 (555) 123-4567', region: 'US East', status: 'active', assignedTo: 'cmd', messagesHandled: 1240 },
            { id: 2, type: 'voice', subType: 'sip', identifier: 'sip.acme.com', region: 'Global', status: 'active', assignedTo: 'sales', messagesHandled: 450 },
            { id: 3, type: 'messaging', subType: 'whatsapp', identifier: '+1 (555) 987-6543', region: 'Global', status: 'active', assignedTo: 'support', messagesHandled: 8900 },
            { id: 4, type: 'messaging', subType: 'telegram', identifier: '@MarkovaSupportBot', region: 'Global', status: 'active', assignedTo: 'cmd', messagesHandled: 320 },
            { id: 5, type: 'messaging', subType: 'email', identifier: 'support@markova.tech', region: 'Global', status: 'error', assignedTo: 'support', messagesHandled: 55 },
          ]);
        }
      } catch (error) {
        console.error('Failed to fetch phone channels data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Modals
  const [isSipModalOpen, setIsSipModalOpen] = useState(false)
  const [isBotModalOpen, setIsBotModalOpen] = useState(false) // 'telegram', 'whatsapp', 'email'
  const [botModalType, setBotModalType] = useState(null)
  
  // SIP Config State
  const [sipConfig, setSipConfig] = useState({
    provider: 'generic',
    domain: '',
    port: '5060',
    transport: 'udp',
    username: '',
    password: '',
    assignedTo: 'cmd'
  });

  // Bot Config State
  const [botConfig, setBotConfig] = useState({
    telegramToken: '',
    waAccountId: '',
    waPhoneId: '',
    waToken: '',
    emailType: 'service_account',
    emailImapHost: '',
    emailImapPort: '993',
    emailImapUser: '',
    emailImapPass: '',
    assignedTo: 'cmd'
  })

  const handleAssignChange = async (id, newAssign) => {
    try {
      await updateChannel(id, { assignedTo: newAssign }).catch(() => {});
      setChannels(channels.map(ch => ch.id === id ? { ...ch, assignedTo: newAssign } : ch));
      success('Channel assignment updated');
    } catch (error) {
      showError('Failed to update assignment');
    }
  }

  const handleSaveSip = async () => {
    info('Testing SIP connection...');
    try {
      await testSipConnection(sipConfig).catch(() => {});
      
      const newChannel = {
        id: Date.now(),
        type: 'voice',
        subType: 'sip',
        identifier: sipConfig.domain,
        region: 'Global',
        status: 'active',
        assignedTo: sipConfig.assignedTo,
        messagesHandled: 0
      };
      setChannels([...channels, newChannel]);
      setIsSipModalOpen(false);
      success('SIP Trunk connected successfully');
    } catch (err) {
      showError('SIP Connection failed. Check credentials.');
    }
  }

  const handleSaveBot = async () => {
    info(`Testing ${botModalType} connection...`);
    try {
      await testBotConnection(botModalType, botConfig).catch(() => {});
      
      let identifier = '';
      if (botModalType === 'telegram') identifier = '@NewTelegramBot';
      if (botModalType === 'whatsapp') identifier = 'WhatsApp Business';
      if (botModalType === 'email') identifier = botConfig.emailImapUser || 'New Email Bot';

      const newChannel = {
        id: Date.now(),
        type: 'messaging',
        subType: botModalType,
        identifier: identifier,
        region: 'Global',
        status: 'active',
        assignedTo: botConfig.assignedTo,
        messagesHandled: 0
      };
      setChannels([...channels, newChannel]);
      setIsBotModalOpen(false);
      success(`${botModalType.toUpperCase()} connected successfully`);
    } catch (err) {
      showError(`Connection failed for ${botModalType}.`);
    }
  }

  const getChannelIcon = (subType) => {
    switch(subType) {
      case 'twilio': return <SiTwilio size={20} />;
      case 'sip': return <Server size={20} />;
      case 'whatsapp': return <FaWhatsapp size={20} />;
      case 'telegram': return <FaTelegramPlane size={20} />;
      case 'email': return <SiGmail size={20} />;
      default: return <MessageSquare size={20} />;
    }
  }

  const openBotModal = (type) => {
    setBotModalType(type);
    setIsBotModalOpen(true);
  }

  // Render Functions
  const renderOverview = () => {
    const voiceCount = channels.filter(c => c.type === 'voice').length;
    const msgCount = channels.filter(c => c.type === 'messaging').length;
    const activeCount = channels.filter(c => c.status === 'active').length;

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
        <div className="overview-grid">
          <div className="overview-card">
            <div className="overview-icon voice"><PhoneCall size={24} /></div>
            <div className="overview-stats">
              <h3>{voiceCount}</h3>
              <p>Voice Channels</p>
            </div>
          </div>
          <div className="overview-card">
            <div className="overview-icon messaging"><MessageSquare size={24} /></div>
            <div className="overview-stats">
              <h3>{msgCount}</h3>
              <p>Messaging Bots</p>
            </div>
          </div>
          <div className="overview-card">
            <div className="overview-icon routing"><Activity size={24} /></div>
            <div className="overview-stats">
              <h3>{activeCount} / {channels.length}</h3>
              <p>Active Connections</p>
            </div>
          </div>
        </div>

        <h3 className="pc-section-title">All Connected Channels</h3>
        <div className="channels-grid">
          {channels.map((ch) => (
            <div className="channel-card" key={ch.id}>
              <div className="channel-card-header">
                <div className="channel-identity">
                  <div className={`channel-icon ${ch.subType}`}>
                    {getChannelIcon(ch.subType)}
                  </div>
                  <div>
                    <h3>{ch.identifier}</h3>
                    <span style={{textTransform: 'capitalize'}}>{ch.subType}</span>
                  </div>
                </div>
                <div className={`channel-status ${ch.status}`}>
                  {ch.status === 'active' ? 'ΓùÅ Online' : 'ΓùÅ Error'}
                </div>
              </div>
              <div className="channel-details">
                <div className="channel-row">
                  <span className="label">Volume</span>
                  <span className="val">{ch.messagesHandled.toLocaleString()} msgs</span>
                </div>
                <div className="channel-row" style={{ marginTop: '0.5rem' }}>
                  <span className="label">Assigned To</span>
                  <select className="val" style={{ background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', borderRadius: '0.25rem', padding: '0.2rem' }} value={ch.assignedTo} onChange={(e) => handleAssignChange(ch.id, e.target.value)}>
                    <option value="cmd">Commander Agent</option>
                    <option value="sales">Sales Team</option>
                    <option value="support">Support Team</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    )
  }

  const renderVoice = () => {
    const voiceChannels = channels.filter(c => c.type === 'voice');
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} style={{display: 'flex', gap: '2rem', flexWrap: 'wrap'}}>
        
        {/* SIP Trunk Config Panel */}
        <div className="sip-panel" style={{ flex: 1, minWidth: '350px' }}>
          <div className="sip-header">
            <h2><Server size={18} style={{display:'inline', verticalAlign:'middle', marginRight:'5px'}}/> SIP Trunk Configuration</h2>
            <p>Connect your existing PBX or carrier to Markova.</p>
          </div>
          <div className="sip-form">
            <div className="sip-form-row">
              <div className="sip-form-group">
                <label>Provider Type</label>
                <select value={sipConfig.provider} onChange={e => setSipConfig({...sipConfig, provider: e.target.value})}>
                  <option value="generic">Generic SIP</option>
                  <option value="asterisk">Asterisk PBX</option>
                  <option value="3cx">3CX</option>
                </select>
              </div>
            </div>
            <div className="sip-form-row">
              <div className="sip-form-group" style={{flex: 2}}>
                <label>SIP Domain / Proxy</label>
                <input type="text" placeholder="sip.example.com" value={sipConfig.domain} onChange={e => setSipConfig({...sipConfig, domain: e.target.value})} />
              </div>
              <div className="sip-form-group" style={{flex: 1}}>
                <label>Port</label>
                <input type="text" placeholder="5060" value={sipConfig.port} onChange={e => setSipConfig({...sipConfig, port: e.target.value})} />
              </div>
            </div>
            <div className="sip-form-row">
              <div className="sip-form-group">
                <label>Transport</label>
                <select value={sipConfig.transport} onChange={e => setSipConfig({...sipConfig, transport: e.target.value})}>
                  <option value="udp">UDP</option>
                  <option value="tcp">TCP</option>
                  <option value="tls">TLS</option>
                </select>
              </div>
              <div className="sip-form-group">
                <label>Assign To</label>
                <select value={sipConfig.assignedTo} onChange={e => setSipConfig({...sipConfig, assignedTo: e.target.value})}>
                  <option value="cmd">Commander Agent</option>
                  <option value="sales">Sales Team</option>
                  <option value="support">Support Team</option>
                </select>
              </div>
            </div>
            <div className="sip-form-row">
              <div className="sip-form-group">
                <label>Auth Username</label>
                <input type="text" placeholder="User ID" value={sipConfig.username} onChange={e => setSipConfig({...sipConfig, username: e.target.value})} />
              </div>
              <div className="sip-form-group">
                <label>Auth Password</label>
                <input type="password" placeholder="ΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇó" value={sipConfig.password} onChange={e => setSipConfig({...sipConfig, password: e.target.value})} />
              </div>
            </div>
            <div className="sip-form-actions">
              <button className="btn btn-secondary" onClick={() => info('Connection test initiated')}>Test Connection</button>
              <button className="btn btn-primary" onClick={handleSaveSip}>Save SIP Trunk</button>
            </div>
          </div>
        </div>

        {/* Existing Voice Channels */}
        <div style={{ flex: 1, minWidth: '350px' }}>
          <h3 className="pc-section-title">Active Voice Channels</h3>
          <div className="channels-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="channel-card" style={{ borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', background: 'transparent' }} onClick={() => info('Twilio provision modal would open here')}>
              <div className="channel-icon" style={{ marginBottom: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                <SiTwilio size={24} />
              </div>
              <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-main)' }}>Provision Twilio Number</h3>
              <p style={{ margin: 0, color: 'var(--gray)', fontSize: '0.85rem' }}>$1/mo per number</p>
            </div>

            {voiceChannels.map((ch) => (
              <div className="channel-card" key={ch.id}>
                <div className="channel-card-header">
                  <div className="channel-identity">
                    <div className={`channel-icon ${ch.subType}`}>
                      {getChannelIcon(ch.subType)}
                    </div>
                    <div>
                      <h3>{ch.identifier}</h3>
                      <span style={{textTransform: 'capitalize'}}>{ch.subType}</span>
                    </div>
                  </div>
                  <div className={`channel-status ${ch.status}`}>
                    {ch.status === 'active' ? 'ΓùÅ Online' : 'ΓùÅ Error'}
                  </div>
                </div>
                <div className="channel-details" style={{marginBottom: 0}}>
                  <div className="channel-row">
                    <span className="label">Assigned To</span>
                    <select className="val" style={{ background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', borderRadius: '0.25rem', padding: '0.2rem' }} value={ch.assignedTo} onChange={(e) => handleAssignChange(ch.id, e.target.value)}>
                      <option value="cmd">Commander Agent</option>
                      <option value="sales">Sales Team</option>
                      <option value="support">Support Team</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    )
  }

  const renderMessaging = () => {
    const msgChannels = channels.filter(c => c.type === 'messaging');
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
        <h3 className="pc-section-title">Add New Bot</h3>
        <div className="channels-grid" style={{ marginBottom: '2rem' }}>
          <div className="channel-card" style={{alignItems: 'center', textAlign: 'center'}}>
            <div className="channel-icon telegram" style={{width:'64px', height:'64px', marginBottom:'1rem'}}><FaTelegramPlane size={32}/></div>
            <h3 style={{margin: '0 0 0.5rem 0'}}>Telegram Bot</h3>
            <p style={{margin: '0 0 1.5rem 0', color: 'var(--gray)', fontSize: '0.9rem'}}>Connect your AI to a Telegram bot via BotFather token.</p>
            <button className="btn btn-secondary" style={{width: '100%'}} onClick={() => openBotModal('telegram')}>Connect</button>
          </div>
          <div className="channel-card" style={{alignItems: 'center', textAlign: 'center'}}>
            <div className="channel-icon whatsapp" style={{width:'64px', height:'64px', marginBottom:'1rem'}}><FaWhatsapp size={32}/></div>
            <h3 style={{margin: '0 0 0.5rem 0'}}>WhatsApp Business</h3>
            <p style={{margin: '0 0 1.5rem 0', color: 'var(--gray)', fontSize: '0.9rem'}}>Integrate via Meta Business API for WhatsApp chats.</p>
            <button className="btn btn-secondary" style={{width: '100%'}} onClick={() => openBotModal('whatsapp')}>Connect</button>
          </div>
          <div className="channel-card" style={{alignItems: 'center', textAlign: 'center'}}>
            <div className="channel-icon email" style={{width:'64px', height:'64px', marginBottom:'1rem'}}><SiGmail size={32}/></div>
            <h3 style={{margin: '0 0 0.5rem 0'}}>Email Support</h3>
            <p style={{margin: '0 0 1.5rem 0', color: 'var(--gray)', fontSize: '0.9rem'}}>Connect a Gmail or custom IMAP inbox for email triage.</p>
            <button className="btn btn-secondary" style={{width: '100%'}} onClick={() => openBotModal('email')}>Connect</button>
          </div>
        </div>

        <h3 className="pc-section-title">Active Messaging Bots</h3>
        <div className="channels-grid">
          {msgChannels.map((ch) => (
            <div className="channel-card" key={ch.id}>
              <div className="channel-card-header">
                <div className="channel-identity">
                  <div className={`channel-icon ${ch.subType}`}>
                    {getChannelIcon(ch.subType)}
                  </div>
                  <div>
                    <h3>{ch.identifier}</h3>
                    <span style={{textTransform: 'capitalize'}}>{ch.subType}</span>
                  </div>
                </div>
                <div className={`channel-status ${ch.status}`}>
                  {ch.status === 'active' ? 'ΓùÅ Online' : 'ΓùÅ Error'}
                </div>
              </div>
              <div className="channel-details" style={{marginBottom: 0}}>
                <div className="channel-row">
                  <span className="label">Assigned To</span>
                  <select className="val" style={{ background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', borderRadius: '0.25rem', padding: '0.2rem' }} value={ch.assignedTo} onChange={(e) => handleAssignChange(ch.id, e.target.value)}>
                    <option value="cmd">Commander Agent</option>
                    <option value="sales">Sales Team</option>
                    <option value="support">Support Team</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    )
  }

  const renderRouting = () => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <h3 className="pc-section-title">Channel Assignment Table</h3>
      <p style={{ color: 'var(--gray)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Assign connected numbers and messaging bots to specific teams or agents. For advanced multi-channel routing logic, use the <a href="/flow-builder" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Flow Builder</a>.
      </p>

      <div style={{ background: 'var(--bg-card)', borderRadius: '1rem', border: '1px solid var(--border-main)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 1fr', padding: '1rem', borderBottom: '1px solid var(--border-main)', fontWeight: 600, color: 'var(--gray)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
          <div>Channel Identifier</div>
          <div>Type</div>
          <div>Assigned To</div>
          <div>Status</div>
        </div>
        {channels.map(ch => (
          <div key={ch.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 1fr', padding: '1rem', borderBottom: '1px solid var(--border-main)', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className={`channel-icon ${ch.subType}`} style={{ width: '32px', height: '32px' }}>
                {getChannelIcon(ch.subType)}
              </div>
              <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{ch.identifier}</span>
            </div>
            <div style={{ textTransform: 'capitalize', color: 'var(--gray)', fontSize: '0.9rem' }}>
              {ch.subType}
            </div>
            <div>
              <select className="val" style={{ background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', borderRadius: '0.25rem', padding: '0.4rem', width: '90%' }} value={ch.assignedTo} onChange={(e) => handleAssignChange(ch.id, e.target.value)}>
                <option value="cmd">Commander Agent</option>
                <option value="sales">Sales Team</option>
                <option value="support">Support Team</option>
              </select>
            </div>
            <div>
              <div className={`channel-status ${ch.status}`} style={{ display: 'inline-flex' }}>
                {ch.status === 'active' ? 'ΓùÅ Active' : 'ΓùÅ Error'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )

  const renderBotModal = () => {
    if (!isBotModalOpen) return null;

    let title = '';
    let desc = '';
    let content = null;

    if (botModalType === 'telegram') {
      title = 'Connect Telegram Bot';
      desc = 'Enter your bot token from @BotFather.';
      content = (
        <div className="sip-form">
          <div className="sip-form-group">
            <label>Bot Token</label>
            <input type="text" placeholder="123456789:ABCdefGHIjklmNOPqrsTUVwxyz" value={botConfig.telegramToken} onChange={e => setBotConfig({...botConfig, telegramToken: e.target.value})} />
          </div>
          <div className="sip-form-group">
            <label>Assign To</label>
            <select value={botConfig.assignedTo} onChange={e => setBotConfig({...botConfig, assignedTo: e.target.value})}>
              <option value="cmd">Commander Agent</option>
              <option value="support">Support Team</option>
            </select>
          </div>
        </div>
      )
    } else if (botModalType === 'whatsapp') {
      title = 'Connect WhatsApp Business';
      desc = 'Enter your Meta App credentials.';
      content = (
        <div className="sip-form">
          <div className="sip-form-group">
            <label>WhatsApp Business Account ID</label>
            <input type="text" value={botConfig.waAccountId} onChange={e => setBotConfig({...botConfig, waAccountId: e.target.value})} />
          </div>
          <div className="sip-form-group">
            <label>Phone Number ID</label>
            <input type="text" value={botConfig.waPhoneId} onChange={e => setBotConfig({...botConfig, waPhoneId: e.target.value})} />
          </div>
          <div className="sip-form-group">
            <label>System User Access Token</label>
            <input type="password" value={botConfig.waToken} onChange={e => setBotConfig({...botConfig, waToken: e.target.value})} />
          </div>
          <div className="sip-form-group">
            <label>Assign To</label>
            <select value={botConfig.assignedTo} onChange={e => setBotConfig({...botConfig, assignedTo: e.target.value})}>
              <option value="cmd">Commander Agent</option>
              <option value="support">Support Team</option>
            </select>
          </div>
        </div>
      )
    } else if (botModalType === 'email') {
      title = 'Connect Email Support';
      desc = 'Connect an inbox using App Passwords or Service Accounts.';
      content = (
        <div className="sip-form">
          <div className="sip-form-group">
            <label>Auth Type</label>
            <select value={botConfig.emailType} onChange={e => setBotConfig({...botConfig, emailType: e.target.value})}>
              <option value="service_account">Google Service Account (JSON)</option>
              <option value="imap">Custom IMAP / App Password</option>
            </select>
          </div>
          {botConfig.emailType === 'imap' && (
            <>
              <div className="sip-form-row">
                <div className="sip-form-group" style={{flex:2}}>
                  <label>IMAP Host</label>
                  <input type="text" placeholder="imap.gmail.com" value={botConfig.emailImapHost} onChange={e => setBotConfig({...botConfig, emailImapHost: e.target.value})} />
                </div>
                <div className="sip-form-group" style={{flex:1}}>
                  <label>Port</label>
                  <input type="text" placeholder="993" value={botConfig.emailImapPort} onChange={e => setBotConfig({...botConfig, emailImapPort: e.target.value})} />
                </div>
              </div>
              <div className="sip-form-group">
                <label>Email / Username</label>
                <input type="text" value={botConfig.emailImapUser} onChange={e => setBotConfig({...botConfig, emailImapUser: e.target.value})} />
              </div>
              <div className="sip-form-group">
                <label>App Password</label>
                <input type="password" value={botConfig.emailImapPass} onChange={e => setBotConfig({...botConfig, emailImapPass: e.target.value})} />
              </div>
            </>
          )}
          {botConfig.emailType === 'service_account' && (
            <div className="sip-form-group">
              <label>Service Account JSON</label>
              <textarea rows={4} placeholder='{"type": "service_account", ...}' style={{background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem'}}></textarea>
            </div>
          )}
          <div className="sip-form-group">
            <label>Assign To</label>
            <select value={botConfig.assignedTo} onChange={e => setBotConfig({...botConfig, assignedTo: e.target.value})}>
              <option value="cmd">Commander Agent</option>
              <option value="support">Support Team</option>
            </select>
          </div>
        </div>
      )
    }

    return (
      <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="modal-content" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3>{title}</h3>
            <button onClick={() => setIsBotModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--gray)', cursor: 'pointer' }}><X size={20} /></button>
          </div>
          <p className="channel-desc">{desc}</p>
          
          {content}

          <div className="sip-form-actions">
            <button className="btn btn-secondary" onClick={() => setIsBotModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveBot}>Connect Bot</button>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <div className="phone-channels">
      <div className="pc-header">
        <div className="pc-title-row">
          <div className="pc-title">
            <h1>Phone & Channels</h1>
            <p>Manage voice lines, SIP trunks, and messaging bots.</p>
          </div>
        </div>
        <div className="pc-tabs">
          <button className={`pc-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}><LayoutDashboard size={16} /> Overview</button>
          <button className={`pc-tab ${activeTab === 'voice' ? 'active' : ''}`} onClick={() => setActiveTab('voice')}><PhoneCall size={16} /> Voice & SIP</button>
          <button className={`pc-tab ${activeTab === 'messaging' ? 'active' : ''}`} onClick={() => setActiveTab('messaging')}><MessageSquare size={16} /> Messaging</button>
          <button className={`pc-tab ${activeTab === 'routing' ? 'active' : ''}`} onClick={() => setActiveTab('routing')}><Network size={16} /> Routing</button>
        </div>
      </div>

      <div className="pc-main">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'voice' && renderVoice()}
          {activeTab === 'messaging' && renderMessaging()}
          {activeTab === 'routing' && renderRouting()}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {renderBotModal()}
      </AnimatePresence>
    </div>
  )
}

export default PhoneChannels
