# 📊 MARKOVA: AI Infrastructure Dashboard

A premium management portal for monitoring, analyzing, and controlling a global fleet of AI Agents.

## 🚀 Key Features

- **Real-time Monitoring**: Live stats for call volume, agent health, and latency via Socket.IO.
- **Client Management**: Multi-tenant support with client-specific dashboards and analytics.
- **AI Diagnostics**: Deep-dive performance analysis of LLM agents (Automation rates, Satisfaction scores).
- **Agent Discovery**: One-click linking of external agents via secure API handshake.
- **Advanced Visualization**: High-performance charts using Recharts for trend analysis and revenue tracking.

## 🏗️ Technical Stack

- **Frontend**: React 18, Vite, TailwindCSS, Framer Motion
- **Backend**: Node.js, Express, Socket.IO
- **Security**: AES-256-CBC API key encryption, Rate Limiting, URL Whitelisting.

## 🏃 Quick Start (Local Development)

### 1. Installation
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend && npm install
cd ..
```

### 2. Configuration
Create a `.env` file in the `backend` folder:
```env
PORT=5000
DASHBOARD_API_KEY=your_shared_secret
ENCRYPTION_KEY=32_character_string_for_external_keys
```

### 3. Run Development Server
```bash
# Start backend
node backend/server.js

# Start frontend (in another terminal)
npm run dev
```

---

## 🚦 Production Deployment
For professional production setup on Ubuntu or Windows, please refer to the specific guide:

### 👉 [Dashboard Deployment Guide](file:///D:/system%20dashborad/DEPLOYMENT_GUIDE.md)

---

## 📄 License
MIT License - Copyright (c) 2026 MARKOVA AI
