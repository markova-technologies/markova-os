import React from 'react'
import CodeBlock from '../../components/CodeBlock'
import Callout from '../../components/Callout'
import NextLinks from '../../components/NextLinks'

const Knowledge = () => (
  <>
    <p className="docs-page-kicker">Core concepts</p>
    <h1>Knowledge</h1>
    <p className="lead">
      Knowledge is what your agent reads before it answers. Upload your price list, policies, and
      FAQs, and the agent retrieves from them mid-call instead of guessing.
    </p>

    <h2>How it works</h2>
    <p>
      A source is a container — one per category works well, such as "Policies" or "Price list". You
      upload documents into a source, and each document is split into chunks and embedded. During a
      call, the agent searches those chunks and answers from what it finds.
    </p>

    <CodeBlock
      samples={[
        {
          label: 'curl',
          code: `# Create a source
curl -X POST http://localhost:8000/v1/knowledge/sources \\
  -H "x-api-key: mk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Policies", "type": "upload"}'

# Upload a document into it
curl -X POST http://localhost:8000/v1/knowledge/sources/SOURCE_ID/documents \\
  -H "x-api-key: mk_test_YOUR_KEY" \\
  -F "file=@refund-policy.pdf"`,
        },
        {
          label: 'node',
          code: `const source = await markova.createKnowledgeSource({
  name: 'Policies',
  type: 'upload',
});

const form = new FormData();
form.append('file', new Blob([await readFile('refund-policy.pdf')]), 'refund-policy.pdf');

await fetch(\`\${baseUrl}/v1/knowledge/sources/\${source.id}/documents\`, {
  method: 'POST',
  headers: { 'x-api-key': 'mk_test_YOUR_KEY' },
  body: form,
});`,
        },
      ]}
    />

    <h2>Check what the agent would find</h2>
    <p>
      Search the same way the agent does. If the answer you expect isn't in the results, the agent
      won't find it either — which makes this the fastest way to debug a bad answer.
    </p>

    <CodeBlock
      samples={[
        {
          label: 'curl',
          code: `curl -X POST http://localhost:8000/v1/knowledge/search \\
  -H "x-api-key: mk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "ተመላሽ ገንዘብ ፖሊሲ", "limit": 5}'`,
        },
        {
          label: 'node',
          code: `const results = await markova.searchKnowledge('ተመላሽ ገንዘብ ፖሊሲ', 5);`,
        },
      ]}
    />

    <Callout kind="note">
      <p>
        Search is scoped to your company at the database level, not by a filter that could be
        forgotten. One company's documents are never reachable from another company's key, and your
        uploads are not used to train shared models.
      </p>
    </Callout>

    <NextLinks
      links={[
        { to: '/concepts/webhooks', label: 'Webhooks' },
        { to: '/api', label: 'Knowledge in the API reference' },
      ]}
    />
  </>
)

export default Knowledge
