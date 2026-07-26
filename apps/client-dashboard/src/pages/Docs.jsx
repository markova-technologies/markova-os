import { Link } from 'react-router-dom'
import { ROUTES } from '../config/site'
import './Docs.css'

/**
 * Public docs — same gate as /pricing: no login, always in the product nav.
 */
const Docs = () => (
  <div className="mk-docs">
    <nav className="mk-docs-nav" aria-label="Primary">
      <Link to={ROUTES.home} className="mk-docs-brand">
        Markova
      </Link>
      <div className="mk-docs-nav-links">
        <Link to={ROUTES.home}>Home</Link>
        <Link to={ROUTES.pricing}>Pricing</Link>
        <Link to={ROUTES.docs} aria-current="page">
          Docs
        </Link>
        <Link to={ROUTES.login}>Sign in</Link>
        <Link className="mk-docs-nav-cta" to={ROUTES.signup}>
          Get started
        </Link>
      </div>
    </nav>

    <main className="mk-docs-main">
      <header className="mk-docs-header">
        <h1>Docs</h1>
        <p>
          Voice agents on Ethiopian lines, driven by an API. Start in sandbox with a{' '}
          <code>mk_test_</code> key — nothing is billed until you go live.
        </p>
      </header>

      <section className="mk-docs-section" id="quickstart">
        <h2>Quickstart</h2>
        <p>
          Three moves: create an agent, place a sandbox test call, read the transcript. You should
          hear an answer on your phone before you finish your coffee.
        </p>
        <ol className="mk-docs-steps">
          <li>
            <strong>Sign up</strong> and create a sandbox API key (
            <code>environment: &quot;test&quot;</code>). The full secret is shown once.
          </li>
          <li>
            <strong>Create an agent</strong> with a name, language, and prompt — Amharic, Afaan Oromo,
            Tigrinya, or English.
          </li>
          <li>
            <strong>Place a test call</strong> to your number. Sandbox calls never touch live
            telephony or your bill.
          </li>
        </ol>
        <pre className="mk-docs-code">{`# Create an agent
curl -X POST https://api.markova.et/v1/agents \\
  -H "x-api-key: mk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Reception",
    "language": "am",
    "prompt": "You answer for a dental clinic in Addis."
  }'

# Sandbox test call (unbilled)
curl -X POST https://api.markova.et/v1/agents/AGENT_ID/test-call \\
  -H "x-api-key: mk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to_number": "+251911000000"}'`}</pre>
      </section>

      <section className="mk-docs-section" id="concepts">
        <h2>Core concepts</h2>
        <ul className="mk-docs-concepts">
          <li>
            <strong>Agents</strong> — instructions, language, and behavior for every call.
          </li>
          <li>
            <strong>Numbers</strong> — Ethiopian lines pointed at an agent so inbound calls are answered.
          </li>
          <li>
            <strong>Knowledge</strong> — documents the agent can pull answers from during a call.
          </li>
          <li>
            <strong>Sandbox vs live</strong> — <code>mk_test_</code> never bills; <code>mk_live_</code>{' '}
            uses real telephony and your plan minutes.
          </li>
          <li>
            <strong>Webhooks</strong> — get transcripts and call events when a conversation ends.
          </li>
        </ul>
      </section>

      <section className="mk-docs-section" id="plans">
        <h2>Plans</h2>
        <p>
          Basic is 4,999 ETB / month with 900 minutes. Plus is 15,000 ETB / month with 2,500 minutes
          and AI workforce. Enterprise is custom — contact us.
        </p>
        <Link className="mk-docs-link" to={ROUTES.pricing}>
          See full pricing →
        </Link>
      </section>

      <div className="mk-docs-footer-cta">
        <Link className="mk-docs-btn-primary" to={ROUTES.signup}>
          Get started
        </Link>
        <Link className="mk-docs-btn-secondary" to={ROUTES.login}>
          Sign in to dashboard
        </Link>
      </div>
    </main>
  </div>
)

export default Docs
