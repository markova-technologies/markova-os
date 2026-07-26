import React, { useEffect, useState } from 'react'
import { Check, CreditCard, ExternalLink, Receipt } from 'lucide-react'
import { getInvoices, getMe, getPricing } from '../api/client'
import './BillingCenter.css'

// Amounts are ETB per the pricing contract — the API returns `currency` and
// `amount_etb`, so nothing here converts or assumes dollars.
const formatEtb = (value) =>
  `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ETB`

const BillingCenter = () => {
  const [invoices, setInvoices] = useState([])
  const [currency, setCurrency] = useState('ETB')
  const [pricing, setPricing] = useState(null)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [invoiceRes, pricingRes, meRes] = await Promise.all([
          getInvoices(),
          getPricing().catch(() => ({ data: null })),
          getMe().catch(() => ({ data: null })),
        ])
        setInvoices(invoiceRes.data?.invoices || [])
        setCurrency(invoiceRes.data?.currency || 'ETB')
        setPricing(pricingRes.data)
        setPlan(meRes.data?.plan || meRes.data?.company?.plan || null)
      } catch {
        setLoadError("We couldn't load your billing details just now. Try again in a moment.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const outstanding = invoices
    .filter((i) => i.status !== 'paid')
    .reduce((sum, i) => sum + Number(i.amount_etb ?? i.amount_usd ?? 0), 0)

  if (loading) {
    return (
      <div className="billing-center">
        <header className="page-header">
          <h1>Billing</h1>
          <p>Your plan, what you owe, and every line item behind it.</p>
        </header>
        <div className="billing-skeletons">
          <div className="billing-skeleton" />
          <div className="billing-skeleton" />
          <div className="billing-skeleton wide" />
        </div>
      </div>
    )
  }

  return (
    <div className="billing-center">
      <header className="page-header">
        <h1>Billing</h1>
        <p>Your plan, what you owe, and every line item behind it.</p>
      </header>

      {loadError && <div className="billing-error">{loadError}</div>}

      <div className="billing-dashboard">
        <div className="billing-card summary-card">
          <div className="card-header">
            <CreditCard size={20} />
            <h2>Outstanding this cycle</h2>
          </div>
          <div className="amount-display">
            <span className="amount">{Number(outstanding).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            <span className="currency">{currency}</span>
          </div>
          <p className="billing-note">
            Minutes over your plan are billed automatically rather than cutting a call off mid-conversation.
          </p>
        </div>

        <div className="billing-card plan-card">
          <div className="card-header">
            <Receipt size={20} />
            <h2>Your plan</h2>
          </div>
          {pricing ? (
            <div className="plan-list">
              {pricing.tiers?.map((tier) => {
                const isCurrent = plan && String(plan).toLowerCase() === tier.id
                return (
                  <div key={tier.id} className={`plan-row ${isCurrent ? 'is-current' : ''}`}>
                    <div className="plan-row-head">
                      <span className="plan-name">{tier.name}</span>
                      {isCurrent && (
                        <span className="plan-current">
                          <Check size={12} /> Current
                        </span>
                      )}
                    </div>
                    <div className="plan-price">
                      {tier.contact_sales
                        ? 'Contact sales'
                        : `${Number(tier.price_etb_monthly).toLocaleString()} ${pricing.currency}`}
                      {!tier.contact_sales && (
                        <span className="plan-price-unit">/ month</span>
                      )}
                    </div>
                    <p className="plan-summary">
                      {tier.summary}
                      {tier.minutes_included != null
                        ? ` · ${tier.minutes_included.toLocaleString()} minutes included`
                        : ''}
                      {tier.ai_workforce ? ' · AI workforce' : ''}
                    </p>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="billing-note">Pricing is unavailable right now. Reload to try again.</p>
          )}
          <a className="plan-link" href="/pricing" target="_blank" rel="noreferrer">
            See full pricing <ExternalLink size={13} />
          </a>
        </div>

        <div className="billing-card invoice-card full-width">
          <div className="card-header">
            <Receipt size={20} />
            <h2>Line items</h2>
          </div>
          {invoices.length === 0 ? (
            <p className="billing-empty">
              Nothing billed yet — line items appear here once your agents handle live calls.
            </p>
          ) : (
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((item) => (
                  <tr key={item.id}>
                    <td>{item.description}</td>
                    <td>
                      <span className="badge">{item.type}</span>
                    </td>
                    <td>
                      <span className={`status ${item.status}`}>{item.status}</span>
                    </td>
                    <td className="amount-col">{formatEtb(item.amount_etb ?? item.amount_usd)}</td>
                    <td>{item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default BillingCenter
