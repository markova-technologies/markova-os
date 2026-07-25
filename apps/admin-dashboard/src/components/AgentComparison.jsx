import React, { useState } from 'react';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import Card from './ui/Card';
import { IoCheckmarkCircle, IoWarning, IoGitCompare } from 'react-icons/io5';

const AgentComparison = ({ agents, selectedIds = [], onToggleSelection }) => {
    // Determine which agents to show
    const selectedAgents = agents.filter(a => selectedIds.includes(a.id));

    // Generate comparison data
    // In a real app, this would come from the backend or be calculated from agent stats
    const comparisonData = [
        { subject: 'Satisfaction', fullMark: 100 },
        { subject: 'Response Time', fullMark: 100 },
        { subject: 'Resolution', fullMark: 100 },
        { subject: 'Availability', fullMark: 100 },
        { subject: 'Accuracy', fullMark: 100 },
    ];

    // Merge agent scores into data
    const data = comparisonData.map(item => {
        const newItem = { ...item };
        selectedAgents.forEach(agent => {
            // Mock random scores seeded by name length for consistency in demo
            const seed = agent.name.length;
            if (item.subject === 'Satisfaction') newItem[agent.name] = Math.min(100, 85 + (seed % 15));
            if (item.subject === 'Response Time') newItem[agent.name] = Math.min(100, 70 + (seed % 30));
            if (item.subject === 'Resolution') newItem[agent.name] = Math.min(100, 80 + (seed % 20));
            if (item.subject === 'Availability') newItem[agent.name] = Math.min(100, 50 + (seed % 50));
            if (item.subject === 'Accuracy') newItem[agent.name] = Math.min(100, 90 + (seed % 10));
        });
        return newItem;
    });

    const colors = ['#3b82f6', '#10b981', '#f59e0b'];

    if (selectedAgents.length === 0) {
        return (
            <div className="h-96 flex flex-col items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                <IoGitCompare className="w-16 h-16 mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-gray-500">Select agents to compare</h3>
                <p className="max-w-md text-center mt-2">
                    Select up to 3 agents from the list above to view a detailed side-by-side performance comparison.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Radar Chart */}
            <Card className="lg:col-span-2 min-h-[400px]">
                <h3 className="font-bold mb-6 text-gray-800 dark:text-white">Performance Matrix</h3>
                <ResponsiveContainer width="100%" height={350}>
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                        <PolarGrid stroke="#e5e7eb" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        {selectedAgents.map((agent, index) => (
                            <Radar
                                key={agent.id}
                                name={agent.name}
                                dataKey={agent.name}
                                stroke={colors[index % colors.length]}
                                fill={colors[index % colors.length]}
                                fillOpacity={0.3}
                            />
                        ))}
                        <Legend />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </Card>

            {/* Metrics Breakdown */}
            <div className="space-y-6">
                {selectedAgents.map((agent, index) => (
                    <Card key={agent.id} className="relative overflow-hidden border-l-4" style={{ borderLeftColor: colors[index % colors.length] }}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="font-bold text-lg text-gray-800 dark:text-white">{agent.name}</h4>
                                <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded inline-block mt-1">
                                    {agent.type}
                                </span>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-gray-800 dark:text-white">{agent.healthScore}%</div>
                                <div className="text-xs text-gray-500">Overall Score</div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-500">Response Speed</span>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">{data.find(d => d.subject === 'Response Time')[agent.name]}%</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full"
                                        style={{ width: `${data.find(d => d.subject === 'Response Time')[agent.name]}%`, backgroundColor: colors[index % colors.length] }}
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-500">Accuracy</span>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">{data.find(d => d.subject === 'Accuracy')[agent.name]}%</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full"
                                        style={{ width: `${data.find(d => d.subject === 'Accuracy')[agent.name]}%`, backgroundColor: colors[index % colors.length] }}
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default AgentComparison;
