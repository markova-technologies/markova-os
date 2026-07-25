import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoCall, IoTime, IoPerson, IoMic, IoVolumeMedium, IoSearch, IoFunnel } from 'react-icons/io5';
import Header from '../components/layout/Header';

const liveCalls = [
  { id: 'lc-001', tenant: 'Abyssinia Motors', number: '+251 911 234 567', agent: 'Sales Qualifier', duration: '01:42', sentiment: 'positive', status: 'active' },
  { id: 'lc-002', tenant: 'Zemen Bank', number: '+251 922 345 678', agent: 'Support Tier 1', duration: '03:15', sentiment: 'neutral', status: 'active' },
  { id: 'lc-003', tenant: 'Abyssinia Motors', number: '+1 (415) 555-0198', agent: 'Commander Agent', duration: '00:28', sentiment: 'neutral', status: 'ringing' },
  { id: 'lc-004', tenant: 'Ethiopian Airlines Cargo', number: '+251 933 456 789', agent: 'Booking Agent', duration: '05:01', sentiment: 'positive', status: 'active' },
  { id: 'lc-005', tenant: 'Addis Pharma', number: '+251 944 567 890', agent: 'Support Tier 2', duration: '02:33', sentiment: 'negative', status: 'active' },
];

const sentimentColor = { positive: 'text-green-500', neutral: 'text-blue-500', negative: 'text-red-500' };
const sentimentBg = { positive: 'bg-green-100 dark:bg-green-900/20', neutral: 'bg-blue-100 dark:bg-blue-900/20', negative: 'bg-red-100 dark:bg-red-900/20' };

export default function ActiveCalls() {
  const [selectedCall, setSelectedCall] = useState(liveCalls[0]);
  const [search, setSearch] = useState('');

  const filtered = liveCalls.filter(c =>
    c.tenant.toLowerCase().includes(search.toLowerCase()) ||
    c.number.includes(search) ||
    c.agent.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
      <Header title="Active Calls — Platform Wide" breadcrumbs={['Admin', 'Active Calls']} />

      <main className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Live Calls Now', value: liveCalls.filter(c => c.status === 'active').length, color: 'text-green-500', icon: IoCall },
            { label: 'Ringing', value: liveCalls.filter(c => c.status === 'ringing').length, color: 'text-amber-500', icon: IoVolumeMedium },
            { label: 'Avg Duration', value: '02:38', color: 'text-blue-500', icon: IoTime },
            { label: 'Tenants Active', value: [...new Set(liveCalls.map(c => c.tenant))].length, color: 'text-purple-500', icon: IoPerson },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color} bg-gray-100 dark:bg-gray-700`}>
                <s.icon size={20} />
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Call List */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <IoSearch className="text-gray-400" />
              <input type="text" placeholder="Search calls..." value={search} onChange={e => setSearch(e.target.value)}
                className="bg-transparent outline-none text-sm text-gray-700 dark:text-gray-200 flex-1" />
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {filtered.map((call, i) => (
                <motion.div key={call.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${selectedCall?.id === call.id ? 'bg-blue-50 dark:bg-blue-900/10 border-l-4 border-l-blue-500' : ''}`}
                  onClick={() => setSelectedCall(call)}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${call.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
                      <span className="font-semibold text-sm text-gray-800 dark:text-white">{call.number}</span>
                    </div>
                    <span className="text-xs text-gray-400 font-mono">{call.duration}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{call.tenant} → {call.agent}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sentimentBg[call.sentiment]} ${sentimentColor[call.sentiment]}`}>
                      {call.sentiment}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Detail Panel */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            {selectedCall ? (
              <AnimatePresence mode="wait">
                <motion.div key={selectedCall.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-3 h-3 rounded-full ${selectedCall.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">{selectedCall.number}</h3>
                  </div>

                  <div className="space-y-3 mb-6">
                    {[
                      { label: 'Tenant', value: selectedCall.tenant },
                      { label: 'Agent', value: selectedCall.agent },
                      { label: 'Duration', value: selectedCall.duration },
                      { label: 'Status', value: selectedCall.status.toUpperCase() },
                      { label: 'Sentiment', value: selectedCall.sentiment },
                    ].map((field, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">{field.label}</span>
                        <span className="font-medium text-gray-800 dark:text-white">{field.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button className="w-full flex items-center justify-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                      <IoMic /> Listen In
                    </button>
                    <button className="w-full flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                      <IoCall /> Force Disconnect
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="text-center text-gray-400 py-8">Select a call to view details</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}