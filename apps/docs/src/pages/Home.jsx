import React from 'react'
import { Link } from 'react-router-dom'
import Waveform from '../../../../packages/ui/waveform/Waveform'
import CodeBlock from '../components/CodeBlock'
import Callout from '../components/Callout'

const Home = () => (
  <>
    <section className="docs-hero">
      <div className="docs-hero-wave">
        <Waveform size="callscreen" env="test" ariaLabel="" />
      </div>
      <h1>An AI that answers your phone, in Amharic.</h1>
      <p className="lead">
        Markova gives you a voice agent on a real Ethiopian phone line, driven entirely by an API. You
        write the agent's instructions, point a number at it, and it picks up — understanding Amharic,
        Afaan Oromo, Tigrinya, or English, pulling answers from documents you upload, and handing the
        call to a person when it should. Every call is transcribed and billed per minute, and you can
        run the whole thing in a sandbox before a single birr is spent.
      </p>
      <p className="lead">
        These docs are written by the people who built it. Start with the Quickstart — you should have
        an agent answering a test call before you finish your coffee.
      </p>
    </section>

    <h2>Get a call answered</h2>
    <p>
      Three requests: create an agent, place a sandbox test call, read the transcript. Sandbox keys
      start with <code>mk_test_</code> and never touch real telephony.
    </p>

    <CodeBlock
      samples={[
        {
          label: 'curl',
          code: `# 1. Create an agent
curl -X POST http://localhost:8000/v1/agents \\
  -H "x-api-key: mk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Reception",
    "language": "am",
    "prompt": "You answer for a dental clinic in Addis. Give opening hours and take booking requests."
  }'

# 2. Call your own phone from the agent (sandbox, unbilled)
curl -X POST http://localhost:8000/v1/agents/AGENT_ID/test-call \\
  -H "x-api-key: mk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to_number": "+251911000000"}'`,
        },
        {
          label: 'node',
          code: `import { Markova } from '@markova/sdk';

const markova = new Markova({
  baseUrl: 'http://localhost:8000',
  apiKey: 'mk_test_YOUR_KEY',
});

const agent = await markova.createAgent({
  name: 'Reception',
  language: 'am',
  prompt: 'You answer for a dental clinic in Addis. Give opening hours and take booking requests.',
});

await markova.testCall(agent.id, { to_number: '+251911000000' });`,
        },
      ]}
    />

    <Callout kind="sandbox">
      <p>
        Test calls require a sandbox key. Send a <code>mk_live_</code> key to{' '}
        <code>/v1/agents/&#123;id&#125;/test-call</code> and the API returns <code>403</code> rather
        than quietly charging you.
      </p>
    </Callout>

    <h2>Where to go next</h2>
    <div className="docs-card-grid">
      <Link className="docs-card" to="/quickstart">
        <h3>Quickstart</h3>
        <p>From signup to a ringing phone, step by step, with every response shape shown.</p>
      </Link>
      <Link className="docs-card" to="/concepts/agents">
        <h3>Core concepts</h3>
        <p>Agents, calls, numbers, knowledge — what each one is and when you reach for it.</p>
      </Link>
      <Link className="docs-card" to="/api">
        <h3>API reference</h3>
        <p>Every endpoint, parameter, and response, generated from the API's own spec.</p>
      </Link>
      <Link className="docs-card" to="/concepts/environments">
        <h3>Sandbox vs live</h3>
        <p>What actually changes when you cross over into real calls and real spend.</p>
      </Link>
      <Link className="docs-card" to="/webhooks">
        <h3>Webhooks</h3>
        <p>Let an agent act on your systems mid-call, and verify what reaches you.</p>
      </Link>
      <Link className="docs-card" to="/pricing">
        <h3>Pricing</h3>
        <p>Per-minute rates in birr, straight from the pricing endpoint. No sales call.</p>
      </Link>
    </div>
  </>
)

export default Home
