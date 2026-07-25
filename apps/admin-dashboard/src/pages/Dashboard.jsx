import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    IoPeople,
    IoTime,
    IoCheckmarkCircle,
    IoAlertCircle,
    IoPulse,
    IoTrendingUp
} from 'react-icons/io5';
import Header from '../components/layout/Header';
import StatsCard from '../components/dashboard/StatsCard';
import AgentPerformanceCard from '../components/dashboard/AgentPerformanceCard';
import RealTimeAnalytics from '../components/RealTimeAnalytics';
import PerformanceGauge from '../components/PerformanceGauge';
import AdvancedAnalytics from '../components/AdvancedAnalytics';
import { useData } from '../contexts/DataContext';

const Dashboard = ({ onMenuClick }) => {
    const { agents, analytics, loading } = useData();
    const [viewMode, setViewMode] = useState('overview'); // overview | advanced

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 font-medium">Loading premium dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
            <Header title="Dashboard Overview" breadcrumbs={['Main', 'Dashboard']} onMenuClick={onMenuClick} />

            <main className="p-6">
                {/* View Mode Toggle */}
                <div className="flex justify-end mb-6">
                    <div className="flex bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
                        <button
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'overview' ? 'bg-primary-500 text-white shadow-md' : 'text-gray-500'}`}
                            onClick={() => setViewMode('overview')}
                        >
                            Overview
                        </button>
                        <button
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'advanced' ? 'bg-primary-500 text-white shadow-md' : 'text-gray-500'}`}
                            onClick={() => setViewMode('advanced')}
                        >
                            Advanced Analytics
                        </button>
                    </div>
                </div>

                {viewMode === 'advanced' ? (
                    <AdvancedAnalytics data={analytics} />
                ) : (
                    <>
                        {/* Real-time Stats */}
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 items-start"
                        >
                            <StatsCard
                                title="Call Volume"
                                value={analytics.totalCalls || 0}
                                change={12}
                                icon={IoPeople}
                                color="primary"
                                sparklineData={analytics.callVolumeHistory?.map(h => h.calls) || [0, 0, 0]}
                            />
                            <StatsCard
                                title="Active Agents"
                                value={analytics.activeAgents || 0}
                                change={5}
                                icon={IoTime}
                                color="purple"
                                sparklineData={[agents.length, agents.length]}
                            />
                            <StatsCard
                                title="Health Score"
                                value={`${analytics.successRate || 100}%`}
                                change={1.2}
                                icon={IoCheckmarkCircle}
                                color="success"
                                sparklineData={[90, 95, 100]}
                            />
                            <StatsCard
                                title="Avg. Response"
                                value={`${analytics.avgResponseTime || 0}s`}
                                change={-0.3}
                                icon={IoPulse}
                                trend="down"
                                color="danger"
                                sparklineData={analytics.callVolumeHistory?.map(h => h.calls > 0 ? 40 : 100) || [0]}
                            />
                        </motion.div>

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            <RealTimeAnalytics
                                title="Call Volume (Real-time)"
                                data={analytics.callVolumeHistory || []}
                                dataKey="calls"
                                color="#0ea5e9"
                                height={300}
                            />
                            <RealTimeAnalytics
                                title="Revenue Trend (Real-time)"
                                data={analytics.callVolumeHistory || []} // Using callVolumeHistory as proxy for revenue in this demo
                                dataKey="revenue"
                                color="#a855f7"
                                height={300}
                            />
                        </div>

                        {/* Agent Grid */}
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <IoPulse className="text-primary-500" />
                                    Live Agent Monitoring
                                </h2>
                                <button className="text-primary-500 font-medium hover:underline">View All Agents</button>
                            </div>

                            <motion.div
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                            >
                                {agents.slice(0, 8).map((agent) => (
                                    <AgentPerformanceCard key={agent.id} agent={agent} />
                                ))}
                            </motion.div>
                        </div>

                        {/* Proactive Alerts Section */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass-card mb-8"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <IoTrendingUp className="text-warning-500 w-6 h-6" />
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Proactive Insights</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800">
                                    <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400 mb-1">High Load Warning</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">Agent "Nexus-7" is experiencing higher than normal latency. Consider scaling resources.</p>
                                </div>
                                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                                    <p className="text-sm font-semibold text-green-800 dark:text-green-400 mb-1">Performance Peak</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">System reliability is at an all-time high of 99.98% over the last 6 hours.</p>
                                </div>
                                <div className="p-4 rounded-lg bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800">
                                    <p className="text-sm font-semibold text-primary-800 dark:text-primary-400 mb-1">Optimization Goal</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">Current response times are 15% better than last week's average.</p>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </main>
        </div>
    );
};

export default Dashboard;
