import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { DollarSign, TrendingUp, Users, ArrowUpRight, ArrowDownRight, Download } from 'lucide-react';

export default function RevenueAnalytics() {
  const [revenueData, setRevenueData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRevenueData();
  }, []);

  const fetchRevenueData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/revenue`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
      );
      setRevenueData(res.data);
    } catch (err) {
      console.error('Failed to fetch revenue data:', err);
      setError(err?.response?.data?.error || 'Failed to load revenue data. Check API connection.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-emerald-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mr-3"></div>
        Loading revenue analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-red-400 text-lg font-semibold">⚠️ Revenue data unavailable</div>
        <p className="text-gray-400 text-sm max-w-md text-center">{error}</p>
        <button
          onClick={fetchRevenueData}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!revenueData) return null;

  const formatCurrency = (val) => `$${val.toLocaleString()}`;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 text-gray-100"
    >
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Revenue Analytics</h1>
          <p className="text-gray-400 text-sm">Financial performance, subscriptions, and MRR tracking</p>
        </div>
        <button className="flex items-center bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-lg border border-gray-700 transition-colors">
          <Download size={16} className="mr-2" /> Export Financial Report
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm mb-1">Monthly Recurring (MRR)</p>
              <h3 className="text-2xl font-bold text-white">{formatCurrency(revenueData.metrics.mrr)}</h3>
            </div>
            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
              <DollarSign size={20} />
            </div>
          </div>
          <p className="text-emerald-400 text-xs mt-3 flex items-center">
            <ArrowUpRight size={14} className="mr-1" /> +{revenueData.metrics.mrrGrowth}% vs last month
          </p>
        </div>
        
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm mb-1">Annual Recurring (ARR)</p>
              <h3 className="text-2xl font-bold text-white">{formatCurrency(revenueData.metrics.arr)}</h3>
            </div>
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
              <TrendingUp size={20} />
            </div>
          </div>
          <p className="text-emerald-400 text-xs mt-3 flex items-center">
            <ArrowUpRight size={14} className="mr-1" /> On track for target
          </p>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm mb-1">New Subscriptions</p>
              <h3 className="text-2xl font-bold text-white">{revenueData.metrics.newSubscriptions}</h3>
            </div>
            <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
              <Users size={20} />
            </div>
          </div>
          <p className="text-emerald-400 text-xs mt-3 flex items-center">
            <ArrowUpRight size={14} className="mr-1" /> +4 this week
          </p>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm mb-1">Churn Rate</p>
              <h3 className="text-2xl font-bold text-white">{revenueData.metrics.churnRate}%</h3>
            </div>
            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
              <ArrowDownRight size={20} />
            </div>
          </div>
          <p className="text-emerald-400 text-xs mt-3 flex items-center">
            <ArrowDownRight size={14} className="mr-1" /> Improved by 0.3%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Revenue Trend Chart */}
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 col-span-2">
          <h3 className="text-lg font-medium text-white mb-6">Revenue & Expenses Trend</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData.revenueTrend}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(val) => `$${val/1000}k`} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value) => [`$${value.toLocaleString()}`]}
                />
                <Legend verticalAlign="top" height={36}/>
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="expenses" name="Compute Expenses" stroke="#ef4444" fillOpacity={1} fill="url(#colorExp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <h3 className="text-lg font-medium text-white mb-6">Subscription Tiers</h3>
          <div className="h-64 flex justify-center items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={revenueData.planDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {revenueData.planDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff', borderRadius: '0.5rem' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center space-x-6 mt-2">
            {revenueData.planDistribution.map((entry, index) => (
              <div key={index} className="flex items-center text-sm text-gray-300">
                <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: entry.color }}></span>
                {entry.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-700 bg-gray-800/50">
          <h3 className="text-lg font-medium text-white">Recent Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="text-xs text-gray-500 uppercase bg-gray-900/50">
              <tr>
                <th className="px-6 py-4 font-medium">Transaction ID</th>
                <th className="px-6 py-4 font-medium">Tenant</th>
                <th className="px-6 py-4 font-medium text-right">Amount</th>
                <th className="px-6 py-4 font-medium">Plan</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {revenueData.recentTransactions.map((trx, idx) => (
                <tr key={idx} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-4 font-mono text-gray-400">{trx.id}</td>
                  <td className="px-6 py-4 font-medium text-gray-200">{trx.tenant}</td>
                  <td className="px-6 py-4 text-right font-medium text-white">${trx.amount.toFixed(2)}</td>
                  <td className="px-6 py-4">{trx.plan}</td>
                  <td className="px-6 py-4">{trx.date}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      trx.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                      'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {trx.status.charAt(0).toUpperCase() + trx.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-gray-700 bg-gray-800/50 text-center">
          <button className="text-sm text-emerald-400 hover:text-emerald-300 font-medium">View All Transactions</button>
        </div>
      </div>
    </motion.div>
  );
}