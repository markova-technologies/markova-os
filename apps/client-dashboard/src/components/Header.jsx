import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  Search,
  User,
  ChevronDown,
  LogOut,
  Settings,
  CreditCard,
  Menu
} from 'lucide-react'
import './Header.css'
import { ROUTES } from '../config/site'

const Header = ({ user, onLogout, toggleMobileMenu }) => {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const notificationsRef = useRef(null)
  const userMenuRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    if (showNotifications || showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications, showUserMenu]);

  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: 'New Call Completed',
      message: 'AI Agent handled a customer call successfully',
      time: '2 min ago',
      unread: true,
      path: ROUTES.callCenter
    },
    {
      id: 2,
      title: 'Monthly Report Ready',
      message: 'Your analytics report is now available',
      time: '1 hour ago',
      unread: true,
      path: ROUTES.analytics
    },
    {
      id: 3,
      title: 'System Update',
      message: 'Maintenance completed successfully',
      time: '5 hours ago',
      unread: false,
      path: ROUTES.app
    }
  ])

  const unreadCount = notifications.filter(n => n.unread).length

  const handleNotificationClick = (notification) => {
    setNotifications(prev =>
      prev.map(n => n.id === notification.id ? { ...n, unread: false } : n)
    )
    setShowNotifications(false)
    if (notification.path) {
      navigate(notification.path)
    }
  }

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })))
    setShowNotifications(false)
    navigate(ROUTES.notifications)
  }

  return (
    <header className="header">
      <div className="header-left">
        <button className="mobile-menu-btn" onClick={toggleMobileMenu}>
          <Menu size={24} />
        </button>
        <div className="search-container">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            placeholder="Search conversations, reports..."
            className="search-input"
          />
        </div>
      </div>

      <div className="mobile-header-logo">
        <span className="logo-text">MARKOVA</span>
      </div>

      <div className="header-right">
        <div className="header-actions">
          <motion.button
            className="icon-button"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount}</span>
            )}
          </motion.button>

          <div className="user-menu-container" ref={userMenuRef}>
            <motion.button
              className="user-button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="user-avatar">
                <User size={18} />
              </div>
              <div className="user-info">
                <span className="user-name">{user?.name || 'Client User'}</span>
                <span className="user-role">{user?.company || 'Client'}</span>
              </div>
              <ChevronDown size={16} />
            </motion.button>

            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  className="user-dropdown"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="dropdown-header">
                    <div className="dropdown-user-info">
                      <div className="dropdown-avatar">
                        <User size={20} />
                      </div>
                      <div>
                        <div className="dropdown-user-name">{user?.name || 'Client User'}</div>
                        <div className="dropdown-user-email">{user?.email || 'user@company.com'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="dropdown-divider"></div>

                  <div className="dropdown-menu">
                    <button 
                      className="dropdown-item"
                      onClick={() => {
                        setShowUserMenu(false)
                        navigate(ROUTES.settings)
                      }}
                    >
                      <User size={16} />
                      <span>Profile</span>
                    </button>
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        setShowUserMenu(false)
                        navigate(ROUTES.settings)
                      }}
                    >
                      <Settings size={16} />
                      <span>Settings</span>
                    </button>
                    <button 
                      className="dropdown-item"
                      onClick={() => {
                        setShowUserMenu(false)
                        navigate(ROUTES.billing)
                      }}
                    >
                      <CreditCard size={16} />
                      <span>Billing</span>
                    </button>
                  </div>

                  <div className="dropdown-divider"></div>

                  <button className="dropdown-item logout" onClick={onLogout}>
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Notifications Panel */}
      <AnimatePresence>
        {showNotifications && (
          <motion.div
            className="notifications-panel-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            ref={notificationsRef}
            onClick={() => {
              setShowNotifications(false);
            }}
          >
            <motion.div
              className="notifications-panel"
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <div className="notifications-header">
                <h3>Notifications</h3>
                <span className="unread-count">{unreadCount} unread</span>
              </div>

              <div className="notifications-list">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${notification.unread ? 'unread' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="notification-content">
                      <h4>{notification.title}</h4>
                      <p>{notification.message}</p>
                      <span className="notification-time">{notification.time}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="notifications-footer">
                <button className="view-all-btn" onClick={handleMarkAllRead}>View All Notifications</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings page is now used instead of modal */}
    </header>
  )
}

export default Header