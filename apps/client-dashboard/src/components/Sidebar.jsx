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
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { ROUTES } from '../config/site'
import './Sidebar.css'

const Sidebar = ({ onLogout, isOpen, toggleMenu }) => {
  const location = useLocation()

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

  // In-scope IA only (Brief §4). Flow Builder deleted as requested.
  // Phone & Channels = Numbers. CRM, Organization, Governance are enabled in UI.
  const menuItems = [
    {
      title: 'Command Center',
      path: ROUTES.app,
      icon: LayoutDashboard,
      color: 'text-emerald-400'
    },
    {
      title: 'Agents',
      icon: Bot,
      color: 'text-purple-400',
      isDropdown: true,
      subItems: [
        {
          title: 'Agent Studio',
          path: ROUTES.agentStudio,
          icon: Bot,
          color: 'text-purple-400'
        },
        {
          title: 'Knowledge Center',
          path: ROUTES.knowledge,
          icon: BookOpen,
          color: 'text-rose-400'
        },
        {
          title: 'Governance',
          path: ROUTES.governance,
          icon: Shield,
          color: 'text-amber-500'
        }
      ]
    },
    {
      title: 'Phone & Channels',
      path: ROUTES.phoneChannels,
      icon: Phone,
      color: 'text-indigo-400'
    },
    {
      title: 'API Keys',
      path: ROUTES.keys,
      icon: Key,
      color: 'text-amber-400'
    },
    {
      title: 'Integration Hub',
      path: ROUTES.integrations,
      icon: Plug,
      color: 'text-cyan-400'
    },
    {
      title: 'Call Center',
      path: ROUTES.callCenter,
      icon: Headphones,
      color: 'text-pink-400'
    },
    {
      title: 'Usage',
      path: ROUTES.usage,
      icon: BarChart3,
      color: 'text-teal-400'
    },
    {
      title: 'Billing',
      path: ROUTES.billing,
      icon: CreditCard,
      color: 'text-green-500'
    },
    {
      title: 'Settings',
      icon: Settings,
      color: 'text-gray-400',
      isDropdown: true,
      subItems: [
        {
          title: 'General Settings',
          path: ROUTES.settings,
          icon: Settings,
          color: 'text-gray-400'
        },
        {
          title: 'Organization',
          path: ROUTES.organization,
          icon: Building,
          color: 'text-indigo-400'
        }
      ]
    },
    {
      title: 'CRM',
      path: ROUTES.crm,
      icon: Users,
      color: 'text-blue-400'
    }
  ]


  return (
    <motion.aside
      className={`sidebar ${isOpen ? 'mobile-open' : ''}`}
      initial={{ x: -100 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-text">MARKOVA</span>
        </div>
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
                    <Icon className={`nav-icon ${item.color}`} size={20} />
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
                                <SubIcon className={`nav-icon ${sub.color}`} size={18} />
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
                  <Icon className={`nav-icon ${item.color}`} size={20} />
                  <span className="nav-text">{item.title}</span>
                </Link>
              </motion.li>
            )
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="theme-logout-section">
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {theme === 'dark' ? ' Light Mode' : ' Dark Mode'}
          </button>
          <button className="logout-btn" onClick={onLogout}>
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>
    </motion.aside>
  )
}

export default Sidebar