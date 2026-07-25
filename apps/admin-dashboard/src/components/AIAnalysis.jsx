import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { IoSparkles, IoRefresh, IoCheckmarkCircle, IoWarning } from 'react-icons/io5';
import Card from './ui/Card';

const AIAnalysis = ({ agents }) => {
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [insights, setInsights] = useState(null);
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    const [loadingInsights, setLoadingInsights] = useState(false);

    const analyzeAgent = async (agent) => {
        setSelectedAgent(agent);
        setLoadingAnalysis(true);
        setAnalysis(null);

        try {
            const response = await fetch(`http://localhost:5000/api/llm/analyze/${agent.id}`, {
                method: 'POST'
            });
            const data = await response.json();
            if (response.ok) {
                setAnalysis(data.analysis);
            } else {
                setAnalysis('Failed to analyze agent. Please try again.');
            }
        } catch (error) {
            setAnalysis('Connection error. Is the server running?');
        } finally {
            setLoadingAnalysis(false);
        }
    };

    const fetchInsights = async () => {
        setLoadingInsights(true);
        try {
            const response = await fetch('http://localhost:5000/api/llm/insights');
            const data = await response.json();
            if (response.ok) {
                setInsights(data.insights);
            } else {
                setInsights('Failed to generate insights.');
            }
        } catch (error) {
            setInsights('Connection error. Is the server running?');
        } finally {
            setLoadingInsights(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* System Insights */}
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <IoSparkles className="text-purple-500" />
                        AI-Powered System Insights
                    </h3>
                    <button
                        onClick={fetchInsights}
                        disabled={loadingInsights}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <IoRefresh className={loadingInsights ? 'animate-spin' : ''} />
                        Generate Insights
                    </button>
                </div>
                {insights ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-gradient-to-r from-purple-50 to-primary-50 dark:from-purple-900/20 dark:to-primary-900/20 rounded-xl border border-purple-100 dark:border-purple-800"
                    >
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{insights}</p>
                    </motion.div>
                ) : (
                    <p className="text-gray-500 text-sm">Click "Generate Insights" to get AI-powered analysis of your system.</p>
                )}
            </Card>

            {/* Agent Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Agent List */}
                <Card className="lg:col-span-1">
                    <h3 className="font-bold mb-4 text-gray-800 dark:text-white">Select Agent to Analyze</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {agents.map(agent => (
                            <button
                                key={agent.id}
                                onClick={() => analyzeAgent(agent)}
                                className={`w-full p-3 rounded-lg text-left transition-all flex items-center justify-between ${selectedAgent?.id === agent.id
                                    ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500'
                                    : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent'
                                    }`}
                            >
                                <div>
                                    <p className="font-medium text-gray-800 dark:text-white">{agent.name}</p>
                                    <p className="text-xs text-gray-500">{agent.type} • {agent.status}</p>
                                </div>
                                <div className={`w-3 h-3 rounded-full ${agent.healthScore >= 90 ? 'bg-green-500' :
                                    agent.healthScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`} />
                            </button>
                        ))}
                    </div>
                </Card>

                {/* Analysis Result */}
                <Card className="lg:col-span-2">
                    <h3 className="font-bold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
                        <IoSparkles className="text-primary-500" />
                        Agent Analysis
                    </h3>
                    {loadingAnalysis ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                                <p className="text-gray-500 text-sm">Analyzing {selectedAgent?.name}...</p>
                            </div>
                        </div>
                    ) : selectedAgent && analysis ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-4"
                        >
                            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                                <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                    {selectedAgent.name.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 dark:text-white">{selectedAgent.name}</h4>
                                    <div className="flex items-center gap-3 text-sm text-gray-500">
                                        <span>{selectedAgent.type}</span>
                                        <span>•</span>
                                        <span className={selectedAgent.status === 'active' ? 'text-green-500' : 'text-gray-500'}>
                                            {selectedAgent.status}
                                        </span>
                                        <span>•</span>
                                        <span>Health: {Math.round(selectedAgent.healthScore)}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800">
                                <h5 className="font-semibold text-primary-700 dark:text-primary-400 mb-2 flex items-center gap-2">
                                    <IoCheckmarkCircle />
                                    AI Analysis
                                </h5>
                                <p className="text-gray-700 dark:text-gray-300">{analysis}</p>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                            <IoWarning className="w-12 h-12 mb-2 opacity-50" />
                            <p>Select an agent to analyze</p>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default AIAnalysis;
