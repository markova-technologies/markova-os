import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoWarning, IoCheckmarkCircle, IoInformationCircle, IoAlertCircle, IoClose } from 'react-icons/io5';
import { useData } from '../contexts/DataContext';

import { useNavigate } from 'react-router-dom';

const AlertBanner = () => {
    const { alerts, dismissAlert } = useData();
    const [visibleAlerts, setVisibleAlerts] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        // Only show last 3 alerts to avoid clutter
        setVisibleAlerts(alerts.slice(-3));
    }, [alerts]);

    const handleAlertClick = (alert) => {
        if (alert.path) {
            navigate(alert.path);
            if (alert.agentId) {
                // You might need a way to select the agent in context if the page depends on it
                // For now, simple navigation is a good start. 
                // We could dispatch an event or set query param.
            }
        }
        dismissAlert(alert.id);
    };

    const getAlertStyle = (type) => {
        switch (type) {
            case 'success':
                return {
                    bg: 'bg-green-50 dark:bg-green-900/90',
                    border: 'border-green-500',
                    text: 'text-green-800 dark:text-green-100',
                    icon: <IoCheckmarkCircle className="w-5 h-5 flex-shrink-0" />
                };
            case 'warning':
                return {
                    bg: 'bg-yellow-50 dark:bg-yellow-900/90',
                    border: 'border-yellow-500',
                    text: 'text-yellow-800 dark:text-yellow-100',
                    icon: <IoWarning className="w-5 h-5 flex-shrink-0" />
                };
            case 'error':
                return {
                    bg: 'bg-red-50 dark:bg-red-900/90',
                    border: 'border-red-500',
                    text: 'text-red-800 dark:text-red-100',
                    icon: <IoAlertCircle className="w-5 h-5 flex-shrink-0" />
                };
            default:
                return {
                    bg: 'bg-primary-50 dark:bg-primary-900/90',
                    border: 'border-primary-500',
                    text: 'text-primary-800 dark:text-primary-100',
                    icon: <IoInformationCircle className="w-5 h-5 flex-shrink-0" />
                };
        }
    };

    return (
        <div className="fixed top-20 right-6 z-50 flex flex-col gap-3 w-full max-w-sm pointer-events-none">
            <AnimatePresence>
                {visibleAlerts.map((alert) => {
                    const style = getAlertStyle(alert.type);
                    return (
                        <motion.div
                            key={alert.id}
                            initial={{ opacity: 0, x: 50, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 50, scale: 0.9 }}
                            layout
                            onClick={() => handleAlertClick(alert)}
                            className={`
                                pointer-events-auto cursor-pointer
                                flex items-start gap-3 p-4 rounded-lg shadow-xl border-l-4 backdrop-blur-md
                                ${style.bg} ${style.border} ${style.text}
                                hover:brightness-95 transition-all active:scale-95
                            `}
                        >
                            {style.icon}
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm leading-tight">
                                    {alert.message}
                                </p>
                                <p className="text-xs opacity-70 mt-1">
                                    Click to view details • {new Date().toLocaleTimeString()}
                                </p>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    dismissAlert(alert.id);
                                }}
                                className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                            >
                                <IoClose className="w-4 h-4" />
                            </button>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};

export default AlertBanner;
