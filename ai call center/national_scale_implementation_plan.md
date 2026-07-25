# 🚀 National-Scale AI Call Center Implementation Plan

## Executive Summary

This plan transforms the current Amharic AI Call System from a **single-user prototype** into a **production-ready, national-scale service** capable of handling **100+ concurrent calls** reliably. The implementation addresses critical architectural issues and adds enterprise-grade features required for Ethio Telecom-scale deployment.

---

## 🎯 Objectives

1. **Fix Critical Bug**: Eliminate the global singleton issue causing conversation cross-contamination
2. **Scale Horizontally**: Enable multi-process deployment for high concurrency
3. **Ensure Reliability**: Persist conversation state to survive server restarts
4. **Maximize Performance**: Remove blocking I/O bottlenecks with async networking
5. **Production Ready**: Add comprehensive monitoring, logging, and error recovery

---

## 🐛 Current Architecture Issues

### Critical: Global Singleton Bug

**The Problem:**
```python
# main_natural_voice.py (CURRENT - BROKEN)
ai_assistant = AmharicAIAssistant()  # ❌ ONE instance for ALL callers
```

**Impact:**
- Caller A: "My name is Ahmed"
- Caller B: "What's the weather?" 
- AI Response to B: "Hello Ahmed, the weather is..." ❌ **WRONG CALLER**

**Root Cause:** All callers share the same `conversation_history` array in memory.

### Performance Bottlenecks

1. **Blocking TTS**: `requests.get()` makes all callers wait in line
2. **Single Process**: Only one CPU core is used, regardless of server capacity
3. **Memory-Only State**: Server restart = all conversations lost

---

## 📋 Implementation Phases

### Phase 1: Session Management System
**Goal:** Each caller gets their own isolated AI assistant

#### 1.1 Create Session Manager Class

**File:** [main_natural_voice.py](file:///d:/amharic-ai-call-demo/main_natural_voice.py)

**Changes:**
```python
class SessionManager:
    """Manages isolated AI assistant instances per call"""
    
    def __init__(self):
        self.sessions = {}  # {call_id: AmharicAIAssistant}
        self.lock = asyncio.Lock()
    
    async def get_session(self, call_id: str) -> AmharicAIAssistant:
        """Get or create session for a specific call"""
        async with self.lock:
            if call_id not in self.sessions:
                self.sessions[call_id] = AmharicAIAssistant(call_id)
                logger.info(f"🆕 Created new session: {call_id}")
            return self.sessions[call_id]
    
    async def end_session(self, call_id: str):
        """Clean up session when call ends"""
        async with self.lock:
            if call_id in self.sessions:
                # Save to database before removing
                await self.sessions[call_id].save_to_db()
                del self.sessions[call_id]
                logger.info(f"🗑️ Ended session: {call_id}")
```

#### 1.2 Modify AmharicAIAssistant Class

**Add Constructor Parameter:**
```python
class AmharicAIAssistant:
    def __init__(self, call_id: str = None):  # ✅ Add call_id
        self.call_id = call_id
        self.groq_client = groq_client
        self.conversation_history = []
        self.detected_language = "amharic"
        self.is_first_turn = True
        
        # Load existing conversation from DB if available
        if call_id:
            self._load_from_db()
```

#### 1.3 Update Endpoint Handlers

**Before (BROKEN):**
```python
@app.post("/handle-input")
async def handle_input(request: Request, SpeechResult: Optional[str] = Form(None)):
    response, lang = get_response(user_input)  # ❌ Uses global ai_assistant
```

**After (FIXED):**
```python
session_manager = SessionManager()

@app.post("/handle-input")
async def handle_input(
    request: Request, 
    SpeechResult: Optional[str] = Form(None),
    CallSid: Optional[str] = Form(None)  # ✅ Twilio sends this
):
    call_id = CallSid or request.headers.get("X-Call-ID", "test-call")
    
    # Get isolated session
    assistant = await session_manager.get_session(call_id)
    
    # Generate response using THIS caller's history
    response = assistant.generate_response(user_input)
    lang = assistant.detected_language
```

**Testing Strategy:**
- Run two simultaneous calls from different phones
- Verify each maintains separate conversation context
- Check logs show distinct session IDs

---

### Phase 2: Database Persistence Layer
**Goal:** Conversations survive server restarts and enable analytics

#### 2.1 Database Schema Design

**File:** New file `database.py`

**Tables:**
```sql
-- Conversation sessions
CREATE TABLE IF NOT EXISTS conversation_sessions (
    call_id TEXT PRIMARY KEY,
    caller_number TEXT,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    detected_language TEXT DEFAULT 'amharic',
    turn_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active'  -- active, completed, abandoned
);

-- Message history
CREATE TABLE IF NOT EXISTS conversation_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id TEXT NOT NULL,
    role TEXT NOT NULL,  -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    language TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (call_id) REFERENCES conversation_sessions(call_id)
);

-- Call analytics
CREATE TABLE IF NOT EXISTS call_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id TEXT NOT NULL,
    metric_name TEXT NOT NULL,  -- 'response_time', 'tts_cache_hit', etc.
    metric_value REAL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (call_id) REFERENCES conversation_sessions(call_id)
);
```

#### 2.2 Database Manager Class

```python
class ConversationDB:
    """Handles all database operations for conversations"""
    
    def __init__(self, db_path: str = "system.db"):
        self.db_path = db_path
        self._init_schema()
    
    async def save_message(self, call_id: str, role: str, content: str, language: str):
        """Save a single message"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """INSERT INTO conversation_messages 
                   (call_id, role, content, language) 
                   VALUES (?, ?, ?, ?)""",
                (call_id, role, content, language)
            )
            await db.commit()
    
    async def load_conversation(self, call_id: str) -> List[Dict]:
        """Load full conversation history"""
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                """SELECT role, content, language 
                   FROM conversation_messages 
                   WHERE call_id = ? 
                   ORDER BY timestamp ASC""",
                (call_id,)
            ) as cursor:
                rows = await cursor.fetchall()
                return [
                    {"role": row[0], "content": row[1], "language": row[2]}
                    for row in rows
                ]
    
    async def end_session(self, call_id: str):
        """Mark session as completed"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """UPDATE conversation_sessions 
                   SET end_time = CURRENT_TIMESTAMP, status = 'completed' 
                   WHERE call_id = ?""",
                (call_id,)
            )
            await db.commit()
```

#### 2.3 Integrate with AmharicAIAssistant

**Modify `generate_response()` method:**
```python
async def generate_response(self, user_input: str) -> str:
    # Existing logic...
    
    # Save user message
    await conversation_db.save_message(
        self.call_id, 
        "user", 
        user_input, 
        self.detected_language
    )
    
    # Generate AI response
    ai_response = # ... existing logic ...
    
    # Save assistant message
    await conversation_db.save_message(
        self.call_id,
        "assistant",
        ai_response,
        self.detected_language
    )
    
    return ai_response
```

**Add `_load_from_db()` method:**
```python
async def _load_from_db(self):
    """Load conversation history when session is restored"""
    messages = await conversation_db.load_conversation(self.call_id)
    if messages:
        self.conversation_history = messages
        logger.info(f"📥 Loaded {len(messages)} messages for {self.call_id}")
```

---

### Phase 3: Async Network Operations
**Goal:** Eliminate blocking I/O to maximize concurrency

#### 3.1 Replace `requests` with `httpx`

**Current (BLOCKING):**
```python
import requests

def generate_enhanced_google_tts(text: str, lang: str = "am"):
    response = requests.get(url, headers=headers, timeout=15)  # ❌ BLOCKS
```

**New (ASYNC):**
```python
import httpx

async def generate_enhanced_google_tts(text: str, lang: str = "am"):
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, timeout=15)  # ✅ NON-BLOCKING
```

#### 3.2 Update All TTS Functions

**Files to modify:**
- `generate_enhanced_google_tts()` 
- `generate_openai_tts()`
- `generate_multilingual_voice()`

**Pattern:**
```python
# Before
def generate_multilingual_voice(text, lang_name):
    audio_url = generate_enhanced_google_tts(text, lang_code)  # ❌ Sync

# After  
async def generate_multilingual_voice(text, lang_name):
    audio_url = await generate_enhanced_google_tts(text, lang_code)  # ✅ Async
```

#### 3.3 Update Endpoint Signatures

**All FastAPI endpoints must become async:**
```python
# Before
@app.post("/incoming-call")
def handle_incoming_call(request: Request, From: str = Form(None)):
    audio_url = generate_multilingual_voice(welcome_text, "amharic")  # ❌

# After
@app.post("/incoming-call")
async def handle_incoming_call(request: Request, From: str = Form(None)):
    audio_url = await generate_multilingual_voice(welcome_text, "amharic")  # ✅
```

#### 3.4 Dependencies to Add

**requirements.txt:**
```txt
httpx>=0.27.0        # Async HTTP client
aiosqlite>=0.19.0    # Async SQLite
```

**Install:**
```bash
pip install httpx aiosqlite
```

---

### Phase 4: Multi-Worker Deployment
**Goal:** Utilize all CPU cores for horizontal scaling

#### 4.1 Worker Configuration

**Production Start Command:**
```bash
# Single machine with 8 cores
uvicorn main_natural_voice:app \
  --host 0.0.0.0 \
  --port 8001 \
  --workers 6 \
  --log-level info \
  --access-log
```

**Workers Calculation:**
```
Recommended Workers = (CPU Cores × 2) - 1
Example: 4 cores → (4 × 2) - 1 = 7 workers
```

#### 4.2 Shared State Management

> [!WARNING]
> Each worker is a separate process with its own memory. The `SessionManager` dictionary won't be shared.

**Solution: Use Redis for Session State**

**Install Redis:**
```bash
# Windows (via Chocolatey)
choco install redis-64

# Ubuntu
sudo apt install redis-server

# Python library
pip install redis aioredis
```

**Modify SessionManager:**
```python
import aioredis

class SessionManager:
    def __init__(self):
        self.redis = aioredis.from_url("redis://localhost")
    
    async def get_session(self, call_id: str) -> AmharicAIAssistant:
        # Check if session exists in Redis
        session_data = await self.redis.get(f"session:{call_id}")
        
        if session_data:
            # Deserialize from Redis
            assistant = AmharicAIAssistant.from_dict(json.loads(session_data))
        else:
            # Create new session
            assistant = AmharicAIAssistant(call_id)
            await assistant.load_from_db()
        
        return assistant
    
    async def save_session(self, call_id: str, assistant: AmharicAIAssistant):
        # Serialize to Redis with 1-hour TTL
        session_data = assistant.to_dict()
        await self.redis.setex(
            f"session:{call_id}",
            3600,  # 1 hour
            json.dumps(session_data)
        )
```

#### 4.3 Health Check Endpoint

**Add monitoring endpoint:**
```python
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "worker_id": os.getpid(),
        "active_sessions": len(session_manager.sessions),
        "db_connected": await check_db_connection(),
        "redis_connected": await check_redis_connection()
    }
```

---

### Phase 5: Production Monitoring & Observability
**Goal:** Track system health and performance metrics

#### 5.1 Structured Logging

**Add contextual logging:**
```python
import structlog

logger = structlog.get_logger()

@app.post("/handle-input")
async def handle_input(CallSid: str = Form(None), ...):
    log = logger.bind(call_id=CallSid, worker=os.getpid())
    
    log.info("call.input.received", text_length=len(user_input))
    
    # ... processing ...
    
    log.info("call.response.generated", 
             language=lang, 
             response_time_ms=elapsed_ms)
```

#### 5.2 Performance Metrics

**Track key metrics:**
```python
class MetricsCollector:
    async def record_tts_cache_hit(self, call_id: str, hit: bool):
        await conversation_db.save_metric(
            call_id, 
            "tts_cache_hit", 
            1.0 if hit else 0.0
        )
    
    async def record_response_time(self, call_id: str, ms: float):
        await conversation_db.save_metric(call_id, "response_time_ms", ms)
```

#### 5.3 Error Tracking & Alerts

**Enhance AlertManager:**
```python
async def handle_critical_error(error: Exception, call_id: str):
    # Log to database
    await log_error_to_db(call_id, str(error))
    
    # Send email alert if error rate exceeds threshold
    error_rate = await get_error_rate_last_hour()
    if error_rate > 0.05:  # 5% error rate
        await alert_manager.send_alert(
            subject="🚨 High Error Rate Detected",
            message=f"Error rate: {error_rate*100:.1f}%\nLast error: {error}"
        )
```

---

## 🏗️ Implementation Checklist

### Week 1: Core Architecture
- [ ] Create `SessionManager` class
- [ ] Update `AmharicAIAssistant` to accept `call_id`
- [ ] Modify `/incoming-call` to create sessions
- [ ] Modify `/handle-input` to use session-specific assistants
- [ ] **Test:** Run 2 simultaneous calls, verify isolation

### Week 2: Database Layer
- [ ] Create `database.py` with schema
- [ ] Implement `ConversationDB` class
- [ ] Add `save_message()` to `generate_response()`
- [ ] Add `_load_from_db()` method
- [ ] **Test:** Restart server mid-call, verify conversation continues

### Week 3: Async Conversion
- [ ] Install `httpx` and `aiosqlite`
- [ ] Convert `generate_enhanced_google_tts()` to async
- [ ] Convert `generate_openai_tts()` to async
- [ ] Update all endpoint handlers to `async def`
- [ ] **Test:** Load test with 20 concurrent calls

### Week 4: Multi-Worker Setup
- [ ] Install Redis (or use SQLite for state if Redis unavailable)
- [ ] Implement Redis-backed `SessionManager`
- [ ] Add `/health` endpoint
- [ ] Create `start_production.sh` script
- [ ] **Test:** Run with 4 workers, verify load distribution

### Week 5: Production Hardening
- [ ] Add structured logging with `structlog`
- [ ] Implement `MetricsCollector`
- [ ] Add error tracking and alerting thresholds
- [ ] Create monitoring dashboard queries
- [ ] **Test:** Simulate failures, verify recovery

---

## 📊 Expected Performance Gains

| Metric | Current | After Implementation |
|--------|---------|---------------------|
| **Max Concurrent Calls** | 5-10 | 100+ |
| **Response Time (cached)** | 200ms | 150ms |
| **Response Time (new TTS)** | 2-3s | 800ms |
| **Memory per Call** | ~50MB | ~5MB (with DB) |
| **Uptime** | 🔴 Loses state on restart | 🟢 Stateless workers |
| **Caller Isolation** | 🔴 **BROKEN** (shared memory) | 🟢 **FIXED** (per-session) |

---

## 🚨 Critical Risks & Mitigations

### Risk 1: Database Bottleneck
**Problem:** SQLite may struggle with 100+ concurrent writes

**Mitigation:**
- Use connection pooling
- Batch message saves (write every 3 messages vs every message)
- Consider PostgreSQL for >500 calls/hour

### Risk 2: Redis Single Point of Failure
**Problem:** If Redis crashes, all sessions are lost

**Mitigation:**
- Enable Redis persistence (RDB snapshots)
- Implement graceful degradation to DB-only mode
- Use Redis Sentinel for auto-failover

### Risk 3: Groq Rate Limits
**Problem:** Free tier has ~14,400 requests/day limit

**Mitigation:**
- Implement request queuing
- Cache AI responses for common questions
- Upgrade to Groq Pro ($0.27/million tokens)

---

## 💰 Cost Projections (National Scale)

**Assumptions:** 10,000 calls/day, 2 min avg duration

| Service | Usage | Cost/Month |
|---------|-------|-----------|
| **Groq (LLM)** | ~300K requests | $81 (Pro tier) |
| **OpenAI (TTS)** | ~5M characters | $75 |
| **Twilio** | 20K minutes STT | $100 |
| **Server (VPS)** | 8-core, 16GB RAM | $40 |
| **Redis Cloud** | 1GB cache | $20 |
| **TOTAL** | | **~$316/month** |

**Cost per Call:** $0.03 (extremely affordable)

---

## 🎯 Success Metrics

### Technical KPIs
- [ ] Zero conversation cross-contamination errors
- [ ] 99.9% uptime during business hours
- [ ] <500ms p95 response time
- [ ] <0.1% error rate

### Business KPIs
- [ ] Handle 100+ concurrent calls
- [ ] Support 10,000+ calls/day
- [ ] Maintain conversation context across 10+ turns
- [ ] Multi-language detection accuracy >95%

---

## 🚀 Deployment Strategy

### Local Development
```bash
# Single worker for debugging
uvicorn main_natural_voice:app --reload --port 8001
```

### Staging Environment
```bash
# 2 workers + Redis
redis-server &
uvicorn main_natural_voice:app --workers 2 --port 8001
```

### Production (Ethio Telecom)
```bash
# Systemd service with 6 workers
sudo systemctl start almaz-ai
```

**Systemd Unit File** (`/etc/systemd/system/almaz-ai.service`):
```ini
[Unit]
Description=Almaz AI Call Center
After=network.target redis.service

[Service]
Type=notify
User=almaz
WorkingDirectory=/opt/almaz-ai
ExecStart=/opt/almaz-ai/venv/bin/uvicorn main_natural_voice:app \
          --workers 6 \
          --host 0.0.0.0 \
          --port 8001 \
          --log-config logging.conf
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## 📚 Dependencies Update

**requirements.txt (Production):**
```txt
# Existing
fastapi==0.115.6
uvicorn[standard]==0.34.0
groq==0.11.0
openai==1.59.5
python-multipart==0.0.20
python-dotenv==1.0.1

# NEW - Scalability
httpx==0.27.2              # Async HTTP
aiosqlite==0.20.0          # Async SQLite
redis==5.2.1               # Session state
structlog==24.4.0          # Structured logging

# OPTIONAL - Advanced
psycopg2-binary==2.9.10    # PostgreSQL (if scaling beyond SQLite)
prometheus-client==0.21.0  # Metrics export
sentry-sdk==2.19.2         # Error tracking
```

---

## 🎓 Team Training Plan

### Phase 1: Architecture Understanding (2 days)
- Session isolation concepts
- Async/await patterns in Python
- Database transaction safety

### Phase 2: Hands-On Implementation (1 week)
- Pair programming on SessionManager
- Code review sessions for async conversion
- Load testing workshops

### Phase 3: Operations (3 days)
- Multi-worker deployment
- Redis management
- Production monitoring

---

## 🔍 Post-Implementation Verification

### Manual Testing
1. **Isolation Test:** Call from 2 phones simultaneously, give different names, verify responses stay separate
2. **Restart Test:** Call → server restart → call again → verify conversation continues
3. **Load Test:** Use `locust.py` to simulate 50 concurrent calls
4. **Failover Test:** Stop Redis mid-call, verify graceful degradation

### Automated Testing
```python
# tests/test_session_isolation.py
async def test_concurrent_sessions():
    manager = SessionManager()
    
    # Create 2 sessions
    session_a = await manager.get_session("call-123")
    session_b = await manager.get_session("call-456")
    
    # Different inputs
    response_a = await session_a.generate_response("My name is Ahmed")
    response_b = await session_b.generate_response("My name is Sara")
    
    # Verify isolation
    assert "Ahmed" not in response_b
    assert "Sara" not in response_a
```

---

## 📅 Timeline Summary

| Phase | Duration | Skills Required | Risk Level |
|-------|----------|----------------|------------|
| Session Management | 1 week | Python OOP | 🟡 Medium |
| Database Layer | 1 week | SQL, Async I/O | 🟢 Low |
| Async Conversion | 1 week | Python Async | 🟡 Medium |
| Multi-Worker | 1 week | DevOps, Redis | 🔴 High |
| Production Hardening | 1 week | Monitoring | 🟢 Low |
| **TOTAL** | **5 weeks** | | |

---

## ✅ Definition of Done

The system is ready for national-scale deployment when:

1. ✅ **Bug Fixed:** No conversation cross-contamination in 100+ call load test
2. ✅ **Performance:** Handles 100 concurrent calls with <1s response time
3. ✅ **Reliability:** Survives server restart without losing active calls
4. ✅ **Observability:** All metrics logged to database and queryable
5. ✅ **Documentation:** Runbooks created for common failure scenarios
6. ✅ **Training:** Ops team can deploy, monitor, and troubleshoot independently

---

## 🎯 Next Steps After Plan Approval

1. **Week 0:** Review plan with stakeholders, get approval
2. **Week 1:** Begin Phase 1 implementation
3. **Daily:** Standups to track progress and blockers
4. **Weekly:** Demo working features to stakeholders
5. **Week 6:** Final load test and production deployment

---

**Prepared By:** Antigravity AI Assistant  
**Date:** 2026-02-01  
**Status:** Ready for Implementation  
**Estimated Effort:** 5 weeks (1 developer)
