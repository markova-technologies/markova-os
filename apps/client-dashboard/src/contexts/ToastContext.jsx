import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import './ToastContext.css';

const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const addToast = useCallback(({ title, message, type = 'info', duration = 5000 }) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, title, message, type }]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, [removeToast]);

    // Confirmations echo the verb the button used ("Place test call" -> "Call placed"),
    // so callers pass their own title; these defaults are the plain fallback.
    const success = (message, title = 'Done') => addToast({ title, message, type: 'success' });
    const error = (message, title = "That didn't go through") => addToast({ title, message, type: 'error' });
    const info = (message, title = 'Heads up') => addToast({ title, message, type: 'info' });

    return (
        <ToastContext.Provider value={{ success, error, info, addToast }}>
            {children}

            <div className="toast-stack" role="status" aria-live="polite">
                <AnimatePresence>
                    {toasts.map(toast => (
                        <Toast key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};

const ICONS = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
};

const Toast = ({ toast, onDismiss }) => {
    const Icon = ICONS[toast.type] || Info;

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.18 }}
            className={`toast toast-${toast.type}`}
        >
            <span className="toast-icon">
                <Icon size={18} />
            </span>
            <div className="toast-body">
                {toast.title && <h4 className="toast-title">{toast.title}</h4>}
                {toast.message && <p className="toast-message">{toast.message}</p>}
            </div>
            <button className="toast-dismiss" onClick={onDismiss} aria-label="Dismiss">
                <X size={15} />
            </button>
        </motion.div>
    );
};
