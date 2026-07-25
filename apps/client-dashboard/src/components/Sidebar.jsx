import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Bot,
  GitBranch,
  BookOpen,
  Plug,
  Phone,
  Headphones,
  BarChart3,
  Users,
  LogOut,
  Moon,
  Sun,
  X,
  ChevronDown,
  ChevronUp,
  Shield,
  CreditCard,
  Building2,
  Settings
} from 'lucide-react'
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

  const menuItems = [
    {
      title: 'Command Center',
      path: '/',
      icon: LayoutDashboard,
      color: 'text-emerald-400'
    },

    {
      title: 'Agent Center',
      icon: Bot,
      color: 'text-purple-400',
      isDropdown: true,
      subItems: [
        {
          title: 'Agent Studio',
          path: '/agent-studio',
          icon: Bot,
          color: 'text-purple-400'
        },
        {
          title: 'Flow Builder',
          path: '/flow-builder',
          icon: GitBranch,
          color: 'text-blue-400'
        },
        {
          title: 'Knowledge Center',
          path: '/knowledge',
          icon: BookOpen,
          color: 'text-rose-400'
        },
        {
          title: 'AI Governance',
          path: '/governance',
          icon: Shield,
          color: 'text-amber-500'
        }
      ]
    },
    {
      title: 'Integration Hub',
      path: '/integrations',
      icon: Plug,
      color: 'text-cyan-400'
    },
    {
      title: 'Phone & Channels',
      path: '/channels',
      icon: Phone,
      color: 'text-indigo-400'
    },
    {
      title: 'Call Center',
      path: '/call-center',
      icon: Headphones,
      color: 'text-pink-400'
    },
    {
      title: 'Analytics Center',
      path: '/analytics',
      icon: BarChart3,
      color: 'text-teal-400'
    },
    {
      title: 'Customers / CRM',
      path: '/crm',
      icon: Users,
      color: 'text-orange-400'
    },
    {
      title: 'Administration',
      icon: Settings,
      color: 'text-gray-400',
      isDropdown: true,
      subItems: [
        {
          title: 'Organization',
          path: '/organization',
          icon: Building2,
          color: 'text-blue-500'
        },
        {
          title: 'Billing & Quotas',
          path: '/billing',
          icon: CreditCard,
          color: 'text-green-500'
        },
        {
          title: 'Settings',
          path: '/settings',
          icon: Settings,
          color: 'text-gray-400'
        }
      ]
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
              const isDropdownOpen = openDropdown === item.title;
              return (
                <motion.li
                  key={item.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="nav-dropdown-container"
                >
                  <div
                    className="nav-link nav-dropdown-btn"
                    onClick={() => setOpenDropdown(isDropdownOpen ? null : item.title)}
                    style={{ cursor: 'pointer' }}
                  >
                    <Icon className={`nav-icon ${item.color}`} size={20} />
                    <span className="nav-text">{item.title}</span>
                    <span className="dropdown-icon" style={{ marginLeft: 'auto' }}>
                      {isDropdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </div>
                  
                  <AnimatePresence>
                    {isDropdownOpen && (
                      <motion.ul 
                        className="nav-sub-menu"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden', paddingLeft: '1.5rem', listStyle: 'none', marginTop: '0.25rem' }}
                      >
                        {item.subItems.map((subItem) => {
                          const SubIcon = subItem.icon;
                          const isSubActive = location.pathname === subItem.path;
                          return (
                            <li key={subItem.path}>
                              <Link
                                to={subItem.path}
                                className={`nav-link sub-nav-link ${isSubActive ? 'active' : ''}`}
                                style={{ margin: '0.25rem 0', padding: '0.5rem 1rem' }}
                              >
                                <SubIcon className={`nav-icon ${subItem.color}`} size={16} />
                                <span className="nav-text" style={{ fontSize: '0.85rem' }}>{subItem.title}</span>
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

            const isActive = location.pathname === item.path || (location.pathname === '/dashboard' && item.path === '/')
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