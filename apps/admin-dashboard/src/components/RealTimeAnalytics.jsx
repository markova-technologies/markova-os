import React from 'react';
import {
    AreaChart, Area,
    LineChart, Line,
    XAxis, YAxis,
    CartesianGrid, Tooltip,
    ResponsiveContainer
} from 'recharts';
import { motion } from 'framer-motion';

const RealTimeAnalytics = ({
    data,
    dataKey = 'value',
    title,
    color = '#3b82f6',
    height = 300,
    type = 'area'
}) => {
    const ChartComponent = type === 'area' ? AreaChart : LineChart;
    const DataComponent = type === 'area' ? Area : Line;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 backdrop-blur-sm bg-opacity-80 dark:bg-opacity-80"
        >
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: color }}></span>
                    {title}
                </h3>
                <div className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-medium text-gray-500 dark:text-gray-400">
                    Live
                </div>
            </div>

            <div style={{ width: '100%', height: height }}>
                <ResponsiveContainer>
                    <ChartComponent
                        data={data}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id={`color${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                                <stop offset="95%" stopColor={color} stopOpacity={0.1} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156, 163, 175, 0.2)" />
                        <XAxis
                            dataKey="time"
                            stroke="currentColor"
                            className="text-gray-400 text-xs"
                            tick={{ fill: '#9ca3af' }}
                            tickLine={false}
                        />
                        <YAxis
                            stroke="currentColor"
                            className="text-gray-400 text-xs"
                            tick={{ fill: '#9ca3af' }}
                            tickLine={false}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                borderRadius: '8px',
                                border: 'none',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                color: '#1f2937'
                            }}
                        />
                        <DataComponent
                            type="monotone"
                            dataKey={dataKey}
                            stroke={color}
                            fillOpacity={1}
                            fill={type === 'area' ? `url(#color${dataKey})` : 'none'}
                            strokeWidth={2}
                            dot={type === 'line' ? { r: 4, fill: color } : false}
                            activeDot={{ r: 6 }}
                            isAnimationActive={false}
                        />
                    </ChartComponent>
                </ResponsiveContainer>
            </div>
        </motion.div>
    );
};

export default RealTimeAnalytics;
