import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoSearch, IoNotifications, IoMenu } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import RealTimeMonitor from '../RealTimeMonitor';

const Header = ({ title, breadcrumbs = [], onMenuClick }) => {
    const { notificationHistory, markAllRead, agents, clients } = useData();
    const [searchQuery, setSearchQuery] = React.useState('');
    const [showNotifications, setShowNotifications] = React.useState(false);
    const [showSearchResults, setShowSearchResults] = React.useState(false);
    const navigate = useNavigate();

    const filteredAgents = searchQuery.length > 1
        ? agents.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : [];

    const filteredClients = searchQuery.length > 1
        ? clients.filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.company.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : [];

    const hasResults = filteredAgents.length > 0 || filteredClients.length > 0;
    const unreadCount = notificationHistory.filter(n => !n.read).length;

    const handleNotificationClick = () => {
        setShowNotifications(!showNotifications);
        if (!showNotifications && unreadCount > 0) {
            markAllRead();
        }
    };

    const handleItemClick = (notification) => {
        if (notification.path) {
            navigate(notification.path);
            setShowNotifications(false);
        }
    };

    return (
        <header className="h-16 glass border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 md:px-6 sticky top-0 z-20">
            {/* Left Section: Menu & Title */}
            <div className="flex items-center gap-3 md:gap-4">
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                    <IoMenu size={24} />
                </button>

                <div>
                    {breadcrumbs.length > 0 && (
                        <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-0.5">
                            {breadcrumbs.map((crumb, index) => (
                                <React.Fragment key={index}>
                                    {index > 0 && <span>/</span>}
                                    <span>{crumb}</span>
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                    <h1 className="text-base md:text-xl font-bold text-gray-900 dark:text-white line-clamp-1">
                        {title}
                    </h1>
                </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-4">
                {/* Real-time Status */}
                <RealTimeMonitor />

                {/* Search */}
                <div className="relative hidden md:block">
                    <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search agents or clients..."
                        value={searchQuery}
                        onFocus={() => setShowSearchResults(true)}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setShowSearchResults(true);
                        }}
                        className="pl-10 pr-4 py-2 w-64 rounded-xl border border-gray-300 dark:border-gray-600
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         transition-all duration-200"
                    />

                    {/* Search Results Dropdown */}
                    <AnimatePresence>
                        {showSearchResults && searchQuery.length > 1 && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setShowSearchResults(false)}
                                />
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-20 max-h-96 overflow-y-auto"
                                >
                                    {!hasResults ? (
                                        <div className="p-8 text-center">
                                            <p className="text-sm text-gray-500">No matches found for "{searchQuery}"</p>
                                        </div>
                                    ) : (
                                        <div className="p-2">
                                            {filteredAgents.length > 0 && (
                                                <div className="mb-2">
                                                    <h3 className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Agents</h3>
                                                    {filteredAgents.map(agent => (
                                                        <button
                                                            key={agent.id}
                                                            onClick={() => {
                                                                navigate(`/agents/${agent.id}`);
                                                                setShowSearchResults(false);
                                                                setSearchQuery('');
                                                            }}
                                                            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center text-primary-500 font-bold">
                                                                {agent.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-gray-900 dark:text-white">{agent.name}</p>
                                                                <p className="text-[10px] text-gray-400">{agent.type}</p>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {filteredClients.length > 0 && (
                                                <div>
                                                    <h3 className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Clients</h3>
                                                    {filteredClients.map(client => (
                                                        <button
                                                            key={client.id}
                                                            onClick={() => {
                                                                navigate(`/clients/${client.id}`);
                                                                setShowSearchResults(false);
                                                                setSearchQuery('');
                                                            }}
                                                            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500 font-bold">
                                                                {client.company.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-gray-900 dark:text-white">{client.company}</p>
                                                                <p className="text-[10px] text-gray-400">{client.name}</p>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>

                {/* Notifications */}
                <div className="relative">
                    <button
                        onClick={handleNotificationClick}
                        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <IoNotifications className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white border-2 border-white dark:border-gray-900">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Notification Dropdown */}
                    {showNotifications && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setShowNotifications(false)}
                            />
                            <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-20 overflow-hidden animate-fade-in-up">
                                <div className="p-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                    <h3 className="font-bold text-gray-900 dark:text-white">Notifications</h3>
                                    <span className="text-xs text-gray-500">{notificationHistory.length} recent</span>
                                </div>
                                <div className="max-h-96 overflow-y-auto">
                                    {notificationHistory.length > 0 ? (
                                        notificationHistory.map((notification) => (
                                            <div
                                                key={notification.id}
                                                onClick={() => handleItemClick(notification)}
                                                className={`p-4 border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${!notification.read ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}
                                            >
                                                <div className="flex gap-3">
                                                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${notification.type === 'error' ? 'bg-red-500' :
                                                        notification.type === 'warning' ? 'bg-yellow-500' :
                                                            'bg-primary-500'
                                                        }`} />
                                                    <div>
                                                        <p className="text-sm text-gray-800 dark:text-gray-200 mb-1">
                                                            {notification.message}
                                                        </p>
                                                        <p className="text-xs text-gray-400">
                                                            {new Date(notification.id).toLocaleTimeString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-8 text-center text-gray-400 text-sm">
                                            No notifications
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;

