import React from 'react'

const ENTRIES = [
  {
    date: '2026-07-26',
    title: 'Numbers, transfer context, and real knowledge search',
    items: [
      'Numbers support routing rules, IVR digits, call recording toggle, and voicemail-to-email.',
      "POST /v1/calls/{id}/transfer now hands the receiving human the full conversation transcript and a summary, not just a status flag.",
      'POST /v1/knowledge/search runs on real vector embeddings with pgvector cosine distance, enforced per tenant.',
      'Workflow tool execution respects a per-action confidence threshold: below it, the action is queued for approval instead of run automatically, and every execution is written to an immutable audit log.',
    ],
  },
  {
    date: '2026-07-19',
    title: 'Usage-based billing and public pricing',
    items: [
      'GET /v1/usage and /v1/usage/history read from a real per-call usage ledger, not an estimate.',
      'Billing webhooks are signature-verified (HMAC-SHA256) — an unsigned request is rejected before anything is recorded.',
      'Pricing is public at /v1/pricing and /pricing, in birr, with no login required.',
    ],
  },
  {
    date: '2026-07-12',
    title: 'The API contract, in one place',
    items: [
      'openapi.yaml at the repo root is now the source of truth for every documented endpoint.',
      'Sandbox and live are a real environment column and gateway header, not a prefix convention alone.',
      'POST /v1/agents/{id}/test-call ships, and @markova/sdk wraps the whole surface for Node.',
    ],
  },
  {
    date: '2026-07-05',
    title: 'Contract-breaking bugs fixed',
    items: [
      'The gateway correctly authenticates service-to-service key verification.',
      'Login and registration were moved onto their real /v1/auth/* paths.',
      'GET /v1/auth/me added; tenant isolation was added to a previously unauthenticated CRM route.',
    ],
  },
]

const Changelog = () => (
  <>
    <p className="docs-page-kicker">Product</p>
    <h1>Changelog</h1>
    <p className="lead">
      Plain, dated entries — what changed and why it matters to something you built against the API
      before it changed.
    </p>

    <div className="changelog-list">
      {ENTRIES.map((entry) => (
        <article className="changelog-entry" key={entry.date}>
          <p className="changelog-date">{entry.date}</p>
          <div>
            <h3>{entry.title}</h3>
            <ul>
              {entry.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </article>
      ))}
    </div>
  </>
)

export default Changelog
