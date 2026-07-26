import React from 'react'
import CodeBlock from '../../components/CodeBlock'
import Callout from '../../components/Callout'
import NextLinks from '../../components/NextLinks'

const Environments = () => (
  <>
    <p className="docs-page-kicker">Core concepts</p>
    <h1>Sandbox vs live</h1>
    <p className="lead">
      The two environments share one API and one set of request shapes. What differs is consequence:
      sandbox spends nothing and calls nobody real.
    </p>

    <h2>The key decides</h2>
    <p>
      There is no environment parameter to remember. The prefix on your key determines which world the
      request lands in, so a key that leaks can't quietly act in the wrong one.
    </p>

    <table>
      <thead>
        <tr>
          <th />
          <th>
            <code>mk_test_</code>
          </th>
          <th>
            <code>mk_live_</code>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Telephony spend</td>
          <td>None</td>
          <td>Billed per minute</td>
        </tr>
        <tr>
          <td>Numbers</td>
          <td>Test lines, marked as such</td>
          <td>Real, dialable lines</td>
        </tr>
        <tr>
          <td>
            <code>/agents/&#123;id&#125;/test-call</code>
          </td>
          <td>Allowed</td>
          <td>
            Rejected with <code>403</code>
          </td>
        </tr>
        <tr>
          <td>Card required</td>
          <td>No</td>
          <td>Yes</td>
        </tr>
        <tr>
          <td>Request and response shapes</td>
          <td colSpan={2}>Identical — code written against sandbox runs unchanged against live</td>
        </tr>
      </tbody>
    </table>

    <h2>Keeping both keys</h2>
    <p>
      Keep a sandbox key in local and CI environments and a live key only where real calls belong.
      Both are created from the same endpoint.
    </p>

    <CodeBlock
      code={`curl -X POST http://localhost:8000/v1/keys \\
  -H "Authorization: Bearer YOUR_JWT" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "production", "environment": "live"}'`}
    />

    <p>
      Listing keys returns prefixes only — the full secret is shown once, at creation, and never
      again. If you lose it, delete the key and make another.
    </p>

    <CodeBlock
      language="json"
      code={`[
  { "id": "8f1c...", "name": "local dev",  "key_prefix": "mk_test_9f2", "environment": "test", "status": "active" },
  { "id": "b204...", "name": "production", "key_prefix": "mk_live_c71", "environment": "live", "status": "active" }
]`}
    />

    <Callout kind="live">
      <p>
        Going live is a deliberate step, not a config flag you flip by accident. Before you swap keys,
        place one more test call and read the transcript — the sandbox behaves the same way the live
        line will.
      </p>
    </Callout>

    <NextLinks
      links={[
        { to: '/pricing', label: 'What live calls cost' },
        { to: '/concepts/numbers', label: 'Numbers' },
      ]}
    />
  </>
)

export default Environments
