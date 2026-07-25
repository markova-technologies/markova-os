# Markova 2.0 - AI Workforce Operating System

Markova 2.0 is an AI Workforce Operating System designed for multi-tenant deployment, allowing businesses to rapidly build, deploy, and monitor AI agents (Voice & Text) integrated with their CRM, knowledge bases, and telephony systems.

## 🏗 System Architecture

The platform follows a microservices architecture orchestrated via Docker Compose and utilizing npm workspaces.

### 🌐 Frontend Applications (React + Vite)
- **Admin Dashboard**: Super-admin interface for managing tenants, tracking platform health, audit logs, and global billing. (`apps/admin-dashboard`)
- **Client Dashboard**: Tenant-facing UI for managing agents, phone numbers, integrations, and viewing analytics. (`apps/client-dashboard`)

### ⚙️ Core Microservices (Node.js/Express)
- **API Gateway**: Central entry point. Routes requests, handles authentication verification, and rate limiting. (`:8000`)
- **Orchestrator**: Core runtime engine. Handles WebSocket connections for live calls, LLM context loop, and coordinates between Tool Engine and Knowledge Service. (`:6000`)
- **Auth Service**: Handles JWT generation, login, registration, and RBAC. (`:5001`)
- **Tenant Service**: Manages tenant settings, phone numbers, routing rules, and billing status. (`:5002`)
- **Agent Builder Service**: Manages team definitions, agent prompts, and node-based conversation flows. (`:5003`)
- **Tool Engine**: Executes dynamic tools for AI agents. (`:5004`)
- **Connector Hub**: Handles OAuth and API keys for external integrations. (`:5005`)
- **Knowledge Service**: Manages ingestion, chunking, and querying of RAG documents. (`:5006`)

### 🛠 Background Workers
- **Connector Worker**: Asynchronous external system integration tasks.
- **Reporting Worker**: Generates heavy asynchronous analytics reports from Redis queues.
- **RPA Agent**: Automated robotic process execution.
- **Sync Worker**: Cron-based worker for periodic data synchronization.

### 🗄 Infrastructure
- **PostgreSQL**: Primary relational data store (Tenants, Users, Agents, Logs).
- **Redis**: Caching, Pub/Sub for real-time events, and Queue management for background workers.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Docker & Docker Compose

### Running Locally

1. **Start the backend infrastructure and services**:
   ```bash
   docker-compose up -d
   ```

2. **Run Frontend Dashboards** (in a separate terminal):
   ```bash
   npm install
   npm run dev:admin  # Starts Admin Dashboard
   npm run dev:client # Starts Client Dashboard
   ```
