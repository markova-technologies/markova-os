# Ethio Telecom Short Code Integration Guide for AI Call Center

## 📋 Executive Summary

Your goal is to integrate your **Twilio-based AI call center** with **Ethio Telecom's 4-digit short code** system so Ethiopian customers can call your company's short code (e.g., `1234`) and reach your AI agent "Almaz" instead of Twilio phone numbers.

**Key Finding**: Yes, Ethio Telecom uses **SIP trunking** for business services, and there are **multiple architectural approaches** to bridge it with your current Twilio webhook system.

---

## 🇪🇹 How Ethio Telecom Short Codes Work

### What Are Short Codes?

**Short codes** are abbreviated phone numbers (3-4 digits) that Ethiopian businesses use for:
- Customer service hotlines
- Premium services
- IVR (Interactive Voice Response) systems
- Call centers

**Examples**:
- `994` - Ethio Telecom customer service
- `980` - Premium customer service
- `700` - Telebirr customer service

### Short Code Categories

Ethio Telecom offers short codes in three tiers:

| Type | Digits | Setup Fee | Monthly Fee | Use Case |
|------|--------|-----------|-------------|----------|
| **Silver** | 4-digit | Lower | Lower | Standard business |
| **Platinum** | 4-digit | Medium | Medium | Premium brands |
| **Gold** | 3-digit | Higher | Higher | Major enterprises |

---

## 🔐 Requirements to Get a Short Code

### 1. **Legal/Regulatory Requirements**

You MUST obtain a **Call Center Service License** from the **Ethiopian Communications Authority (ECA)** (formerly Ethiopian Telecommunication Agency).

**License Requirements**:
- **Professional Staff**: Minimum 2 graduates with degrees in:
  - Computer Science
  - Electrical/Computer Engineering
  - Related IT fields
  - Must have 2+ years experience in ICT sector

- **Technical Infrastructure**:
  - Automatic Call Distribution (ACD) switch
  - Minimum 2 call agents (can be AI in your case!)
  - Network design documentation

- **Business Documentation**:
  - Principal Registration Certificate
  - Memorandum and Article of Association
  - Proof of Ethiopian nationality (for founders)
  - Employment contracts for professional staff
  - Educational certificates and work experience proof

**License Validity**: 1 fiscal year (must renew annually)

### 2. **Ethio Telecom Service Agreement**

After obtaining the ECA license:
- Sign service delivery contract with Ethio Telecom
- Submit network design plan
- Agree on service levels, quality metrics, and payment terms
- Get assigned your 3/4-digit short code

---

## 🔌 Ethio Telecom's Technical Infrastructure

### SIP Trunking Service

Ethio Telecom provides **SIP (Session Initiation Protocol) trunking** packages:

| Package | Concurrent Calls | Features |
|---------|-----------------|----------|
| **Small** | 5-100 calls | Basic SIP trunk |
| **Medium** | 101-500 calls | Enhanced features |
| **Large** | 500+ calls | Enterprise-grade |

**Key Features**:
- VoIP-based (Voice over IP)
- Supports voice, video, messaging, conferencing
- Cloud-based or on-premise integration
- Global reach capabilities
- Business continuity (call rerouting)
- Cost-effective vs. traditional PSTN

### Integration Points

Ethio Telecom's SIP service can connect to:
- ✅ Traditional PBX systems
- ✅ Hosted IP-PBX (cloud-based)
- ✅ Unified Communications (UC) platforms
- ✅ Custom VoIP applications
- ✅ Third-party SIP providers (for redundancy)

---

## 🏗️ Integration Architecture Options

You have **3 main approaches** to connect Ethio Telecom's SIP short code to your Twilio webhook-based AI system:

---

### **Option 1: SIP-to-HTTP Bridge (RECOMMENDED)**

**Architecture**:
```
[Caller] → [Ethio Telecom Short Code] → [SIP Trunk] 
    → [Your SIP Server/Bridge] → [HTTP Webhook] 
    → [Your FastAPI AI App] → [Response] 
    → [SIP Server] → [Ethio Telecom] → [Caller]
```

**How It Works**:
1. Caller dials your 4-digit short code (e.g., `1234`)
2. Ethio Telecom routes call via SIP to your server's public IP
3. Your SIP bridge server receives the SIP INVITE
4. Bridge converts SIP to HTTP POST request to your FastAPI `/incoming-call` endpoint
5. Your AI generates response (same code you have now!)
6. Response goes back through bridge as SIP/RTP audio
7. Caller hears your AI agent "Almaz"

**Components Needed**:
- **SIP Server Software**: FreeSWITCH, Asterisk, or Kamailio
- **Public Server**: VPS/Cloud server with static IP (AWS, DigitalOcean, etc.)
- **SIP-to-HTTP Bridge Module**: Custom or existing integration

**Pros**:
- ✅ Keep your existing Twilio webhook code with minimal changes
- ✅ Full control over infrastructure
- ✅ No dependency on Twilio for this route
- ✅ Cost-effective (no per-minute Twilio fees for Ethiopian calls)

**Cons**:
- ❌ Requires maintaining SIP server infrastructure
- ❌ Need SIP/VoIP expertise
- ❌ More complex initial setup

---

### **Option 2: Ethio Telecom SIP → Twilio SIP Trunk → Webhook**

**Architecture**:
```
[Caller] → [Ethio Telecom Short Code] → [SIP Trunk]
    → [Twilio SIP Domain/Trunk] → [Twilio Webhook]
    → [Your FastAPI AI App] → [Twilio] 
    → [Ethio Telecom] → [Caller]
```

**How It Works**:
1. Caller dials short code
2. Ethio Telecom SIP trunk forwards to Twilio SIP Domain/Trunk
3. Twilio receives SIP call and triggers your webhook (EXISTING CODE!)
4. Your AI responds with TwiML (NO CODE CHANGES!)
5. Twilio converts back to SIP for Ethio Telecom
6. Caller hears response

**Components Needed**:
- **Twilio SIP Domain** or **Elastic SIP Trunk**
- **SIP connection** between Ethio Telecom and Twilio
- Your existing FastAPI app (NO CHANGES!)

**Two Sub-Options**:

#### 2A: **Twilio Programmable Voice SIP Domain**
- Create SIP domain: `yourcompany.sip.twilio.com`
- Configure Ethio Telecom to send calls there
- Set webhook URL to your `/incoming-call` endpoint
- **Best for**: Direct SIP-to-webhook conversion

#### 2B: **Twilio Elastic SIP Trunking**
- Create SIP trunk in Twilio
- Connect Ethio Telecom SIP trunk to Twilio trunk
- Associate Twilio phone numbers (or use termination URI)
- Configure webhooks on phone numbers
- **Best for**: Traditional PBX-to-Twilio setup

**Pros**:
- ✅ ZERO CODE CHANGES to your existing app
- ✅ Twilio handles all SIP complexity
- ✅ Proven, reliable infrastructure
- ✅ Easy to set up and maintain

**Cons**:
- ❌ Per-minute Twilio charges for all Ethiopian calls
- ❌ Requires Ethio Telecom to support third-party SIP interconnection
- ❌ Dependency on two providers (Ethio Telecom + Twilio)
- ❌ Potential latency (call routing through Twilio servers)

---

### **Option 3: Hybrid - Ethio Telecom Direct + Keep Twilio for International**

**Architecture**:
```
[Ethiopian Callers] → [Ethio Telecom Short Code] → [SIP Bridge] → [Your AI App]
[International Callers] → [Twilio Phone Number] → [Your AI App]
```

**How It Works**:
- Ethiopian customers: Use Ethio Telecom short code (Option 1 approach)
- International customers: Use existing Twilio phone numbers
- Same AI backend handles both routes

**Pros**:
- ✅ Best of both worlds
- ✅ Low cost for local Ethiopian calls
- ✅ Global reach via Twilio
- ✅ Optimized for each market

**Cons**:
- ❌ Two separate infrastructures to maintain
- ❌ More complex overall architecture

---

## 🛠️ Technical Implementation Details

### SIP Server Options for Option 1

#### **A. FreeSWITCH** (RECOMMENDED)
**Why**:
- Open-source, enterprise-grade
- Excellent HTTP/webhook integration via `mod_xml_curl`
- Can invoke your FastAPI endpoints directly
- Handles audio transcoding, recording, etc.

**Example Configuration**:
```xml
<!-- FreeSWITCH Dialplan -->
<extension name="incoming_from_ethiotelecom">
  <condition field="destination_number" expression="^1234$">
    <action application="answer"/>
    <action application="curl" data="http://your-server.com/incoming-call 
           post caller_id=${caller_id_number} 
           destination=${destination_number}"/>
    <action application="playback" data="${curl_response}/audio/welcome.mp3"/>
    <action application="play_and_detect_speech" data="..."/>
  </condition>
</extension>
```

#### **B. Asterisk**
**Why**:
- Most popular open-source PBX
- AGI (Asterisk Gateway Interface) for custom scripts
- Can call external APIs

**Example AGI Script** (Python):
```python
# Asterisk calls this script
# You can make HTTP requests to your FastAPI app
import requests

caller_id = sys.argv[1]
response = requests.post('http://localhost:8001/incoming-call',
    data={'From': caller_id})
# Parse TwiML and execute Asterisk commands
```

#### **C. Kamailio**
**Why**:
- Lightweight SIP proxy/router
- Excellent for high-traffic scenarios
- Can integrate with HTTP via modules

---

### SIP Technical Requirements

#### Network Configuration
- **Public Static IP**: Your SIP server needs a fixed IP
- **Firewall Ports**:
  - `5060` (UDP/TCP) - SIP signaling
  - `5061` (TCP) - SIP over TLS (secure)
  - `10000-20000` (UDP) - RTP audio streams

#### SIP Trunk Configuration
**Information Ethio Telecom will provide**:
- SIP proxy address (e.g., `sip.ethiotelecom.et`)
- Authentication credentials (username/password)
- Codec requirements (audio formats)
- IP whitelist requirements

**Information you provide to Ethio Telecom**:
- Your public SIP server IP address
- SIP domain/URI
- Preferred codecs (e.g., G.711, G.729)
- Concurrent call capacity

#### Audio Codecs
Common codecs for Ethiopia:
- **G.711 (ulaw/alaw)**: Standard, best quality, high bandwidth
- **G.729**: Compressed, lower quality, low bandwidth
- **Opus**: Modern, excellent quality, efficient

---

## 🔄 Adapting Your Current Code

### Minimal Changes Needed (for Option 1)

Your current code structure is ALREADY PERFECT for this! You just need to:

#### 1. **Add SIP Parameters Handling**
```python
@app.post("/incoming-call")
async def handle_incoming_call(
    # Existing Twilio parameters
    From: Optional[str] = Form(None),
    To: Optional[str] = Form(None),
    
    # New SIP parameters (from FreeSWITCH/Asterisk)
    caller_id: Optional[str] = Form(None),
    sip_from: Optional[str] = Form(None),
    source: Optional[str] = Form("twilio")  # "twilio" or "ethiotelecom"
):
    # Normalize caller info
    caller = From or caller_id or sip_from
    
    # Your existing code continues here...
    welcome_text = "ሰላም! እኔ አልማዝ ነኝ። እንኳን ደህና መጡ። በምን ልርዳዎ
ት?"
    # ... rest stays the same ...
```

#### 2. **Add SIP-Compatible TwiML Alternative**
If request comes from SIP bridge instead of Twilio, return different format:

```python
if source == "ethiotelecom":
    # Return JSON for SIP bridge to process
    return JSONResponse({
        "action": "play",
        "audio_url": full_audio_url,
        "then": "gather_speech"
    })
else:
    # Return TwiML for Twilio
    return Response(content=twiml, media_type="application/xml")
```

#### 3. **Audio Format Compatibility**
Your current system generates MP3. Make sure SIP server can:
- Stream MP3 directly, OR
- Convert to WAV/PCM for SIP (FreeSWITCH can do this automatically)

---

## 📊 Cost Comparison

### Option 1: Direct SIP Bridge
**Setup Costs**:
- Server: $10-50/month (VPS)
- Static IP: Usually included
- SIP software: FREE (open-source)
- Ethio Telecom short code: One-time + monthly rental
- ECA license: Annual fee

**Per-Call Costs**:
- Essentially FREE (you pay for server, not per minute)
- Only Ethio Telecom charges (termination fees if any)

**Monthly for 10,000 calls**: ~$50-100

---

### Option 2: Via Twilio SIP
**Setup Costs**:
- Twilio SIP Trunk: $2/month base
- Ethio Telecom short code: One-time + monthly rental
- ECA license: Annual fee

**Per-Call Costs**:
- Twilio: ~$0.01-0.02/minute (depending on region)
- Groq LLM: Very cheap (~$0.0005/call)
- TTS: Free (Google TTS) or ~$0.01/call (OpenAI)

**Monthly for 10,000 calls** (avg 3 min/call):
- Twilio: $300-600
- AI services: $50-150
- **Total: $350-750/month**

---

## 🎯 Recommended Approach for You

Based on your project, I recommend **Option 2A: Twilio Programmable Voice SIP Domain** for these reasons:

### Why Option 2A?
1. **ZERO CODE CHANGES**: Your entire FastAPI app works as-is
2. **Quick Setup**: Can be done in days, not weeks
3. **Proven Reliability**: Twilio handles all SIP complexity
4. **Easy Testing**: Can test before going to Ethio Telecom
5. **Maintainable**: You're already familiar with Twilio

### Migration Path:
**Phase 1** (Start here):
- Set up Twilio SIP Domain
- Test with SIP clients (softphones)
- Verify your webhook works with SIP calls

**Phase 2**:
- Apply for ECA license (parallel task - takes time!)
- Order short code from Ethio Telecom
- Coordinate SIP trunk setup

**Phase 3**:
- Connect Ethio Telecom SIP trunk to Twilio SIP Domain
- Test with real Ethiopian calls
- Go live!

**Phase 4** (Optional - Cost Optimization):
- If call volume is high (>10,000/month), consider migrating to Option 1
- This saves money but requires SIP server expertise

---

## 📝 Step-by-Step Setup (Option 2A)

### Step 1: Set Up Twilio SIP Domain

1. **Login to Twilio Console**
   - Go to: https://console.twilio.com

2. **Navigate to SIP Domains**
   - Phone Numbers → Manage → Elastic SIP Trunking → SIP Domains

3. **Create New SIP Domain**
   - Domain Name: `yourcompany.sip.twilio.com` (choose unique name)
   - Friendly Name: "Ethio Telecom Integration"

4. **Configure Authentication**
   Option A - IP ACL (recommended for Ethio Telecom):
   - Create IP Access Control List
   - Add Ethio Telecom's SIP server IPs
   
   Option B - Credential Auth:
   - Create username/password
   - Give to Ethio Telecom for SIP authentication

5. **Set Voice Webhook URL**
   - Request URL: `https://your-ngrok-or-server.com/incoming-call`
   - Method: POST
   - This is your EXISTING endpoint!

### Step 2: Test with SIP Client

**Before connecting to Ethio Telecom**, test with a SIP softphone:

1. **Download SIP Client**:
   - Windows/Mac: Zoiper, MicroSIP, X-Lite
   - Mobile: Linphone, Zoiper

2. **Configure Client**:
   - SIP Server: `yourcompany.sip.twilio.com`
   - Username: (if using credential auth)
   - Password: (if using credential auth)

3. **Make Test Call**:
   - Dial any number/extension
   - Twilio will call your webhook
   - You should hear Almaz's greeting!

### Step 3: Apply for ECA License

**Required Documents**:
1. Business registration certificate
2. Professional staff credentials (2 IT graduates with 2+ years exp)
3. Network design document
4. Infrastructure proof (can list your FastAPI system + SIP server)

**Timeline**: 2-4 weeks typically

### Step 4: Order Short Code from Ethio Telecom

**After ECA approval**:
1. Contact Ethio Telecom Enterprise Division
   - Email: enterprise@ethiotelecom.et
   - Or visit their enterprise service center

2. **Request**:
   - 4-digit short code (specify tier: Silver/Platinum/Gold)
   - SIP trunk service
   - Number of concurrent calls needed

3. **Provide**:
   - ECA license
   - Your Twilio SIP Domain URI: `yourcompany.sip.twilio.com`
   - Technical contact info

### Step 5: Configure SIP Trunk Connection

**Ethio Telecom will provide**:
- SIP server address
- Authentication details
- IP addresses to whitelist

**You configure in Twilio**:
- Add their IPs to your SIP Domain's IP ACL
- Or set up credential auth
- Test call routing

### Step 6: Go Live!

1. Ethio Telecom activates your short code (e.g., `1234`)
2. Configure routing: `1234` → Your SIP trunk → Twilio SIP Domain → Your webhook
3. Test call from Ethiopian mobile: Dial `1234`
4. Your AI agent "Almaz" answers!

---

## 🔍 Alternative: If Ethio Telecom Doesn't Support Third-Party SIP

Some telecom providers require on-premise equipment. If Ethio Telecom requires this:

### You'll Need Option 1: Your Own SIP Server

**Hosting Options**:
1. **Local Server** (in Ethiopia):
   - Pros: Low latency, local data sovereignty
   - Cons: Need physical space, power, maintenance

2. **Ethiopian Cloud Provider**:
   - Providers: Ethio Cloud, local hosting companies
   - Pros: Local hosting, good connectivity to Ethio Telecom
   - Cons: May be limited options

3. **International Cloud** (AWS, DigitalOcean, etc.):
   - Pros: Reliable, scalable, easy setup
   - Cons: Potential latency, international bandwidth costs

**Recommended**: Ethiopian VPS/cloud provider for best connectivity

---

## 🚧 Potential Challenges & Solutions

### Challenge 1: Audio Quality/Latency
**Problem**: Poor audio quality on SIP calls
**Solutions**:
- Use high-quality codecs (G.711)
- Host SIP server in Ethiopia (low latency to Ethio Telecom)
- Optimize TTS generation (cache common responses)
- Use local audio storage

### Challenge 2: NAT/Firewall Issues
**Problem**: SIP traffic blocked by firewalls
**Solutions**:
- Use SIP ALG (Application Layer Gateway) on router
- Configure proper port forwarding
- Consider SIP over TLS (port 5061)
- Use STUN/TURN servers if needed

### Challenge 3: Speech Recognition in Amharic
**Problem**: Your current system uses Twilio's speech recognition
**Solutions**:
- Keep using Twilio (if using Option 2)
- Use Whisper AI (you already have it in requirements!)
- Record audio on SIP server, send to your FastAPI for processing

### Challenge 4: Regulatory Compliance
**Problem**: ECA license requirements seem complex
**Solutions**:
- Hire local consultant familiar with ECA licensing
- Partner with existing licensed call center
- Ensure you have required professional staff on paper

---

## 📞 Key Contacts

### Ethio Telecom
- **Website**: https://www.ethiotelecom.et
- **Enterprise Services**: enterprise@ethiotelecom.et
- **Customer Support**: 994 (4-digit short code)

### Ethiopian Communications Authority (ECA)
- **Website**: Check current government portals
- **License Applications**: Through ECA office in Addis Ababa

---

## 🎯 Next Steps for You

### Immediate (This Week):
1. ✅ Review this document fully
2. ✅ Decide: Option 1 (own SIP server) vs Option 2 (Twilio SIP)
3. ✅ Set up Twilio SIP Domain for testing (even if going with Option 1 eventually)
4. ✅ Test with SIP softphone

### Short-term (This Month):
1. 📋 Begin ECA license application process
2. 💼 Ensure you have required professional staff
3. 📄 Prepare technical documentation
4. 🏢 Contact Ethio Telecom enterprise division for initial consultation

### Medium-term (2-3 Months):
1. 🏆 Obtain ECA license
2. 📞 Order short code from Ethio Telecom
3. 🔌 Set up SIP trunk connection
4. 🧪 Conduct thorough testing

### Long-term (3-6 Months):
1. 🚀 Go live with short code
2. 📊 Monitor call quality and costs
3. 🔧 Optimize based on real usage
4. 💰 Consider migrating to Option 1 if call volume is high (cost savings)

---

## 💡 Final Recommendation

**Start with Option 2A** (Twilio SIP Domain):
- Fastest time to market
- Lowest technical risk
- Leverages your existing code
- Easy to test before committing to Ethio Telecom

**Then evaluate Option 1** (Own SIP Server) after 6 months:
- If call volume > 10,000/month
- If Twilio costs become significant
- If you have SIP expertise available
- If you want full control

This gives you a **working prototype quickly** while keeping the **option to optimize later**.

---

## ❓ Questions to Ask Ethio Telecom

When you contact them, ask:

1. **SIP Trunk Support**:
   - "Do you support third-party SIP trunk interconnection?"
   - "Can I connect your SIP trunk to an external SIP domain (like Twilio)?"

2. **Technical Requirements**:
   - "What SIP proxy address will I use?"
   - "What codecs do you support?"
   - "What authentication methods do you use (IP ACL, credentials)?"
   - "What are your SIP server IP addresses for whitelisting?"

3. **Short Code Details**:
   - "What are the costs for 4-digit short codes (setup + monthly)?"
   - "How long does provisioning take?"
   - "Can I choose the specific digits?"

4. **Licensing**:
   - "Do you help with ECA license application?"
   - "What are the current ECA licensing requirements for Call Center Services?"

---

**This is totally doable!** Your current system is well-architected and can easily adapt to Ethiopian local infrastructure. The key is choosing the right integration approach based on your timeline, budget, and technical comfort level. 🇪🇹🚀
