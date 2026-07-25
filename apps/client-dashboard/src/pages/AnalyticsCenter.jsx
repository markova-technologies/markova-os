import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { 
  BarChart3, 
  Users, 
  PhoneCall, 
  Briefcase, 
  DollarSign, 
  Activity,
  Calendar as CalendarIcon,
  Download,
  TrendingUp,
  TrendingDown,
  Loader2
} from 'lucide-react'
import api from '../api/client'
import './Analytics.css'

const fallbackStats = {
  agent: [
    { title: 'Total Handled Calls', value: '1,248', trend: '+12.5%', isPositive: true, icon: PhoneCall, color: 'blue' },
    { title: 'Avg Handle Time', value: '2m 14s', trend: '-5.2%', isPositive: true, icon: Activity, color: 'emerald' },
    { title: 'First Contact Resolution', value: '84%', trend: '+2.1%', isPositive: true, icon: BarChart3, color: 'purple' },
    { title: 'Escalation Rate', value: '12%', trend: '-1.5%', isPositive: true, icon: Users, color: 'amber' },
  ],
  business: [
    { title: 'Meetings Booked', value: '142', trend: '+24%', isPositive: true, icon: CalendarIcon, color: 'emerald' },
    { title: 'Lead Conversion', value: '18.4%', trend: '+4.2%', isPositive: true, icon: TrendingUp, color: 'blue' },
    { title: 'Pipeline Value Generated', value: '$45,200', trend: '+15%', isPositive: true, icon: DollarSign, color: 'purple' },
    { title: 'Customer Churn Risk', value: '4.2%', trend: '-0.8%', isPositive: true, icon: Activity, color: 'amber' },
  ]
}

const fallbackLineData = [
  { name: 'Mon', calls: 120, conversion: 15 },
  { name: 'Tue', calls: 132, conversion: 18 },
  { name: 'Wed', calls: 101, conversion: 14 },
  { name: 'Thu', calls: 142, conversion: 19 },
  { name: 'Fri', calls: 150, conversion: 22 },
  { name: 'Sat', calls: 90, conversion: 12 },
  { name: 'Sun', calls: 110, conversion: 16 },
]

const fallbackPieData = [
  { name: 'Sales Intents', value: 400 },
  { name: 'Support Issues', value: 300 },
  { name: 'General Inquiry', value: 200 },
  { name: 'Escalations', value: 100 },
]

const fallbackTableData = [
  { id: '1', agent: 'Support Team', calls: 450, avgTime: '2m 10s', resolution: '88%', cSat: '4.8/5' },
  { id: '2', agent: 'Sales Team', calls: 320, avgTime: '4m 45s', resolution: '72%', cSat: '4.6/5' },
  { id: '3', agent: 'Commander Agent', calls: 890, avgTime: '0m 45s', resolution: '95%', cSat: '4.9/5' },
]

const AnalyticsCenter = () => {
  const [activeTab, setActiveTab] = useState('agent')
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('30d')
  
  const [statsData, setStatsData] = useState(fallbackStats)
  const [lineChartData, setLineChartData] = useState(fallbackLineData)
  const [pieChartData, setPieChartData] = useState(fallbackPieData)
  const [tableData, setTableData] = useState(fallbackTableData)

  const tabs = [
    { id: 'agent', label: 'Agent Analytics', icon: BarChart3 },
    { id: 'team', label: 'Team Analytics', icon: Users },
    { id: 'call', label: 'Call Analytics', icon: PhoneCall },
    { id: 'business', label: 'Business Analytics', icon: Briefcase },
    { id: 'cost', label: 'Cost Analytics', icon: DollarSign },
    { id: 'usage', label: 'Usage & Latency', icon: Activity },
  ]

  useEffect(() => {
    fetchAnalytics()
  }, [dateRange, activeTab])

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      // Mocking API call to /analytics/dashboard
      const res = await api.get(`/analytics/dashboard?tab=${activeTab}&range=${dateRange}`).catch(() => null)
      if (res && res.data) {
        setStatsData(res.data.stats || fallbackStats)
        setLineChartData(res.data.lineData || fallbackLineData)
        setPieChartData(res.data.pieData || fallbackPieData)
        setTableData(res.data.tableData || fallbackTableData)
      } else {
        // use fallbacks
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = () => {
    const headers = ['Agent/Team', 'Total Calls', 'Avg Time', 'Resolution Rate', 'CSAT']
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + tableData.map(e => `${e.agent},${e.calls},${e.avgTime},${e.resolution},${e.cSat}`).join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `analytics_${activeTab}_${dateRange}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const currentStats = statsData[activeTab] || statsData['agent']
  const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444']

  return (
    <div className="analytics-center">
      <div className="ac-header">
        <div className="ac-title-row">
          <div className="ac-title">
            <h1>Analytics Center</h1>
            <p>Executive insights across your AI workforce, calls, and business outcomes.</p>
          </div>
          <div className="ac-actions">
            <div className="ac-date-picker" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-main)', border: '1px solid var(--border-main)', padding: '0.5rem 1rem', borderRadius: '0.5rem', color: 'var(--text-main)' }}>
              <CalendarIcon size={16} color="var(--gray)" />
              <select value={dateRange} onChange={e => setDateRange(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }}>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="ytd">Year to Date</option>
              </select>
            </div>
            <button className="btn btn-secondary" onClick={handleExportCSV}><Download size={16} /> Export CSV</button>
          </div>
        </div>
        
        <div className="ac-tabs" style={{ overflowX: 'auto', display: 'flex', gap: '0.5rem' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button 
                key={tab.id}
                className={`ac-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} /> {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="ac-main">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--primary)' }}><Loader2 className="spinner" size={32} /></div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
            >
              {/* Stats Grid */}
              <div className="ac-stats-grid">
                {currentStats.map((stat, i) => {
                  const Icon = stat.icon || Activity;
                  return (
                    <div className="ac-stat-card" key={i}>
                      <div className="ac-stat-header">
                        <span className="ac-stat-title">{stat.title}</span>
                        <div className={`ac-stat-icon ${stat.color}`}>
                          <Icon size={16} />
                        </div>
                      </div>
                      <div className="ac-stat-value">{stat.value}</div>
                      <div className={`ac-stat-trend ${stat.isPositive ? 'positive' : 'negative'}`}>
                        {stat.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {stat.trend} vs last period
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Charts Grid */}
              <div className="ac-charts-grid">
                <div className="ac-chart-card">
                  <div className="ac-chart-header">
                    <h3 className="ac-chart-title">Performance Over Time</h3>
                    <select style={{ background: 'transparent', color: 'var(--gray)', border: 'none', outline: 'none' }}>
                      <option>Daily</option>
                      <option>Weekly</option>
                    </select>
                  </div>
                  <div className="ac-chart-placeholder" style={{ height: '300px', padding: '1rem 0' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lineChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="name" stroke="#888" />
                        <YAxis yAxisId="left" stroke="#888" />
                        <YAxis yAxisId="right" orientation="right" stroke="#888" />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                        <Line yAxisId="left" type="monotone" dataKey="calls" stroke="#3b82f6" activeDot={{ r: 8 }} />
                        <Line yAxisId="right" type="monotone" dataKey="conversion" stroke="#10b981" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="ac-chart-card">
                  <div className="ac-chart-header">
                    <h3 className="ac-chart-title">Distribution</h3>
                  </div>
                  <div className="ac-chart-placeholder" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Table Area */}
              <div className="ac-chart-card" style={{ minHeight: 'auto', overflowX: 'auto' }}>
                 <div className="ac-chart-header" style={{ marginBottom: '1rem' }}>
                    <h3 className="ac-chart-title">Detailed Breakdown ({activeTab})</h3>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-main)', color: 'var(--gray)' }}>
                        <th style={{ padding: '1rem' }}>Entity</th>
                        <th style={{ padding: '1rem' }}>Total Calls</th>
                        <th style={{ padding: '1rem' }}>Avg Time</th>
                        <th style={{ padding: '1rem' }}>Resolution Rate</th>
                        <th style={{ padding: '1rem' }}>CSAT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row) => (
                        <tr key={row.id} style={{ borderBottom: '1px solid var(--border-main)' }}>
                          <td style={{ padding: '1rem', color: 'var(--text-main)', fontWeight: 500 }}>{row.agent}</td>
                          <td style={{ padding: '1rem', color: 'var(--text-main)' }}>{row.calls}</td>
                          <td style={{ padding: '1rem', color: 'var(--text-main)' }}>{row.avgTime}</td>
                          <td style={{ padding: '1rem', color: '#10b981' }}>{row.resolution}</td>
                          <td style={{ padding: '1rem', color: 'var(--text-main)' }}>{row.cSat}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>

            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

export default AnalyticsCenter
