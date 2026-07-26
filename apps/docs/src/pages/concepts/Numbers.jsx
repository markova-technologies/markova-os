import React from 'react'
import CodeBlock from '../../components/CodeBlock'
import Callout from '../../components/Callout'
import NextLinks from '../../components/NextLinks'

const Numbers = () => (
  <>
    <p className="docs-page-kicker">Core concepts</p>
    <h1>Numbers</h1>
    <p className="lead">
      A number is the phone line customers actually dial. Provision one, point it at an agent, and
      inbound calls start arriving.
    </p>

    <h2>Search, then provision</h2>
    <p>
      Search for what's available, then claim one. Assigning an agent at provision time means the line
      is answering from the moment it exists.
    </p>

    <CodeBlock
      samples={[
        {
          label: 'curl',
          code: `# What's available
curl -X POST http://localhost:8000/v1/numbers/search \\
  -H "x-api-key: mk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"country": "ET", "area_code": "11"}'

# Claim one and point it at an agent
curl -X POST http://localhost:8000/v1/numbers \\
  -H "x-api-key: mk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone_number": "+251115000000",
    "agent_id": "AGENT_ID",
    "settings": { "recording_enabled": true }
  }'`,
        },
        {
          label: 'node',
          code: `const available = await markova.searchNumbers({ country: 'ET', area_code: '11' });

const number = await markova.createNumber({
  phone_number: available[0].phone_number,
  agent_id: agent.id,
  settings: { recording_enabled: true },
});`,
        },
      ]}
    />

    <h2>Per-number settings</h2>
    <p>
      Behaviour that belongs to the line rather than the agent lives in <code>settings</code>, updated
      with <code>PUT /v1/numbers/&#123;id&#125;</code>.
    </p>

    <table>
      <thead>
        <tr>
          <th>Setting</th>
          <th>Effect</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <code>recording_enabled</code>
          </td>
          <td>Records the call audio and attaches the URL to the call record.</td>
        </tr>
        <tr>
          <td>
            <code>ivr_enabled</code>
          </td>
          <td>Plays a keypad menu before connecting, driven by the number's routing rules.</td>
        </tr>
        <tr>
          <td>
            <code>ivr_menu</code>
          </td>
          <td>The spoken prompt for that menu.</td>
        </tr>
        <tr>
          <td>
            <code>voicemail_email</code>
          </td>
          <td>Where a voicemail recording and its transcript get sent.</td>
        </tr>
        <tr>
          <td>
            <code>transfer_number</code>
          </td>
          <td>Default destination when a call is handed to a person.</td>
        </tr>
      </tbody>
    </table>

    <h2>Routing rules</h2>
    <p>
      Routing rules map a keypad digit to an action: send the caller to the agent, transfer to a
      person, or take a voicemail.
    </p>

    <CodeBlock
      code={`curl -X POST http://localhost:8000/v1/numbers/NUMBER_ID/routing-rules \\
  -H "x-api-key: mk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "rules": [
      { "digit": "1", "action": "agent",     "label": "Bookings and hours" },
      { "digit": "2", "action": "transfer",  "label": "Speak to the front desk", "to": "+251911222333" },
      { "digit": "3", "action": "voicemail", "label": "Leave a message" }
    ]
  }'`}
    />

    <Callout kind="live">
      <p>
        Provisioning is one of the few actions with real cost attached. A number claimed with a{' '}
        <code>mk_live_</code> key is a real line on a real bill — sandbox numbers are marked as test
        and never ring a stranger.
      </p>
    </Callout>

    <NextLinks
      links={[
        { to: '/concepts/knowledge', label: 'Knowledge' },
        { to: '/concepts/environments', label: 'Sandbox vs live' },
      ]}
    />
  </>
)

export default Numbers
