# 🤖 AI Agent Deployment Guide: Amharic Call Center

This guide covers the production deployment of the **Amharic AI Call Center Engine** (FastAPI) located in this folder.

---

## 🛠️ Prerequisites
- **Python 3.10+**
- **Public IP & Domain** (Required for Twilio Webhooks)
- **Shared API Key** (Must match the one in the MARKOVA Dashboard)

---

## 🐧 Option 1: Ubuntu Linux (Recommended)

### 1. Installation
```bash
cd /opt/amharic-ai-call-demo
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install gunicorn uvicorn
```

### 2. Configure Environment (`.env`)
```env
GROQ_API_KEY=your_key
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
BASE_URL=https://agent.yourdomain.com
DASHBOARD_API_KEY=your_shared_secret
MARKOVA_BACKEND_URL=https://dashboard-api.yourdomain.com
```

### 3. Setup Systemd Service (`/etc/systemd/system/amharic-ai.service`)
```ini
[Unit]
Description=Amharic AI Engine
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/amharic-ai-call-demo
ExecStart=/opt/amharic-ai-call-demo/.venv/bin/gunicorn main_natural_voice:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8001
Restart=always

[Install]
WantedBy=multi-user.target
```

### 4. Nginx Reverse Proxy
Point Nginx to `http://localhost:8001` and enable SSL via Certbot.

---

## 🪟 Option 2: Windows Server

### 1. Setup
```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Run as Service (NSSM)
1. `nssm install AmharicAI`
2. Path: `C:\Path\To\.venv\Scripts\python.exe`
3. Arguments: `-m uvicorn main_natural_voice:app --workers 4 --port 8001`

---

## 🧪 Verification
Run `python verify_metrics.py` to ensure the agent is recording calls and successfully communicating with your Dashboard.
