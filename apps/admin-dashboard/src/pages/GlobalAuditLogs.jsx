import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Search, Filter, Download, Activity, ShieldAlert, CheckCircle2, AlertTriangle, User } from 'lucide-react';

export default function GlobalAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      // Mocking /api/admin/audit-logs endpoint
      const res = await axios.get('http://localhost:8000/api/admin/audit-logs').catch(() => ({
        data: {
          logs: [
            { id: 'log-001', timestamp: '2026-06-29T10:45:12Z', user: 'admin@markova.tech', action: 'TENANT_CREATED', target: 'Acme Corp', ip: '192.168.1.45', status: 'success', type: 'system' },
            { id: 'log-002', timestamp: '2026-06-29T10:30:05Z', user: 'sarah@markova.tech', action: 'BILLING_UPDATED', target: 'MedHealth Clinics', ip: '10.0.0.15', status: 'success', type: 'billing' },
            { id: 'log-003', timestamp: '2026-06-29T09:15:22Z', user: 'system', action: 'API_KEY_REVOKED', target: 'Global Logistics (Key mk_live_...)', ip: 'internal', status: 'success', type: 'security' },
            { id: 'log-004', timestamp: '2026-06-29T08:42:10Z', user: 'unknown', action: 'FAILED_LOGIN_ATTEMPT', target: 'admin@markova.tech', ip: '45.22.11.9', status: 'failure', type: 'security' },
            { id: 'log-005', timestamp: '2026-06-28T16:20:00Z', user: 'admin@markova.tech', action: 'FEATURE_FLAG_TOGGLED', target: 'new_flow_builder_v2 (enabled)', ip: '192.168.1.45', status: 'success', type: 'system' },
            { id: 'log-006', timestamp: '2026-06-28T14:10:33Z', user: 'james@markova.tech', action: 'TENANT_SUSPENDED', target: 'FastRetail', ip: '10.0.0.42', status: 'success', type: 'system' },
            { id: 'log-007', timestamp: '2026-06-28T11:05:15Z', user: 'system', action: 'SUBSCRIPTION_RENEWED', target: 'EduTech Online', ip: 'internal', status: 'success', type: 'billing' },
            { id: 'log-008', timestamp: '2026-06-27T09:30:00Z', user: 'sarah@markova.tech', action: 'USER_ROLE_CHANGED', target: 'james@markova.tech (Support -> Admin)', ip: '10.0.0.15', status: 'success', type: 'security' },
          ]
        }
      }));
      setLogs(res.data.logs || []);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionIcon = (type) => {
    switch(type) {
      case 'security': return <ShieldAlert size={16} className="text-amber-400" />;
      case 'billing': return <Activity size={16} className="text-blue-400" />;
      default: return <User size={16} className="text-gray-400" />;
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'success') return <CheckCircle2 size={16} className="text-emerald-400" />;
    return <AlertTriangle size={16} className="text-red-400" />;
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.user.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.target.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || log.type === filterType;
    return matchesSearch && matchesType;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-emerald-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mr-3"></div>
        Loading global audit logs...
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
          <h1 className="text-2xl font-bold text-white mb-1">Global Audit Logs</h1>
          <p className="text-gray-400 text-sm">Comprehensive security and system activity tracking</p>
        </div>
        <button className="flex items-center bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-lg border border-gray-700 transition-colors">
          <Download size={16} className="mr-2" /> Export Logs (CSV)
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex flex-col md:flex-row justify-between items-center bg-gray-800/50 gap-4">
          <div className="relative w-full md:w-96">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search by user, action, or target..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg pl-9 pr-4 py-2 w-full focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center text-sm text-gray-400">
              <Filter size={16} className="mr-2" /> Filter:
            </div>
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Events</option>
              <option value="security">Security</option>
              <option value="billing">Billing</option>
              <option value="system">System</option>
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="text-xs text-gray-500 uppercase bg-gray-900/50">
              <tr>
                <th className="px-6 py-4 font-medium">Timestamp</th>
                <th className="px-6 py-4 font-medium">Action</th>
                <th className="px-6 py-4 font-medium">User / Source</th>
                <th className="px-6 py-4 font-medium">Target Entity</th>
                <th className="px-6 py-4 font-medium">IP Address</th>
                <th className="px-6 py-4 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-300 font-mono text-xs">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-200 flex items-center">
                    <span className="mr-2">{getActionIcon(log.type)}</span>
                    {log.action}
                  </td>
                  <td className="px-6 py-4">{log.user}</td>
                  <td className="px-6 py-4 truncate max-w-xs" title={log.target}>{log.target}</td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-500">{log.ip}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      {getStatusIcon(log.status)}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    No audit logs found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-gray-700 bg-gray-800/50 flex justify-between items-center text-sm text-gray-400">
          <div>Showing {filteredLogs.length} events</div>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-gray-900 border border-gray-700 rounded hover:bg-gray-700 disabled:opacity-50" disabled>Previous</button>
            <button className="px-3 py-1 bg-gray-900 border border-gray-700 rounded hover:bg-gray-700">Next</button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}