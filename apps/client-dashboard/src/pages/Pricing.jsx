import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DOCS_URL, ROUTES } from '../config/site'
import './Pricing.css'

/**
 * Public pricing — lives on the client product before /app.
 * Rates come from GET /v1/pricing (same source as docs + billing).
 */
const Pricing = () => {
  const [pricing, setPricing] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/v1/pricing')
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then(setPricing)
      .catch(() => setFailed(true))
  }, [])

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
            Per minute, in birr. Sandbox is free — build the whole integration before you pay
            anything. Pick a plan, then enter the dashboard.
          </p>
        </header>

        {failed && (
          <p className="mk-pricing-note">
            Live rates come from the API and aren’t reachable right now. Start the gateway or check{' '}
            <code>/v1/pricing</code>.
          </p>
        )}

        {pricing && (
          <>
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

              {pricing.tiers?.map((tier) => (
                <article
                  key={tier.id}
                  className={`mk-pricing-tier ${tier.id === 'pro' ? 'is-featured' : ''}`}
                >
                  <h2>{tier.name}</h2>
                  <p className="mk-pricing-rate">
                    {tier.price_etb_per_minute_inbound}
                    <span>
                      {pricing.currency} / inbound min
                    </span>
                  </p>
                  <p className="mk-pricing-summary">{tier.summary}</p>
                  <ul>
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
                  <Link className="mk-pricing-tier-cta" to={ROUTES.signup}>
                    Choose {tier.name}
                  </Link>
                </article>
              ))}
            </div>

            {pricing.add_ons?.length > 0 && (
              <section className="mk-pricing-addons">
                <h2>Add-ons</h2>
                <ul>
                  {pricing.add_ons.map((addOn) => (
                    <li key={addOn.id}>
                      <span>{addOn.name}</span>
                      <strong>
                        {addOn.price_etb} {pricing.currency}
                      </strong>
                      <em>{addOn.notes}</em>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mk-pricing-how">
              <h2>How billing works</h2>
              <ul>
                <li>Calls are metered per minute against usage you can read in the dashboard.</li>
                <li>Going over included minutes bills automatically — calls are not cut mid-conversation.</li>
                {pricing.annual_discount_percent ? (
                  <li>Paying annually takes {pricing.annual_discount_percent}% off.</li>
                ) : null}
                <li>Sandbox usage is never billed, on any plan.</li>
              </ul>
            </section>
          </>
        )}

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
