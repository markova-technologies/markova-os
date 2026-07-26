import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    IoHome,
    IoPeople,
    IoPersonCircle,
    IoAnalytics,
    IoSettings,
    IoFlask,
    IoMoon,
    IoSunny,
    IoClose,
    IoShieldCheckmark,
    IoHeartCircle,
    IoBarChart,
    IoTicket,
    IoDocumentText
} from 'react-icons/io5';
import { useTheme } from '../../contexts/ThemeContext';
import { useSocket } from '../../contexts/SocketContext';
import { ROUTES } from '../../config/site';

const Sidebar = ({ isOpen, onClose }) => {
    const { theme, toggleTheme } = useTheme();
    const { connected } = useSocket();
    const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);

    React.useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 1024);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const menuItems = [
        { path: ROUTES.dashboard, icon: IoHome, label: 'Dashboard' },
        { path: ROUTES.companies, icon: IoPersonCircle, label: 'Companies Management' },
        { path: ROUTES.revenue, icon: IoAnalytics, label: 'Revenue Analytics' },
        { path: ROUTES.calls, icon: IoFlask, label: 'Active Calls' },
        { path: ROUTES.health, icon: IoHeartCircle, label: 'Platform Health' },
        { path: ROUTES.usage, icon: IoBarChart, label: 'Tenant Usage' },
        { path: ROUTES.tickets, icon: IoTicket, label: 'Support Tickets' },
        { path: ROUTES.audit, icon: IoDocumentText, label: 'Global Audit Logs' },
        { path: ROUTES.settings, icon: IoSettings, label: 'Settings' },
    ];

    return (
        <>
            {/* Backdrop */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                    />
                )}
            </AnimatePresence>

            <motion.aside
                initial={false}
                animate={{
                    x: isMobile ? (isOpen ? 0 : -300) : 0
                }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-64 h-screen glass border-r border-gray-200 dark:border-gray-700 flex flex-col fixed left-0 top-0 z-50 lg:translate-x-0 shadow-2xl lg:shadow-none"
            >
                {/* Logo & Profile */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div className="px-2">
                        <h1 className="text-2xl font-black tracking-tighter text-gray-900 dark:text-white">
                            MARKOVA
                        </h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Management Hub</p>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        className="lg:hidden p-3 -mr-3 text-gray-500 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all active:scale-90"
                        aria-label="Close sidebar"
                    >
                        <IoClose size={28} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 overflow-y-auto">
                    <ul className="space-y-2">
                        {menuItems.map((item) => (
                            <li key={item.path} onClick={() => window.innerWidth < 1024 && onClose()}>
                                <NavLink
                                    to={item.path}
                                    className={({ isActive }) => `
                      flex items-center gap-3 px-4 py-3 rounded-lg
                      transition-all duration-200
                      ${isActive
                                            ? 'bg-primary-500 text-white shadow-lg'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                        }
                    `}
                                >
                                    <item.icon className="w-5 h-5" />
                                    <span className="font-medium">{item.label}</span>
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Theme Toggle */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={toggleTheme}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-lg
                         bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
                         transition-colors duration-200"
                    >
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {theme === 'light' ? 'Light Mode' : 'Dark Mode'}
                        </span>
                        {theme === 'light' ? (
                            <IoSunny className="w-5 h-5 text-yellow-500" />
                        ) : (
                            <IoMoon className="w-5 h-5 text-primary-400" />
                        )}
                    </button>
                </div>
            </motion.aside>
        </>
    );
};

export default Sidebar;
