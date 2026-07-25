# 📊 MARKOVA Dashboard Deployment Guide

This guide covers the production setup of the **MARKOVA Management Dashboard** (Node.js Backend & React Frontend) located in this folder.

---

## 🛠️ Prerequisites
- **Node.js v18+** & **npm**
- **Shared API Key** (Must match the one in the Amharic AI Agent)
- **Encryption Key** (32-character string for securing external agent keys)

---

## 🐧 Ubuntu Linux Deployment

### 1. Backend (Node.js API)
```bash
cd /opt/system-dashboard/backend
npm install
sudo npm install -g pm2
pm2 start server.js --name "dashboard-api"
```

### 2. Frontend (React/Vite Build)
```bash
cd /opt/system-dashboard
npm install
npm run build
```

### 3. Nginx Configuration
```nginx
server {
    listen 80;
    server_name dashboard.yourdomain.com;

    # Serve Built Frontend
    location / {
        root /opt/system-dashboard/dist;
        try_files $uri /index.html;
    }

    # Proxy API Requests
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
    }
}
```

---

## 🪟 Windows Server Deployment

### 1. Backend Service (NSSM)
1. `nssm install DashboardAPI`
2. Path: `C:\Program Files\nodejs\node.exe`
3. Arguments: `C:\Path\To\backend\server.js`

### 2. Frontend Hosting
Build the project using `npm run build` and point an IIS Site or Apache vhost to the `/dist` folder.

---

## 🛡️ Security Check
1. Ensure `DASHBOARD_API_KEY` in `backend/.env` is secure.
2. Set `ENCRYPTION_KEY` to a unique 32-character string.
3. Once running, use the **Link External Agent** feature to connect your AI Agent URL (`https://agent.yourdomain.com`).

---

**Connectivity Test**: Run `node backend/check_health.js` to verify the dashboard server is up.
