import React from 'react'
import CodeBlock from '../../components/CodeBlock'
import Callout from '../../components/Callout'
import NextLinks from '../../components/NextLinks'

const WebhooksConcept = () => (
  <>
    <p className="docs-page-kicker">Core concepts</p>
    <h1>Webhooks</h1>
    <p className="lead">
      A webhook is how an agent reaches out of the phone call and into your systems — booking the
      appointment it just agreed to, or opening the ticket it promised.
    </p>

    <h2>Tools are the outbound side</h2>
    <p>
      You register a tool with a URL you control. When the agent decides that action is called for,
      Markova sends a request to that URL with the arguments it gathered from the caller.
    </p>

    <CodeBlock
      code={`curl -X POST http://localhost:8000/v1/tools \\
  -H "x-api-key: mk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "create_booking",
    "description": "Book an appointment. Needs caller name, date and time.",
    "webhook_url": "https://api.your-clinic.et/hooks/booking",
    "method": "POST"
  }'`}
    />

    <h2>Confidence decides whether it fires</h2>
    <p>
      Voice transcription is not perfect, so an action carries a confidence score. Each action type
      has a threshold: above it the action executes, below it the action is queued for a human to
      approve instead of acting on a misheard sentence.
    </p>

    <CodeBlock
      code={`curl -X PUT http://localhost:8000/v1/workflow-settings \\
  -H "x-api-key: mk_test_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "confidence_thresholds": {
      "default": 0.7,
      "create_booking": 0.85
    }
  }'`}
    />

    <Callout kind="note">
      <p>
        On the Basic plan actions are detected and recorded but not executed — you see what the agent
        would have done, and nothing is written to your systems. Pro and Plus execute them. Either way
        every decision lands in the audit trail with its confidence score.
      </p>
    </Callout>

    <h2>Verifying what arrives</h2>
    <p>
      Your endpoint is on the public internet, so it needs to reject anything it can't verify. The
      webhooks guide covers what Markova sends today, the header formats in use, and a signature
      verification example you can run.
    </p>

    <NextLinks
      links={[
        { to: '/webhooks', label: 'Webhooks guide' },
        { to: '/sdks', label: 'SDKs' },
      ]}
    />
  </>
)

export default WebhooksConcept
