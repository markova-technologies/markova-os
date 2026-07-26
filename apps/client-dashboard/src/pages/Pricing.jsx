import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DOCS_URL, ROUTES } from '../config/site'
import './Pricing.css'

/** Fallback when /v1/pricing is unreachable (e.g. static Vercel without API). */
const FALLBACK_PRICING = {
  currency: 'ETB',
  unit: 'per_month',
  sandbox: {
    name: 'Sandbox',
    notes: 'mk_test_ keys — no real telephony spend, no card required.',
  },
  tiers: [
    {
      id: 'basic',
      name: 'Basic',
      price_etb_monthly: 4999,
      minutes_included: 900,
      ai_workforce: false,
      contact_sales: false,
      summary: '900 included minutes per month for inbound voice agents that answer and transcribe.',
    },
    {
      id: 'plus',
      name: 'Plus',
      price_etb_monthly: 15000,
      minutes_included: 2500,
      ai_workforce: true,
      contact_sales: false,
      summary: '2,500 included minutes per month with AI workforce — agents that act on your systems.',
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price_etb_monthly: null,
      minutes_included: null,
      ai_workforce: true,
      contact_sales: true,
      summary: 'Custom volume, SLAs, dedicated support, and workforce at scale. Contact us.',
    },
  ],
}

const formatEtb = (n) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })

/**
 * Public pricing — lives on the client product before /app.
 * Rates come from GET /v1/pricing (same source as docs + billing).
 */
const Pricing = () => {
  const [pricing, setPricing] = useState(FALLBACK_PRICING)
  const [fromApi, setFromApi] = useState(false)

  useEffect(() => {
    fetch('/v1/pricing')
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        setPricing(data)
        setFromApi(true)
      })
      .catch(() => {
        setPricing(FALLBACK_PRICING)
        setFromApi(false)
      })
  }, [])

  const tiers = pricing.tiers || FALLBACK_PRICING.tiers

  return (
    <div className="mk-pricing">
      <nav className="mk-pricing-nav" aria-label="Primary">
        <Link to={ROUTES.home} className="mk-pricing-brand">
          Markova
        </Link>
        <div className="mk-pricing-nav-links">
          <Link to={ROUTES.home}>Home</Link>
          <a href={DOCS_URL} target="_blank" rel="noreferrer">
            Docs
          </a>
          <Link to={ROUTES.login}>Sign in</Link>
          <Link className="mk-pricing-nav-cta" to={ROUTES.signup}>
            Get started
          </Link>
        </div>
      </nav>

      <main className="mk-pricing-main">
        <header className="mk-pricing-header">
          <h1>Pricing</h1>
          <p>
            Monthly plans in birr, with included minutes. Sandbox is free — pick a plan, then enter
            the dashboard.
          </p>
        </header>

        {!fromApi && (
          <p className="mk-pricing-note">
            Showing published rates. Live API pricing will sync when the gateway is reachable.
          </p>
        )}

        <div className="mk-pricing-tiers">
          <article className="mk-pricing-tier">
            <h2>{pricing.sandbox?.name || 'Sandbox'}</h2>
            <p className="mk-pricing-rate">
              Free <span>no card</span>
            </p>
            <p className="mk-pricing-summary">{pricing.sandbox?.notes}</p>
            <Link className="mk-pricing-tier-cta" to={ROUTES.signup}>
              Start free
            </Link>
          </article>

          {tiers.map((tier) => (
            <article
              key={tier.id}
              className={`mk-pricing-tier ${tier.id === 'plus' ? 'is-featured' : ''}`}
            >
              <h2>{tier.name}</h2>
              {tier.contact_sales ? (
                <p className="mk-pricing-rate">
                  Contact <span>custom pricing</span>
                </p>
              ) : (
                <p className="mk-pricing-rate">
                  {formatEtb(tier.price_etb_monthly)}
                  <span>
                    {pricing.currency || 'ETB'} / month
                  </span>
                </p>
              )}
              <p className="mk-pricing-summary">{tier.summary}</p>
              <ul>
                {tier.minutes_included != null && (
                  <li>
                    Included minutes: <strong>{tier.minutes_included.toLocaleString()}</strong>
                  </li>
                )}
                {tier.ai_workforce && (
                  <li>
                    <strong>AI workforce</strong> included
                  </li>
                )}
                {tier.contact_sales && (
                  <li>
                    Custom volume, SLAs, and dedicated support
                  </li>
                )}
              </ul>
              {tier.contact_sales ? (
                <a className="mk-pricing-tier-cta" href="mailto:hello@markova.et">
                  Contact sales
                </a>
              ) : (
                <Link className="mk-pricing-tier-cta" to={ROUTES.signup}>
                  Choose {tier.name}
                </Link>
              )}
            </article>
          ))}
        </div>

        <section className="mk-pricing-how">
          <h2>How billing works</h2>
          <ul>
            <li>Basic includes 900 minutes/month · Plus includes 2,500 minutes/month with AI workforce.</li>
            <li>Going over included minutes bills automatically — calls are not cut mid-conversation.</li>
            <li>Sandbox usage is never billed, on any plan.</li>
            <li>Enterprise is custom — contact us for volume and SLAs.</li>
          </ul>
        </section>

        <div className="mk-pricing-footer-cta">
          <Link className="mk-pricing-btn-primary" to={ROUTES.signup}>
            Get started
          </Link>
          <Link className="mk-pricing-btn-secondary" to={ROUTES.login}>
            Sign in to dashboard
          </Link>
        </div>
      </main>
    </div>
  )
}

export default Pricing
