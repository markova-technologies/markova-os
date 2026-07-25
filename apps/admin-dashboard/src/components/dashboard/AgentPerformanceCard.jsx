import React from 'react';
import Card from '../ui/Card';
import Gauge from '../ui/Gauge';
import { IoEllipsisVertical } from 'react-icons/io5';

const AgentPerformanceCard = ({ agent }) => {
    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'active':
                return 'bg-green-500';
            case 'idle':
                return 'bg-yellow-500';
            case 'offline':
                return 'bg-red-500';
            default:
                return 'bg-gray-500';
        }
    };

    return (
        <Card className="relative">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                            {agent?.name?.charAt(0) || 'A'}
                        </span>
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                            {agent?.name || 'Unknown Agent'}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {agent?.type || 'AI Agent'}
                        </p>
                    </div>
                </div>
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                    <IoEllipsisVertical className="w-5 h-5 text-gray-500" />
                </button>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2 mb-4">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(agent?.status)}`} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                    {agent?.status || 'Unknown'}
                </span>
            </div>

            {/* Performance Gauge */}
            <div className="flex justify-center mb-4">
                <Gauge
                    value={agent?.healthScore || 0}
                    maxValue={100}
                    label="Health Score"
                    size={100}
                />
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Calls Today</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {agent?.callsToday || 0}
                    </p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Response</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {agent?.avgResponse || '0'}ms
                    </p>
                </div>
            </div>
        </Card>
    );
};

export default AgentPerformanceCard;
