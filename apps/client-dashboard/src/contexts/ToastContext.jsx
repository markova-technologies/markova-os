import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

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

    const addToast = useCallback(({ title, message, type = 'info', duration = 5000 }) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, title, message, type }]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const success = (message, title = 'Success') => addToast({ title, message, type: 'success' });
    const error = (message, title = 'Error') => addToast({ title, message, type: 'error' });
    const info = (message, title = 'Information') => addToast({ title, message, type: 'info' });

    return (
        <ToastContext.Provider value={{ success, error, info, addToast }}>
            {children}
            
            {/* Toast Container */}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map(toast => (
                        <Toast key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};

const Toast = ({ toast, onDismiss }) => {
    const icons = {
        success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
        error: <AlertCircle className="w-5 h-5 text-red-500" />,
        info: <Info className="w-5 h-5 text-blue-500" />
    };

    const bgColors = {
        success: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
        error: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
        info: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20'
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={`pointer-events-auto flex w-80 shadow-lg rounded-lg border p-4 ${bgColors[toast.type]} backdrop-blur-sm`}
        >
            <div className="flex-shrink-0 mr-3">
                {icons[toast.type]}
            </div>
            <div className="flex-1 mr-2">
                <h4 className={`text-sm font-semibold mb-1 ${toast.type === 'success' ? 'text-emerald-800 dark:text-emerald-400' : toast.type === 'error' ? 'text-red-800 dark:text-red-400' : 'text-blue-800 dark:text-blue-400'}`}>
                    {toast.title}
                </h4>
                {toast.message && (
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                        {toast.message}
                    </p>
                )}
            </div>
            <button
                onClick={onDismiss}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </motion.div>
    );
};
