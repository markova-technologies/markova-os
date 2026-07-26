import React from 'react'
import CodeBlock from '../components/CodeBlock'
import Callout from '../components/Callout'
import NextLinks from '../components/NextLinks'

const Sdks = () => (
  <>
    <p className="docs-page-kicker">Reference</p>
    <h1>SDKs</h1>
    <p className="lead">
      One published client so far: <code>@markova/sdk</code> for Node. It is a thin wrapper over the
      same HTTP API — nothing is available through the SDK that you can't do with curl.
    </p>

    <h2>Node</h2>
    <p>Requires Node 18 or newer, for built-in fetch.</p>

    <CodeBlock language="bash" code={`npm install @markova/sdk`} />

    <h3>Creating a client</h3>
    <p>
      Authenticate with an API key for server-side work, or a JWT when you're acting as a signed-in
      user. Set either at construction or later with <code>setApiKey</code> / <code>setToken</code>.
    </p>

    <CodeBlock
      language="javascript"
      code={`import { Markova } from '@markova/sdk';

const markova = new Markova({
  baseUrl: 'http://localhost:8000',
  apiKey: process.env.MARKOVA_API_KEY, // mk_test_... or mk_live_...
});`}
    />

    <h3>A full sandbox run</h3>
    <CodeBlock
      language="javascript"
      code={`const agent = await markova.createAgent({
  name: 'Reception',
  language: 'am',
  prompt: 'You answer for a dental clinic in Addis. Give opening hours and take booking requests.',
});

const call = await markova.testCall(agent.id, { to_number: '+251911000000' });

// ...after the call
const transcript = await markova.getTranscript(call.id);
transcript.forEach((line) => console.log(\`\${line.role}: \${line.content}\`));`}
    />

    <h3>Handling errors</h3>
    <p>
      Any non-2xx response throws a <code>MarkovaError</code> carrying the HTTP status and the parsed
      body, so you can branch on the status instead of parsing message text.
    </p>

    <CodeBlock
      language="javascript"
      code={`import { Markova, MarkovaError } from '@markova/sdk';

try {
  await markova.testCall(agent.id, { to_number: '+251911000000' });
} catch (err) {
  if (err instanceof MarkovaError && err.status === 403) {
    console.error('Test calls need a sandbox key — this one is live.');
  } else {
    throw err;
  }
}`}
    />

    <h3>What's covered</h3>
    <table>
      <thead>
        <tr>
          <th>Area</th>
          <th>Methods</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Auth</td>
          <td>
            <code>register</code>, <code>login</code>, <code>refresh</code>, <code>logout</code>,{' '}
            <code>me</code>
          </td>
        </tr>
        <tr>
          <td>Keys</td>
          <td>
            <code>listKeys</code>, <code>createKey</code>, <code>deleteKey</code>
          </td>
        </tr>
        <tr>
          <td>Agents</td>
          <td>
            <code>listAgents</code>, <code>getAgent</code>, <code>createAgent</code>,{' '}
            <code>updateAgent</code>, <code>deleteAgent</code>, <code>listAgentVersions</code>,{' '}
            <code>rollbackAgent</code>, <code>testCall</code>
          </td>
        </tr>
        <tr>
          <td>Calls</td>
          <td>
            <code>listCalls</code>, <code>createCall</code>, <code>getCall</code>,{' '}
            <code>getTranscript</code>, <code>getRecording</code>, <code>transferCall</code>,{' '}
            <code>getTransferContext</code>
          </td>
        </tr>
        <tr>
          <td>Numbers</td>
          <td>
            <code>searchNumbers</code>, <code>listNumbers</code>, <code>createNumber</code>,{' '}
            <code>updateNumber</code>, <code>deleteNumber</code>, <code>listRoutingRules</code>,{' '}
            <code>createRoutingRules</code>, <code>updateRoutingRules</code>,{' '}
            <code>deleteRoutingRules</code>
          </td>
        </tr>
        <tr>
          <td>Knowledge</td>
          <td>
            <code>searchKnowledge</code>
          </td>
        </tr>
        <tr>
          <td>Workflow</td>
          <td>
            <code>executeTool</code>, <code>getWorkflowSettings</code>,{' '}
            <code>updateWorkflowSettings</code>
          </td>
        </tr>
      </tbody>
    </table>

    <Callout kind="note">
      <p>
        Other languages aren't published yet. Until they are, the API is plain JSON over HTTP with two
        header-based auth options — any HTTP client will do, and the reference documents every shape.
      </p>
    </Callout>

    <NextLinks
      links={[
        { to: '/api', label: 'API reference' },
        { to: '/webhooks', label: 'Webhooks guide' },
      ]}
    />
  </>
)

export default Sdks
