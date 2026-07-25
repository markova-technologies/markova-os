import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { Building2, PhoneCall, Clock, CreditCard, ArrowUpRight, Search, Download } from 'lucide-react';

export default function TenantUsage() {
  const [usageData, setUsageData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsageData();
  }, []);

  const fetchUsageData = async () => {
    setIsLoading(true);
    try {
      // Mocking /api/tenant/all-usage response for now until backend endpoint exists
      const res = await axios.get('http://localhost:8000/api/tenant/all-usage').catch(() => ({
        data: {
          tenants: [
            { id: '1', name: 'Acme Corp', industry: 'SaaS', users: 12, agents: 5, totalCalls: 4500, totalMinutes: 12450, cost: 373.50, status: 'active' },
            { id: '2', name: 'Global Logistics', industry: 'Logistics', users: 4, agents: 2, totalCalls: 1200, totalMinutes: 4800, cost: 144.00, status: 'active' },
            { id: '3', name: 'MedHealth Clinics', industry: 'Healthcare', users: 25, agents: 10, totalCalls: 8900, totalMinutes: 26700, cost: 801.00, status: 'active' },
            { id: '4', name: 'EduTech Online', industry: 'Education', users: 8, agents: 3, totalCalls: 3200, totalMinutes: 9600, cost: 288.00, status: 'warning' },
            { id: '5', name: 'FastRetail', industry: 'E-commerce', users: 15, agents: 8, totalCalls: 15600, totalMinutes: 45000, cost: 1350.00, status: 'active' },
          ],
          trends: [
            { date: '2026-06-23', minutes: 12000, calls: 4000 },
            { date: '2026-06-24', minutes: 14500, calls: 4800 },
            { date: '2026-06-25', minutes: 13200, calls: 4400 },
            { date: '2026-06-26', minutes: 16800, calls: 5600 },
            { date: '2026-06-27', minutes: 18500, calls: 6100 },
            { date: '2026-06-28', minutes: 15400, calls: 5100 },
            { date: '2026-06-29', minutes: 19100, calls: 6400 },
          ],
          summary: {
            totalTenants: 124,
            activeTenants: 118,
            totalMinutesThisMonth: 1084050,
            projectedCost: 32521.50
          }
        }
      }));
      setUsageData(res.data.tenants || []);
      setTrendData(res.data.trends || []);
    } catch (error) {
      console.error('Failed to fetch usage data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTenants = usageData.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-emerald-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mr-3"></div>
        Loading tenant usage...
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
          <h1 className="text-2xl font-bold text-white mb-1">Tenant Usage</h1>
          <p className="text-gray-400 text-sm">Monitor platform resource consumption across all workspaces</p>
        </div>
        <button className="flex items-center bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-lg border border-gray-700 transition-colors">
          <Download size={16} className="mr-2" /> Export Report
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Active Tenants</p>
              <h3 className="text-2xl font-bold text-white">118</h3>
            </div>
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
              <Building2 size={20} />
            </div>
          </div>
          <p className="text-emerald-400 text-xs mt-3 flex items-center">
            <ArrowUpRight size={14} className="mr-1" /> +12 this month
          </p>
        </div>
        
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Minutes (MTD)</p>
              <h3 className="text-2xl font-bold text-white">1,084,050</h3>
            </div>
            <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
              <Clock size={20} />
            </div>
          </div>
          <p className="text-emerald-400 text-xs mt-3 flex items-center">
            <ArrowUpRight size={14} className="mr-1" /> +15.4% vs last month
          </p>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Calls (MTD)</p>
              <h3 className="text-2xl font-bold text-white">342,800</h3>
            </div>
            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
              <PhoneCall size={20} />
            </div>
          </div>
          <p className="text-emerald-400 text-xs mt-3 flex items-center">
            <ArrowUpRight size={14} className="mr-1" /> +8.2% vs last month
          </p>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm mb-1">Compute Cost (Est)</p>
              <h3 className="text-2xl font-bold text-white">$32,521</h3>
            </div>
            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
              <CreditCard size={20} />
            </div>
          </div>
          <p className="text-emerald-400 text-xs mt-3 flex items-center">
            <ArrowUpRight size={14} className="mr-1" /> On target
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <h3 className="text-lg font-medium text-white mb-6">Platform Minutes Trend</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickFormatter={(val) => val.slice(5)} />
                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(val) => `${val/1000}k`} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                  itemStyle={{ color: '#a78bfa' }}
                />
                <Line type="monotone" dataKey="minutes" stroke="#a78bfa" strokeWidth={3} dot={{ r: 4, fill: '#a78bfa' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <h3 className="text-lg font-medium text-white mb-6">Daily Call Volume</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickFormatter={(val) => val.slice(5)} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                  itemStyle={{ color: '#34d399' }}
                  cursor={{ fill: '#374151', opacity: 0.4 }}
                />
                <Bar dataKey="calls" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tenant Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
          <h3 className="text-lg font-medium text-white">Detailed Tenant Usage</h3>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search tenants..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-emerald-500 w-64 transition-colors"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="text-xs text-gray-500 uppercase bg-gray-900/50">
              <tr>
                <th className="px-6 py-4 font-medium">Tenant Name</th>
                <th className="px-6 py-4 font-medium">Industry</th>
                <th className="px-6 py-4 font-medium text-right">Users</th>
                <th className="px-6 py-4 font-medium text-right">Agents</th>
                <th className="px-6 py-4 font-medium text-right">Total Calls</th>
                <th className="px-6 py-4 font-medium text-right">Minutes</th>
                <th className="px-6 py-4 font-medium text-right">Est. Cost</th>
                <th className="px-6 py-4 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {filteredTenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-200">{tenant.name}</td>
                  <td className="px-6 py-4">{tenant.industry}</td>
                  <td className="px-6 py-4 text-right">{tenant.users}</td>
                  <td className="px-6 py-4 text-right">{tenant.agents}</td>
                  <td className="px-6 py-4 text-right">{tenant.totalCalls.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-mono text-emerald-400">{tenant.totalMinutes.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">${tenant.cost.toFixed(2)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      tenant.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                      'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {tenant.status.charAt(0).toUpperCase() + tenant.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredTenants.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                    No tenants found matching "{searchTerm}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}