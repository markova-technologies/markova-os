# FreeSWITCH Telephony Infrastructure for Markova OS

This directory contains the production FreeSWITCH telephony gateway configurations, dialplans, and deployment scripts for carrier SIP interconnects (Ethio Telecom, Safaricom, and local SIP PBXs).

---

## 📁 Architecture & Directory Structure

```
infrastructure/telephony/freeswitch/
├── README.md                      # This documentation
├── scripts/
│   ├── install_freeswitch.sh     # Automated Debian/Ubuntu 22.04 installation script
│   ├── setup_firewall.sh         # UFW security and RTP port configuration
│   └── fix_freeswitch_microsip.ps1 # Local SIP client diagnostic script
└── config/
    ├── vars.xml                  # Global variables, codecs, and IP bindings
    ├── autoload_configs/
    │   └── modules.conf.xml      # Essential modules (mod_sofia, mod_curl, mod_lua, etc.)
    ├── dialplan/
    │   ├── default.xml           # Internal PBX routing (extensions 1000-1099, extension 8000 -> AI)
    │   └── public.xml            # Inbound DID/Shortcode routing -> Markova Orchestrator
    ├── scripts/
    │   └── ai_agent_handler.lua  # Lua conversational handler & TwiML/REST bridge
    └── sip_profiles/
        └── external.xml          # Ethio Telecom / Carrier SIP trunk registration profile
```

---

## 🚀 Deployment Guide (Ubuntu 22.04 LTS)

### 1. Prerequisites
- A dedicated VPS / Cloud VM (e.g. AWS EC2, DigitalOcean, or On-Premise Server with static public IP).
- Minimum specs: 2 vCPU, 4GB RAM (handles 50+ concurrent active Amharic voice calls).

### 2. Install FreeSWITCH
Run the automated installation script:
```bash
sudo chmod +x scripts/install_freeswitch.sh
sudo ./scripts/install_freeswitch.sh
```

### 3. Configure Security & Firewall
Configure UFW to allow only essential VoIP and management ports:
```bash
sudo chmod +x scripts/setup_firewall.sh
sudo ./scripts/setup_firewall.sh
```

**Port Matrix:**
| Port | Protocol | Service | Description |
|---|---|---|---|
| `22` | TCP | SSH | Server administration |
| `5060` | UDP/TCP | SIP Signaling | Carrier & internal extension signaling |
| `5080` | UDP/TCP | SIP External | External SIP trunk gateway |
| `16384-32768` | UDP | RTP Audio | Real-time voice media stream packets |
| `8021` | TCP | Event Socket Layer (ESL) | Internal Markova Orchestrator barge-in listener |

---

## ⚙️ Configuration Setup

1. Backup default FreeSWITCH configuration:
   ```bash
   sudo mv /etc/freeswitch /etc/freeswitch.orig
   sudo mkdir -p /etc/freeswitch
   ```

2. Copy Markova configuration files:
   ```bash
   sudo cp -r config/* /etc/freeswitch/
   sudo chown -R freeswitch:freeswitch /etc/freeswitch
   ```

3. Update Carrier Credentials in `/etc/freeswitch/sip_profiles/external.xml`:
   - Replace `YOUR_SIP_USERNAME` with your Ethio Telecom / Carrier trunk ID.
   - Replace `YOUR_SIP_PASSWORD` with the SIP password.
   - Set `proxy` to the carrier proxy (e.g., `sip.ethiotelecom.et`).

4. Update Public Inbound Match in `/etc/freeswitch/dialplan/public.xml`:
   - Replace `YOUR_SHORTCODE` with your assigned 4-digit shortcode or E.164 number.
   - Ensure the `curl` or `lua` action points to the active Markova Orchestrator URL:
     `https://markova-orchestrator.onrender.com/incoming-call`

5. Reload FreeSWITCH:
   ```bash
   fs_cli -x "reloadxml"
   fs_cli -x "sofia profile external rescan"
   ```

---

## 🎙️ Real-Time Audio Streaming & Barge-In
- Calls entering FreeSWITCH trigger `ai_agent_handler.lua`, which answers the call and bridges inbound audio.
- When FreeSWITCH is connected via mod_event_socket, the Orchestrator's `BargeInManager` connects to port `8021` to listen for speaker energy.
- When caller speech is detected during AI audio playback, `uuid_break` is issued to instantly stop synthesis playback with zero latency.
