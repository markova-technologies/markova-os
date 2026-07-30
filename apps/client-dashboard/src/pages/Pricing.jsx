import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Check, ArrowRight, ShieldCheck, Zap } from 'lucide-react'
import { ROUTES } from '../config/site'
import PublicHeader from '../components/PublicHeader'
import './Pricing.css'

const FALLBACK_PRICING = {
  currency: 'ETB',
  unit: 'per_month',
  sandbox: {
    name: 'Sandbox',
    notes: 'mk_test_ API keys — no real telephony spend, no credit card required.',
  },
  tiers: [
    {
      id: 'basic',
      name: 'Basic',
      price_etb_monthly: 4999,
      minutes_included: 900,
      ai_workforce: false,
      contact_sales: false,
      summary: '900 included minutes per month for inbound voice agents that answer, route, and transcribe.',
    },
    {
      id: 'plus',
      name: 'Plus',
      price_etb_monthly: 15000,
      minutes_included: 2500,
      ai_workforce: true,
      contact_sales: false,
      summary: '2,500 included minutes per month with AI workforce — agents that execute actions in your systems.',
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price_etb_monthly: null,
      minutes_included: null,
      ai_workforce: true,
      contact_sales: true,
      summary: 'Custom call volume, guaranteed SLAs, dedicated engineering support, and workforce at scale.',
    },
  ],
}

const formatEtb = (n) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })

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
    <div className="pricing-page-wrapper">
      <PublicHeader />

      <main className="pricing-page-main">
        <header className="pricing-header-section">
          <div className="pricing-badge">
            <Sparkles size={14} />
            <span>TRANSPARENT VALUE PRICING</span>
          </div>
          <h1>Deploy AI Employees at Scale</h1>
          <p>
            Monthly plans with included telephony minutes. Start free in sandbox, pick a plan when you are ready to go live.
          </p>
        </header>

        <div className="pricing-grid">
          <article className="pricing-card glass-card">
            <div className="pricing-card-header">
              <h3>{pricing.sandbox?.name || 'Sandbox'}</h3>
              <div className="pricing-rate">
                <span className="rate-amount">Free</span>
                <span className="rate-period">No card required</span>
              </div>
            </div>
            <p className="pricing-summary">{pricing.sandbox?.notes}</p>
            <ul className="pricing-features">
              <li><Check size={16} className="feature-check" /> <span>Unlimited test call simulations</span></li>
              <li><Check size={16} className="feature-check" /> <span>Full Agent Studio access</span></li>
              <li><Check size={16} className="feature-check" /> <span>Knowledge base uploading</span></li>
            </ul>
            <Link className="pricing-cta-btn secondary" to={ROUTES.signup}>
              Start Free in Sandbox
            </Link>
          </article>

          {tiers.map((tier) => {
            const isFeatured = tier.id === 'plus'
            return (
              <article
                key={tier.id}
                className={`pricing-card glass-card ${isFeatured ? 'is-featured' : ''}`}
              >
                {isFeatured && <div className="featured-ribbon">MOST POPULAR</div>}
                <div className="pricing-card-header">
                  <h3>{tier.name}</h3>
                  {tier.contact_sales ? (
                    <div className="pricing-rate">
                      <span className="rate-amount">Custom</span>
                      <span className="rate-period">Contact Sales</span>
                    </div>
                  ) : (
                    <div className="pricing-rate">
                      <span className="rate-currency">{pricing.currency || 'ETB'}</span>
                      <span className="rate-amount">{formatEtb(tier.price_etb_monthly)}</span>
                      <span className="rate-period">/ month</span>
                    </div>
                  )}
                </div>
                <p className="pricing-summary">{tier.summary}</p>
                <ul className="pricing-features">
                  {tier.minutes_included != null && (
                    <li>
                      <Check size={16} className="feature-check" />
                      <span><strong>{tier.minutes_included.toLocaleString()}</strong> included minutes/mo</span>
                    </li>
                  )}
                  {tier.ai_workforce && (
                    <li>
                      <Check size={16} className="feature-check" />
                      <span><strong>Full AI Workforce</strong> tools included</span>
                    </li>
                  )}
                  {tier.contact_sales && (
                    <li>
                      <Check size={16} className="feature-check" />
                      <span>Custom volume, 99.9% uptime SLA & dedicated SLA</span>
                    </li>
                  )}
                  <li><Check size={16} className="feature-check" /> <span>Live Telephony phone numbers</span></li>
                  <li><Check size={16} className="feature-check" /> <span>Real-time webhook events</span></li>
                </ul>

                {tier.contact_sales ? (
                  <a className="pricing-cta-btn primary" href="mailto:hello@markova.et">
                    Contact Sales
                  </a>
                ) : (
                  <Link className={`pricing-cta-btn ${isFeatured ? 'featured' : 'secondary'}`} to={ROUTES.signup}>
                    <span>Select {tier.name} Plan</span>
                    <ArrowRight size={16} />
                  </Link>
                )}
              </article>
            )
          })}
        </div>

        <section className="pricing-faq-section glass-panel">
          <h2>Transparent Telephony & Operations</h2>
          <div className="faq-grid">
            <div className="faq-item">
              <Zap size={20} className="faq-icon" />
              <div>
                <h4>Included Minutes & Overages</h4>
                <p>Basic includes 900 minutes/month; Plus includes 2,500 minutes/month. Calls never drop if you reach your quota; overages are billed transparently.</p>
              </div>
            </div>
            <div className="faq-item">
              <ShieldCheck size={20} className="faq-icon" />
              <div>
                <h4>Sandbox vs Live Mode</h4>
                <p>Sandbox testing mode is always free and never charges your balance. Live phone lines only consume minutes when active.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="pricing-bottom-cta">
          <h2>Ready to transform your business operations?</h2>
          <div className="cta-actions">
            <Link className="public-btn-primary" to={ROUTES.signup}>
              <span>Get Started Now</span>
              <ArrowRight size={16} />
            </Link>
            <Link className="public-btn-ghost" to={ROUTES.login}>
              Sign In to Dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Pricing
