import React from 'react'
import CodeBlock from '../../components/CodeBlock'
import Callout from '../../components/Callout'
import NextLinks from '../../components/NextLinks'

const Calls = () => (
  <>
    <p className="docs-page-kicker">Core concepts</p>
    <h1>Calls</h1>
    <p className="lead">
      A call is one conversation between a caller and an agent, with its transcript, recording,
      metering, and — if it happened — the handoff to a person.
    </p>

    <h2>What it is</h2>
    <p>
      Calls arrive two ways. Inbound: someone dials a number you've provisioned, and the agent
      assigned to that number answers. Outbound: you create the call yourself with{' '}
      <code>POST /v1/calls</code>. Either way you get back a call record with an id, and everything
      else hangs off it.
    </p>

    <CodeBlock
      samples={[
        {
          label: 'curl',
          code: `curl -X POST http://localhost:8000/v1/calls \\
  -H "x-api-key: mk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "AGENT_ID",
    "to_number": "+251911000000",
    "sandbox": true
  }'`,
        },
        {
          label: 'node',
          code: `const call = await markova.createCall({
  agent_id: agent.id,
  to_number: '+251911000000',
  sandbox: true,
});`,
        },
      ]}
    />

    <CodeBlock
      language="json"
      code={`{
  "id": "3c9a...",
  "agent_id": "8f1c...",
  "agent_name": "Reception",
  "caller_number": "+251911000000",
  "status": "active",
  "start_time": "2026-07-26T08:14:00Z",
  "end_time": null,
  "turn_count": 0,
  "recording_url": null,
  "sandbox": true,
  "billed": false
}`}
    />

    <h2>Transcripts and recordings</h2>
    <p>
      The transcript is written turn by turn as the call happens, so you can read it while the call is
      still open. Recording is a per-number setting rather than a per-call flag — see{' '}
      <a href="/concepts/numbers">Numbers</a>.
    </p>

    <CodeBlock
      code={`curl http://localhost:8000/v1/calls/CALL_ID/transcript -H "x-api-key: mk_test_YOUR_KEY"
curl http://localhost:8000/v1/calls/CALL_ID/recording  -H "x-api-key: mk_test_YOUR_KEY"`}
    />

    <h2>Handing a call to a person</h2>
    <p>
      When the agent should step aside, transfer the call. The response carries the full conversation
      context — transcript and a summary — so whoever picks up isn't asking the caller to start over.
    </p>

    <CodeBlock
      samples={[
        {
          label: 'curl',
          code: `curl -X POST http://localhost:8000/v1/calls/CALL_ID/transfer \\
  -H "x-api-key: mk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+251911222333",
    "notes": "Caller wants to reschedule a booking made last week."
  }'`,
        },
        {
          label: 'node',
          code: `const handoff = await markova.transferCall(call.id, {
  to: '+251911222333',
  notes: 'Caller wants to reschedule a booking made last week.',
});

console.log(handoff.context.transcript);`,
        },
      ]}
    />

    <p>
      The same package stays retrievable afterwards at{' '}
      <code>GET /v1/calls/&#123;id&#125;/transfer-context</code>, which is what you'd show a support
      agent opening the call in your own tooling.
    </p>

    <Callout kind="sandbox">
      <p>
        A sandbox call that fails is a sandbox problem — no real line was dialled and nothing was
        billed. Check <code>status</code> on the call record before assuming a telephony fault.
      </p>
    </Callout>

    <NextLinks
      links={[
        { to: '/concepts/numbers', label: 'Numbers' },
        { to: '/concepts/webhooks', label: 'Webhooks' },
      ]}
    />
  </>
)

export default Calls
