# MARKOVA 2.0 - System Architecture

## Overview
Markova 2.0 is an AI Workforce Operating System designed for multi-tenant deployment, allowing businesses to rapidly build, deploy, and monitor AI agents (Voice & Text) integrated with their CRM, knowledge bases, and telephony systems.

## Core Architecture
The system follows a microservices-based architecture built around a central API Gateway and Orchestrator.

### Frontend Applications
1. **Client Dashboard** (Vite + React)
   - Tenant-facing UI for managing agents, phone numbers, integrations, and viewing analytics.
2. **Admin Dashboard** (Vite + React)
   - Super-admin interface for managing tenants, tracking platform health, audit logs, and global billing.
3. **Markova Demo Site** (Express)
   - Public-facing marketing site (Amharic AI Call Demo).

### Backend Services (Node.js/Express)
1. **API Gateway** (`:8000`)
   - Central entry point. Routes requests, handles authentication verification, and rate limiting.
2. **Auth Service** (`:5001`)
   - Handles JWT generation, login, registration, and RBAC.
3. **Tenant Service** (`:5002`)
   - Manages tenant settings, phone numbers, routing rules, and billing status.
4. **Agent Builder Service** (`:5003`)
   - Manages team definitions, agent prompts, and node-based conversation flows.
5. **Tool Engine** (`:5004`)
   - Executes dynamic tools for AI agents (e.g., booking appointments, fetching CRM data).
6. **Connector Hub** (`:5005`)
   - Handles OAuth and API keys for external integrations (HubSpot, Zendesk, etc.).
7. **Knowledge Service** (`:5006`)
   - Manages ingestion, chunking, and querying of RAG documents (PDFs, URLs, Google Drive).
8. **Orchestrator** (`:6000`)
   - The core runtime engine. Handles WebSocket connections for live calls (Twilio Media Streams), manages the LLM context loop, and coordinates between the Tool Engine and Knowledge Service.

### Background Workers
1. **Reporting Worker**
   - Listens to Redis queues to generate heavy asynchronous analytics reports.
2. **Sync Worker**
   - Cron-based worker that periodically synchronizes data from external systems (CRMs, Knowledge Bases).

### Data Layer
- **PostgreSQL**: Primary relational data store (Tenants, Users, Agents, Logs).
- **Redis**: Caching, Pub/Sub for real-time events, and Queue management for background workers.

## Communication Patterns
- **Synchronous**: REST APIs between frontend and API Gateway, and between microservices via internal HTTP calls.
- **Asynchronous**: Redis Pub/Sub for cross-service events (e.g., Call Started, Agent Updated), and Redis Lists for background job processing.
- **Real-Time**: WebSockets for live call metrics, transcription streaming, and agent state updates to the Client Dashboard.
