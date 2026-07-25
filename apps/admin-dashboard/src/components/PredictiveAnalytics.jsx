import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import { IoTrendingUp, IoWarning, IoAnalytics, IoFlash, IoCheckmarkCircle } from 'react-icons/io5';
import Card from './ui/Card';

const PredictiveAnalytics = ({ agentId }) => {
    // Mock predictive data
    const generatePredictionData = () => {
        const data = [];
        const today = new Date();

        // Past 7 days (Actuals)
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            data.push({
                date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                actual: 85 + Math.random() * 10,
                type: 'History'
            });
        }

        // Next 5 days (Forecast)
        const lastValue = data[data.length - 1].actual;
        for (let i = 1; i <= 5; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            const forecast = lastValue + (Math.random() * 5 - 2); // Slight random drift
            data.push({
                date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                forecast: forecast,
                range: [forecast - 5, forecast + 5], // Confidence interval
                type: 'Forecast'
            });
        }
        return data;
    };

    const [data] = useState(generatePredictionData());

    return (
        <div className="space-y-6">


            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Forecast Chart */}
                <Card className="lg:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <IoTrendingUp className="text-primary-500" />
                                Health Trend Forecast
                            </h3>
                            <p className="text-sm text-gray-500">Projected performance with 95% confidence interval</p>
                        </div>
                        <span className="bg-primary-100 text-primary-700 text-xs font-bold px-2 py-1 rounded-full uppercase">
                            AI Model v2.1
                        </span>
                    </div>

                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={data}>
                                <defs>
                                    <linearGradient id="forecastRange" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156, 163, 175, 0.2)" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} className="text-xs text-gray-400" />
                                <YAxis domain={[60, 100]} axisLine={false} tickLine={false} className="text-xs text-gray-400" />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                />
                                <Legend />
                                <ReferenceLine x={data[6].date} stroke="#9ca3af" strokeDasharray="3 3" label={{ position: 'top', value: 'Today', fill: '#9ca3af', fontSize: 12 }} />

                                <Area
                                    type="monotone"
                                    dataKey="range"
                                    fill="url(#forecastRange)"
                                    stroke="transparent"
                                    name="Confidence Range"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="actual"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    name="Historical Data"
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="forecast"
                                    stroke="#8b5cf6"
                                    strokeWidth={3}
                                    strokeDasharray="5 5"
                                    name="AI Forecast"
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Risk & Insights */}
                <div className="space-y-6">
                    <Card>
                        <h3 className="font-bold mb-4 flex items-center gap-2">
                            <IoFlash className="text-yellow-500" />
                            Predicted Risks
                        </h3>
                        <div className="space-y-3">
                            <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 rounded-lg">
                                <div className="flex justify-between items-start">
                                    <h4 className="text-sm font-bold text-red-700 dark:text-red-400">Latency Spike</h4>
                                    <span className="text-xs font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">High Probability</span>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Expected increase in response time on Friday afternoon based on historical load.</p>
                            </div>
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 rounded-lg">
                                <div className="flex justify-between items-start">
                                    <h4 className="text-sm font-bold text-yellow-700 dark:text-yellow-400">Resource Saturation</h4>
                                    <span className="text-xs font-bold bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded">Medium Risk</span>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Token usage may approach limit in 3 days if current growth continues.</p>
                            </div>
                        </div>
                    </Card>

                    <Card className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-xl border-none">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 bg-white/20 rounded-lg">
                                <IoAnalytics size={18} className="text-white" />
                            </div>
                            <h3 className="font-bold text-lg">AI Suggestion</h3>
                        </div>
                        <p className="text-sm text-indigo-50/90 leading-relaxed">
                            💡 **Smart Tip**: Based on your usage patterns, switching to the "Turbo" model during off-peak hours (2am - 6am) could save you up to 15% in costs without impacting service quality.
                        </p>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default PredictiveAnalytics;
