import React from 'react'
import CodeBlock from '../components/CodeBlock'
import Callout from '../components/Callout'
import NextLinks from '../components/NextLinks'

const Quickstart = () => (
  <>
    <p className="docs-page-kicker">Start here</p>
    <h1>Quickstart</h1>
    <p className="lead">
      Five steps to an agent that answers a real call on your own phone, with nothing billed. Every
      command below runs as written once you swap in your key.
    </p>

    <h2>1. Get a sandbox key</h2>
    <p>
      Register, then create a key with <code>environment: "test"</code>. The full secret is returned
      exactly once — store it now, because afterwards only the prefix is retrievable.
    </p>

    <CodeBlock
      samples={[
        {
          label: 'curl',
          code: `# Register (returns a JWT you use to mint API keys)
curl -X POST http://localhost:8000/v1/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Selam Bekele",
    "companyName": "Bekele Dental",
    "email": "selam@example.com",
    "password": "a-long-passphrase"
  }'

# Create a sandbox key with the JWT from the response
curl -X POST http://localhost:8000/v1/keys \\
  -H "Authorization: Bearer YOUR_JWT" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "local dev", "environment": "test"}'`,
        },
        {
          label: 'node',
          code: `import { Markova } from '@markova/sdk';

const markova = new Markova({ baseUrl: 'http://localhost:8000' });

const session = await markova.register({
  name: 'Selam Bekele',
  companyName: 'Bekele Dental',
  email: 'selam@example.com',
  password: 'a-long-passphrase',
});

markova.setToken(session.token);

const key = await markova.createKey({ name: 'local dev', environment: 'test' });
console.log(key.api_key); // mk_test_... shown once`,
        },
      ]}
    />

    <p>The create-key response:</p>
    <CodeBlock
      language="json"
      code={`{
  "id": "8f1c...",
  "name": "local dev",
  "key_prefix": "mk_test_9f2",
  "environment": "test",
  "status": "active",
  "api_key": "mk_test_9f2..."
}`}
    />

    <h2>2. Authenticate</h2>
    <p>
      Two ways in, both accepted on every endpoint: an API key in <code>x-api-key</code> for
      server-to-server work, or a JWT in <code>Authorization: Bearer</code> for a signed-in user.
      Use the key for anything running on your own infrastructure.
    </p>

    <CodeBlock
      code={`curl http://localhost:8000/v1/agents \\
  -H "x-api-key: mk_test_YOUR_KEY"`}
    />

    <h2>3. Create an agent</h2>
    <p>
      An agent is a prompt, a language, and a voice. <code>language</code> takes{' '}
      <code>am</code> (Amharic), <code>om</code> (Afaan Oromo), <code>ti</code> (Tigrinya), or{' '}
      <code>en</code>. Write the prompt the way you'd brief a new receptionist.
    </p>

    <CodeBlock
      samples={[
        {
          label: 'curl',
          code: `curl -X POST http://localhost:8000/v1/agents \\
  -H "x-api-key: mk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Reception",
    "language": "am",
    "prompt": "You answer the phone for Bekele Dental in Bole. Opening hours are 8am to 6pm, Monday to Saturday. Take the caller name and preferred day for a booking. If the caller sounds distressed or asks for a person, transfer the call.",
    "voice_config": { "provider": "azure", "voice_id": "am-ET-MekdesNeural" }
  }'`,
        },
        {
          label: 'node',
          code: `const agent = await markova.createAgent({
  name: 'Reception',
  language: 'am',
  prompt:
    'You answer the phone for Bekele Dental in Bole. Opening hours are 8am to 6pm, Monday to Saturday. ' +
    'Take the caller name and preferred day for a booking. If the caller sounds distressed or asks for a person, transfer the call.',
  voice_config: { provider: 'azure', voice_id: 'am-ET-MekdesNeural' },
});

console.log(agent.id);`,
        },
      ]}
    />

    <Callout kind="note">
      <p>
        Every agent opens by identifying itself as an AI. That line is added by the platform and
        cannot be turned off — callers always know what they're talking to.
      </p>
    </Callout>

    <h2>4. Place a test call</h2>
    <p>
      The test-call endpoint dials a number you supply and runs the agent against it. It is
      sandbox-only, so nothing is billed and no live line is touched.
    </p>

    <CodeBlock
      samples={[
        {
          label: 'curl',
          code: `curl -X POST http://localhost:8000/v1/agents/AGENT_ID/test-call \\
  -H "x-api-key: mk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to_number": "+251911000000"}'`,
        },
        {
          label: 'node',
          code: `const call = await markova.testCall(agent.id, { to_number: '+251911000000' });
console.log(call.id, call.status);`,
        },
      ]}
    />

    <p>Your phone rings. Answer it and talk to the agent.</p>

    <h2>5. Read the transcript</h2>
    <p>
      Every call is transcribed turn by turn. Fetch the call for its metadata, or the transcript for
      what was actually said.
    </p>

    <CodeBlock
      samples={[
        {
          label: 'curl',
          code: `curl http://localhost:8000/v1/calls/CALL_ID/transcript \\
  -H "x-api-key: mk_test_YOUR_KEY"`,
        },
        {
          label: 'node',
          code: `const transcript = await markova.getTranscript(call.id);

for (const line of transcript) {
  console.log(\`\${line.role}: \${line.content}\`);
}`,
        },
      ]}
    />

    <CodeBlock
      language="json"
      code={`[
  { "role": "agent", "content": "ሰላም፣ በቀለ ጥርስ ክሊኒክ ነው። ይህ አውቶማቲክ ረዳት ነው።", "created_at": "2026-07-26T08:14:02Z" },
  { "role": "user", "content": "ነገ ቀጠሮ ማግኘት እችላለሁ?", "created_at": "2026-07-26T08:14:09Z" },
  { "role": "agent", "content": "አዎ፣ ነገ ከጠዋቱ 2 ሰዓት ክፍት ነው። ስምዎን ልጠይቅ?", "created_at": "2026-07-26T08:14:12Z" }
]`}
    />

    <h2>Then what?</h2>
    <p>
      Point a real number at the agent so customers can reach it, upload your policies so answers
      come from your own documents, and only then swap your sandbox key for a live one.
    </p>

    <NextLinks
      links={[
        { to: '/concepts/numbers', label: 'Give it a phone number' },
        { to: '/concepts/knowledge', label: 'Teach it your documents' },
        { to: '/concepts/environments', label: 'Go live' },
      ]}
    />
  </>
)

export default Quickstart
