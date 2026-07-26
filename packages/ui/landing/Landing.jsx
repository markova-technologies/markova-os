import React from 'react'
import { Link } from 'react-router-dom'
import Waveform from '../waveform/Waveform'
import './Landing.css'

const STEPS = [
  {
    n: '01',
    title: 'Write the agent',
    body: 'Give it a name, a system prompt, and the languages it should hear. Sandbox keys never touch live telephony.',
  },
  {
    n: '02',
    title: 'Point a number',
    body: 'Attach an Ethiopian line (or a test number) so inbound calls reach your agent in seconds.',
  },
  {
    n: '03',
    title: 'Answer and hand off',
    body: 'It picks up, answers from your knowledge, and transfers to a person when the call needs one.',
  },
]

const LANGUAGES = ['Amharic', 'Afaan Oromo', 'Tigrinya', 'English']

/**
 * Shared Markova marketing landing.
 * `/` gate for client + admin — CTAs and docs URL are wired by each app.
 */
const Landing = ({
  primaryTo = '/login',
  primaryLabel = 'Sign in',
  secondaryTo,
  secondaryLabel,
  docsHref = '/docs',
  pricingTo,
  brandTo = '/',
}) => (
  <div className="mk-landing">
    <nav className="mk-landing-nav" aria-label="Primary">
      <Link to={brandTo} className="mk-landing-nav-brand">
        Markova
      </Link>
      <div className="mk-landing-nav-links">
        <a className="mk-landing-nav-link" href="#how">
          How it works
        </a>
        {pricingTo ? (
          <Link className="mk-landing-nav-link" to={pricingTo}>
            Pricing
          </Link>
        ) : null}
        <a className="mk-landing-nav-link" href={docsHref} target="_blank" rel="noreferrer">
          Docs
        </a>
        {secondaryTo && secondaryLabel ? (
          <Link className="mk-landing-nav-link" to={secondaryTo}>
            {secondaryLabel}
          </Link>
        ) : null}
        <Link className="mk-landing-nav-cta" to={primaryTo}>
          {primaryLabel}
        </Link>
      </div>
    </nav>

    <main>
      <section className="mk-landing-hero" aria-label="Hero">
        <h1 className="mk-landing-brand">MARKOVA</h1>
        <p className="mk-landing-headline">An AI that answers your phone, in Amharic.</p>
        <p className="mk-landing-lead">
          Voice agents on real Ethiopian lines — driven by an API you control, billed per minute,
          sandbox-first.
        </p>
        <div className="mk-landing-actions">
          <Link className="mk-landing-btn mk-landing-btn-primary" to={primaryTo}>
            {primaryLabel}
          </Link>
          {secondaryTo && secondaryLabel ? (
            <Link className="mk-landing-btn mk-landing-btn-secondary" to={secondaryTo}>
              {secondaryLabel}
            </Link>
          ) : (
            <a className="mk-landing-btn mk-landing-btn-secondary" href={docsHref} target="_blank" rel="noreferrer">
              Read the docs
            </a>
          )}
        </div>
        <div className="mk-landing-wave">
          <Waveform size="callscreen" env="test" ariaLabel="" />
        </div>
      </section>

      <section id="how" className="mk-landing-section">
        <h2 className="mk-landing-section-title">From prompt to live line</h2>
        <p className="mk-landing-section-lead">
          Three moves. You should hear a test answer before you finish your coffee.
        </p>
        <ol className="mk-landing-steps">
          {STEPS.map((step) => (
            <li key={step.n} className="mk-landing-step">
              <span className="mk-landing-step-n">{step.n}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="languages" className="mk-landing-section mk-landing-section-alt">
        <h2 className="mk-landing-section-title">Built for Ethiopian callers</h2>
        <p className="mk-landing-section-lead">
          Understand what people actually say on the phone — then pull answers from documents you
          upload, and keep a full transcript of every minute.
        </p>
        <ul className="mk-landing-langs" aria-label="Supported languages">
          {LANGUAGES.map((lang) => (
            <li key={lang}>{lang}</li>
          ))}
        </ul>
      </section>

      <section className="mk-landing-section">
        <h2 className="mk-landing-section-title">API-first, not a black box</h2>
        <p className="mk-landing-section-lead">
          Create agents, place sandbox calls, read transcripts, and wire webhooks — the same contract
          your dashboard uses. Start with a <code className="mk-landing-code">mk_test_</code> key;
          graduate to live when you are ready.
        </p>
        <div className="mk-landing-actions">
          <a className="mk-landing-btn mk-landing-btn-secondary" href={docsHref} target="_blank" rel="noreferrer">
            Open API docs
          </a>
          <Link className="mk-landing-btn mk-landing-btn-primary" to={primaryTo}>
            {primaryLabel}
          </Link>
        </div>
      </section>

      <footer className="mk-landing-footer">
        <p className="mk-landing-footer-brand">MARKOVA</p>
        <div className="mk-landing-footer-links">
          <a href={docsHref} target="_blank" rel="noreferrer">
            Docs
          </a>
          {pricingTo ? <Link to={pricingTo}>Pricing</Link> : null}
          <Link to={primaryTo}>{primaryLabel}</Link>
        </div>
      </footer>
    </main>
  </div>
)

export default Landing
