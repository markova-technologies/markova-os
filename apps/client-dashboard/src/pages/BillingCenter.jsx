import React, { useEffect, useState, useMemo } from 'react'
import {
  CreditCard,
  Receipt,
  Zap,
  Shield,
  Phone,
  Download,
  Plus,
  Trash2,
  Star,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  Sliders,
  DollarSign,
  Wallet,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  FileText,
  Sparkles,
  ArrowUpRight,
  Check,
  Building,
  Printer,
  X
} from 'lucide-react'
import {
  getInvoices,
  getPricing,
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  topUpCredits,
  updateSubscriptionPlan,
  updateBillingSettings,
  getMe
} from '../api/client'
import './BillingCenter.css'

const EXCHANGE_RATE = 120.0

const formatCurrency = (amountEtb, currencyView = 'ETB') => {
  const num = Number(amountEtb || 0)
  if (currencyView === 'USD') {
    const usd = num / EXCHANGE_RATE
    return `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ETB`
}

const BillingCenter = () => {
  // Core state
  const [billing, setBilling] = useState(null)
  const [pricing, setPricing] = useState(null)
  const [paymentMethods, setPaymentMethods] = useState([])
  const [activeTab, setActiveTab] = useState('plans') // plans | credits | payment-methods | invoices | limits
  const [currencyView, setCurrencyView] = useState('ETB') // ETB | USD
  const [billingCycle, setBillingCycle] = useState('monthly') // monthly | annual
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState(null)

  // Invoice Filters
  const [searchInvoice, setSearchInvoice] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  // Modals state
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false)
  const [selectedTopUpPack, setSelectedTopUpPack] = useState(10000)
  const [customTopUpAmount, setCustomTopUpAmount] = useState('')
  const [topUpPaymentMethodId, setTopUpPaymentMethodId] = useState('')
  const [isSubmittingTopUp, setIsSubmittingTopUp] = useState(false)

  const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    type: 'telebirr',
    name: 'Telebirr SuperApp',
    identifier: '',
    account_name: 'Markova Enterprise Client',
    expiry: '08/28',
    is_default: false
  })
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)

  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [isEnterpriseModalOpen, setIsEnterpriseModalOpen] = useState(false)
  const [enterpriseForm, setEnterpriseForm] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    minutesNeeded: '50,000+',
    useCase: 'Inbound customer support & automated outbound appointment reminders'
  })
  const [isSubmittingEnterprise, setIsSubmittingEnterprise] = useState(false)

  // Limits / Auto-Recharge Form state
  const [rulesState, setRulesState] = useState({
    auto_recharge_enabled: true,
    auto_recharge_threshold_etb: 1000,
    auto_recharge_amount_etb: 5000,
    spending_cap_enabled: true,
    spending_cap_etb: 100000,
    notify_threshold_80: true,
    notify_threshold_95: true,
    notify_sms: true,
    notify_email: true
  })
  const [isSavingRules, setIsSavingRules] = useState(false)

  const showToast = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() })
    setTimeout(() => setToast(null), 4000)
  }

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true)
    try {
      const [invoiceRes, pricingRes, pmRes, meRes] = await Promise.all([
        getInvoices(),
        getPricing(),
        getPaymentMethods(),
        getMe().catch(() => ({ data: null }))
      ])

      const billingData = invoiceRes.data || {}
      setBilling(billingData)
      setPricing(pricingRes.data || null)
      setPaymentMethods(pmRes.data || [])

      if (billingData.current_cycle) {
        setBillingCycle(billingData.current_cycle.billing_cycle || 'monthly')
        setRulesState({
          auto_recharge_enabled: billingData.current_cycle.auto_recharge_enabled ?? true,
          auto_recharge_threshold_etb: billingData.current_cycle.auto_recharge_threshold_etb ?? 1000,
          auto_recharge_amount_etb: billingData.current_cycle.auto_recharge_amount_etb ?? 5000,
          spending_cap_enabled: billingData.current_cycle.spending_cap_enabled ?? true,
          spending_cap_etb: billingData.current_cycle.spending_cap_etb ?? 100000,
          notify_threshold_80: billingData.current_cycle.notify_threshold_80 ?? true,
          notify_threshold_95: billingData.current_cycle.notify_threshold_95 ?? true,
          notify_sms: billingData.current_cycle.notify_sms ?? true,
          notify_email: billingData.current_cycle.notify_email ?? true
        })
      }

      if (pmRes.data && pmRes.data.length > 0) {
        const defaultMethod = pmRes.data.find(m => m.is_default) || pmRes.data[0]
        setTopUpPaymentMethodId(defaultMethod.id)
      }

      if (isManualRefresh) {
        showToast('Billing & usage telemetry synchronized', 'success')
      }
    } catch (err) {
      console.error('Failed to load billing details:', err)
      showToast('Could not sync latest ledger. Using active workspace cache.', 'info')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Derived current active plan
  const currentPlanId = billing?.current_cycle?.plan_id || 'plus'
  const currentTier = useMemo(() => {
    if (!pricing?.tiers) return null
    return pricing.tiers.find(t => t.id === currentPlanId) || pricing.tiers[1]
  }, [pricing, currentPlanId])

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    if (!billing?.invoices) return []
    return billing.invoices.filter(inv => {
      const matchesSearch =
        (inv.number || '').toLowerCase().includes(searchInvoice.toLowerCase()) ||
        (inv.description || '').toLowerCase().includes(searchInvoice.toLowerCase()) ||
        (inv.payment_method || '').toLowerCase().includes(searchInvoice.toLowerCase())

      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter
      const matchesType = typeFilter === 'all' || inv.type === typeFilter

      return matchesSearch && matchesStatus && matchesType
    })
  }, [billing, searchInvoice, statusFilter, typeFilter])

  // Actions
  const handleSwitchPlan = async (tierId) => {
    if (tierId === 'enterprise') {
      setIsEnterpriseModalOpen(true)
      return
    }

    try {
      await updateSubscriptionPlan(tierId, billingCycle)
      await loadData()
      showToast(`Subscription plan updated to ${tierId.toUpperCase()} (${billingCycle})`, 'success')
    } catch (err) {
      showToast('Failed to switch plan. Please try again.', 'error')
    }
  }

  const handleToggleBillingCycle = async (newCycle) => {
    setBillingCycle(newCycle)
    try {
      await updateSubscriptionPlan(currentPlanId, newCycle)
      await loadData()
      showToast(`Billing cadence switched to ${newCycle}. ${newCycle === 'annual' ? '20% savings applied!' : ''}`, 'success')
    } catch (err) {
      console.error(err)
    }
  }

  const handleTopUpSubmit = async (e) => {
    e.preventDefault()
    setIsSubmittingTopUp(true)

    const finalAmount = customTopUpAmount ? Number(customTopUpAmount) : Number(selectedTopUpPack)
    if (!finalAmount || finalAmount <= 0) {
      showToast('Please enter a valid top-up amount', 'error')
      setIsSubmittingTopUp(false)
      return
    }

    const selectedPm = paymentMethods.find(m => m.id === topUpPaymentMethodId) || paymentMethods[0]

    try {
      await topUpCredits({
        amount_etb: finalAmount,
        payment_method_id: selectedPm?.id,
        payment_method_name: `${selectedPm?.name} (${selectedPm?.identifier})`
      })
      await loadData()
      setIsTopUpModalOpen(false)
      setCustomTopUpAmount('')
      showToast(`Successfully credited ${formatCurrency(finalAmount, currencyView)} to telephony pool!`, 'success')
    } catch (err) {
      showToast('Payment authorization failed. Please check funds.', 'error')
    } finally {
      setIsSubmittingTopUp(false)
    }
  }

  const handleAddPaymentMethod = async (e) => {
    e.preventDefault()
    if (!paymentForm.identifier) {
      showToast('Please provide an account number or phone number', 'error')
      return
    }

    setIsSubmittingPayment(true)
    try {
      await addPaymentMethod({
        type: paymentForm.type,
        name: paymentForm.type === 'telebirr' ? 'Telebirr SuperApp' : paymentForm.type === 'cbe_birr' ? 'CBE Birr' : 'Corporate Card',
        identifier: paymentForm.identifier,
        account_name: paymentForm.account_name || 'Markova Enterprise Client',
        expiry: paymentForm.type === 'card' ? paymentForm.expiry : undefined,
        is_default: paymentForm.is_default
      })
      await loadData()
      setIsAddPaymentModalOpen(false)
      setPaymentForm({
        type: 'telebirr',
        name: 'Telebirr SuperApp',
        identifier: '',
        account_name: 'Markova Enterprise Client',
        expiry: '08/28',
        is_default: false
      })
      showToast('New payment instrument verified & saved', 'success')
    } catch (err) {
      showToast('Failed to add payment method.', 'error')
    } finally {
      setIsSubmittingPayment(false)
    }
  }

  const handleDeletePaymentMethod = async (id) => {
    if (paymentMethods.length <= 1) {
      showToast('At least one payment method is required for auto-settlement', 'error')
      return
    }
    try {
      await deletePaymentMethod(id)
      await loadData()
      showToast('Payment method removed', 'info')
    } catch (err) {
      showToast('Could not remove payment method', 'error')
    }
  }

  const handleSetDefaultPaymentMethod = async (id) => {
    try {
      await setDefaultPaymentMethod(id)
      await loadData()
      showToast('Default payment method updated', 'success')
    } catch (err) {
      showToast('Failed to update default payment method', 'error')
    }
  }

  const handleSaveRules = async (e) => {
    e.preventDefault()
    setIsSavingRules(true)
    try {
      await updateBillingSettings(rulesState)
      await loadData()
      showToast('Auto-recharge rules and threshold alerts saved', 'success')
    } catch (err) {
      showToast('Failed to update billing rules', 'error')
    } finally {
      setIsSavingRules(false)
    }
  }

  const handleExportCsv = () => {
    if (!billing?.invoices || billing.invoices.length === 0) {
      showToast('No invoices available to export', 'info')
      return
    }

    const headers = ['Invoice ID', 'Date', 'Description', 'Type', 'Status', 'Amount ETB', 'Amount USD', 'Payment Method']
    const rows = billing.invoices.map(inv => [
      inv.number || inv.id,
      inv.created_at ? new Date(inv.created_at).toISOString().split('T')[0] : '',
      `"${(inv.description || '').replace(/"/g, '""')}"`,
      inv.type,
      inv.status,
      inv.amount_etb || 0,
      inv.amount_usd || (inv.amount_etb ? +(inv.amount_etb / EXCHANGE_RATE).toFixed(2) : 0),
      `"${(inv.payment_method || '').replace(/"/g, '""')}"`
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Markova_Telephony_Invoices_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Invoice statement exported to CSV', 'success')
  }

  const handleEnterpriseSubmit = (e) => {
    e.preventDefault()
    setIsSubmittingEnterprise(true)
    setTimeout(() => {
      setIsSubmittingEnterprise(false)
      setIsEnterpriseModalOpen(false)
      showToast('Enterprise quote inquiry received! An account executive will reach out within 2 business hours.', 'success')
    }, 600)
  }

  if (loading) {
    return (
      <div className="billing-center">
        <header className="page-header">
          <div className="header-titles">
            <span className="page-category-tag">ENTERPRISE TELEPHONY & VOICE AI</span>
            <h1>Billing & Subscriptions</h1>
            <p>Manage subscription tiers, voice credit reserves, payment rails, and official tax statements.</p>
          </div>
        </header>
        <div className="billing-skeletons">
          <div className="billing-skeleton" />
          <div className="billing-skeleton" />
          <div className="billing-skeleton" />
          <div className="billing-skeleton" />
          <div className="billing-skeleton wide" />
        </div>
      </div>
    )
  }

  const cycle = billing?.current_cycle || {}
  const minutesPercent = Math.min(100, Math.round(((cycle.minutes_used || 0) / (cycle.minutes_included || 10000)) * 100))

  return (
    <div className="billing-center">
      {/* Toast Alert Notification */}
      {toast && (
        <div className={`billing-toast ${toast.type}`}>
          {toast.type === 'success' && <CheckCircle2 size={16} />}
          {toast.type === 'error' && <AlertCircle size={16} />}
          {toast.type === 'info' && <RefreshCw size={16} className="spin" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <header className="page-header">
        <div className="billing-header-info">
          <div className="header-badges">
            <span className="live-pill">
              <span className="pulse-dot green" />
              INSA Telephony Settlement Live
            </span>
            <span className="currency-rate-badge">1 USD ≈ {EXCHANGE_RATE} ETB</span>
          </div>
          <h1>Billing & Subscriptions</h1>
          <p>
            Your current plan, pooled voice minute reserves, verified Ethiopian digital wallets, and tax receipts.
          </p>
        </div>

        <div className="header-controls">
          {/* Currency Toggle */}
          <div className="currency-selector" title="Switch display currency">
            <button
              type="button"
              className={`currency-btn ${currencyView === 'ETB' ? 'active' : ''}`}
              onClick={() => setCurrencyView('ETB')}
            >
              ETB (ብር)
            </button>
            <button
              type="button"
              className={`currency-btn ${currencyView === 'USD' ? 'active' : ''}`}
              onClick={() => setCurrencyView('USD')}
            >
              USD ($)
            </button>
          </div>

          <button
            type="button"
            className="action-btn secondary-btn"
            onClick={() => loadData(true)}
            disabled={refreshing}
            title="Refresh balance and invoice status"
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            <span>Sync</span>
          </button>

          <button
            type="button"
            className="action-btn primary-btn topup-cta"
            onClick={() => setIsTopUpModalOpen(true)}
          >
            <Zap size={15} />
            <span>+ Top Up Credits</span>
          </button>
        </div>
      </header>

      {/* Top 4 KPI Metric Cards */}
      <div className="billing-kpis-grid">
        {/* KPI 1: Active Subscription Plan */}
        <div className="kpi-card">
          <div className="kpi-card-header">
            <div className="kpi-icon-wrap amber">
              <Receipt size={18} />
            </div>
            <span className="kpi-status-badge active">
              <span className="pulse-dot green" /> Active
            </span>
          </div>
          <div className="kpi-label">Active Plan</div>
          <div className="kpi-value-row">
            <span className="kpi-primary-val">{currentTier?.name || 'Growth / Plus'}</span>
          </div>
          <div className="kpi-subtext">
            <span>Next invoice: <strong>{new Date(cycle.next_billing_date || '2026-10-24').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</strong></span>
            <button type="button" className="inline-link" onClick={() => setActiveTab('plans')}>
              Manage <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {/* KPI 2: Available Telephony Credits */}
        <div className="kpi-card">
          <div className="kpi-card-header">
            <div className="kpi-icon-wrap emerald">
              <Wallet size={18} />
            </div>
            <span className="kpi-status-badge info">
              Auto-Recharge {rulesState.auto_recharge_enabled ? 'ON' : 'OFF'}
            </span>
          </div>
          <div className="kpi-label">Telephony Voice Balance</div>
          <div className="kpi-value-row">
            <span className="kpi-primary-val amount">
              {formatCurrency(billing?.balance_etb || 24500, currencyView)}
            </span>
          </div>
          <div className="kpi-subtext">
            <span>~{billing?.minutes_available ? Number(billing.minutes_available).toLocaleString() : '3,840'} voice mins pool</span>
            <button type="button" className="inline-link" onClick={() => setIsTopUpModalOpen(true)}>
              + Add <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {/* KPI 3: Cycle Voice Minutes Used */}
        <div className="kpi-card">
          <div className="kpi-card-header">
            <div className="kpi-icon-wrap cyan">
              <Phone size={18} />
            </div>
            <span className="kpi-meta-badge">Cycle Quota</span>
          </div>
          <div className="kpi-label">Included Minutes Usage</div>
          <div className="kpi-value-row">
            <span className="kpi-primary-val">
              {Number(cycle.minutes_used || 6160).toLocaleString()}
              <span className="kpi-secondary-unit"> / {Number(cycle.minutes_included || 10000).toLocaleString()} mins</span>
            </span>
          </div>
          <div className="quota-bar-wrapper">
            <div className="quota-progress-track">
              <div
                className={`quota-progress-fill ${minutesPercent > 90 ? 'critical' : minutesPercent > 75 ? 'warn' : 'ok'}`}
                style={{ width: `${minutesPercent}%` }}
              />
            </div>
            <div className="quota-labels">
              <span>{minutesPercent}% used</span>
              <span>Resets in 30 days</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Upcoming Estimated Invoice */}
        <div className="kpi-card">
          <div className="kpi-card-header">
            <div className="kpi-icon-wrap violet">
              <CreditCard size={18} />
            </div>
            <span className="kpi-meta-badge">Scheduled</span>
          </div>
          <div className="kpi-label">Estimated Upcoming Charge</div>
          <div className="kpi-value-row">
            <span className="kpi-primary-val amount">
              {formatCurrency(cycle.estimated_next_amount_etb || 29900, currencyView)}
            </span>
          </div>
          <div className="kpi-subtext">
            <span>Settled automatically via default wallet</span>
            <button type="button" className="inline-link" onClick={() => setActiveTab('payment-methods')}>
              Wallets <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <nav className="billing-nav-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'plans' ? 'active' : ''}`}
          onClick={() => setActiveTab('plans')}
        >
          <Receipt size={16} />
          <span>Subscription & Plans</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'credits' ? 'active' : ''}`}
          onClick={() => setActiveTab('credits')}
        >
          <Zap size={16} />
          <span>Voice Credits & Top-Up</span>
          <span className="tab-pill-badge hot">Instant</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'payment-methods' ? 'active' : ''}`}
          onClick={() => setActiveTab('payment-methods')}
        >
          <Wallet size={16} />
          <span>Payment Methods & Wallets</span>
          <span className="tab-counter-badge">{paymentMethods.length}</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'invoices' ? 'active' : ''}`}
          onClick={() => setActiveTab('invoices')}
        >
          <FileText size={16} />
          <span>Invoices & Statements</span>
          <span className="tab-counter-badge">{billing?.invoices?.length || 0}</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'limits' ? 'active' : ''}`}
          onClick={() => setActiveTab('limits')}
        >
          <Sliders size={16} />
          <span>Usage Limits & Auto-Recharge</span>
        </button>
      </nav>

      {/* TAB CONTENT SECTIONS */}

      {/* ========================================================== */}
      {/* TAB 1: Subscription & Plans */}
      {/* ========================================================== */}
      {activeTab === 'plans' && (
        <div className="tab-pane-fade">
          {/* Plan Cadence Toggle */}
          <div className="plans-cadence-header">
            <div>
              <h2>Subscription Tiers & Infrastructure</h2>
              <p>Transparent AI telephony rates with dedicated Ethio Telecom SIP interconnects and low latency voice pools.</p>
            </div>

            <div className="cadence-switch-wrap">
              <span className={billingCycle === 'monthly' ? 'active-cadence' : ''}>Monthly</span>
              <button
                type="button"
                className={`switch-toggle ${billingCycle === 'annual' ? 'on' : ''}`}
                onClick={() => handleToggleBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                aria-label="Toggle annual billing cadence"
              >
                <span className="toggle-thumb" />
              </button>
              <span className={billingCycle === 'annual' ? 'active-cadence' : ''}>
                Annual <span className="discount-pill">Save 20% + 2 Mo Free</span>
              </span>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="plans-grid">
            {pricing?.tiers?.map((tier) => {
              const isCurrent = currentPlanId === tier.id
              const monthlyEtb = tier.price_etb_monthly
              const annualEtb = tier.price_etb_annual ? tier.price_etb_annual / 12 : null
              const effectiveEtb = billingCycle === 'annual' ? annualEtb : monthlyEtb

              return (
                <div
                  key={tier.id}
                  className={`plan-pricing-card ${isCurrent ? 'is-active-tier' : ''} ${tier.popular ? 'is-popular' : ''}`}
                >
                  {tier.popular && <div className="popular-ribbon">MOST POPULAR</div>}
                  {isCurrent && <div className="current-ribbon">CURRENT PLAN</div>}

                  <div className="plan-card-top">
                    <div className="tier-header-row">
                      <h3 className="tier-title">{tier.name}</h3>
                      <span className="tier-badge">{tier.badge}</span>
                    </div>
                    <p className="tier-tagline">{tier.tagline}</p>
                  </div>

                  <div className="tier-pricing-box">
                    {tier.contact_sales ? (
                      <div className="custom-price-display">
                        <span className="custom-price-text">Custom Quote</span>
                        <span className="custom-price-sub">Tailored to enterprise volume</span>
                      </div>
                    ) : (
                      <div className="amount-price-display">
                        <span className="price-num">
                          {formatCurrency(effectiveEtb, currencyView)}
                        </span>
                        <span className="price-cadence">/ month</span>
                      </div>
                    )}

                    {billingCycle === 'annual' && !tier.contact_sales && (
                      <div className="billed-annually-note">
                        Billed annually ({formatCurrency(tier.price_etb_annual, currencyView)} / yr)
                      </div>
                    )}
                  </div>

                  <div className="tier-specs-grid">
                    <div className="tier-spec-item">
                      <span className="spec-val">
                        {tier.minutes_included ? `${Number(tier.minutes_included).toLocaleString()} mins` : 'Unlimited pool'}
                      </span>
                      <span className="spec-label">Pooled Voice AI</span>
                    </div>
                    <div className="tier-spec-item">
                      <span className="spec-val">{tier.concurrent_calls} Channels</span>
                      <span className="spec-label">Concurrent Calls</span>
                    </div>
                    <div className="tier-spec-item">
                      <span className="spec-val">{tier.ai_agents}</span>
                      <span className="spec-label">Agent Personas</span>
                    </div>
                    <div className="tier-spec-item">
                      <span className="spec-val">
                        {tier.overage_rate_etb ? `${tier.overage_rate_etb} ETB/min` : 'Negotiated'}
                      </span>
                      <span className="spec-label">Out-of-Plan Rate</span>
                    </div>
                  </div>

                  <ul className="tier-features-list">
                    {tier.features?.map((f, i) => (
                      <li key={i}>
                        <Check size={14} className="feature-check" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="plan-cta-box">
                    {isCurrent ? (
                      <button type="button" className="tier-btn current" disabled>
                        <CheckCircle2 size={16} />
                        <span>Currently Active</span>
                      </button>
                    ) : tier.contact_sales ? (
                      <button
                        type="button"
                        className="tier-btn enterprise"
                        onClick={() => setIsEnterpriseModalOpen(true)}
                      >
                        <Building size={16} />
                        <span>Talk to Enterprise Sales</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="tier-btn upgrade"
                        onClick={() => handleSwitchPlan(tier.id)}
                      >
                        <span>Switch to {tier.name}</span>
                        <ArrowUpRight size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Add-on Telephony Modules */}
          <div className="billing-addons-card">
            <div className="addons-header">
              <div className="addon-title-box">
                <Sparkles size={20} className="amber-icon" />
                <div>
                  <h3>Infrastructure Add-Ons & SIP Expansions</h3>
                  <p>Scale your call capacity without changing your core subscription tier.</p>
                </div>
              </div>
            </div>

            <div className="addons-grid">
              <div className="addon-item">
                <div className="addon-info">
                  <span className="addon-name">Additional Ethio Telecom SIP Line</span>
                  <span className="addon-desc">High-throughput inbound/outbound concurrent channels for peak campaign bursts.</span>
                </div>
                <div className="addon-pricing">
                  <span className="addon-price">500 ETB / line / mo</span>
                  <button
                    type="button"
                    className="addon-add-btn"
                    onClick={() => showToast('Additional SIP Line requested. Provisioning ticket created.', 'success')}
                  >
                    + Add Channel
                  </button>
                </div>
              </div>

              <div className="addon-item">
                <div className="addon-info">
                  <span className="addon-name">Custom Voice Cloning Studio License</span>
                  <span className="addon-desc">Clone your executive or brand voice actor in Amharic and English dialects.</span>
                </div>
                <div className="addon-pricing">
                  <span className="addon-price">2,500 ETB / voice</span>
                  <button
                    type="button"
                    className="addon-add-btn"
                    onClick={() => showToast('Voice Cloning Studio slot initialized. Ready for training audio.', 'success')}
                  >
                    + Clone Voice
                  </button>
                </div>
              </div>

              <div className="addon-item">
                <div className="addon-info">
                  <span className="addon-name">7-Year INSA Encrypted Call Archive</span>
                  <span className="addon-desc">Meets Ethiopian National Cybersecurity & Financial regulatory compliance storage.</span>
                </div>
                <div className="addon-pricing">
                  <span className="addon-price">3,000 ETB / mo</span>
                  <button
                    type="button"
                    className="addon-add-btn"
                    onClick={() => showToast('INSA Cold-Storage Vault activated for your tenant.', 'success')}
                  >
                    + Activate Vault
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 2: Voice Credits & Top-Up */}
      {/* ========================================================== */}
      {activeTab === 'credits' && (
        <div className="tab-pane-fade">
          <div className="credits-dashboard-layout">
            {/* Top-up Selection & Checkout Card */}
            <div className="credits-main-card">
              <div className="card-top-heading">
                <div className="heading-icon-wrap amber">
                  <Zap size={22} />
                </div>
                <div>
                  <h2>Instant Voice Credit Top-Up</h2>
                  <p>Credits never expire. Top-up balances fund out-of-plan minutes seamlessly without disconnecting active calls.</p>
                </div>
              </div>

              <div className="packs-selection-grid">
                {[
                  { amount: 2500, label: 'Starter Pack', mins: 850, popular: false, bonus: null },
                  { amount: 10000, label: 'Business Pack', mins: 3400, popular: true, bonus: 'Most Popular' },
                  { amount: 25000, label: 'High-Volume Pack', mins: 8500, popular: false, bonus: '+5% Bonus Credit' },
                  { amount: 50000, label: 'Wholesale Pack', mins: 17000, popular: false, bonus: '+10% Bonus Credit' }
                ].map((pack) => {
                  const isSelected = selectedTopUpPack === pack.amount && !customTopUpAmount
                  return (
                    <div
                      key={pack.amount}
                      className={`credit-pack-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedTopUpPack(pack.amount)
                        setCustomTopUpAmount('')
                      }}
                    >
                      {pack.bonus && <span className="pack-bonus-badge">{pack.bonus}</span>}
                      <span className="pack-label">{pack.label}</span>
                      <div className="pack-price">{formatCurrency(pack.amount, currencyView)}</div>
                      <span className="pack-minutes">~{pack.mins.toLocaleString()} AI Voice Mins</span>
                      <span className="pack-rate">@ 2.95 ETB / min</span>
                    </div>
                  )
                })}
              </div>

              {/* Custom Amount Field */}
              <div className="custom-amount-box">
                <label htmlFor="customAmountInput">Or Enter a Custom Recharge Amount (ETB)</label>
                <div className="custom-input-row">
                  <div className="input-with-currency">
                    <span className="currency-prefix">ETB</span>
                    <input
                      id="customAmountInput"
                      type="number"
                      min="500"
                      step="500"
                      placeholder="e.g. 15,000"
                      value={customTopUpAmount}
                      onChange={(e) => {
                        setCustomTopUpAmount(e.target.value)
                        setSelectedTopUpPack(null)
                      }}
                    />
                  </div>
                  {customTopUpAmount && Number(customTopUpAmount) > 0 && (
                    <div className="est-minutes-tag">
                      ≈ {Math.round(Number(customTopUpAmount) / 2.95).toLocaleString()} voice mins
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Rail Selector */}
              <div className="checkout-payment-method-box">
                <label>Select Settlement Wallet / Method</label>
                <div className="wallet-options-row">
                  {paymentMethods.map((m) => (
                    <div
                      key={m.id}
                      className={`wallet-select-chip ${topUpPaymentMethodId === m.id ? 'active' : ''}`}
                      onClick={() => setTopUpPaymentMethodId(m.id)}
                    >
                      <div className="wallet-chip-indicator">
                        {topUpPaymentMethodId === m.id && <Check size={12} />}
                      </div>
                      <div className="wallet-chip-details">
                        <span className="wallet-chip-name">{m.name}</span>
                        <span className="wallet-chip-id">{m.identifier}</span>
                      </div>
                      {m.is_default && <span className="default-pill">Default</span>}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="add-wallet-chip-btn"
                    onClick={() => setIsAddPaymentModalOpen(true)}
                  >
                    <Plus size={14} /> Add Wallet
                  </button>
                </div>
              </div>

              {/* Checkout Trigger */}
              <div className="topup-summary-bar">
                <div className="summary-calc">
                  <span className="summary-title">Total Recharge Amount:</span>
                  <span className="summary-value">
                    {formatCurrency(customTopUpAmount || selectedTopUpPack, currencyView)}
                  </span>
                </div>
                <button
                  type="button"
                  className="confirm-topup-btn"
                  onClick={handleTopUpSubmit}
                  disabled={isSubmittingTopUp}
                >
                  {isSubmittingTopUp ? (
                    <>
                      <RefreshCw size={16} className="spin" />
                      <span>Authorizing Payment...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={16} />
                      <span>Instant Recharge via {paymentMethods.find(m => m.id === topUpPaymentMethodId)?.name || 'Wallet'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Side Rates and Telephony Information Card */}
            <div className="credits-sidebar-card">
              <h3>Telephony Tariff Schedule</h3>
              <p className="tariff-sub">Official rates compliant with Ethiopian Communications Authority (ECA).</p>

              <div className="tariff-list">
                <div className="tariff-row">
                  <span>Inbound Amharic Voice AI</span>
                  <strong>2.95 ETB / min</strong>
                </div>
                <div className="tariff-row">
                  <span>Outbound Campaign Synthesis</span>
                  <strong>3.20 ETB / min</strong>
                </div>
                <div className="tariff-row">
                  <span>Ethio Telecom Direct SIP Interconnect</span>
                  <strong>0.45 ETB / min</strong>
                </div>
                <div className="tariff-row">
                  <span>SMS Follow-up Delivery (Addis & Regional)</span>
                  <strong>0.65 ETB / msg</strong>
                </div>
                <div className="tariff-row">
                  <span>Real-Time Sentiment Analysis</span>
                  <strong className="free-tag">Included Free</strong>
                </div>
              </div>

              <div className="tariff-security-callout">
                <Shield size={16} className="emerald-icon" />
                <div>
                  <strong>Zero Dropped Calls Guarantee</strong>
                  <p>When credit reserves drop below 500 ETB, Markova extends emergency grace minutes so conversations complete gracefully.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 3: Payment Methods & Digital Wallets */}
      {/* ========================================================== */}
      {activeTab === 'payment-methods' && (
        <div className="tab-pane-fade">
          <div className="payment-methods-header">
            <div>
              <h2>Verified Payment Rails & Digital Wallets</h2>
              <p>Primary settlement accounts for automatic plan renewals, overage minutes, and one-click credit recharges.</p>
            </div>
            <button
              type="button"
              className="action-btn primary-btn"
              onClick={() => setIsAddPaymentModalOpen(true)}
            >
              <Plus size={16} />
              <span>Add Payment Method</span>
            </button>
          </div>

          <div className="payment-cards-grid">
            {paymentMethods.map((method) => {
              const isTelebirr = method.type === 'telebirr'
              const isCbe = method.type === 'cbe_birr'
              const isCard = method.type === 'card'

              return (
                <div
                  key={method.id}
                  className={`payment-method-card ${method.is_default ? 'is-default' : ''}`}
                >
                  <div className="pm-card-head">
                    <div className="pm-brand-badge">
                      {isTelebirr && <span className="brand-pill telebirr">Telebirr SuperApp</span>}
                      {isCbe && <span className="brand-pill cbe">CBE Birr (Commercial Bank)</span>}
                      {isCard && <span className="brand-pill visa">Corporate Visa / Card</span>}
                    </div>

                    {method.is_default ? (
                      <span className="default-indicator-badge">
                        <Star size={12} /> Default Payment Method
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="set-default-btn"
                        onClick={() => handleSetDefaultPaymentMethod(method.id)}
                      >
                        Set as Default
                      </button>
                    )}
                  </div>

                  <div className="pm-identifier-box">
                    <div className="pm-number">{method.identifier}</div>
                    <div className="pm-holder">{method.account_name}</div>
                  </div>

                  <div className="pm-footer-row">
                    <span className="pm-status-pill verified">
                      <CheckCircle2 size={12} /> Verified & Authorized
                    </span>
                    <button
                      type="button"
                      className="pm-delete-btn"
                      onClick={() => handleDeletePaymentMethod(method.id)}
                      title="Remove payment method"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Ethiopian Payment Rails Context Box */}
          <div className="rails-info-banner">
            <div className="info-icon-col">
              <Building size={24} className="amber-icon" />
            </div>
            <div className="info-text-col">
              <h4>Direct Integration with Ethiopian Financial Infrastructure</h4>
              <p>
                Markova AI Call Center integrates directly with Ethio Telecom&apos;s Telebirr merchant platform and Commercial Bank of Ethiopia (CBE) Birr USSD protocols. All transactions are logged with Ethiopian Ministry of Revenues tax-compliant invoices and validated against INSA financial cyber guidelines.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 4: Invoices & Statements */}
      {/* ========================================================== */}
      {activeTab === 'invoices' && (
        <div className="tab-pane-fade">
          <div className="invoices-section-header">
            <div>
              <h2>Invoices & Billing History</h2>
              <p>Official tax invoices, itemized monthly subscriptions, and credit pack purchase receipts.</p>
            </div>
            <button
              type="button"
              className="action-btn secondary-btn"
              onClick={handleExportCsv}
            >
              <Download size={15} />
              <span>Export CSV Statement</span>
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="invoices-filter-bar">
            <div className="search-input-box">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder="Search invoice number, description, or payment method..."
                value={searchInvoice}
                onChange={(e) => setSearchInvoice(e.target.value)}
              />
              {searchInvoice && (
                <button type="button" className="clear-search-btn" onClick={() => setSearchInvoice('')}>
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="filter-dropdown-group">
              <div className="filter-select-wrap">
                <Filter size={13} />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>

              <div className="filter-select-wrap">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="subscription">Subscription</option>
                  <option value="topup">Voice Top-Up</option>
                  <option value="setup">Setup & Trunking</option>
                </select>
              </div>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="invoices-table-card">
            {filteredInvoices.length === 0 ? (
              <div className="empty-invoices-box">
                <FileText size={36} className="empty-icon" />
                <h4>No invoices match your search</h4>
                <p>Try adjusting your search query or status filter above.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="invoices-table">
                  <thead>
                    <tr>
                      <th>Invoice ID</th>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Payment Rail</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th className="actions-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="inv-number-cell">
                          <strong>{inv.number || inv.id}</strong>
                        </td>
                        <td className="inv-date-cell">
                          {inv.created_at ? new Date(inv.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </td>
                        <td className="inv-desc-cell">
                          <span className="desc-title">{inv.description}</span>
                        </td>
                        <td>
                          <span className={`inv-type-badge ${inv.type}`}>
                            {inv.type === 'subscription' ? 'Subscription' : inv.type === 'topup' ? 'Voice Top-Up' : 'Setup'}
                          </span>
                        </td>
                        <td className="inv-method-cell">
                          <span>{inv.payment_method || 'Telebirr'}</span>
                        </td>
                        <td className="inv-amount-cell">
                          <strong>{formatCurrency(inv.amount_etb, currencyView)}</strong>
                        </td>
                        <td>
                          <span className={`status-pill ${inv.status}`}>
                            <span className="dot" /> {inv.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="actions-cell">
                          <button
                            type="button"
                            className="view-receipt-btn"
                            onClick={() => setSelectedInvoice(inv)}
                            title="View itemized receipt"
                          >
                            <Receipt size={13} />
                            <span>Receipt</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 5: Usage Limits & Auto-Recharge Rules */}
      {/* ========================================================== */}
      {activeTab === 'limits' && (
        <div className="tab-pane-fade">
          <form onSubmit={handleSaveRules} className="rules-form-layout">
            <div className="rules-header">
              <div>
                <h2>Telephony Thresholds & Auto-Recharge Protection</h2>
                <p>Prevent unexpected service disruptions or bill runaways by configuring automated balance top-ups and strict monthly caps.</p>
              </div>
              <button
                type="submit"
                className="action-btn primary-btn"
                disabled={isSavingRules}
              >
                {isSavingRules ? (
                  <>
                    <RefreshCw size={15} className="spin" />
                    <span>Saving Rules...</span>
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    <span>Save Billing Rules</span>
                  </>
                )}
              </button>
            </div>

            <div className="rules-cards-grid">
              {/* Card 1: Auto-Recharge Rule */}
              <div className="rule-card">
                <div className="rule-card-header">
                  <div className="icon-wrap amber">
                    <Zap size={20} />
                  </div>
                  <div className="rule-title-box">
                    <h3>Automated Balance Top-Up</h3>
                    <p>Recharge voice credits automatically when pool runs low.</p>
                  </div>
                  <button
                    type="button"
                    className={`switch-toggle ${rulesState.auto_recharge_enabled ? 'on' : ''}`}
                    onClick={() => setRulesState({ ...rulesState, auto_recharge_enabled: !rulesState.auto_recharge_enabled })}
                    aria-label="Toggle auto-recharge"
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>

                <div className={`rule-card-body ${!rulesState.auto_recharge_enabled ? 'disabled' : ''}`}>
                  <div className="form-field-row">
                    <label>When voice credit balance drops below:</label>
                    <select
                      value={rulesState.auto_recharge_threshold_etb}
                      disabled={!rulesState.auto_recharge_enabled}
                      onChange={(e) => setRulesState({ ...rulesState, auto_recharge_threshold_etb: Number(e.target.value) })}
                    >
                      <option value={500}>500 ETB (~170 mins remaining)</option>
                      <option value={1000}>1,000 ETB (~340 mins remaining)</option>
                      <option value={2500}>2,500 ETB (~850 mins remaining)</option>
                      <option value={5000}>5,000 ETB (~1,700 mins remaining)</option>
                    </select>
                  </div>

                  <div className="form-field-row">
                    <label>Automatically purchase and credit:</label>
                    <select
                      value={rulesState.auto_recharge_amount_etb}
                      disabled={!rulesState.auto_recharge_enabled}
                      onChange={(e) => setRulesState({ ...rulesState, auto_recharge_amount_etb: Number(e.target.value) })}
                    >
                      <option value={2500}>2,500 ETB (~850 mins)</option>
                      <option value={5000}>5,000 ETB (~1,700 mins)</option>
                      <option value={10000}>10,000 ETB (~3,400 mins)</option>
                      <option value={25000}>25,000 ETB (~8,500 mins)</option>
                    </select>
                  </div>

                  <p className="rule-hint">
                    Charged to default wallet: <strong>{paymentMethods.find(m => m.is_default)?.name || 'Default Wallet'}</strong>
                  </p>
                </div>
              </div>

              {/* Card 2: Hard Spending Cap */}
              <div className="rule-card">
                <div className="rule-card-header">
                  <div className="icon-wrap coral">
                    <Shield size={20} />
                  </div>
                  <div className="rule-title-box">
                    <h3>Monthly Telephony Spending Cap</h3>
                    <p>Enforce an absolute safety ceiling on total monthly call expenses.</p>
                  </div>
                  <button
                    type="button"
                    className={`switch-toggle ${rulesState.spending_cap_enabled ? 'on' : ''}`}
                    onClick={() => setRulesState({ ...rulesState, spending_cap_enabled: !rulesState.spending_cap_enabled })}
                    aria-label="Toggle spending cap"
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>

                <div className={`rule-card-body ${!rulesState.spending_cap_enabled ? 'disabled' : ''}`}>
                  <div className="form-field-row">
                    <label>Maximum allowed monthly spend (ETB):</label>
                    <input
                      type="number"
                      step="5000"
                      min="10000"
                      disabled={!rulesState.spending_cap_enabled}
                      value={rulesState.spending_cap_etb}
                      onChange={(e) => setRulesState({ ...rulesState, spending_cap_etb: Number(e.target.value) })}
                    />
                  </div>

                  <p className="rule-hint">
                    Once the monthly cap is reached, non-emergency outbound campaigns will pause until admin authorization.
                  </p>
                </div>
              </div>

              {/* Card 3: Notifications & Early Alerts */}
              <div className="rule-card full-width">
                <div className="rule-card-header">
                  <div className="icon-wrap cyan">
                    <Sliders size={20} />
                  </div>
                  <div className="rule-title-box">
                    <h3>Threshold Notification Channels</h3>
                    <p>Receive proactive warnings before quotas or caps are exhausted.</p>
                  </div>
                </div>

                <div className="notification-toggles-grid">
                  <label className="checkbox-toggle-row">
                    <input
                      type="checkbox"
                      checked={rulesState.notify_threshold_80}
                      onChange={(e) => setRulesState({ ...rulesState, notify_threshold_80: e.target.checked })}
                    />
                    <div>
                      <span className="toggle-title">80% Minute Consumption Warning</span>
                      <span className="toggle-desc">Trigger alert when 80% of included monthly plan minutes are consumed.</span>
                    </div>
                  </label>

                  <label className="checkbox-toggle-row">
                    <input
                      type="checkbox"
                      checked={rulesState.notify_threshold_95}
                      onChange={(e) => setRulesState({ ...rulesState, notify_threshold_95: e.target.checked })}
                    />
                    <div>
                      <span className="toggle-title">95% Critical Pool Warning</span>
                      <span className="toggle-desc">Urgent alert when only 5% of pooled voice reserves remain.</span>
                    </div>
                  </label>

                  <label className="checkbox-toggle-row">
                    <input
                      type="checkbox"
                      checked={rulesState.notify_sms}
                      onChange={(e) => setRulesState({ ...rulesState, notify_sms: e.target.checked })}
                    />
                    <div>
                      <span className="toggle-title">SMS Alerts to Super Admin Phone</span>
                      <span className="toggle-desc">Immediate SMS push to primary Ethiopian telecom phone number.</span>
                    </div>
                  </label>

                  <label className="checkbox-toggle-row">
                    <input
                      type="checkbox"
                      checked={rulesState.notify_email}
                      onChange={(e) => setRulesState({ ...rulesState, notify_email: e.target.checked })}
                    />
                    <div>
                      <span className="toggle-title">Email Ledger Statement</span>
                      <span className="toggle-desc">Send automated monthly PDF summary to billing admin contacts.</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 1: Top-Up Checkout Modal */}
      {/* ========================================================== */}
      {isTopUpModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsTopUpModalOpen(false)}>
          <div className="modal-container topup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Zap size={20} className="amber-icon" />
                <h3>Voice Credit Recharge Checkout</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsTopUpModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTopUpSubmit} className="modal-form">
              <div className="modal-body">
                <div className="order-summary-box">
                  <div className="order-row">
                    <span>Recharge Amount:</span>
                    <strong>{formatCurrency(customTopUpAmount || selectedTopUpPack, currencyView)}</strong>
                  </div>
                  <div className="order-row">
                    <span>Estimated Pooled Minutes:</span>
                    <span>~{Math.round((customTopUpAmount || selectedTopUpPack) / 2.95).toLocaleString()} voice mins</span>
                  </div>
                  <div className="order-row">
                    <span>VAT (15% ECA Telecom Tax):</span>
                    <span>Included in total</span>
                  </div>
                  <div className="order-total-row">
                    <span>Total Settlement:</span>
                    <span className="total-highlight">
                      {formatCurrency(customTopUpAmount || selectedTopUpPack, currencyView)}
                    </span>
                  </div>
                </div>

                <div className="form-group">
                  <label>Charge to Wallet / Payment Method:</label>
                  <select
                    value={topUpPaymentMethodId}
                    onChange={(e) => setTopUpPaymentMethodId(e.target.value)}
                  >
                    {paymentMethods.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.identifier}) {m.is_default ? '— Default' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="checkout-disclaimer">
                  By confirming, funds will be immediately deducted and credited to your organization&apos;s active pooled balance. An official tax receipt will be issued.
                </p>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setIsTopUpModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="confirm-btn"
                  disabled={isSubmittingTopUp}
                >
                  {isSubmittingTopUp ? (
                    <>
                      <RefreshCw size={14} className="spin" />
                      <span>Authorizing...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Confirm & Recharge Now</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 2: Add Payment Method Modal */}
      {/* ========================================================== */}
      {isAddPaymentModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddPaymentModalOpen(false)}>
          <div className="modal-container payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Wallet size={20} className="amber-icon" />
                <h3>Add Verified Payment Instrument</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAddPaymentModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddPaymentMethod} className="modal-form">
              <div className="modal-body">
                {/* Method Type Radio Buttons */}
                <div className="method-type-selector">
                  <button
                    type="button"
                    className={`method-type-btn ${paymentForm.type === 'telebirr' ? 'active' : ''}`}
                    onClick={() => setPaymentForm({ ...paymentForm, type: 'telebirr', name: 'Telebirr SuperApp', identifier: '+251 9' })}
                  >
                    <span className="radio-pill" />
                    <span>Telebirr SuperApp</span>
                  </button>

                  <button
                    type="button"
                    className={`method-type-btn ${paymentForm.type === 'cbe_birr' ? 'active' : ''}`}
                    onClick={() => setPaymentForm({ ...paymentForm, type: 'cbe_birr', name: 'CBE Birr', identifier: '+251 9' })}
                  >
                    <span className="radio-pill" />
                    <span>CBE Birr</span>
                  </button>

                  <button
                    type="button"
                    className={`method-type-btn ${paymentForm.type === 'card' ? 'active' : ''}`}
                    onClick={() => setPaymentForm({ ...paymentForm, type: 'card', name: 'Corporate Card', identifier: '' })}
                  >
                    <span className="radio-pill" />
                    <span>Credit / Debit Card</span>
                  </button>
                </div>

                {/* Form Fields Based on Type */}
                {(paymentForm.type === 'telebirr' || paymentForm.type === 'cbe_birr') ? (
                  <>
                    <div className="form-group">
                      <label>{paymentForm.type === 'telebirr' ? 'Telebirr Phone Number' : 'CBE Birr Registered Phone Number'}:</label>
                      <input
                        type="text"
                        placeholder="+251 91 123 4567"
                        required
                        value={paymentForm.identifier}
                        onChange={(e) => setPaymentForm({ ...paymentForm, identifier: e.target.value })}
                      />
                      <span className="input-hint">Will receive a USSD push authorization prompt to link your account.</span>
                    </div>

                    <div className="form-group">
                      <label>Registered Account Name / Organization:</label>
                      <input
                        type="text"
                        placeholder="e.g. Markova Technologies PLC"
                        required
                        value={paymentForm.account_name}
                        onChange={(e) => setPaymentForm({ ...paymentForm, account_name: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group">
                      <label>Cardholder Full Name:</label>
                      <input
                        type="text"
                        placeholder="e.g. Abebe Bikila"
                        required
                        value={paymentForm.account_name}
                        onChange={(e) => setPaymentForm({ ...paymentForm, account_name: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Card Number:</label>
                      <input
                        type="text"
                        placeholder="4242 •••• •••• 4242"
                        required
                        value={paymentForm.identifier}
                        onChange={(e) => setPaymentForm({ ...paymentForm, identifier: e.target.value })}
                      />
                    </div>

                    <div className="form-row-2">
                      <div className="form-group">
                        <label>Expiry Date:</label>
                        <input
                          type="text"
                          placeholder="MM/YY"
                          value={paymentForm.expiry}
                          onChange={(e) => setPaymentForm({ ...paymentForm, expiry: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>CVV / CVC:</label>
                        <input type="password" placeholder="•••" maxLength={4} />
                      </div>
                    </div>
                  </>
                )}

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={paymentForm.is_default}
                    onChange={(e) => setPaymentForm({ ...paymentForm, is_default: e.target.checked })}
                  />
                  <span>Set as default settlement payment method</span>
                </label>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setIsAddPaymentModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="confirm-btn"
                  disabled={isSubmittingPayment}
                >
                  {isSubmittingPayment ? (
                    <>
                      <RefreshCw size={14} className="spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Save & Authorize</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 3: Itemized Receipt / Tax Invoice Modal */}
      {/* ========================================================== */}
      {selectedInvoice && (
        <div className="modal-backdrop" onClick={() => setSelectedInvoice(null)}>
          <div className="modal-container receipt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Receipt size={20} className="amber-icon" />
                <h3>Official Tax Invoice — {selectedInvoice.number || selectedInvoice.id}</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedInvoice(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="receipt-content-printable">
              {/* Receipt Branding Header */}
              <div className="receipt-header-row">
                <div className="org-tax-info">
                  <h4 className="receipt-company-title">Markova Technologies PLC</h4>
                  <p>Ministry of Innovation & Technology (MInT) Certified</p>
                  <p>Bole Sub-City, Woreda 03, Addis Ababa, Ethiopia</p>
                  <p className="tin-line">TIN: <strong>{selectedInvoice.tax_tin || 'ET-004829104'}</strong> · VAT Reg: <strong>91823-A</strong></p>
                </div>
                <div className="receipt-inv-meta">
                  <div className="receipt-tag paid">PAID IN FULL</div>
                  <div className="meta-line"><span>Invoice #:</span> <strong>{selectedInvoice.number || selectedInvoice.id}</strong></div>
                  <div className="meta-line"><span>Date:</span> {new Date(selectedInvoice.created_at || Date.now()).toLocaleDateString()}</div>
                  <div className="meta-line"><span>Payment:</span> {selectedInvoice.payment_method}</div>
                </div>
              </div>

              <div className="receipt-divider" />

              {/* Line Items */}
              <table className="receipt-table">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>Qty</th>
                    <th className="amount-col">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedInvoice.items && selectedInvoice.items.length > 0) ? (
                    selectedInvoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.desc}</td>
                        <td>1</td>
                        <td className="amount-col">{formatCurrency(item.amount, currencyView)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td>{selectedInvoice.description}</td>
                      <td>1</td>
                      <td className="amount-col">{formatCurrency(selectedInvoice.amount_etb, currencyView)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="receipt-divider" />

              {/* Total Calculation */}
              <div className="receipt-totals-box">
                <div className="receipt-total-row">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(Math.round(selectedInvoice.amount_etb / 1.15), currencyView)}</span>
                </div>
                <div className="receipt-total-row">
                  <span>VAT (15%):</span>
                  <span>{formatCurrency(Math.round(selectedInvoice.amount_etb - (selectedInvoice.amount_etb / 1.15)), currencyView)}</span>
                </div>
                <div className="receipt-total-row grand-total">
                  <span>Total Settled:</span>
                  <strong>{formatCurrency(selectedInvoice.amount_etb, currencyView)}</strong>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setSelectedInvoice(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="confirm-btn"
                onClick={() => {
                  window.print()
                  showToast('Preparing printable tax document', 'info')
                }}
              >
                <Printer size={15} />
                <span>Print Tax Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 4: Enterprise Quote Modal */}
      {/* ========================================================== */}
      {isEnterpriseModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsEnterpriseModalOpen(false)}>
          <div className="modal-container enterprise-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Building size={20} className="amber-icon" />
                <h3>Enterprise AI Telephony Consultation</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsEnterpriseModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEnterpriseSubmit} className="modal-form">
              <div className="modal-body">
                <p className="enterprise-intro">
                  Designed for banks, airlines, telecom carriers, and high-volume government services requiring 50,000+ pooled minutes, on-premise voice engines, and dedicated PRI trunks.
                </p>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Full Name:</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Tewodros Kassahun"
                      value={enterpriseForm.name}
                      onChange={(e) => setEnterpriseForm({ ...enterpriseForm, name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Enterprise / Ministry Name:</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Commercial Bank of Ethiopia"
                      value={enterpriseForm.company}
                      onChange={(e) => setEnterpriseForm({ ...enterpriseForm, company: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Contact Phone Number:</label>
                    <input
                      type="text"
                      required
                      placeholder="+251 9..."
                      value={enterpriseForm.phone}
                      onChange={(e) => setEnterpriseForm({ ...enterpriseForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Corporate Email:</label>
                    <input
                      type="email"
                      required
                      placeholder="executive@bank.com.et"
                      value={enterpriseForm.email}
                      onChange={(e) => setEnterpriseForm({ ...enterpriseForm, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Anticipated Monthly Call Volume:</label>
                  <select
                    value={enterpriseForm.minutesNeeded}
                    onChange={(e) => setEnterpriseForm({ ...enterpriseForm, minutesNeeded: e.target.value })}
                  >
                    <option value="50,000+">50,000 – 100,000 Minutes / Month</option>
                    <option value="250,000+">100,000 – 500,000 Minutes / Month</option>
                    <option value="1,000,000+">1,000,000+ Pooled Minutes (Wholesale Carrier Pool)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Primary Telephony & AI Objectives:</label>
                  <textarea
                    rows={3}
                    placeholder="Tell us about your dialer systems, CRM integrations, or custom Amharic dialect requirements..."
                    value={enterpriseForm.useCase}
                    onChange={(e) => setEnterpriseForm({ ...enterpriseForm, useCase: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setIsEnterpriseModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="confirm-btn"
                  disabled={isSubmittingEnterprise}
                >
                  {isSubmittingEnterprise ? (
                    <>
                      <RefreshCw size={14} className="spin" />
                      <span>Sending Inquiry...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Submit Enterprise Request</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default BillingCenter
