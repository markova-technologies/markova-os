import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  PhoneCall,
  ShieldAlert,
  Search,
  CheckCheck,
  Trash2,
  ChevronRight
} from 'lucide-react'
import { ROUTES } from '../config/site'
import './Notifications.css'

const initialNotifications = [
  {
    id: 1,
    category: 'Calls & AI',
    title: 'High Volume Escalation',
    message: 'AI Inbound Sales Agent handled 120 calls in the past hour with 98.4% resolution rate.',
    time: '5 minutes ago',
    unread: true,
    severity: 'info',
    path: ROUTES.callCenter
  },
  {
    id: 2,
    category: 'Governance',
    title: 'High-Risk Action Awaiting Approval',
    message: 'Billing Specialist requested approval to issue a $45.00 refund for Order #1029.',
    time: '18 minutes ago',
    unread: true,
    severity: 'warning',
    path: ROUTES.governance
  },
  {
    id: 3,
    category: 'Security',
    title: 'New API Key Provisioned',
    message: 'Prod-Voice-Gateway key created by admin user@company.com.',
    time: '1 hour ago',
    unread: true,
    severity: 'info',
    path: ROUTES.keys
  },
  {
    id: 4,
    category: 'System',
    title: 'Knowledge Base Vector Index Updated',
    message: 'Document "Q3 Customer Support FAQs.pdf" re-indexed into vector memory successfully.',
    time: '3 hours ago',
    unread: false,
    severity: 'info',
    path: ROUTES.knowledge
  },
  {
    id: 5,
    category: 'Calls & AI',
    title: 'Call Sentiment Alert',
    message: 'Negative sentiment spike detected on Telephony Trunk #2 (3 consecutive customer hangups).',
    time: '5 hours ago',
    unread: false,
    severity: 'warning',
    path: ROUTES.analytics
  },
  {
    id: 6,
    category: 'Governance',
    title: 'Hallucination Check Passed',
    message: 'Automated evaluation verified zero hallucinations on 450 customer query responses today.',
    time: '12 hours ago',
    unread: false,
    severity: 'info',
    path: ROUTES.governance
  },
  {
    id: 7,
    category: 'System',
    title: 'Monthly Usage Threshold Notice',
    message: 'You have consumed 75% of your included voice synthesis minutes for this billing cycle.',
    time: '1 day ago',
    unread: false,
    severity: 'info',
    path: ROUTES.usage
  }
]

const Notifications = () => {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState(initialNotifications)
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  const categories = ['All', 'Unread', 'Calls & AI', 'Governance', 'Security', 'System']

  const handleMarkAsRead = (id) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, unread: false } : n))
    )
  }

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })))
  }

  const handleClearAll = () => {
    setNotifications([])
  }

  const filteredNotifications = notifications.filter(n => {
    const matchesCategory =
      activeCategory === 'All'
        ? true
        : activeCategory === 'Unread'
        ? n.unread
        : n.category === activeCategory

    const matchesSearch =
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesCategory && matchesSearch
  })

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Calls & AI':
        return <PhoneCall size={18} className="icon-blue" />
      case 'Governance':
        return <AlertTriangle size={18} className="icon-amber" />
      case 'Security':
        return <ShieldAlert size={18} className="icon-purple" />
      case 'System':
      default:
        return <CheckCircle2 size={18} className="icon-green" />
    }
  }

  const unreadCount = notifications.filter(n => n.unread).length

  return (
    <div className="notifications-page">
      {/* Page Header */}
      <div className="notifications-page-header">
        <div>
          <div className="title-row">
            <h1>Notification Center</h1>
            {unreadCount > 0 && (
              <span className="unread-badge-pill">{unreadCount} Unread</span>
            )}
          </div>
          <p className="subtitle">
            System alerts, AI governance approvals, telephony updates, and audit notifications.
          </p>
        </div>

        <div className="header-actions-group">
          {unreadCount > 0 && (
            <button className="glass-btn primary" onClick={handleMarkAllRead}>
              <CheckCheck size={16} /> Mark All as Read
            </button>
          )}
          {notifications.length > 0 && (
            <button className="glass-btn danger" onClick={handleClearAll}>
              <Trash2 size={16} /> Clear History
            </button>
          )}
        </div>
      </div>

      {/* Control Bar: Search & Filter Tabs */}
      <div className="controls-card">
        <div className="search-bar-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Filter notifications by keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-tabs">
          {categories.map(cat => (
            <button
              key={cat}
              className={`filter-tab ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
              {cat === 'Unread' && unreadCount > 0 && (
                <span className="tab-badge">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="notifications-container">
        {filteredNotifications.length === 0 ? (
          <div className="empty-notifications-state">
            <Bell size={48} className="empty-icon" />
            <h3>No Notifications Found</h3>
            <p>You're all caught up! There are no alerts matching your current filter.</p>
          </div>
        ) : (
          <div className="notifications-grid">
            {filteredNotifications.map(n => (
              <div
                key={n.id}
                className={`notification-card ${n.unread ? 'is-unread' : ''}`}
                onClick={() => {
                  handleMarkAsRead(n.id)
                  if (n.path) navigate(n.path)
                }}
              >
                <div className="card-left-icon">
                  {getCategoryIcon(n.category)}
                </div>

                <div className="card-main-content">
                  <div className="card-top-meta">
                    <span className={`category-tag ${n.category.toLowerCase().replace(/[^a-z]/g, '')}`}>
                      {n.category}
                    </span>
                    <span className="time-tag">{n.time}</span>
                  </div>

                  <h3 className="notification-title">{n.title}</h3>
                  <p className="notification-desc">{n.message}</p>
                </div>

                <div className="card-right-action">
                  {n.unread && <span className="unread-dot" title="Unread" />}
                  <ChevronRight size={18} className="arrow-icon" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Notifications
