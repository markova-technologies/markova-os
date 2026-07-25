import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { IoBusiness, IoSearch, IoEllipsisVertical, IoCheckmarkCircle, IoPauseCircle, IoAdd, IoChevronForward } from 'react-icons/io5';
import Header from '../components/layout/Header';

const tenantsData = [
  { id: 1, name: 'Abyssinia Motors', plan: 'Enterprise', agents: 12, calls: 4520, mrr: 899, status: 'active', industry: 'Automotive', joined: '2025-11-15' },
  { id: 2, name: 'Ethiopian Airlines Cargo', plan: 'Growth', agents: 6, calls: 2180, mrr: 299, status: 'active', industry: 'Logistics', joined: '2026-01-20' },
  { id: 3, name: 'Zemen Bank', plan: 'Enterprise', agents: 15, calls: 8900, mrr: 899, status: 'active', industry: 'Finance', joined: '2025-09-05' },
  { id: 4, name: 'Ride Addis', plan: 'Starter', agents: 2, calls: 340, mrr: 49, status: 'active', industry: 'Transport', joined: '2026-05-01' },
  { id: 5, name: 'TechHub Ethiopia', plan: 'Growth', agents: 4, calls: 1200, mrr: 299, status: 'suspended', industry: 'Technology', joined: '2026-02-10' },
  { id: 6, name: 'Addis Pharma', plan: 'Growth', agents: 5, calls: 1890, mrr: 299, status: 'active', industry: 'Healthcare', joined: '2026-03-18' },
];

export default function CompaniesManagement() {
  const [search, setSearch] = useState('');
  const [tenants, setTenants] = useState(tenantsData);
  const [filterStatus, setFilterStatus] = useState('all');

  const filtered = tenants.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.industry.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalMRR = tenants.filter(t => t.status === 'active').reduce((sum, t) => sum + t.mrr, 0);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
      <Header title="Companies Management" breadcrumbs={['Admin', 'Companies']} />

      <main className="p-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Tenants', value: tenants.length, color: 'text-blue-500' },
            { label: 'Active', value: tenants.filter(t => t.status === 'active').length, color: 'text-green-500' },
            { label: 'Total MRR', value: `$${totalMRR.toLocaleString()}`, color: 'text-purple-500' },
            { label: 'Total Agents Deployed', value: tenants.reduce((s, t) => s + t.agents, 0), color: 'text-amber-500' },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</div>
              <div className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</div>
            </motion.div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 flex-1 max-w-md">
            <IoSearch className="text-gray-400" />
            <input type="text" placeholder="Search companies..." value={search} onChange={e => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm text-gray-700 dark:text-gray-200 flex-1" />
          </div>
          <div className="flex items-center gap-2">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            <button className="flex items-center gap-1 bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
              <IoAdd /> Add Tenant
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Company</th>
                <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Plan</th>
                <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Agents</th>
                <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Total Calls</th>
                <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">MRR</th>
                <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                        {t.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800 dark:text-white">{t.name}</div>
                        <div className="text-xs text-gray-400">{t.industry}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.plan === 'Enterprise' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : t.plan === 'Growth' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {t.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{t.agents}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{t.calls.toLocaleString()}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800 dark:text-white">${t.mrr}</td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1 text-xs font-medium ${t.status === 'active' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                      {t.status === 'active' ? <IoCheckmarkCircle /> : <IoPauseCircle />}
                      {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3"><IoChevronForward className="text-gray-400" /></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}