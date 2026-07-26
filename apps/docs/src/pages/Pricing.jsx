import React, { useEffect, useState } from 'react'
import Callout from '../components/Callout'
import NextLinks from '../components/NextLinks'

const API_BASE = import.meta.env.VITE_API_URL || ''

const formatEtb = (n) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })

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
        Monthly plans in birr, with included minutes. Sandbox is free and needs no card, so you can
        build the whole integration before you pay anything.
      </p>

      {failed && (
        <Callout kind="note">
          <p>
            Live rates come from the API and it isn&apos;t reachable from here right now. Start the
            gateway or check <code>/v1/pricing</code> directly.
          </p>
          <p>
            Published rates: Basic 4,999 ETB / 900 min · Plus 15,000 ETB / 2,500 min with AI workforce
            · Enterprise contact.
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
              <div
                key={tier.id}
                className={`pricing-card ${tier.id === 'plus' ? 'is-featured' : ''}`}
              >
                <p className="pricing-name">{tier.name}</p>
                <p className="pricing-rate">
                  {tier.contact_sales
                    ? 'Contact'
                    : formatEtb(tier.price_etb_monthly)}
                  <span>
                    {tier.contact_sales
                      ? 'custom pricing'
                      : `${pricing.currency} / month`}
                  </span>
                </p>
                <p className="pricing-summary">{tier.summary}</p>
                <ul className="pricing-facts">
                  {tier.minutes_included != null && (
                    <li>
                      Included minutes: <strong>{tier.minutes_included.toLocaleString()}</strong>
                    </li>
                  )}
                  <li>
                    AI workforce: <strong>{tier.ai_workforce ? 'yes' : 'no'}</strong>
                  </li>
                  <li>
                    Support: <strong>{tier.support}</strong>
                  </li>
                </ul>
              </div>
            ))}
          </div>

          <h2>How billing works</h2>
          <ul>
            <li>Basic: 4,999 ETB/month with 900 included minutes.</li>
            <li>Plus: 15,000 ETB/month with 2,500 included minutes and AI workforce.</li>
            <li>Enterprise: contact us for custom volume and SLAs.</li>
            <li>
              Going over your included minutes bills automatically rather than cutting a call off
              mid-conversation.
            </li>
            <li>Sandbox usage is never billed, on any plan.</li>
          </ul>
        </>
      )}

      <Callout kind="sandbox">
        <p>
          Plus includes AI workforce — agents that execute actions on your connected systems. Basic
          answers and transcribes within your included minutes.
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
