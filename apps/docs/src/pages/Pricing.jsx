import React, { useEffect, useState } from 'react'
import Callout from '../components/Callout'
import NextLinks from '../components/NextLinks'

const API_BASE = import.meta.env.VITE_API_URL || ''

// Read from the same public /v1/pricing endpoint the dashboard uses, so the
// published rates can never drift from the ones you are billed at.
const Pricing = () => {
  const [pricing, setPricing] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/v1/pricing`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then(setPricing)
      .catch(() => setFailed(true))
  }, [])

  return (
    <>
      <p className="docs-page-kicker">Product</p>
      <h1>Pricing</h1>
      <p className="lead">
        Per minute, in birr, with no minimum and no sales call. Sandbox is free and needs no card, so
        you can build the whole integration before you pay anything.
      </p>

      {failed && (
        <Callout kind="note">
          <p>
            Live rates come from the API and it isn't reachable from here right now. Start the gateway
            or check <code>/v1/pricing</code> directly.
          </p>
        </Callout>
      )}

      {pricing && (
        <>
          <div className="pricing-grid">
            <div className="pricing-card">
              <p className="pricing-name">{pricing.sandbox?.name || 'Sandbox'}</p>
              <p className="pricing-rate">
                Free<span>no card</span>
              </p>
              <p className="pricing-summary">{pricing.sandbox?.notes}</p>
            </div>

            {pricing.tiers?.map((tier) => (
              <div key={tier.id} className={`pricing-card ${tier.id === 'pro' ? 'is-featured' : ''}`}>
                <p className="pricing-name">{tier.name}</p>
                <p className="pricing-rate">
                  {tier.price_etb_per_minute_inbound}
                  <span>
                    {pricing.currency} / inbound min
                  </span>
                </p>
                <p className="pricing-summary">{tier.summary}</p>
                <ul className="pricing-facts">
                  <li>
                    Outbound:{' '}
                    <strong>
                      {tier.price_etb_per_minute_outbound
                        ? `${tier.price_etb_per_minute_outbound} ${pricing.currency} / min`
                        : 'add-on pack'}
                    </strong>
                  </li>
                  <li>
                    Included outbound minutes: <strong>{tier.outbound_minutes_included}</strong>
                  </li>
                  <li>
                    Concurrent agents: <strong>{tier.concurrent_agents}</strong>
                  </li>
                  <li>
                    Workflow actions:{' '}
                    <strong>{tier.workflow_execution ? 'executed' : 'detected only'}</strong>
                  </li>
                  <li>
                    Support: <strong>{tier.support}</strong>
                  </li>
                </ul>
              </div>
            ))}
          </div>

          {pricing.add_ons?.length > 0 && (
            <>
              <h2>Add-ons</h2>
              <table>
                <thead>
                  <tr>
                    <th>Add-on</th>
                    <th>Price</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {pricing.add_ons.map((addOn) => (
                    <tr key={addOn.id}>
                      <td>{addOn.name}</td>
                      <td>
                        {addOn.price_etb} {pricing.currency}
                      </td>
                      <td>{addOn.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <h2>How billing works</h2>
          <ul>
            <li>Calls are metered per minute against the ledger you can read at /v1/usage.</li>
            <li>
              Going over your included minutes bills automatically rather than cutting a call off
              mid-conversation.
            </li>
            {pricing.annual_discount_percent ? (
              <li>Paying annually takes {pricing.annual_discount_percent}% off.</li>
            ) : null}
            <li>Sandbox usage is never billed, on any plan.</li>
          </ul>
        </>
      )}

      <Callout kind="sandbox">
        <p>
          Workflow actions are the one real difference between Basic and Pro. On Basic an agent still
          detects what should happen and records it — you just approve it yourself instead of it being
          written to your systems automatically.
        </p>
      </Callout>

      <NextLinks
        links={[
          { to: '/concepts/environments', label: 'Sandbox vs live' },
          { to: '/quickstart', label: 'Start building' },
        ]}
      />
    </>
  )
}

export default Pricing
