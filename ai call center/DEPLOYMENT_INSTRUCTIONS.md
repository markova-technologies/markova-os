# Markova AI Call Center — Deployment Guide

This guide covers how to test the AI system locally, and how to deploy it for real-world phone calls.

---

## 💻 Local Testing (Without FreeSWITCH)

Since FreeSWITCH has proven unstable on your local Windows PC (causing MicroSIP to freeze), the best way to develop and test the AI is through the **Web Phone Simulator**.

1. **Start the backend:**
   Run `run_app.bat` to start the FastAPI server on port 8001.
2. **Start the Web UI:**
   Open a terminal and run `python -m http.server 3000` in the project folder.
3. **Test:**
   Open `http://localhost:3000/test_form.html` in Chrome. Click "Start Call" and talk to the AI using your PC microphone. This uses the exact same ElevenLabs STT, Groq LLM, and Addis AI TTS that a real phone call would use.

---

## ☁️ Production Deployment (Real Phone Calls)

To connect this to real phone numbers (like an Ethio Telecom SIP trunk), you need two components:
1. **The Backend:** (Can be deployed on Render, Heroku, or a VPS)
2. **FreeSWITCH:** (MUST be deployed on a VPS like DigitalOcean, Vultr, or Linode because it requires open UDP ports for SIP and RTP which Render does not support)

### Option 1: Deploy Backend to Render (Recommended for easiest scaling)
Render is a great place to host the FastAPI backend.

1. **Push your code to GitHub.**
2. Go to **Render.com** and create a new **Blueprint** (or Web Service).
3. Connect your GitHub repository. Render will automatically detect the `render.yaml` file I created for you.
4. Render will build the Docker container (which installs `ffmpeg` required for audio conversion) and start the server.
5. In the Render Dashboard, go to your Web Service -> **Environment**, and add your API keys:
   - `GROQ_API_KEY`
   - `ELEVENLABS_API_KEY`
   - `ADDIS_AI_TTS_KEY`
6. Render will give you a public URL (e.g., `https://markova-ai.onrender.com`). Use this URL as the backend URL in your FreeSWITCH configuration.

*Note: The `render.yaml` automatically sets up a 1GB persistent disk at `/app/data` so your database and cached audio files aren't deleted when the server restarts.*

### Option 2: Full VPS Deployment (Backend + FreeSWITCH together)
If you want to host both the backend and FreeSWITCH on the exact same server to save money:

#### Step 1: Server Setup
1. Rent a cheap VPS (e.g., DigitalOcean, Vultr, or Linode) with at least 2GB RAM.
2. Install Python 3.10+, ffmpeg, and FreeSWITCH.
   ```bash
   sudo apt update
   sudo apt install python3-pip python3-venv ffmpeg freeswitch freeswitch-mod-lua
   ```

### Step 2: Backend Setup
1. Clone your code to the server.
2. Set up the Python virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
3. Copy your `.env` file to the server.
4. Run the backend using `pm2` or `systemd` so it stays alive:
   ```bash
   uvicorn main_natural_voice:app --host 0.0.0.0 --port 8001
   ```

### Step 3: FreeSWITCH Configuration
1. **Public Dialplan (`/etc/freeswitch/dialplan/public/00_inbound.xml`):**
   Set up the dialplan to route incoming SIP calls to your Python backend using the Lua script, exactly as it is in your `public.xml`.
2. **SIP Profile (`/etc/freeswitch/sip_profiles/external/ethiotelecom.xml`):**
   Add your Ethio Telecom SIP trunk details (Username, Password, Proxy URL) so FreeSWITCH can register with the carrier.

### Step 4: Ethio Telecom Integration
When deploying in Ethiopia with Ethio Telecom:
1. Ensure your VPS has a static IP.
2. Provide your static IP to Ethio Telecom so they can whitelist it on their SIP firewall.
3. Use the G.711 (PCMA/PCMU) or G.729 codecs, as these are standard for telecom networks.

Once this is running, anyone in Ethiopia can dial your short code (e.g., 8888) and it will ring your FreeSWITCH server, which routes the audio directly to your Python AI!
