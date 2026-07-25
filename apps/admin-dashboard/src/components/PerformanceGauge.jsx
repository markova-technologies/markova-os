import React from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

const PerformanceGauge = ({
    value,
    maxValue = 100,
    label,
    subLabel,
    size = 'md',
    showValue = true,
    color
}) => {
    const percentage = Math.min(100, Math.max(0, (value / maxValue) * 100));

    // Size mapping
    const sizeClasses = {
        sm: 'w-24 h-24',
        md: 'w-32 h-32',
        lg: 'w-48 h-48',
        xl: 'w-64 h-64'
    };

    // Dynamic color determination if not provided
    const getColor = (pct) => {
        if (color) return color;
        if (pct >= 80) return '#10b981'; // Green-500
        if (pct >= 60) return '#f59e0b'; // Amber-500
        return '#ef4444'; // Red-500
    };

    const pathColor = getColor(percentage);

    return (
        <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 backdrop-blur-sm bg-opacity-80 dark:bg-opacity-80">
            <div className={`${sizeClasses[size] || sizeClasses.md} relative mb-3`}>
                <CircularProgressbar
                    value={percentage}
                    text={showValue ? `${Math.round(value)}%` : ''}
                    styles={buildStyles({
                        pathColor: pathColor,
                        textColor: 'currentColor',
                        trailColor: 'rgba(156, 163, 175, 0.2)',
                        pathTransitionDuration: 0.5,
                        textSize: '22px',
                    })}
                    className="font-bold text-gray-700 dark:text-gray-200"
                />
            </div>
            {label && (
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 text-center">
                    {label}
                </h3>
            )}
            {subLabel && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
                    {subLabel}
                </p>
            )}
        </div>
    );
};

export default PerformanceGauge;
