import React, { useEffect, useState } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Card from '../ui/Card';

const LiveChart = ({
    title,
    data = [],
    dataKey = 'value',
    type = 'line',
    color = '#0ea5e9',
    height = 300
}) => {
    const [chartData, setChartData] = useState(data);

    useEffect(() => {
        setChartData(data);
    }, [data]);

    const ChartComponent = type === 'area' ? AreaChart : LineChart;
    const DataComponent = type === 'area' ? Area : Line;

    return (
        <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {title}
            </h3>
            <ResponsiveContainer width="100%" height={height}>
                <ChartComponent data={chartData}>
                    <defs>
                        <linearGradient id={`color${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                            <stop offset="95%" stopColor={color} stopOpacity={0.1} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(156, 163, 175, 0.2)" />
                    <XAxis
                        dataKey="time"
                        stroke="currentColor"
                        style={{ fontSize: '12px' }}
                        tick={{ fill: 'currentColor' }}
                    />
                    <YAxis
                        stroke="currentColor"
                        style={{ fontSize: '12px' }}
                        tick={{ fill: 'currentColor' }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            border: '1px solid rgba(156, 163, 175, 0.3)',
                            borderRadius: '8px',
                            backdropFilter: 'blur(10px)',
                        }}
                    />
                    <Legend />
                    <DataComponent
                        type="monotone"
                        dataKey={dataKey}
                        stroke={color}
                        strokeWidth={2}
                        fill={type === 'area' ? `url(#color${dataKey})` : color}
                        dot={{ fill: color, r: 4 }}
                        activeDot={{ r: 6 }}
                    />
                </ChartComponent>
            </ResponsiveContainer>
        </Card>
    );
};

export default LiveChart;
