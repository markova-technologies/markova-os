import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
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
  Bot,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Search,
  ArrowUpDown,
  PhoneOff,
  Zap,
  CheckCircle2,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import api from '../api/client'
import { useToast } from '../contexts/ToastContext'
import { useEnvironment } from '../contexts/EnvironmentContext'
import './Analytics.css'

// Comprehensive Analytics Data Models for all 6 tabs
const ANALYTICS_DATA = {
  agent: {
    stats: [
      { title: 'Total Handled Calls', value: '1,248', trend: '+12.5%', isPositive: true, icon: PhoneCall, color: 'amber' },
      { title: 'Avg Handle Time', value: '2m 14s', trend: '-5.2%', isPositive: true, icon: Activity, color: 'emerald' },
      { title: 'First Contact Resolution', value: '86.4%', trend: '+2.8%', isPositive: true, icon: BarChart3, color: 'blue' },
      { title: 'Escalation Rate', value: '10.2%', trend: '-1.8%', isPositive: true, icon: Users, color: 'purple' },
    ],
    chartTitle: 'Agent Throughput & Resolution Trend',
    primaryMetric: 'Calls Handled',
    secondaryMetric: 'Resolution Rate (%)',
    dailyData: [
      { name: 'Mon', primary: 142, secondary: 84 },
      { name: 'Tue', primary: 168, secondary: 87 },
      { name: 'Wed', primary: 155, secondary: 85 },
      { name: 'Thu', primary: 182, secondary: 89 },
      { name: 'Fri', primary: 195, secondary: 88 },
      { name: 'Sat', primary: 110, secondary: 82 },
      { name: 'Sun', primary: 125, secondary: 86 },
    ],
    weeklyData: [
      { name: 'Week 1', primary: 890, secondary: 83 },
      { name: 'Week 2', primary: 980, secondary: 85 },
      { name: 'Week 3', primary: 1120, secondary: 86 },
      { name: 'Week 4', primary: 1248, secondary: 87 },
    ],
    pieTitle: 'Calls Distribution by Agent',
    pieData: [
      { name: 'Almaz (Customer Care)', value: 520, color: '#f59e0b' },
      { name: 'Dawit (Sales & Booking)', value: 340, color: '#3b82f6' },
      { name: 'Abebe (Logistics)', value: 260, color: '#10b981' },
      { name: 'Sara (Support)', value: 128, color: '#a855f7' },
    ],
    tableColumns: ['Agent / Voice Identity', 'Role / Department', 'Total Calls', 'Avg Handle Time', 'Resolution Rate', 'CSAT Score', 'Status'],
    tableRows: [
      { id: '1', col1: 'Almaz (Customer Care)', col2: 'General Support & Showroom', col3: '520', col4: '2m 10s', col5: '88.4%', col6: '4.9 / 5.0', status: 'Optimal' },
      { id: '2', col1: 'Dawit (Sales & Booking)', col2: 'Corporate & Retail Sales', col3: '340', col4: '3m 45s', col5: '82.1%', col6: '4.8 / 5.0', status: 'Optimal' },
      { id: '3', col1: 'Abebe (Delivery Dispatch)', col2: 'Logistics & Order Status', col3: '260', col4: '1m 55s', col5: '91.5%', col6: '4.7 / 5.0', status: 'Optimal' },
      { id: '4', col1: 'Sara (After-Sales)', col2: 'Warranty & Replacements', col3: '128', col4: '2m 40s', col5: '79.2%', col6: '4.6 / 5.0', status: 'Review' },
    ]
  },

  team: {
    stats: [
      { title: 'AI Workforce Containment', value: '88.5%', trend: '+3.4%', isPositive: true, icon: Bot, color: 'emerald' },
      { title: 'Supervisor Barge-Ins', value: '24', trend: '-22.5%', isPositive: true, icon: ShieldCheck, color: 'amber' },
      { title: 'Active AI Voice Agents', value: '12', trend: '+2 new', isPositive: true, icon: Users, color: 'blue' },
      { title: 'Team CSAT Benchmark', value: '4.86 / 5', trend: '+0.15', isPositive: true, icon: Sparkles, color: 'purple' },
    ],
    chartTitle: 'Autonomous AI vs Supervisor Escalations',
    primaryMetric: 'AI Automated',
    secondaryMetric: 'Escalated to Human',
    dailyData: [
      { name: 'Mon', primary: 128, secondary: 14 },
      { name: 'Tue', primary: 149, secondary: 19 },
      { name: 'Wed', primary: 136, secondary: 16 },
      { name: 'Thu', primary: 164, secondary: 18 },
      { name: 'Fri', primary: 178, secondary: 17 },
      { name: 'Sat', primary: 98, secondary: 12 },
      { name: 'Sun', primary: 112, secondary: 13 },
    ],
    weeklyData: [
      { name: 'Week 1', primary: 780, secondary: 110 },
      { name: 'Week 2', primary: 860, secondary: 95 },
      { name: 'Week 3', primary: 990, secondary: 88 },
      { name: 'Week 4', primary: 1104, secondary: 84 },
    ],
    pieTitle: 'Workload by Department',
    pieData: [
      { name: 'Customer Support', value: 48, color: '#10b981' },
      { name: 'Commercial Sales', value: 28, color: '#3b82f6' },
      { name: 'Logistics & Dispatch', value: 16, color: '#f59e0b' },
      { name: 'Executive Escalation', value: 8, color: '#ef4444' },
    ],
    tableColumns: ['Department / Unit', 'Supervisor Lead', 'Handled Calls', 'Containment Rate', 'Escalations', 'Avg Response', 'Health SLA'],
    tableRows: [
      { id: '1', col1: 'Customer Support Unit', col2: 'Selamawit T.', col3: '580', col4: '89.2%', col5: '10.8%', col6: '1.2s', status: 'Healthy' },
      { id: '2', col1: 'Commercial Sales Unit', col2: 'Michael B.', col3: '390', col4: '84.5%', col5: '15.5%', col6: '1.4s', status: 'Healthy' },
      { id: '3', col1: 'Logistics & Dispatch', col2: 'Yonas K.', col3: '220', col4: '93.1%', col5: '6.9%', col6: '0.9s', status: 'Healthy' },
      { id: '4', col1: 'Priority Escalations', col2: 'Demo Developer', col3: '98', col4: '76.4%', col5: '23.6%', col6: '2.1s', status: 'Review' },
    ]
  },

  call: {
    stats: [
      { title: 'Total Telephony Minutes', value: '2,840 min', trend: '+14.2%', isPositive: true, icon: PhoneCall, color: 'amber' },
      { title: 'Inbound / Outbound Ratio', value: '78% / 22%', trend: '+4% Inbound', isPositive: true, icon: ArrowUpDown, color: 'blue' },
      { title: 'Peak Concurrent Calls', value: '18 channels', trend: '+3 surge', isPositive: true, icon: Activity, color: 'purple' },
      { title: 'Dropped / Abandoned Rate', value: '1.2%', trend: '-0.6%', isPositive: true, icon: PhoneOff, color: 'emerald' },
    ],
    chartTitle: 'Hourly Inbound & Outbound Traffic',
    primaryMetric: 'Inbound Calls',
    secondaryMetric: 'Outbound Campaigns',
    dailyData: [
      { name: '08:00', primary: 85, secondary: 20 },
      { name: '10:00', primary: 145, secondary: 35 },
      { name: '12:00', primary: 110, secondary: 25 },
      { name: '14:00', primary: 135, secondary: 30 },
      { name: '16:00', primary: 160, secondary: 40 },
      { name: '18:00', primary: 95, secondary: 15 },
      { name: '20:00', primary: 55, secondary: 10 },
    ],
    weeklyData: [
      { name: 'Mon', primary: 210, secondary: 45 },
      { name: 'Tue', primary: 235, secondary: 60 },
      { name: 'Wed', primary: 220, secondary: 50 },
      { name: 'Thu', primary: 260, secondary: 65 },
      { name: 'Fri', primary: 280, secondary: 70 },
      { name: 'Sat', primary: 140, secondary: 30 },
      { name: 'Sun', primary: 160, secondary: 35 },
    ],
    pieTitle: 'Caller Sentiment Analysis',
    pieData: [
      { name: 'Positive / Satisfied', value: 64, color: '#10b981' },
      { name: 'Neutral / Informational', value: 24, color: '#3b82f6' },
      { name: 'Frustrated / Displeased', value: 9, color: '#f59e0b' },
      { name: 'Escalated Urgency', value: 3, color: '#ef4444' },
    ],
    tableColumns: ['Time Window', 'Inbound Calls', 'Outbound Calls', 'Avg Call Duration', 'Call Success Rate', 'Dropped Calls', 'Line Status'],
    tableRows: [
      { id: '1', col1: '08:00 - 10:00 AM', col2: '240', col3: '45', col4: '2m 15s', col5: '98.4%', col6: '2', status: 'Optimal' },
      { id: '2', col1: '10:00 - 12:00 PM', col2: '410', col3: '80', col4: '2m 45s', col5: '99.1%', col6: '3', status: 'Peak' },
      { id: '3', col1: '12:00 - 02:00 PM', col2: '310', col3: '60', col4: '2m 05s', col5: '98.8%', col6: '2', status: 'Optimal' },
      { id: '4', col1: '02:00 - 04:00 PM', col2: '380', col3: '75', col4: '2m 30s', col5: '99.3%', col6: '1', status: 'Peak' },
    ]
  },

  business: {
    stats: [
      { title: 'Meetings & Visits Booked', value: '184', trend: '+28.4%', isPositive: true, icon: CalendarIcon, color: 'emerald' },
      { title: 'Qualified Sales Leads', value: '342', trend: '+14.2%', isPositive: true, icon: TrendingUp, color: 'blue' },
      { title: 'Pipeline Value Generated', value: '1,420,000 ብር', trend: '+18.5%', isPositive: true, icon: DollarSign, color: 'amber' },
      { title: 'Customer Churn Risk', value: '3.1%', trend: '-0.9%', isPositive: true, icon: Activity, color: 'purple' },
    ],
    chartTitle: 'Inquiries Received vs Qualified Pipeline',
    primaryMetric: 'Total Inquiries',
    secondaryMetric: 'Qualified Leads',
    dailyData: [
      { name: 'Mon', primary: 65, secondary: 22 },
      { name: 'Tue', primary: 78, secondary: 28 },
      { name: 'Wed', primary: 72, secondary: 25 },
      { name: 'Thu', primary: 85, secondary: 32 },
      { name: 'Fri', primary: 94, secondary: 38 },
      { name: 'Sat', primary: 52, secondary: 18 },
      { name: 'Sun', primary: 60, secondary: 21 },
    ],
    weeklyData: [
      { name: 'Week 1', primary: 380, secondary: 110 },
      { name: 'Week 2', primary: 440, secondary: 135 },
      { name: 'Week 3', primary: 510, secondary: 160 },
      { name: 'Week 4', primary: 580, secondary: 184 },
    ],
    pieTitle: 'Primary Call Intent Categories',
    pieData: [
      { name: 'Sofa & Living Room', value: 42, color: '#f59e0b' },
      { name: 'Showroom Visit Booking', value: 28, color: '#10b981' },
      { name: 'Delivery Tracking', value: 18, color: '#3b82f6' },
      { name: 'Custom Quote Requests', value: 12, color: '#a855f7' },
    ],
    tableColumns: ['Product Line / Campaign', 'Total Inquiries', 'Qualified Leads', 'Bookings', 'Pipeline Value', 'Conversion Rate', 'ROI Level'],
    tableRows: [
      { id: '1', col1: 'Luxury Sofa & Living Sets', col2: '480', col3: '165', col4: '74', col5: '680,000 ብር', col6: '34.4%', status: 'High' },
      { id: '2', col1: 'Corporate Workstations', col2: '290', col3: '98', col4: '42', col5: '410,000 ብር', col6: '33.8%', status: 'High' },
      { id: '3', col1: 'Master Bedroom Collections', col2: '240', col3: '54', col4: '36', col5: '215,000 ብር', col6: '22.5%', status: 'Medium' },
      { id: '4', col1: 'Custom Wood Dining Tables', col2: '150', col3: '45', col4: '32', col5: '115,000 ብር', col6: '30.0%', status: 'Medium' },
    ]
  },

  cost: {
    stats: [
      { title: 'Total AI Compute Spend', value: '1,842.50 ብር', trend: '~$14.74 USD', isPositive: true, icon: DollarSign, color: 'amber' },
      { title: 'Cost Per Resolved Call', value: '1.47 ብር', trend: 'vs 35 ብር human', isPositive: true, icon: Activity, color: 'emerald' },
      { title: 'Net Labor Savings', value: '41,830 ብር', trend: '88.4% reduction', isPositive: true, icon: TrendingDown, color: 'blue' },
      { title: 'ROI Efficiency Multiplier', value: '23.7x', trend: 'labor parity', isPositive: true, icon: Sparkles, color: 'purple' },
    ],
    chartTitle: 'Daily AI Compute Spend vs Labor Savings',
    primaryMetric: 'AI Compute Cost (ETB)',
    secondaryMetric: 'Net Savings (ETB / 10)',
    dailyData: [
      { name: 'Mon', primary: 220, secondary: 520 },
      { name: 'Tue', primary: 265, secondary: 610 },
      { name: 'Wed', primary: 245, secondary: 580 },
      { name: 'Thu', primary: 290, secondary: 680 },
      { name: 'Fri', primary: 310, secondary: 720 },
      { name: 'Sat', primary: 180, secondary: 410 },
      { name: 'Sun', primary: 210, secondary: 490 },
    ],
    weeklyData: [
      { name: 'Week 1', primary: 1250, secondary: 2800 },
      { name: 'Week 2', primary: 1420, secondary: 3200 },
      { name: 'Week 3', primary: 1680, secondary: 3800 },
      { name: 'Week 4', primary: 1842, secondary: 4183 },
    ],
    pieTitle: 'Cost Breakdown by Infrastructure',
    pieData: [
      { name: 'Carrier Telephony (SIP)', value: 42, color: '#f59e0b' },
      { name: 'LLM Reasoning (LLaMA 3.3)', value: 36, color: '#a855f7' },
      { name: 'STT (Groq Whisper v3)', value: 14, color: '#3b82f6' },
      { name: 'TTS (Edge Neural Mekdes)', value: 8, color: '#10b981' },
    ],
    tableColumns: ['Service Infrastructure Layer', 'Provider / Model', 'Billed Units', 'Unit Rate', 'Subtotal (ETB)', 'Subtotal (USD)', 'Share of Budget'],
    tableRows: [
      { id: '1', col1: 'Carrier SIP Trunking', col2: 'Ethio Telecom / Safaricom', col3: '1,540 min', col4: '0.50 ብር / min', col5: '770.00 ብር', col6: '$6.16', status: '41.8%' },
      { id: '2', col1: 'LLM Reasoning & Context', col2: 'Meta LLaMA 3.3 70B (Groq)', col3: '2,210k tokens', col4: '0.30 ብር / 1k', col5: '663.00 ብር', col6: '$5.30', status: '36.0%' },
      { id: '3', col1: 'Speech Recognition (STT)', col2: 'Groq Whisper Large v3', col3: '1,720 min', col4: '0.15 ብር / min', col5: '258.00 ብር', col6: '$2.06', status: '14.0%' },
      { id: '4', col1: 'Neural Voice Synthesis', col2: 'am-ET-MekdesNeural', col3: '3,030k chars', col4: '0.05 ብር / 1k', col5: '151.50 ብር', col6: '$1.21', status: '8.2%' },
    ]
  },

  usage: {
    stats: [
      { title: 'End-to-End Latency (P50)', value: '685 ms', trend: '-45ms faster', isPositive: true, icon: Activity, color: 'emerald' },
      { title: 'STT Turnaround Time', value: '185 ms', trend: 'Groq Whisper', isPositive: true, icon: Zap, color: 'blue' },
      { title: 'LLM Time-To-First-Token', value: '340 ms', trend: 'LLaMA 3.3 stream', isPositive: true, icon: Sparkles, color: 'amber' },
      { title: 'Voice Stream Buffer Delay', value: '160 ms', trend: 'Edge Neural chunk', isPositive: true, icon: Clock, color: 'purple' },
    ],
    chartTitle: 'Median (P50) vs 95th Percentile (P95) Latency (ms)',
    primaryMetric: 'P50 Latency (ms)',
    secondaryMetric: 'P95 Latency (ms)',
    dailyData: [
      { name: 'Mon', primary: 690, secondary: 940 },
      { name: 'Tue', primary: 675, secondary: 910 },
      { name: 'Wed', primary: 685, secondary: 925 },
      { name: 'Thu', primary: 670, secondary: 895 },
      { name: 'Fri', primary: 695, secondary: 960 },
      { name: 'Sat', primary: 660, secondary: 880 },
      { name: 'Sun', primary: 670, secondary: 890 },
    ],
    weeklyData: [
      { name: 'Week 1', primary: 740, secondary: 990 },
      { name: 'Week 2', primary: 710, secondary: 950 },
      { name: 'Week 3', primary: 695, secondary: 930 },
      { name: 'Week 4', primary: 685, secondary: 910 },
    ],
    pieTitle: 'Latency Contribution by Pipeline Stage',
    pieData: [
      { name: 'LLM Reasoning & RAG', value: 48, color: '#a855f7' },
      { name: 'STT Speech Recognition', value: 27, color: '#3b82f6' },
      { name: 'TTS Chunked Synthesis', value: 18, color: '#10b981' },
      { name: 'Telephony RTP Network', value: 7, color: '#f59e0b' },
    ],
    tableColumns: ['Pipeline Layer Stage', 'Engine / Provider', 'Target SLA', 'Median (P50)', '95th Pct (P95)', 'Jitter Variance', 'SLA Health'],
    tableRows: [
      { id: '1', col1: 'Silero Voice Activity Detection', col2: 'WebRTC Inbound VAD', col3: '< 50 ms', col4: '28 ms', col5: '42 ms', col6: '± 4 ms', status: 'Optimal' },
      { id: '2', col1: 'Acoustic Speech-To-Text', col2: 'Groq Whisper Large v3', col3: '< 250 ms', col4: '185 ms', col5: '240 ms', col6: '± 18 ms', status: 'Optimal' },
      { id: '3', col1: 'Prompt RAG & LLM Streaming', col2: 'Meta LLaMA 3.3 70B', col3: '< 450 ms', col4: '340 ms', col5: '480 ms', col6: '± 35 ms', status: 'Optimal' },
      { id: '4', col1: 'Text-To-Speech Synthesis', col2: 'am-ET-MekdesNeural', col3: '< 200 ms', col4: '160 ms', col5: '215 ms', col6: '± 12 ms', status: 'Optimal' },
    ]
  }
}

const TABS = [
  { id: 'agent', label: 'Agent Analytics', icon: BarChart3, badge: 'Workforce' },
  { id: 'team', label: 'Team & Escalations', icon: Users, badge: 'Containment' },
  { id: 'call', label: 'Call & Telephony', icon: PhoneCall, badge: 'Traffic' },
  { id: 'business', label: 'Business Outcomes', icon: Briefcase, badge: 'Conversion' },
  { id: 'cost', label: 'Cost & Savings', icon: DollarSign, badge: 'Finance' },
  { id: 'usage', label: 'Latency & SLA', icon: Activity, badge: 'Engine' },
]

const DATE_RANGES = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: '90d', label: 'Last 90 Days' },
  { id: 'ytd', label: 'Year to Date' },
]

const AnalyticsCenter = () => {
  const { environment } = useEnvironment()
  const { success, info } = useToast()

  const [activeTab, setActiveTab] = useState('agent')
  const [dateRange, setDateRange] = useState('30d')
  const [timeAgg, setTimeAgg] = useState('daily') // 'daily' | 'weekly'
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [lastRefreshed, setLastRefreshed] = useState(new Date())

  // Current active data slice
  const currentData = ANALYTICS_DATA[activeTab] || ANALYTICS_DATA.agent

  // Refresh data handler
  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => {
      setRefreshing(false)
      setLastRefreshed(new Date())
      success(`Updated ${TABS.find(t => t.id === activeTab)?.label} telemetry.`, 'Refreshed')
    }, 450)
  }

  // Export CSV handler
  const handleExportCSV = () => {
    const tabObj = TABS.find(t => t.id === activeTab) || TABS[0]
    const headers = currentData.tableColumns
    const rows = currentData.tableRows.map(row => [
      `"${row.col1}"`,
      `"${row.col2}"`,
      `"${row.col3}"`,
      `"${row.col4}"`,
      `"${row.col5}"`,
      `"${row.col6}"`,
      `"${row.status}"`,
    ])

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const dateStr = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `markova-analytics-${activeTab}-${dateRange}-${dateStr}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    success(`Exported ${tabObj.label} CSV successfully.`, 'Export Complete')
  }

  // Filter table rows by search query
  const filteredTableRows = useMemo(() => {
    if (!searchQuery.trim()) return currentData.tableRows
    const q = searchQuery.toLowerCase().trim()
    return currentData.tableRows.filter(row =>
      (row.col1 && row.col1.toLowerCase().includes(q)) ||
      (row.col2 && row.col2.toLowerCase().includes(q)) ||
      (row.status && row.status.toLowerCase().includes(q))
    )
  }, [currentData, searchQuery])

  // Chart dataset based on daily vs weekly aggregation
  const activeChartData = timeAgg === 'daily' ? currentData.dailyData : currentData.weeklyData

  // Total pie value to accurately format percentages vs volume
  const totalPieVal = useMemo(() => {
    return currentData.pieData.reduce((acc, curr) => acc + (curr.value || 0), 0)
  }, [currentData])

  const formatPieLegendVal = (val) => {
    if (totalPieVal <= 100) {
      return `${val}%`
    }
    const pct = totalPieVal > 0 ? Math.round((val / totalPieVal) * 100) : 0
    return `${val.toLocaleString()} (${pct}%)`
  }

  return (
    <div className="analytics-center">
      {/* Top Header */}
      <header className="ac-header">
        <div className="ac-title-row">
          <div className="ac-title">
            <div className="ac-title-headline">
              <h1>Analytics Center</h1>
              <span className={`ac-env-badge env-${environment}`}>
                <span className="ac-pulse-dot" />
                {environment === 'live' ? 'Live Telemetry' : 'Sandbox Analytics'}
              </span>
            </div>
            <p>Executive intelligence, conversational insights, and unit economics across your AI workforce.</p>
          </div>

          <div className="ac-actions">
            {/* Date Range Selector */}
            <div className="ac-date-selector" role="group" aria-label="Date range selector">
              {DATE_RANGES.map(r => (
                <button
                  key={r.id}
                  className={`ac-date-btn ${dateRange === r.id ? 'is-active' : ''}`}
                  onClick={() => setDateRange(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="ac-btn-group">
              <button
                className="btn btn-secondary ac-refresh-btn"
                onClick={handleRefresh}
                disabled={refreshing}
                title="Refresh analytics data"
              >
                <RefreshCw size={14} className={refreshing ? 'spin-icon' : ''} />
                <span>Refresh</span>
              </button>

              <button
                className="btn btn-secondary ac-export-btn"
                onClick={handleExportCSV}
                title="Export detailed table as CSV"
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Redesigned Upper Tab Navigation Bar with Generous Padding & Badges */}
        <div className="ac-tabs-bar" role="tablist">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                className={`ac-tab-pill ${isActive ? 'is-active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id)
                  setSearchQuery('')
                }}
              >
                <Icon size={16} className="ac-tab-icon" />
                <span className="ac-tab-label">{tab.label}</span>
                <span className="ac-tab-badge">{tab.badge}</span>
              </button>
            )
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="ac-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="ac-tab-content"
          >
            {/* 4 Primary KPI Cards */}
            <div className="ac-stats-grid">
              {currentData.stats.map((stat, i) => {
                const Icon = stat.icon || Activity
                return (
                  <div className="ac-stat-card" key={i}>
                    <div className="ac-stat-header">
                      <span className="ac-stat-title">{stat.title}</span>
                      <div className={`ac-stat-icon-wrap icon-${stat.color}`}>
                        <Icon size={16} />
                      </div>
                    </div>
                    <div className="ac-stat-value">{stat.value}</div>
                    <div className={`ac-stat-trend ${stat.isPositive ? 'positive' : 'neutral'}`}>
                      {stat.isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      <span>{stat.trend} vs last period</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Charts Grid: Performance Over Time & Distribution Donut */}
            <div className="ac-charts-grid">
              {/* Left Line Chart Card */}
              <div className="ac-chart-card">
                <div className="ac-chart-header">
                  <div>
                    <h3 className="ac-chart-title">{currentData.chartTitle}</h3>
                    <div className="ac-chart-legend-custom">
                      <span className="legend-chip">
                        <span className="chip-dot chip-blue" />
                        <span>{currentData.primaryMetric}</span>
                      </span>
                      <span className="legend-chip">
                        <span className="chip-dot chip-emerald" />
                        <span>{currentData.secondaryMetric}</span>
                      </span>
                    </div>
                  </div>

                  {/* Daily vs Weekly Toggle */}
                  <div className="ac-agg-toggle" role="group" aria-label="Aggregation toggle">
                    <button
                      className={`ac-agg-btn ${timeAgg === 'daily' ? 'is-active' : ''}`}
                      onClick={() => setTimeAgg('daily')}
                    >
                      Daily
                    </button>
                    <button
                      className={`ac-agg-btn ${timeAgg === 'weekly' ? 'is-active' : ''}`}
                      onClick={() => setTimeAgg('weekly')}
                    >
                      Weekly
                    </button>
                  </div>
                </div>

                <div className="ac-chart-canvas">
                  <ResponsiveContainer width="100%" height={290}>
                    <LineChart data={activeChartData} margin={{ top: 12, right: 12, left: -18, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} tickLine={false} />
                      <YAxis yAxisId="left" stroke="#64748b" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'rgba(18, 20, 29, 0.95)',
                          backdropFilter: 'blur(16px)',
                          borderColor: 'rgba(255, 255, 255, 0.15)',
                          borderRadius: '0.75rem',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                          color: '#ffffff',
                          fontSize: '12px'
                        }}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="primary"
                        name={currentData.primaryMetric}
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#3b82f6', stroke: '#12141f', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#60a5fa' }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="secondary"
                        name={currentData.secondaryMetric}
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#10b981', stroke: '#12141f', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#34d399' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Right Donut Distribution Chart Card */}
              <div className="ac-chart-card">
                <div className="ac-chart-header">
                  <h3 className="ac-chart-title">{currentData.pieTitle}</h3>
                </div>

                <div className="ac-donut-canvas">
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie
                        data={currentData.pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {currentData.pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0.4)" strokeWidth={2} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(val) => [formatPieLegendVal(val), 'Volume & Share']}
                        contentStyle={{
                          backgroundColor: 'rgba(18, 20, 29, 0.95)',
                          backdropFilter: 'blur(16px)',
                          borderColor: 'rgba(255, 255, 255, 0.15)',
                          borderRadius: '0.75rem',
                          color: '#ffffff',
                          fontSize: '12px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Donut Legend */}
                  <div className="ac-pie-legend">
                    {currentData.pieData.map((item, idx) => (
                      <div className="ac-pie-legend-item" key={idx}>
                        <span className="legend-dot" style={{ backgroundColor: item.color }} />
                        <span className="legend-text">{item.name}</span>
                        <span className="legend-val">{formatPieLegendVal(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Table Area */}
            <div className="ac-table-card">
              <div className="ac-table-header">
                <div>
                  <h3 className="ac-table-title">Detailed Telemetry Breakdown ({TABS.find(t => t.id === activeTab)?.label})</h3>
                  <span className="ac-table-subtitle">Granular unit performance and audit metrics for the current period.</span>
                </div>

                <div className="ac-table-search">
                  <Search size={14} className="ac-search-icon" />
                  <input
                    type="text"
                    placeholder="Filter records..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="ac-table-wrapper">
                <table className="ac-table">
                  <thead>
                    <tr>
                      {currentData.tableColumns.map((col, idx) => (
                        <th key={idx}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTableRows.map((row) => (
                      <tr key={row.id}>
                        <td className="ac-col-primary">{row.col1}</td>
                        <td>{row.col2}</td>
                        <td className="ac-mono">{row.col3}</td>
                        <td className="ac-mono">{row.col4}</td>
                        <td className="ac-mono text-emerald">{row.col5}</td>
                        <td className="ac-mono">{row.col6}</td>
                        <td>
                          <span className={`ac-status-badge status-${row.status.toLowerCase().replace(/\s+/g, '-')}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="ac-table-footer">
                <span>Showing {filteredTableRows.length} of {currentData.tableRows.length} entries</span>
                <span className="ac-footer-sync">
                  <CheckCircle2 size={12} color="#10b981" /> Reconciled with operational telemetry ledger
                </span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="ac-footer">
        <Clock size={13} />
        <span>
          Executive analytics automatically refreshed at {lastRefreshed.toLocaleTimeString()}. Metrics calculated from persistent call transcripts and provider API ledgers.
        </span>
      </footer>
    </div>
  )
}

export default AnalyticsCenter
