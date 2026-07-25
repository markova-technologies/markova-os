import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoSpeedometer, IoShieldCheckmark, IoTime, IoPulse } from 'react-icons/io5';
import PerformanceGauge from './PerformanceGauge';
import Card from './ui/Card';

const AgentPerformanceDetails = ({ agent }) => {
    const [activeTab, setActiveTab] = useState('overview');

    if (!agent) return <div className="p-8 text-center text-gray-500">Select an agent to view details</div>;

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'metrics', label: 'Detailed Metrics' },
        { id: 'history', label: 'History' },
    ];

    return (
        <Card className="h-full">
            <div className="flex items-center justify-between mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">{agent.name}</h3>
                    <p className="text-sm text-gray-500">{agent.type} • <span className="capitalize">{agent.status}</span></p>
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${activeTab === tab.id
                                ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'overview' && (
                    <motion.div
                        key="overview"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-6"
                    >
                        <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                            <PerformanceGauge value={agent.healthScore} size="md" label="Overall Health" />
                        </div>
                        <div className="space-y-4">
                            <div className="bg-primary-50 dark:bg-primary-900/10 p-4 rounded-xl flex items-center gap-4">
                                <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-full text-primary-600 dark:text-primary-400">
                                    <IoTime className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Avg Response Time</p>
                                    <p className="text-xl font-bold text-gray-800 dark:text-white">{agent.avgResponse}ms</p>
                                </div>
                            </div>
                            <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl flex items-center gap-4">
                                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400">
                                    <IoShieldCheckmark className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Success Rate</p>
                                    <p className="text-xl font-bold text-gray-800 dark:text-white">98.5%</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'metrics' && (
                    <motion.div
                        key="metrics"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="space-y-6"
                    >
                        {[
                            { label: 'Response Accuracy', val: 95, color: 'bg-green-500' },
                            { label: 'Tone Consistency', val: 88, color: 'bg-primary-500' },
                            { label: 'Context Retention', val: 92, color: 'bg-purple-500' },
                            { label: 'Instruction Following', val: 97, color: 'bg-indigo-500' }
                        ].map((metric, i) => (
                            <div key={i}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600 dark:text-gray-300">{metric.label}</span>
                                    <span className="font-bold text-gray-800 dark:text-white">{metric.val}%</span>
                                </div>
                                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${metric.val}%` }}
                                        className={`h-full ${metric.color}`}
                                    />
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}

                {activeTab === 'history' && (
                    <motion.div
                        key="history"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="flex flex-col items-center justify-center h-48 text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl"
                    >
                        <IoPulse className="w-12 h-12 mb-2 opacity-50" />
                        <p>Detailed history logs available in full report.</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
};

export default AgentPerformanceDetails;
