import React, { useState, useEffect } from 'react'
import { CreditCard, Activity, CheckCircle, ShieldAlert } from 'lucide-react'
import axios from 'axios'
import './BillingCenter.css'

const BillingCenter = () => {
  const [billingData, setBillingData] = useState({
    usage: [],
    lineItems: [],
    totalAiCost: 0
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchBilling = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_SYSTEM_DASHBOARD_URL || 'http://localhost:8000'}/api/billing/invoice`, {
          headers: {
            'x-tenant-id': JSON.parse(localStorage.getItem('user'))?.company_id || 'test-company-id'
          }
        })
        setBillingData({
          usage: response.data.usage || [],
          lineItems: response.data.lineItems || [],
          totalAiCost: response.data.totalUnbilledAiCost || 0
        })
      } catch (err) {
        console.error('Failed to fetch billing data', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchBilling()
  }, [])

  return (
    <div className="billing-center">
      <header className="page-header">
        <h1>Billing & Quotas</h1>
        <p>Manage your enterprise subscription, AI inference limits, and invoices.</p>
      </header>

      {isLoading ? (
        <div className="loading">Loading billing data...</div>
      ) : (
        <div className="billing-dashboard">
          
          <div className="billing-card summary-card">
            <div className="card-header">
              <CreditCard size={24} />
              <h2>Current AI Usage (Unbilled)</h2>
            </div>
            <div className="amount-display">
              <span className="currency">$</span>
              <span className="amount">{Number(billingData.totalAiCost).toFixed(4)}</span>
              <span className="period">/ this cycle</span>
            </div>
            <button className="pay-button">Pay Now</button>
          </div>

          <div className="billing-card limits-card">
            <div className="card-header">
              <Activity size={24} />
              <h2>Resource Quotas</h2>
            </div>
            <div className="quota-list">
              {billingData.usage.length === 0 ? (
                <p className="no-data">No active quotas found. You have unlimited resources on this plan.</p>
              ) : (
                billingData.usage.map(u => (
                  <div key={u.id} className="quota-item">
                    <div className="quota-info">
                      <span className="quota-name">{u.resource_type.replace('_', ' ').toUpperCase()}</span>
                      <span className="quota-numbers">{u.current_usage} / {u.max_limit === 0 ? '∞' : u.max_limit}</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className={`progress-fill ${u.max_limit > 0 && (u.current_usage / u.max_limit) > 0.9 ? 'danger' : ''}`}
                        style={{ width: u.max_limit === 0 ? '10%' : `${Math.min((u.current_usage / u.max_limit) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="billing-card invoice-card full-width">
            <div className="card-header">
              <ShieldAlert size={24} />
              <h2>Recent Line Items</h2>
            </div>
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
                {billingData.lineItems.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center text-gray-500 py-4">No unbilled items</td>
                  </tr>
                ) : (
                  billingData.lineItems.map(item => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td><span className={`badge ${item.type}`}>{item.type}</span></td>
                      <td>
                        {item.status === 'unbilled' ? <span className="status unbilled">Unbilled</span> : <CheckCircle size={16} className="text-green-500" />}
                      </td>
                      <td className="amount-col">${Number(item.amount_usd).toFixed(4)}</td>
                      <td>{new Date(item.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default BillingCenter
