import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts';
import { Activity, Server, Database, Globe, ArrowUpCircle, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function PlatformHealth() {
  const [healthData, setHealthData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchHealthData();
  }, []);

  const fetchHealthData = async () => {
    setIsLoading(true);
    try {
      // Mocking /api/admin/health endpoint
      const res = await axios.get('http://localhost:8000/api/admin/health').catch(() => ({
        data: {
          status: 'operational',
          uptime: 99.99,
          activeNodes: 24,
          responseTimeAvg: 142,
          services: [
            { name: 'API Gateway', status: 'operational', uptime: 99.99, latency: 45 },
            { name: 'Tenant Service', status: 'operational', uptime: 99.99, latency: 120 },
            { name: 'Builder Service', status: 'operational', uptime: 99.95, latency: 85 },
            { name: 'Orchestrator Service', status: 'operational', uptime: 99.99, latency: 65 },
            { name: 'PostgreSQL Database', status: 'operational', uptime: 100, latency: 15 },
            { name: 'Redis Cache', status: 'operational', uptime: 100, latency: 5 },
            { name: 'Twilio Integration', status: 'operational', uptime: 99.90, latency: 210 },
            { name: 'OpenAI Integration', status: 'degraded', uptime: 98.50, latency: 1450 }
          ],
          latencyHistory: [
            { time: '10:00', api: 45, db: 15, ext: 300 },
            { time: '10:05', api: 48, db: 16, ext: 320 },
            { time: '10:10', api: 52, db: 14, ext: 290 },
            { time: '10:15', api: 120, db: 25, ext: 450 },
            { time: '10:20', api: 145, db: 30, ext: 1450 }, // OpenAI spike
            { time: '10:25', api: 110, db: 22, ext: 1200 },
            { time: '10:30', api: 65, db: 15, ext: 400 },
          ],
          incidents: [
            { id: 1, title: 'OpenAI API Latency Spike', status: 'investigating', time: '10:20 AM', severity: 'warning' },
            { id: 2, title: 'Database Maintenance', status: 'resolved', time: 'Yesterday 02:00 AM', severity: 'info' }
          ]
        }
      }));
      setHealthData(res.data);
    } catch (error) {
      console.error('Failed to fetch health data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !healthData) {
    return (
      <div className="flex items-center justify-center h-full text-emerald-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mr-3"></div>
        Loading platform health metrics...
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 text-gray-100"
    >
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 flex items-center">
            Platform Health
            <span className={`ml-3 px-3 py-1 text-xs font-medium rounded-full ${
              healthData.status === 'operational' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
              'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {healthData.status === 'operational' ? 'All Systems Operational' : 'Degraded Performance'}
            </span>
          </h1>
          <p className="text-gray-400 text-sm">Real-time service status, latency, and incident tracking</p>
        </div>
        <button onClick={fetchHealthData} className="flex items-center bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-lg border border-gray-700 transition-colors">
          Refresh Data
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm mb-1">Global Uptime</p>
              <h3 className="text-2xl font-bold text-white">{healthData.uptime}%</h3>
            </div>
            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
              <ArrowUpCircle size={20} />
            </div>
          </div>
          <p className="text-gray-400 text-xs mt-3">Trailing 30 days</p>
        </div>
        
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm mb-1">Avg Response Time</p>
              <h3 className="text-2xl font-bold text-white">{healthData.responseTimeAvg}ms</h3>
            </div>
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
              <Activity size={20} />
            </div>
          </div>
          <p className="text-amber-400 text-xs mt-3 flex items-center">
            <ArrowUpCircle size={14} className="mr-1 rotate-45" /> Elevated due to ext API
          </p>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm mb-1">Active Nodes</p>
              <h3 className="text-2xl font-bold text-white">{healthData.activeNodes}</h3>
            </div>
            <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
              <Server size={20} />
            </div>
          </div>
          <p className="text-emerald-400 text-xs mt-3 flex items-center">
            Auto-scaled +4 nodes
          </p>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm mb-1">Active Incidents</p>
              <h3 className="text-2xl font-bold text-white">{healthData.incidents.filter(i => i.status !== 'resolved').length}</h3>
            </div>
            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
              <AlertCircle size={20} />
            </div>
          </div>
          <p className="text-amber-400 text-xs mt-3 flex items-center">
            1 Investigating
          </p>
        </div>
      </div>

      {/* Latency Chart */}
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-8">
        <h3 className="text-lg font-medium text-white mb-6">System Latency (Last Hour)</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={healthData.latencyHistory}>
              <defs>
                <linearGradient id="colorApi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <RechartsTooltip 
                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend verticalAlign="top" height={36}/>
              <Area type="monotone" dataKey="ext" name="External APIs (ms)" stroke="#f59e0b" fillOpacity={1} fill="url(#colorExt)" />
              <Area type="monotone" dataKey="api" name="Internal API (ms)" stroke="#3b82f6" fillOpacity={1} fill="url(#colorApi)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Services Status */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 col-span-2 overflow-hidden">
          <div className="p-6 border-b border-gray-700 bg-gray-800/50">
            <h3 className="text-lg font-medium text-white">Service Status</h3>
          </div>
          <div className="p-0">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="text-xs text-gray-500 uppercase bg-gray-900/50 border-b border-gray-700">
                <tr>
                  <th className="px-6 py-4 font-medium">Service Name</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Uptime</th>
                  <th className="px-6 py-4 font-medium text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {healthData.services.map((service, idx) => (
                  <tr key={idx} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-200 flex items-center">
                      {service.name.includes('Database') ? <Database size={16} className="mr-3 text-gray-500" /> : 
                       service.name.includes('Integration') ? <Globe size={16} className="mr-3 text-gray-500" /> : 
                       <Server size={16} className="mr-3 text-gray-500" />}
                      {service.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`flex items-center text-xs font-medium ${service.status === 'operational' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {service.status === 'operational' ? <CheckCircle2 size={14} className="mr-1" /> : <AlertCircle size={14} className="mr-1" />}
                        {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">{service.uptime}%</td>
                    <td className="px-6 py-4 text-right font-mono">
                      <span className={service.latency > 500 ? 'text-amber-400' : 'text-gray-400'}>
                        {service.latency}ms
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Incidents */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-700 bg-gray-800/50">
            <h3 className="text-lg font-medium text-white">Recent Incidents</h3>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              {healthData.incidents.map((incident) => (
                <div key={incident.id} className="relative pl-6 border-l-2 border-gray-700">
                  <div className={`absolute -left-1.5 top-1.5 w-3 h-3 rounded-full ${
                    incident.status === 'resolved' ? 'bg-gray-500' : 'bg-amber-500 ring-4 ring-amber-500/20'
                  }`}></div>
                  <h4 className="text-sm font-medium text-white">{incident.title}</h4>
                  <p className="text-xs text-gray-500 mt-1">{incident.time} • {incident.status.toUpperCase()}</p>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:bg-gray-700 rounded-lg transition-colors">
              View Incident History
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}