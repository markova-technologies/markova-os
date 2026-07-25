# MARKOVA 2.0 - API Reference

## Authentication
All protected routes require a Bearer token in the Authorization header.
`Authorization: Bearer <JWT_TOKEN>`

## 1. Auth Service (`/api/auth`)
- `POST /register` - Register a new tenant admin account.
- `POST /login` - Authenticate user and receive JWT.
- `GET /me` - Get current user profile.
- `POST /verify-token` - Verify token validity (internal/gateway use).

## 2. Tenant Service (`/api/tenant`)
- `GET /stats` - Fetch KPI metrics for the client dashboard command center.
- `GET /activity` - Fetch recent tenant activity feed.
- `GET /phone-numbers` - List active phone numbers associated with the tenant.
- `POST /phone-numbers` - Provision a new phone number.
- `PUT /company` - Update company profile and industry.
- `POST /providers` - Save provider API keys (OpenAI, Twilio).

## 3. Agent Builder (`/api/builder`)
- `GET /agents` - List all configured AI agents.
- `POST /agents` - Create a new AI agent.
- `GET /teams` - List all teams.
- `POST /teams` - Create a new team with a designated commander agent.
- `GET /flows` - Fetch ReactFlow JSON definitions for conversation logic.

## 4. Connector Hub (`/api/connectors`)
- `GET /integrations` - List active and available external integrations.
- `POST /integrations/:id/config` - Save OAuth/API keys for a specific integration (e.g., HubSpot).

## 5. Knowledge Service (`/api/knowledge`)
- `GET /sources` - List knowledge bases (PDFs, websites).
- `POST /upload` - Upload a new document for RAG processing.

## 6. Orchestrator (`/api/orchestrator`)
- `GET /calls` - List active and historical calls.
- `WS /ws` - Connect to the WebSocket stream for real-time call transcripts and status.

## 7. Admin Dashboard (`/api/admin`)
- `GET /revenue` - Fetch global platform revenue, MRR, and ARR.
- `GET /audit-logs` - Fetch global system audit events.
- `GET /tickets` - Fetch support tickets from all tenants.
- `POST /tickets/:id/reply` - Send a reply to a support ticket thread.
