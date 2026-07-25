import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoClose, IoWarning, IoCheckmarkCircle, IoInformationCircle, IoAlertCircle } from 'react-icons/io5';

const Alert = ({
    type = 'info',
    message,
    onClose,
    autoClose = true,
    duration = 5000
}) => {
    const [visible, setVisible] = React.useState(true);

    React.useEffect(() => {
        if (autoClose) {
            const timer = setTimeout(() => {
                setVisible(false);
                setTimeout(() => onClose?.(), 300);
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [autoClose, duration, onClose]);

    const types = {
        success: {
            bg: 'bg-green-50 dark:bg-green-900/20 border-green-500',
            text: 'text-green-800 dark:text-green-200',
            icon: <IoCheckmarkCircle className="w-6 h-6" />,
        },
        warning: {
            bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500',
            text: 'text-yellow-800 dark:text-yellow-200',
            icon: <IoWarning className="w-6 h-6" />,
        },
        error: {
            bg: 'bg-red-50 dark:bg-red-900/20 border-red-500',
            text: 'text-red-800 dark:text-red-200',
            icon: <IoAlertCircle className="w-6 h-6" />,
        },
        info: {
            bg: 'bg-primary-50 dark:bg-primary-900/20 border-primary-500',
            text: 'text-primary-800 dark:text-primary-200',
            icon: <IoInformationCircle className="w-6 h-6" />,
        },
    };

    const config = types[type] || types.info;

    const handleClose = () => {
        setVisible(false);
        setTimeout(() => onClose?.(), 300);
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    className={`
            ${config.bg} ${config.text}
            border-l-4 rounded-lg p-4 shadow-lg
            flex items-start gap-3
          `}
                >
                    <div className="flex-shrink-0">{config.icon}</div>
                    <div className="flex-1">
                        <p className="font-medium">{message}</p>
                    </div>
                    {onClose && (
                        <button
                            onClick={handleClose}
                            className="flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        >
                            <IoClose className="w-5 h-5" />
                        </button>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default Alert;
