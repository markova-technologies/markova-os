import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  IoBusiness, 
  IoSearch, 
  IoCheckmarkCircle, 
  IoPauseCircle, 
  IoAdd, 
  IoTrash, 
  IoClose, 
  IoShieldCheckmark,
  IoSettingsSharp,
  IoChevronForward
} from 'react-icons/io5';
import Header from '../components/layout/Header';
import { useData } from '../contexts/DataContext';

export default function CompaniesManagement() {
  const { clients: tenants = [], loading } = useData();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyPlan, setNewCompanyPlan] = useState('starter');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Toggle suspension status state
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    setIsSubmitting(true);
    setActionError(null);

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/v1/admin/companies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newCompanyName,
          plan: newCompanyPlan
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create company');
      }

      // Reload window to trigger DataContext initial fetch refresh
      window.location.reload();
    } catch (err) {
      setActionError(err.message);
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (tenant) => {
    const nextStatus = tenant.status === 'active' ? 'suspended' : 'active';
    const confirmMsg = `Are you sure you want to ${nextStatus === 'suspended' ? 'suspend' : 'activate'} "${tenant.name}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/v1/admin/companies/${tenant.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update company status');
      }

      window.location.reload();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteCompany = async (tenant) => {
    const confirmMsg = `WARNING: Deleting "${tenant.name}" will permanently erase all associated agents, calls, phone configurations, and metrics. Type the company name to confirm:`;
    const responseName = window.prompt(confirmMsg);
    if (responseName !== tenant.name) {
      if (responseName !== null) alert('Confirmation name mismatch. Action cancelled.');
      return;
    }

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/v1/admin/companies/${tenant.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete company');
      }

      window.location.reload();
    } catch (err) {
      alert(err.message);
    }
  };

  const filtered = (tenants || []).filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) || 
                        (t.industry && t.industry.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const activeTenants = (tenants || []).filter(t => t.status === 'active');
  const totalMRR = activeTenants.reduce((sum, t) => sum + (t.mrr || 0), 0);
  const totalAgents = (tenants || []).reduce((s, t) => s + (t.agents || 0), 0);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-medium">Loading companies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
      <Header title="Companies Management" breadcrumbs={['Admin', 'Companies']} />

      <main className="p-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Tenants', value: tenants.length, color: 'text-blue-500' },
            { label: 'Active Tenants', value: activeTenants.length, color: 'text-green-500' },
            { label: 'Total MRR', value: `$${totalMRR.toLocaleString()}`, color: 'text-purple-500' },
            { label: 'Total Agents Deployed', value: totalAgents, color: 'text-amber-500' },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
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
            <button 
              onClick={() => {
                setNewCompanyName('');
                setNewCompanyPlan('starter');
                setActionError(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1 bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm"
            >
              <IoAdd /> Add Tenant
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left bg-gray-50 dark:bg-gray-800/50">
                <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Company</th>
                <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Plan</th>
                <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Agents</th>
                <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Total Calls</th>
                <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">MRR</th>
                <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500 dark:text-gray-400">No companies found.</td>
                </tr>
              ) : (
                filtered.map((t, i) => (
                  <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                          {t.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800 dark:text-white">{t.name}</div>
                          <div className="text-xs text-gray-400">{t.industry || 'Technology'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.plan === 'enterprise' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : t.plan === 'plus' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {t.plan.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{t.agents || 0}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{(t.calls || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800 dark:text-white">${t.mrr || 0}</td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => handleToggleStatus(t)}
                        className={`flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80 ${t.status === 'active' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}
                      >
                        {t.status === 'active' ? <IoCheckmarkCircle className="w-4 h-4" /> : <IoPauseCircle className="w-4 h-4" />}
                        {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleToggleStatus(t)}
                          title={t.status === 'active' ? 'Suspend Company' : 'Activate Company'}
                          className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          <IoPauseCircle className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteCompany(t)}
                          title="Delete Company"
                          className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          <IoTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Add Tenant Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-2xl relative z-10"
            >
              <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100 dark:border-gray-750">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <IoBusiness className="text-blue-500" />
                  Add New Tenant Company
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <IoClose className="w-5 h-5" />
                </button>
              </div>

              {actionError && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                  {actionError}
                </div>
              )}

              <form onSubmit={handleCreateCompany} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Company Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Abyssinia Motors"
                    value={newCompanyName}
                    onChange={e => setNewCompanyName(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-950 dark:text-white outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Subscription Plan</label>
                  <select 
                    value={newCompanyPlan}
                    onChange={e => setNewCompanyPlan(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-950 dark:text-white outline-none focus:border-blue-500"
                  >
                    <option value="starter">Starter</option>
                    <option value="plus">Plus</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors mt-6 shadow-md"
                >
                  {isSubmitting ? 'Provisioning...' : 'Provision Tenant'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}