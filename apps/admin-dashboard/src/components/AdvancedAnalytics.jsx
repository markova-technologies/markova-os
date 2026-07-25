import React, { useState } from 'react';
import {
    AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { motion } from 'framer-motion';
import { IoTime, IoCalendar, IoStatsChart } from 'react-icons/io5';
import PerformanceGauge from './PerformanceGauge';
import Card from './ui/Card';

const AdvancedAnalytics = ({ data = {}, timeframe = '24h' }) => {
    const [activeTimeframe, setActiveTimeframe] = useState(timeframe);

    // Mock distribution data if not provided
    const distributionData = [
        { name: 'Active', value: 12, color: '#10b981' },
        { name: 'Idle', value: 3, color: '#f59e0b' },
        { name: 'Offline', value: 2, color: '#ef4444' },
    ];

    const typeData = [
        { name: 'Support', value: 45, color: '#3b82f6' },
        { name: 'Sales', value: 25, color: '#8b5cf6' },
        { name: 'Tech', value: 20, color: '#ec4899' },
        { name: 'Billing', value: 10, color: '#06b6d4' },
    ];

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <IoStatsChart className="text-primary-500 w-5 h-5" />
                    <h2 className="font-bold text-gray-800 dark:text-white">Advanced Analytics</h2>
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                    {['1h', '24h', '7d', '30d'].map((tf) => (
                        <button
                            key={tf}
                            onClick={() => setActiveTimeframe(tf)}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${activeTimeframe === tf
                                    ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                }`}
                        >
                            {tf}
                        </button>
                    ))}
                </div>
            </div>

            {/* Key Performance Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="flex flex-col items-center justify-center py-6">
                    <PerformanceGauge value={88} label="System Health" size="sm" />
                </Card>
                <Card className="flex flex-col items-center justify-center py-6">
                    <PerformanceGauge value={92} label="Customer Sat." size="sm" color="#8b5cf6" />
                </Card>
                <Card className="flex flex-col items-center justify-center py-6">
                    <PerformanceGauge value={95} label="Uptime" size="sm" color="#10b981" />
                </Card>
                <Card className="flex flex-col items-center justify-center py-6">
                    <PerformanceGauge value={76} label="Utilization" size="sm" color="#f59e0b" />
                </Card>
            </div>

            {/* Main Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <h3 className="font-bold mb-4 text-gray-700 dark:text-gray-200">Health Trend Analysis</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.performanceHistory || []}>
                                <defs>
                                    <linearGradient id="colorHealth" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156, 163, 175, 0.2)" />
                                <XAxis dataKey="time" axisLine={false} tickLine={false} className="text-xs text-gray-400" />
                                <YAxis axisLine={false} tickLine={false} className="text-xs text-gray-400" domain={[0, 100]} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                />
                                <Area type="monotone" dataKey="score" stroke="#10b981" fillOpacity={1} fill="url(#colorHealth)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card>
                    <h3 className="font-bold mb-4 text-gray-700 dark:text-gray-200">Response Time Distribution</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.performanceHistory || []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156, 163, 175, 0.2)" />
                                <XAxis dataKey="time" axisLine={false} tickLine={false} className="text-xs text-gray-400" />
                                <YAxis axisLine={false} tickLine={false} className="text-xs text-gray-400" />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                />
                                <Line type="monotone" dataKey="resolution" stroke="#3b82f6" strokeWidth={3} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* Main Charts Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <h3 className="font-bold mb-4 text-center text-gray-700 dark:text-gray-200">Agent Status</h3>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={distributionData}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {distributionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card>
                    <h3 className="font-bold mb-4 text-center text-gray-700 dark:text-gray-200">Agent Types</h3>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={typeData}
                                    innerRadius={0}
                                    outerRadius={80}
                                    dataKey="value"
                                >
                                    {typeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card>
                    <h3 className="font-bold mb-4 text-center text-gray-700 dark:text-gray-200">Performance History</h3>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.callVolumeHistory ? data.callVolumeHistory.slice(-5) : []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="time" className="text-xs" />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="calls" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default AdvancedAnalytics;
