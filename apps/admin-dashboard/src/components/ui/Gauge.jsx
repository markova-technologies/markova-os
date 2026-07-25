import React from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

const Gauge = ({
    value,
    maxValue = 100,
    label,
    size = 120,
    showValue = true,
    color,
}) => {
    const percentage = (value / maxValue) * 100;

    // Auto-color based on health score
    const getColor = () => {
        if (color) return color;
        if (percentage >= 80) return '#10b981'; // green
        if (percentage >= 60) return '#f59e0b'; // yellow
        return '#ef4444'; // red
    };

    const gaugeColor = getColor();

    return (
        <div className="flex flex-col items-center gap-2">
            <div style={{ width: size, height: size }}>
                <CircularProgressbar
                    value={percentage}
                    text={showValue ? `${Math.round(percentage)}%` : ''}
                    styles={buildStyles({
                        pathColor: gaugeColor,
                        textColor: 'currentColor',
                        trailColor: 'rgba(156, 163, 175, 0.2)',
                        pathTransitionDuration: 0.5,
                    })}
                />
            </div>
            {label && (
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 text-center">
                    {label}
                </p>
            )}
        </div>
    );
};

export default Gauge;
