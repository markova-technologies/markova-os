import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Bot,
  BookOpen,
  Plug,
  Phone,
  Key,
  Headphones,
  BarChart3,
  LogOut,
  Moon,
  Sun,
  X,
  CreditCard,
  Settings,
  Shield,
  Users,
  Building,
  User,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { ROUTES } from '../config/site'
import { useAuth } from '../contexts/AuthContext'
import './Sidebar.css'

const Sidebar = ({ onLogout, isOpen, toggleMenu }) => {
  const location = useLocation()
  const { can } = useAuth()

  const [theme, setTheme] = useState('dark'); // Default to dark theme
  const [openDropdown, setOpenDropdown] = useState(null);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // Navigation menu items with granular RBAC permission assignments
  const rawMenuItems = [
    {
      title: 'Command Center',
      path: ROUTES.app,
      icon: LayoutDashboard
    },
    {
      title: 'Agents',
      icon: Bot,
      isDropdown: true,
      requiredPermission: 'agents:read',
      subItems: [
        {
          title: 'Agent Studio',
          path: ROUTES.agentStudio,
          icon: Bot,
          requiredPermission: 'agents:read'
        },
        {
          title: 'Knowledge Center',
          path: ROUTES.knowledge,
          icon: BookOpen,
          requiredPermission: 'knowledge:read'
        },
        {
          title: 'Governance',
          path: ROUTES.governance,
          icon: Shield,
          requiredPermission: 'governance:read'
        }
      ]
    },
    {
      title: 'Phone & Channels',
      path: ROUTES.phoneChannels,
      icon: Phone,
      requiredPermission: 'telephony:read'
    },
    {
      title: 'API Keys',
      path: ROUTES.keys,
      icon: Key,
      requiredPermission: 'keys:read'
    },
    {
      title: 'Integration Hub',
      path: ROUTES.integrations,
      icon: Plug,
      requiredPermission: 'integrations:read'
    },
    {
      title: 'Call Center',
      path: ROUTES.callCenter,
      icon: Headphones,
      requiredPermission: 'calls:read'
    },
    {
      title: 'Team',
      path: ROUTES.team,
      icon: Users,
      requiredPermission: 'users:read'
    },
    {
      title: 'Usage',
      path: ROUTES.usage,
      icon: BarChart3,
      requiredPermission: 'billing:read'
    },
    {
      title: 'Analytics Center',
      path: ROUTES.analytics,
      icon: BarChart3,
      requiredPermission: 'analytics:read'
    },
    {
      title: 'CRM',
      path: ROUTES.crm,
      icon: Users,
      requiredPermission: 'crm:read'
    }
  ];

  // Dynamically filter menu items and subitems based on user's active permissions
  const menuItems = rawMenuItems.reduce((acc, item) => {
    if (item.requiredPermission && !can(item.requiredPermission)) {
      return acc;
    }
    if (item.isDropdown && item.subItems) {
      const allowedSubItems = item.subItems.filter(sub => !sub.requiredPermission || can(sub.requiredPermission));
      if (allowedSubItems.length === 0) {
        return acc;
      }
      return [...acc, { ...item, subItems: allowedSubItems }];
    }
    return [...acc, item];
  }, []);


  return (
    <motion.aside
      className={`sidebar ${isOpen ? 'mobile-open' : ''}`}
      initial={{ x: -100 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="sidebar-header">
        <Link to={ROUTES.app} className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Bot size={22} className="brand-bot-icon" />
          </div>
          <div className="sidebar-brand-text">
            <span className="brand-name">MARKOVA</span>
            <span className="brand-badge">OS</span>
          </div>
        </Link>
        <button className="mobile-close-btn" onClick={toggleMenu}>
          <X size={24} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <ul className="nav-menu">
          {menuItems.map((item, index) => {
            const Icon = item.icon

            if (item.isDropdown) {
              const isActive = item.subItems.some(sub => location.pathname === sub.path || (sub.path !== ROUTES.app && location.pathname.startsWith(sub.path + '/')))
              const isOpen = openDropdown === item.title

              return (
                <motion.li
                  key={item.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <button
                    className={`nav-link ${isActive ? 'active' : ''}`}
                    onClick={() => setOpenDropdown(isOpen ? null : item.title)}
                    style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', outline: 'none' }}
                  >
                    <Icon className="nav-icon" size={20} />
                    <span className="nav-text" style={{ flex: 1 }}>{item.title}</span>
                    {isOpen ? <ChevronDown size={16} className="nav-icon" /> : <ChevronRight size={16} className="nav-icon" />}
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden', paddingLeft: '2.5rem', listStyle: 'none', margin: 0 }}
                      >
                        {item.subItems.map(sub => {
                          const SubIcon = sub.icon
                          const isSubActive = location.pathname === sub.path || (sub.path !== ROUTES.app && location.pathname.startsWith(sub.path + '/'))
                          return (
                            <li key={sub.path} style={{ marginTop: '0.25rem' }}>
                              <Link to={sub.path} className={`nav-link ${isSubActive ? 'active' : ''}`} style={{ padding: '0.5rem 1rem' }}>
                                <SubIcon className="nav-icon" size={18} />
                                <span className="nav-text" style={{ fontSize: '0.9em' }}>{sub.title}</span>
                              </Link>
                            </li>
                          )
                        })}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </motion.li>
              )
            }

            const isActive = location.pathname === item.path || (item.path !== ROUTES.app && location.pathname.startsWith(item.path + '/'))
            return (
               <motion.li
                key={item.path}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  to={item.path}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                >
                  <Icon className="nav-icon" size={20} />
                  <span className="nav-text">{item.title}</span>
                </Link>
              </motion.li>
            )
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <button
          className="theme-toggle-icon-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </motion.aside>
  )
}

export default Sidebar