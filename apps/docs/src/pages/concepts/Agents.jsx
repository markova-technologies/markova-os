import React from 'react'
import CodeBlock from '../../components/CodeBlock'
import Callout from '../../components/Callout'
import NextLinks from '../../components/NextLinks'

const Agents = () => (
  <>
    <p className="docs-page-kicker">Core concepts</p>
    <h1>Agents</h1>
    <p className="lead">
      An agent is the thing that talks. It holds the instructions, the language, and the voice used on
      every call routed to it.
    </p>

    <h2>What it is</h2>
    <p>
      Agents are configuration, not running processes — you create one, and it exists until you delete
      it, ready to pick up whenever a call arrives. The prompt is where the work goes: it is the whole
      brief the agent has about your business, so write it the way you'd brief a new hire on their
      first shift, including what to do when they don't know the answer.
    </p>

    <table>
      <thead>
        <tr>
          <th>Field</th>
          <th>What it controls</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <code>name</code>
          </td>
          <td>How you identify the agent in listings and call records. Callers never hear it.</td>
        </tr>
        <tr>
          <td>
            <code>prompt</code>
          </td>
          <td>Everything the agent knows about how to behave. Required.</td>
        </tr>
        <tr>
          <td>
            <code>language</code>
          </td>
          <td>
            <code>am</code>, <code>om</code>, <code>ti</code>, or <code>en</code>. Defaults to{' '}
            <code>am</code>.
          </td>
        </tr>
        <tr>
          <td>
            <code>voice_config</code>
          </td>
          <td>
            <code>provider</code> and <code>voice_id</code> for the speaking voice.
          </td>
        </tr>
        <tr>
          <td>
            <code>model_config</code>
          </td>
          <td>
            <code>provider</code> and <code>model_id</code> when you want to pin the reasoning model.
          </td>
        </tr>
      </tbody>
    </table>

    <h2>Why it matters</h2>
    <p>
      Numbers, knowledge, and workflow actions all attach to an agent. Getting the prompt right is the
      single largest lever on call quality — more than any model setting.
    </p>

    <CodeBlock
      samples={[
        {
          label: 'curl',
          code: `curl -X POST http://localhost:8000/v1/agents \\
  -H "x-api-key: mk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Support line",
    "language": "am",
    "prompt": "You answer support calls for an internet provider. Confirm the account phone number first. If the caller reports an outage, take the address and tell them a technician will call back."
  }'`,
        },
        {
          label: 'node',
          code: `const agent = await markova.createAgent({
  name: 'Support line',
  language: 'am',
  prompt:
    'You answer support calls for an internet provider. Confirm the account phone number first. ' +
    'If the caller reports an outage, take the address and tell them a technician will call back.',
});`,
        },
      ]}
    />

    <h2>Versions and rollback</h2>
    <p>
      Each update writes a new version. If a prompt change makes calls worse, roll back instead of
      trying to reconstruct the old wording from memory.
    </p>

    <CodeBlock
      code={`# See the version history
curl http://localhost:8000/v1/agents/AGENT_ID/versions \\
  -H "x-api-key: mk_test_YOUR_KEY"

# Put a previous version back in service
curl -X POST http://localhost:8000/v1/agents/AGENT_ID/versions/VERSION_ID/rollback \\
  -H "x-api-key: mk_test_YOUR_KEY"`}
    />

    <Callout kind="note">
      <p>
        The AI disclosure at the start of every call is part of the platform, not the prompt. You
        cannot remove it, and you don't need to write it yourself.
      </p>
    </Callout>

    <NextLinks
      links={[
        { to: '/concepts/calls', label: 'Calls' },
        { to: '/api', label: 'Agents in the API reference' },
      ]}
    />
  </>
)

export default Agents
