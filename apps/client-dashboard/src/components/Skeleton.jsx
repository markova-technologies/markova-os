import React from 'react';

/**
 * Skeleton component for loading states.
 * 
 * @param {Object} props
 * @param {'text' | 'circular' | 'rectangular' | 'card'} props.variant - The shape of the skeleton
 * @param {string} props.width - Custom width (e.g., '100%', '200px')
 * @param {string} props.height - Custom height
 * @param {string} props.className - Additional Tailwind classes
 */
const Skeleton = ({ variant = 'text', width, height, className = '' }) => {
    
    const baseClasses = "animate-pulse bg-gray-200 dark:bg-gray-700/50";
    
    let variantClasses = "";
    switch (variant) {
        case 'text':
            variantClasses = "rounded-md";
            if (!height) height = "1rem";
            if (!width) width = "100%";
            break;
        case 'circular':
            variantClasses = "rounded-full";
            break;
        case 'rectangular':
            variantClasses = "rounded-lg";
            break;
        case 'card':
            variantClasses = "rounded-xl";
            if (!height) height = "200px";
            if (!width) width = "100%";
            break;
        default:
            variantClasses = "rounded-md";
    }

    const style = {};
    if (width) style.width = width;
    if (height) style.height = height;

    return (
        <div 
            className={`${baseClasses} ${variantClasses} ${className}`} 
            style={style}
            aria-hidden="true"
        />
    );
};

export default Skeleton;
