import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Terminal,
  Cpu,
  PhoneCall,
  Key,
  Database,
  Building2,
  Code2,
  Copy,
  Check,
  Search,
  ExternalLink,
  ShieldCheck,
  Zap,
  Info,
  Layers,
  ArrowRight,
} from 'lucide-react'
import PublicHeader from '../components/PublicHeader'
import { ROUTES } from '../config/site'
import './DocsSite.css'

const DOC_TOPICS = [
  {
    group: 'Getting Started',
    items: [
      { id: 'overview', title: 'Platform Overview', icon: BookOpen, badge: 'Core' },
      { id: 'quickstart', title: 'Quickstart Guide', icon: Zap, badge: '5 min' },
      { id: 'auth', title: 'Authentication & Keys', icon: Key, badge: 'Security' },
    ],
  },
  {
    group: 'Voice & Telephony',
    items: [
      { id: 'voice-pipeline', title: 'The Amharic Voice Engine', icon: Cpu, badge: 'Almaz' },
      { id: 'telephony', title: 'SIP Trunks & Telephony', icon: PhoneCall, badge: 'PSTN' },
    ],
  },
  {
    group: 'REST API Reference',
    items: [
      { id: 'api-agents', title: 'Agents API', icon: Terminal, badge: '/v1/agents' },
      { id: 'api-calls', title: 'Calls & Transcripts', icon: PhoneCall, badge: '/v1/calls' },
      { id: 'api-knowledge', title: 'Knowledge Base & RAG', icon: Database, badge: '/v1/knowledge' },
      { id: 'workspaces', title: 'Workspace Isolation', icon: Building2, badge: 'Multi-Tenant' },
    ],
  },
  {
    group: 'SDKs & Integrations',
    items: [
      { id: 'sdks', title: 'Python & Node.js Recipes', icon: Code2, badge: 'Code' },
    ],
  },
]

const DocsSite = () => {
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [codeLang, setCodeLang] = useState('curl')
  const [copied, setCopied] = useState(false)

  const handleCopyCode = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Filter items based on search query
  const filteredGroups = DOC_TOPICS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.badge.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="docs-page-wrapper">
      <PublicHeader />

      {/* Hero Header */}
      <header className="docs-hero-section">
        <div className="docs-hero-badge">
          <BookOpen size={14} />
          <span>Developer Documentation & API Reference</span>
        </div>
        <h1>Build with Markova OS</h1>
        <p>
          Comprehensive guides, architecture blueprints, and API specifications for deploying
          sovereign Amharic AI voice workforces at enterprise scale.
        </p>
        <div className="docs-search-bar">
          <Search size={18} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search guides, endpoints, or concepts (e.g. agents, SIP, homophones)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      {/* Main Documentation Two-Column Layout */}
      <div className="docs-main-container">
        {/* Sticky Sidebar Navigation */}
        <aside className="docs-sidebar">
          {filteredGroups.map((group, gIdx) => (
            <div key={gIdx} className="docs-nav-group">
              <h4>{group.group}</h4>
              <ul className="docs-nav-list">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = activeTab === item.id
                  return (
                    <li key={item.id}>
                      <button
                        className={`docs-nav-button ${isActive ? 'active' : ''}`}
                        onClick={() => setActiveTab(item.id)}
                      >
                        <Icon size={16} />
                        <span>{item.title}</span>
                        {item.badge && <span className="docs-badge-tag">{item.badge}</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          <div className="docs-nav-group" style={{ marginTop: 'auto', paddingTop: '1rem' }}>
            <h4>External Tools</h4>
            <ul className="docs-nav-list">
              <li>
                <a
                  href="https://markova-api-gateway.onrender.com/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="docs-nav-button"
                  style={{ color: '#a5b4fc' }}
                >
                  <ExternalLink size={15} />
                  <span>OpenAPI Swagger UI</span>
                </a>
              </li>
            </ul>
          </div>
        </aside>

        {/* Dynamic Content Area */}
        <main className="docs-content-area">
          {activeTab === 'overview' && (
            <article className="docs-article">
              <div className="docs-article-header">
                <div className="docs-article-category">Architecture & Core Mission</div>
                <h2>Platform Overview</h2>
                <p className="docs-article-lead">
                  Markova OS is the sovereign AI Voice & Call Center Operating System built natively for
                  African languages and emerging market telephony—featuring production-grade Amharic as its foundation.
                </p>
              </div>

              <div className="docs-callout tip">
                <ShieldCheck size={22} className="docs-callout-icon" />
                <div className="docs-callout-body">
                  <h5>The Two-World Architecture Law</h5>
                  <p>
                    All experimental voice logic, FreeSWITCH SIP dialplans, and acoustic tests are first proven in
                    the <strong>Playground</strong> (<code>ai call center/</code>). Once battle-tested under live cellular conditions,
                    they are migrated into the <strong>Production Orchestrator</strong> (<code>services/orchestrator/</code>).
                  </p>
                </div>
              </div>

              <div className="docs-section">
                <h3>System Architecture & Topology</h3>
                <p>
                  Markova OS operates as a high-concurrency microservice cluster designed for sub-second voice response,
                  strict multi-tenant database isolation, and real-time supervisor call control:
                </p>

                <div className="docs-quick-grid">
                  <div className="docs-quick-card" onClick={() => setActiveTab('voice-pipeline')}>
                    <Cpu size={24} color="#818cf8" />
                    <h4>The "Almaz" Voice Engine</h4>
                    <p>Sub-second Amharic STT, 30+ homophone normalizer, and neural Edge TTS.</p>
                  </div>
                  <div className="docs-quick-card" onClick={() => setActiveTab('telephony')}>
                    <PhoneCall size={24} color="#10b981" />
                    <h4>Telephony Ingestion</h4>
                    <p>FreeSWITCH SIP trunks with Ethio Telecom/Safaricom and Twilio PSTN fallbacks.</p>
                  </div>
                  <div className="docs-quick-card" onClick={() => setActiveTab('workspaces')}>
                    <Building2 size={24} color="#f59e0b" />
                    <h4>Workspace Isolation</h4>
                    <p>Company-branded portals at <code>/workspace/:slug</code> with cross-org rejection.</p>
                  </div>
                  <div className="docs-quick-card" onClick={() => setActiveTab('api-agents')}>
                    <Terminal size={24} color="#3b82f6" />
                    <h4>Autonomous Actions</h4>
                    <p>Direct webhooks to CRM, ERP, Telegram, and SMS receipt dispatching.</p>
                  </div>
                </div>
              </div>
            </article>
          )}

          {activeTab === 'quickstart' && (
            <article className="docs-article">
              <div className="docs-article-header">
                <div className="docs-article-category">Getting Started</div>
                <h2>Quickstart: Deploy Your First Voice Agent</h2>
                <p className="docs-article-lead">
                  Create, configure, and test a conversational Amharic voice agent in under 5 minutes using the REST API.
                </p>
              </div>

              <div className="docs-section">
                <h3>Step 1: Obtain Your API Key</h3>
                <p>
                  Log into your Markova OS dashboard and navigate to <strong>Developer Keys</strong>. Use your
                  <code>mk_test_...</code> key for testing and <code>mk_live_...</code> key for real telephony traffic.
                </p>

                <h3>Step 2: Create an Agent</h3>
                <p>
                  Send a <code>POST</code> request to <code>/v1/agents</code> specifying the persona prompt, language,
                  and greeting in Amharic.
                </p>

                <div className="docs-code-box">
                  <div className="docs-code-header">
                    <div className="docs-code-tabs">
                      <button
                        className={`docs-code-tab ${codeLang === 'curl' ? 'active' : ''}`}
                        onClick={() => setCodeLang('curl')}
                      >
                        cURL
                      </button>
                      <button
                        className={`docs-code-tab ${codeLang === 'python' ? 'active' : ''}`}
                        onClick={() => setCodeLang('python')}
                      >
                        Python
                      </button>
                      <button
                        className={`docs-code-tab ${codeLang === 'js' ? 'active' : ''}`}
                        onClick={() => setCodeLang('js')}
                      >
                        Node.js
                      </button>
                    </div>
                    <button
                      className="docs-copy-btn"
                      onClick={() =>
                        handleCopyCode(
                          codeLang === 'curl'
                            ? `curl -X POST https://markova-api-gateway.onrender.com/v1/agents \\\n  -H "Authorization: Bearer mk_test_98f4c2e17a" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "name": "Almaz Customer Support",\n    "language": "am-ET",\n    "voice_id": "am-ET-MekdesNeural",\n    "system_prompt": "You are Almaz, a polite Ethiopian support assistant. Answer in fluent Amharic.",\n    "initial_greeting": "ጤና ይስጥልኝ! ማርኮቫ ነኝ። ምን ልርዳዎት?"\n  }'`
                            : codeLang === 'python'
                            ? `import requests\n\nres = requests.post(\n    "https://markova-api-gateway.onrender.com/v1/agents",\n    headers={\n        "Authorization": "Bearer mk_test_98f4c2e17a",\n        "Content-Type": "application/json"\n    },\n    json={\n        "name": "Almaz Customer Support",\n        "language": "am-ET",\n        "voice_id": "am-ET-MekdesNeural",\n        "system_prompt": "You are Almaz, a polite Ethiopian support assistant. Answer in fluent Amharic.",\n        "initial_greeting": "ጤና ይስጥልኝ! ማርኮቫ ነኝ። ምን ልርዳዎት?"\n    }\n)\nprint(res.json())`
                            : `const axios = require('axios');\n\nconst { data } = await axios.post(\n  'https://markova-api-gateway.onrender.com/v1/agents',\n  {\n    name: 'Almaz Customer Support',\n    language: 'am-ET',\n    voice_id: 'am-ET-MekdesNeural',\n    system_prompt: 'You are Almaz, a polite Ethiopian support assistant.',\n    initial_greeting: 'ጤና ይስጥልኝ! ማርኮቫ ነኝ። ምን ልርዳዎት?'\n  },\n  { headers: { Authorization: 'Bearer mk_test_98f4c2e17a' } }\n);\nconsole.log(data);`
                        )
                      }
                    >
                      {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="docs-code-pre">
                    {codeLang === 'curl' &&
                      `curl -X POST https://markova-api-gateway.onrender.com/v1/agents \\
  -H "Authorization: Bearer mk_test_98f4c2e17a" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Almaz Customer Support",
    "language": "am-ET",
    "voice_id": "am-ET-MekdesNeural",
    "system_prompt": "You are Almaz, a polite Ethiopian support assistant. Answer in fluent Amharic.",
    "initial_greeting": "ጤና ይስጥልኝ! ማርኮቫ ነኝ። ምን ልርዳዎት?"
  }'`}
                    {codeLang === 'python' &&
                      `import requests

response = requests.post(
    "https://markova-api-gateway.onrender.com/v1/agents",
    headers={
        "Authorization": "Bearer mk_test_98f4c2e17a",
        "Content-Type": "application/json"
    },
    json={
        "name": "Almaz Customer Support",
        "language": "am-ET",
        "voice_id": "am-ET-MekdesNeural",
        "system_prompt": "You are Almaz, a polite Ethiopian support assistant. Answer in fluent Amharic.",
        "initial_greeting": "ጤና ይስጥልኝ! ማርኮቫ ነኝ። ምን ልርዳዎት?"
    }
)
print(response.json())`}
                    {codeLang === 'js' &&
                      `const axios = require('axios');

const { data } = await axios.post(
  'https://markova-api-gateway.onrender.com/v1/agents',
  {
    name: 'Almaz Customer Support',
    language: 'am-ET',
    voice_id: 'am-ET-MekdesNeural',
    system_prompt: 'You are Almaz, a polite Ethiopian support assistant.',
    initial_greeting: 'ጤና ይስጥልኝ! ማርኮቫ ነኝ። ምን ልርዳዎት?'
  },
  { headers: { Authorization: 'Bearer mk_test_98f4c2e17a' } }
);
console.log(data);`}
                  </pre>
                </div>

                <h3>Step 3: Bind to a Live Phone Number</h3>
                <p>
                  Attach your agent to a dedicated inbound phone number via <code>POST /v1/numbers/bind</code>, or
                  test interactively in the Web Call Simulator under <strong>Agent Studio</strong>.
                </p>
              </div>
            </article>
          )}

          {activeTab === 'auth' && (
            <article className="docs-article">
              <div className="docs-article-header">
                <div className="docs-article-category">Security & API Keys</div>
                <h2>Authentication & Identity</h2>
                <p className="docs-article-lead">
                  Authenticate API requests using secret API keys or microservice RS256 Bearer tokens.
                </p>
              </div>

              <div className="docs-section">
                <h3>Dual-Token Architecture</h3>
                <p>
                  Markova OS employs a hybrid authentication framework:
                </p>
                <ul>
                  <li>
                    <strong>Developer API Keys</strong> (<code>mk_live_...</code> / <code>mk_test_...</code>):
                    Passed in the <code>Authorization: Bearer &lt;key&gt;</code> header for B2B API access.
                  </li>
                  <li>
                    <strong>Microservice RS256 JWTs</strong>: Signed by <code>auth-service</code> using an RSA-2048 private
                    key. Validated dynamically by the API Gateway.
                  </li>
                  <li>
                    <strong>Supabase HS256 JWTs</strong>: Used by frontend dashboard sessions and verified with symmetric secrets.
                  </li>
                </ul>

                <div className="docs-callout warning">
                  <Info size={22} className="docs-callout-icon" />
                  <div className="docs-callout-body">
                    <h5>API Key Security</h5>
                    <p>
                      Never expose your <code>mk_live_</code> keys in client-side code, mobile bundles, or public GitHub repositories.
                      Always route API calls through your backend server.
                    </p>
                  </div>
                </div>
              </div>
            </article>
          )}

          {activeTab === 'voice-pipeline' && (
            <article className="docs-article">
              <div className="docs-article-header">
                <div className="docs-article-category">Speech Processing</div>
                <h2>The "Almaz" Amharic Voice Pipeline</h2>
                <p className="docs-article-lead">
                  How Markova OS achieves 98%+ Amharic conversational comprehension and sub-second response times.
                </p>
              </div>

              <div className="docs-section">
                <h3>1. Audio Pre-Processing & AGC</h3>
                <p>
                  Raw cellular audio from mobile networks undergoes automated high-pass filtering (300Hz cutoff),
                  automatic gain control (AGC), and silence trimming via an internal <code>ffmpeg</code> pipeline.
                </p>

                <h3>2. Unicode Validation & Anti-Hallucination Gate</h3>
                <p>
                  Whisper models frequently hallucinate non-speech sounds into foreign characters (Georgian, Thai, Cyrillic)
                  or repetitive YouTube video outro text. Markova OS validates transcripts against the Ethiopic Unicode block
                  (<code>U+1200</code> to <code>U+139F</code>). If non-Amharic noise is detected, it politely re-prompts the caller
                  in natural Amharic:
                </p>
                <div className="docs-code-box">
                  <pre className="docs-code-pre" style={{ color: '#a7f3d0' }}>
                    "ይቅርታ፣ ድምፅዎ አልተሰማኝም። እባክዎ በድጋሚ ይንገሩኝ?"
                  </pre>
                </div>

                <h3>3. 30+ Ethiopic Homophone Normalization</h3>
                <p>
                  Amharic has multiple letters that sound identical (e.g. <code>ሀ / ሐ / ኀ</code>, <code>ሠ / ሰ</code>, <code>ዐ / አ</code>).
                  The normalizer maps all variations to canonical phonetic roots before performing vector database searches or CRM updates.
                </p>
              </div>
            </article>
          )}

          {activeTab === 'telephony' && (
            <article className="docs-article">
              <div className="docs-article-header">
                <div className="docs-article-category">Telephony & SIP</div>
                <h2>SIP Trunks & FreeSWITCH Integration</h2>
                <p className="docs-article-lead">
                  Carrier-grade telephony bridging local telecom carriers (Ethio Telecom, Safaricom) and international PSTN trunks.
                </p>
              </div>

              <div className="docs-section">
                <h3>Call Lifecycle Webhook Flow</h3>
                <ol>
                  <li>
                    <strong>Inbound Call Event</strong>: Telephony gateway invokes <code>POST /incoming-call</code>.
                  </li>
                  <li>
                    <strong>Company Lookup</strong>: Maps the dialed phone number to the target agent and tenant company.
                  </li>
                  <li>
                    <strong>Redis Session Initialization</strong>: Creates <code>call:&#123;CallSid&#125;:state</code> with 1-hour TTL.
                  </li>
                  <li>
                    <strong>Speech Gathering</strong>: The caller's speech is processed by <code>POST /twilio/respond</code> or FreeSWITCH ESL.
                  </li>
                  <li>
                    <strong>Barge-In Handling</strong>: If the caller speaks while audio is playing, playback cuts off immediately.
                  </li>
                </ol>
              </div>
            </article>
          )}

          {activeTab === 'api-agents' && (
            <article className="docs-article">
              <div className="docs-article-header">
                <div className="docs-article-category">REST API Reference</div>
                <h2>Agents API (<code>/v1/agents</code>)</h2>
                <p className="docs-article-lead">
                  Create, retrieve, update, and manage conversational AI voice agent definitions.
                </p>
              </div>

              <div className="docs-section">
                <h3>Endpoints</h3>
                <div className="docs-table-wrapper">
                  <table className="docs-table">
                    <thead>
                      <tr>
                        <th>Method</th>
                        <th>Path</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><code>GET</code></td>
                        <td><code>/v1/agents</code></td>
                        <td>List all agents for the authenticated tenant company.</td>
                      </tr>
                      <tr>
                        <td><code>POST</code></td>
                        <td><code>/v1/agents</code></td>
                        <td>Create a new voice agent with prompt, voice ID, and model configuration.</td>
                      </tr>
                      <tr>
                        <td><code>GET</code></td>
                        <td><code>/v1/agents/:id</code></td>
                        <td>Retrieve full configuration and version history for a specific agent.</td>
                      </tr>
                      <tr>
                        <td><code>PATCH</code></td>
                        <td><code>/v1/agents/:id</code></td>
                        <td>Update system prompt, voice, model provider, or tool permissions.</td>
                      </tr>
                      <tr>
                        <td><code>DELETE</code></td>
                        <td><code>/v1/agents/:id</code></td>
                        <td>Archive an agent and release bound phone numbers.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </article>
          )}

          {activeTab === 'api-calls' && (
            <article className="docs-article">
              <div className="docs-article-header">
                <div className="docs-article-category">REST API Reference</div>
                <h2>Calls & Live Transcripts (<code>/v1/calls</code>)</h2>
                <p className="docs-article-lead">
                  Access call logs, turn-by-turn transcripts, sentiment scores, and live supervisor feeds.
                </p>
              </div>

              <div className="docs-section">
                <h3>Live Webhook Notification</h3>
                <p>
                  Subscribe to real-time call events via WebSocket or HTTP webhooks:
                </p>
                <div className="docs-code-box">
                  <pre className="docs-code-pre">
{`{
  "event": "call.completed",
  "call_id": "call_98f418b2c",
  "company_id": "comp_markova_tech",
  "duration_seconds": 142,
  "turn_count": 8,
  "caller_number": "+251911223344",
  "sentiment": "positive",
  "cost_birr": 4.75,
  "transcript": [
    { "speaker": "agent", "text": "ጤና ይስጥልኝ! ማርኮቫ ነኝ። ምን ልርዳዎት?" },
    { "speaker": "caller", "text": "የሶፋ ዋጋ ማወቅ ፈልጌ ነበር።" },
    { "speaker": "agent", "text": "የሶፋ ዋጋ ከ 45,000 ብር ይጀምራል። የትኛውን ሞዴል ይፈልጋሉ?" }
  ]
}`}
                  </pre>
                </div>
              </div>
            </article>
          )}

          {activeTab === 'api-knowledge' && (
            <article className="docs-article">
              <div className="docs-article-header">
                <div className="docs-article-category">REST API Reference</div>
                <h2>Knowledge Base & Vector Search</h2>
                <p className="docs-article-lead">
                  Upload catalogs, pricing spreadsheets, and policy PDFs to empower agents with RAG vector search.
                </p>
              </div>

              <div className="docs-section">
                <h3>Vector Search Architecture</h3>
                <p>
                  Documents are chunked into semantic paragraphs, embedded via OpenAI/local vector models,
                  and stored in PostgreSQL using <code>pgvector</code> (<code>VECTOR(1536)</code>). During a call,
                  the orchestrator performs real-time cosine similarity search to inject relevant pricing and product details.
                </p>
              </div>
            </article>
          )}

          {activeTab === 'workspaces' && (
            <article className="docs-article">
              <div className="docs-article-header">
                <div className="docs-article-category">Multi-Tenant Isolation</div>
                <h2>Organization Workspace Isolation (<code>/workspace/:slug</code>)</h2>
                <p className="docs-article-lead">
                  Every company operates through a dedicated, branded workspace portal.
                </p>
              </div>

              <div className="docs-section">
                <h3>Scoped Access & Brand Hierarchy</h3>
                <ul>
                  <li>
                    <strong>Custom URL Slug</strong>: Auto-generated from the organization name (e.g. <code>markova.ai/workspace/acme-logistics</code>).
                  </li>
                  <li>
                    <strong>Markova OS Primary Brand</strong>: Hero platform anchor at the top of the portal, with company identity positioned cleanly second.
                  </li>
                  <li>
                    <strong>Cross-Org Denial (HTTP 403)</strong>: Employees are bound to their company's workspace. Signing in to a different workspace is rejected with <code>CROSS_ORG_ACCESS_DENIED</code>.
                  </li>
                  <li>
                    <strong>Dual Access for Owners</strong>: Owners can access both <code>/login</code> and <code>/workspace/:slug</code>.
                  </li>
                </ul>
              </div>
            </article>
          )}

          {activeTab === 'sdks' && (
            <article className="docs-article">
              <div className="docs-article-header">
                <div className="docs-article-category">SDKs & Recipes</div>
                <h2>Python & Node.js Code Recipes</h2>
                <p className="docs-article-lead">
                  Production-ready scripts for initiating outbound calls and managing conversational agents.
                </p>
              </div>

              <div className="docs-section">
                <h3>Triggering an Outbound Call (Python)</h3>
                <div className="docs-code-box">
                  <pre className="docs-code-pre">
{`import requests

API_URL = "https://markova-api-gateway.onrender.com"
API_KEY = "mk_live_your_secret_key"

response = requests.post(
    f"{API_URL}/v1/calls/dispatch",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={
        "agent_id": "agent_almaz_01",
        "to_number": "+251911234567",
        "context": {
            "customer_name": "አቶ በቀለ",
            "order_id": "ORD-9412",
            "delivery_date": "ሰኞ ጥዋት"
        }
    }
)
print("Call Initiated:", response.json())`}
                  </pre>
                </div>
              </div>
            </article>
          )}
        </main>
      </div>
    </div>
  )
}

export default DocsSite
