import React from 'react';
import { motion } from 'framer-motion';
import { IoTrendingUp, IoTrendingDown } from 'react-icons/io5';
import Card from '../ui/Card';

const StatsCard = ({ title, value, change, icon: Icon, trend = 'up', color = 'primary', sparklineData = [40, 60, 45, 80, 50] }) => {
    const colors = {
        primary: {
            bg: 'bg-primary-500/10',
            icon: 'bg-primary-500/20 text-primary-500',
            indicator: 'text-primary-500 bg-primary-500/10'
        },
        success: {
            bg: 'bg-green-500/10',
            icon: 'bg-green-500/20 text-green-500',
            indicator: 'text-green-500 bg-green-500/10'
        },
        warning: {
            bg: 'bg-yellow-500/10',
            icon: 'bg-yellow-500/20 text-yellow-500',
            indicator: 'text-yellow-500 bg-yellow-500/10'
        },
        danger: {
            bg: 'bg-red-500/10',
            icon: 'bg-red-500/20 text-red-500',
            indicator: 'text-red-500 bg-red-500/10'
        },
        purple: {
            bg: 'bg-purple-500/10',
            icon: 'bg-purple-500/20 text-purple-500',
            indicator: 'text-purple-500 bg-purple-500/10'
        },
    };

    const colorScheme = colors[color] || colors.primary;
    const isPositive = trend === 'up';

    return (
        <Card className="p-5 border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1f2e] group hover:border-primary-500/50 transition-all duration-300">
            <div className="flex justify-between items-start mb-6">
                {/* Icon Container */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorScheme.icon}`}>
                    <Icon className="w-5 h-5" />
                </div>

                {/* Change Badge */}
                {change !== undefined && (
                    <div className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${isPositive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {isPositive ? '+' : '-'}{Math.abs(change)}%
                    </div>
                )}
            </div>

            <div className="space-y-1 mb-6">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {title}
                </p>
                <motion.h3
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-2xl font-bold text-gray-900 dark:text-white"
                >
                    {value}
                </motion.h3>
            </div>

            {/* Mini Bar Chart (Sparkline) */}
            <div className="flex items-end gap-1.5 h-8">
                {sparklineData.map((val, i) => (
                    <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${val}%` }}
                        transition={{ delay: i * 0.1, duration: 0.5 }}
                        className="flex-1 bg-gray-200 dark:bg-gray-700/50 rounded-sm group-hover:bg-primary-500/30 transition-colors"
                    />
                ))}
            </div>
        </Card>
    );
};

export default StatsCard;
