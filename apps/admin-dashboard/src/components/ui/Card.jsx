import React from 'react';
import { motion } from 'framer-motion';

const Card = ({
    children,
    className = '',
    variant = 'glass',
    hover = true,
    onClick,
    ...props
}) => {
    const variants = {
        glass: 'glass-card',
        solid: 'bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg',
        outline: 'border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6',
    };

    const baseClasses = variants[variant] || variants.glass;
    const hoverClasses = hover ? 'cursor-pointer hover:scale-[1.02]' : '';
    const clickClasses = onClick ? 'cursor-pointer' : '';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`${baseClasses} ${hoverClasses} ${clickClasses} ${className}`}
            onClick={onClick}
            {...props}
        >
            {children}
        </motion.div>
    );
};

export default Card;
