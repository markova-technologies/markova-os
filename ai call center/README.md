# 🤖 Amharic AI Call Center Engine

High-fidelity Amharic speech recognition and response system powered by Groq, FastAPI, and an intelligent multi-language routing engine.

## 🚀 Key Features

- **Natural Amharic Voice**: Multi-fallback TTS system (Google/OpenAI) with high-clarity Amharic pronunciation.
- **Multilingual Support**: Real-time language detection and switching (Amharic, English, Spanish, French, Arabic).
- **Session Isolation**: Advanced context management ensuring callers never mix histories.
- **Production Performance**: Multi-worker uvicorn setup with SQLite WAL-mode for high concurrency (100+ calls).
- **Dashboard Reporting**: Real-time metrics streaming to the MARKOVA Dashboard.

## 🏃 Quick Start (Local Development)

### 1. Prerequisites
- Python 3.10+
- Groq API Key
- Twilio Account (for actual call handling)

### 2. Setup
```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .\.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Run Agent
```bash
python main_natural_voice.py
```
The agent starts at `http://localhost:8001`.

## 🏛️ Architecture Details
- **Backend**: FastAPI (Python)
- **Database**: SQLite (aiosqlite)
- **LLM**: Llama 3.3 70B (via Groq)
- **Voice**: Hybrid Google Translate TTS / OpenAI TTS

---

## 🚦 Production Deployment
For professional production setup on Ubuntu or Windows, please refer to the specific guide:

### 👉 [AI Agent Deployment Guide](file:///d:/amharic-ai-call-demo/DEPLOYMENT_GUIDE.md)

---

## 📄 License
MIT License - Copyright (c) 2026 Almaz AI Project