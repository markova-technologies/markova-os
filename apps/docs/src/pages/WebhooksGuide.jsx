import React from 'react'
import CodeBlock from '../components/CodeBlock'
import Callout from '../components/Callout'
import NextLinks from '../components/NextLinks'

const WebhooksGuide = () => (
  <>
    <p className="docs-page-kicker">Reference</p>
    <h1>Webhooks guide</h1>
    <p className="lead">
      Two directions to keep straight: Markova calling your endpoint when an agent takes an action,
      and you calling Markova's endpoint to report a billing event.
    </p>

    <h2>Outbound: action webhooks</h2>
    <p>
      Register a tool with a <code>webhook_url</code> and Markova sends a request there when the agent
      decides that action applies. The body is the argument object the agent assembled from the
      conversation — you define its shape through the tool's description, and the agent fills it in.
    </p>

    <CodeBlock
      language="http"
      code={`POST /hooks/booking HTTP/1.1
Host: api.your-clinic.et
Content-Type: application/json
User-Agent: Markova-Tool-Engine/2.0

{
  "caller_name": "Selam Bekele",
  "date": "2026-08-03",
  "time": "10:00",
  "call_id": "3c9a4f10-...",
  "action_type": "create_booking"
}`}
    />

    <h3>What your endpoint must do</h3>
    <ul>
      <li>
        Respond within <strong>8 seconds</strong>. Markova times out after that and records the
        failure against the call.
      </li>
      <li>
        Answer <code>2xx</code> only when the work is genuinely done. A <code>200</code> on a failed
        write leaves the caller believing something happened that didn't.
      </li>
      <li>
        Treat <code>call_id</code> plus <code>action_type</code> as an idempotency key. Retries can
        deliver the same action twice.
      </li>
    </ul>

    <h3>Whether it fires at all</h3>
    <p>
      An action only reaches your endpoint when the plan allows execution and the confidence score
      clears the threshold for its <code>action_type</code>. The response from{' '}
      <code>POST /v1/tools/&#123;id&#125;/execute</code> tells you which branch you got:
    </p>

    <table>
      <thead>
        <tr>
          <th>Status</th>
          <th>
            <code>status</code>
          </th>
          <th>What happened</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>200</td>
          <td>
            <code>executed</code>
          </td>
          <td>Your endpoint was called and answered successfully.</td>
        </tr>
        <tr>
          <td>202</td>
          <td>
            <code>pending_approval</code>
          </td>
          <td>
            Confidence fell below the threshold. Queued for a person; your endpoint was not called.
          </td>
        </tr>
        <tr>
          <td>202</td>
          <td>
            <code>proposed</code>
          </td>
          <td>
            Basic plan. The intended action is recorded for review only; nothing was sent to you.
          </td>
        </tr>
      </tbody>
    </table>

    <Callout kind="live">
      <p>
        <strong>Action webhooks are not signed yet.</strong> Requests carry{' '}
        <code>User-Agent: Markova-Tool-Engine/2.0</code> and nothing you can cryptographically verify.
        Until request signing ships, protect the endpoint with an unguessable path or a secret query
        parameter you check on arrival, keep it to HTTPS, and never let it perform an irreversible
        action without an idempotency check.
      </p>
    </Callout>

    <h2>Inbound: billing webhooks</h2>
    <p>
      When your payment provider settles an invoice, report it to{' '}
      <code>POST /v1/billing/webhooks/&#123;provider&#125;</code>. This endpoint <em>is</em> verified:
      an unsigned or mis-signed request is rejected with <code>401</code> before anything is recorded.
    </p>

    <h3>How the signature is computed</h3>
    <ul>
      <li>Algorithm: HMAC-SHA256, hex encoded.</li>
      <li>
        Secret: the shared <code>BILLING_WEBHOOK_SECRET</code> configured on your deployment.
      </li>
      <li>Signed value: the JSON body as sent.</li>
      <li>
        Header: <code>x-billing-signature</code> (<code>stripe-signature</code> is also accepted).
        The value may be bare hex, <code>sha256=&lt;hex&gt;</code>, or <code>v1=&lt;hex&gt;</code>.
      </li>
    </ul>

    <CodeBlock
      samples={[
        {
          label: 'node',
          code: `import crypto from 'node:crypto';

const secret = process.env.BILLING_WEBHOOK_SECRET;

const event = {
  type: 'invoice.paid',
  company_id: '8f1c...',
  amount_etb: 1250,
  description: 'July usage',
};

const body = JSON.stringify(event);
const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

await fetch('http://localhost:8000/v1/billing/webhooks/telebirr', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-billing-signature': \`sha256=\${signature}\`,
  },
  body,
});`,
        },
        {
          label: 'python',
          code: `import hashlib
import hmac
import json
import os

import requests

secret = os.environ["BILLING_WEBHOOK_SECRET"].encode()

event = {
    "type": "invoice.paid",
    "company_id": "8f1c...",
    "amount_etb": 1250,
    "description": "July usage",
}

body = json.dumps(event)
signature = hmac.new(secret, body.encode(), hashlib.sha256).hexdigest()

requests.post(
    "http://localhost:8000/v1/billing/webhooks/telebirr",
    data=body,
    headers={
        "Content-Type": "application/json",
        "x-billing-signature": f"sha256={signature}",
    },
    timeout=10,
)`,
        },
      ]}
    />

    <h3>Verifying the same way on your side</h3>
    <p>
      Use a constant-time comparison, not <code>===</code>. Comparing byte by byte with an early exit
      leaks how much of the signature you got right.
    </p>

    <CodeBlock
      language="node"
      code={`import crypto from 'node:crypto';

export function verify(rawBody, headerValue, secret) {
  const provided = String(headerValue || '').replace(/^sha256=|^v1=/, '');
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  if (provided.length !== expected.length) return false;

  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}`}
    />

    <h2>Call events</h2>
    <p>
      The orchestrator emits these on its internal event stream as calls progress. They are the names
      to look for in logs and audit entries today; a public subscription API is not exposed yet.
    </p>

    <table>
      <thead>
        <tr>
          <th>Event</th>
          <th>When</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <code>call.started</code>
          </td>
          <td>An inbound call has been matched to an agent and answered.</td>
        </tr>
        <tr>
          <td>
            <code>call.ended</code>
          </td>
          <td>The call finished; usage has been metered.</td>
        </tr>
        <tr>
          <td>
            <code>call.transferred</code>
          </td>
          <td>The call was handed to a person, with context attached.</td>
        </tr>
        <tr>
          <td>
            <code>call.voicemail</code>
          </td>
          <td>The caller left a message; the recording and transcript were sent on.</td>
        </tr>
      </tbody>
    </table>

    <NextLinks
      links={[
        { to: '/sdks', label: 'SDKs' },
        { to: '/api', label: 'API reference' },
      ]}
    />
  </>
)

export default WebhooksGuide
