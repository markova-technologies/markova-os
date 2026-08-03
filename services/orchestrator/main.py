"""
Markova Orchestrator Service v2.0
─────────────────────────────────────────────────────────────────────────────
Multi-tenant voice orchestration engine.

Responsibilities:
  - Receive inbound call webhooks from Twilio
  - Look up phone number → company + agent from PostgreSQL
  - Manage conversation state in Redis
  - Route LLM/STT/TTS calls via modular adapters
  - Validate and normalize Amharic speech (homophones, garbage, LLM repair)
  - Persist call logs, transcripts, and usage metrics in PostgreSQL
  - Serve generated neural voice audio files dynamically
─────────────────────────────────────────────────────────────────────────────
"""

import asyncio
import hashlib
import hmac
import json
import os
import random
import re
import tempfile
import time
import uuid
from contextlib import asynccontextmanager
from typing import Optional, Tuple

import asyncpg  # type: ignore
import httpx
import redis.asyncio as aioredis  # type: ignore
from semantic_cache import SemanticCache

semantic_cache = SemanticCache(similarity_threshold=0.92)
from dotenv import load_dotenv
from fastapi import FastAPI, Form, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL must be set in the environment (no default password).")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
TOOL_ENGINE_URL = os.getenv("TOOL_ENGINE_URL", "http://tool-engine:5004")
PORT = int(os.getenv("PORT", 6000))
AUDIO_DIR = os.getenv("AUDIO_DIR", "/app/audio")

# Create audio directory if it doesn't exist
os.makedirs(AUDIO_DIR, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────────────
# App State
# ─────────────────────────────────────────────────────────────────────────────
db_pool: Optional[asyncpg.Pool] = None
redis_client: Optional[aioredis.Redis] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_pool, redis_client

    # Connect PostgreSQL
    for attempt in range(10):
        try:
            db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
            print("✅ Orchestrator connected to PostgreSQL")
            break
        except Exception as e:
            print(f"⚠️ DB attempt {attempt + 1}/10 failed: {e}. Retrying in 3s...")
            await asyncio.sleep(3)
    else:
        print("❌ Orchestrator: DB connection failed permanently")
        raise RuntimeError("Cannot connect to PostgreSQL")

    # Connect Redis
    for attempt in range(10):
        try:
            redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
            await redis_client.ping()
            print("✅ Orchestrator connected to Redis")
            break
        except Exception as e:
            print(f"⚠️ Redis attempt {attempt + 1}/10 failed: {e}. Retrying in 3s...")
            await asyncio.sleep(3)
    else:
        print("❌ Orchestrator: Redis connection failed permanently")
        raise RuntimeError("Cannot connect to Redis")

    print(f"🚀 Orchestrator ready on port {PORT}")
    
    # Start Redis Pub/Sub listener for WebSockets
    pubsub_task = asyncio.create_task(listen_for_logs())

    yield
    
    pubsub_task.cancel()
    if db_pool:
        await db_pool.close()
    if redis_client:
        await redis_client.close()


app = FastAPI(title="Markova Orchestrator", version="2.0.0", lifespan=lifespan)

# Mount generated audio files directory
app.mount("/audio", StaticFiles(directory=AUDIO_DIR), name="audio")


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS: DB Lookups & Writes
# ─────────────────────────────────────────────────────────────────────────────

async def get_agent_by_phone(phone_number: str) -> Optional[dict]:
    """
    Look up which company+agent owns this phone number.
    Returns full agent configuration including provider settings.
    """
    row = await db_pool.fetchrow(
        """
        SELECT 
            pn.id as phone_number_id,
            pn.phone_number,
            pn.company_id,
            pn.settings as phone_settings,
            a.id as agent_id,
            a.name as agent_name,
            a.prompt,
            a.voice_provider,
            a.voice_id,
            a.model_provider,
            a.model_id
        FROM phone_numbers pn
        LEFT JOIN agents a ON a.id = pn.agent_id
        WHERE pn.phone_number = $1 AND pn.status = 'active'
        """,
        phone_number
    )
    if not row:
        return None
    data = dict(row)
    settings = data.get("phone_settings") or {}
    if isinstance(settings, str):
        settings = json.loads(settings)
    data["phone_settings"] = settings
    return data


async def get_routing_rules_for_phone(phone_number_id: str, company_id: str) -> list:
    rows = await db_pool.fetch(
        """
        SELECT rules FROM routing_rules
        WHERE phone_number_id = $1 AND company_id = $2
        ORDER BY created_at ASC
        """,
        uuid.UUID(phone_number_id), uuid.UUID(company_id),
    )
    out = []
    for r in rows:
        rules = r["rules"]
        if isinstance(rules, str):
            rules = json.loads(rules)
        if isinstance(rules, list):
            out.extend(rules)
    return out


import crypto # Added for decryption

async def get_provider_config(company_id: str, provider_type: str, provider_name: str) -> Optional[dict]:
    """Fetch provider credentials for a company."""
    row = await db_pool.fetchrow(
        """
        SELECT encrypted_config FROM provider_configs
        WHERE company_id = $1 AND provider_type = $2 AND provider_name = $3
        """,
        uuid.UUID(company_id), provider_type, provider_name
    )
    if row:
        config = row["encrypted_config"]
        # Decrypt config if it is encrypted
        if isinstance(config, str):
            decrypted = crypto.decrypt(config)
            try:
                return json.loads(decrypted)
            except json.JSONDecodeError:
                return decrypted
        return config
    return None


async def create_call_record(
    company_id: str,
    agent_id: Optional[str],
    caller_number: str,
    phone_number_id: Optional[str] = None,
) -> str:
    """Create a call record and return its ID."""
    call_id = uuid.uuid4()
    await db_pool.execute(
        """
        INSERT INTO calls (id, company_id, agent_id, phone_number_id, caller_number, status, turn_count)
        VALUES ($1, $2, $3, $4, $5, 'active', 0)
        """,
        call_id,
        uuid.UUID(company_id),
        uuid.UUID(agent_id) if agent_id else None,
        uuid.UUID(phone_number_id) if phone_number_id else None,
        caller_number,
    )
    return str(call_id)


def _parse_phone_settings(settings) -> dict:
    if not settings:
        return {}
    if isinstance(settings, str):
        return json.loads(settings)
    return dict(settings)


def _ivr_prompt_from_settings(settings: dict, routing_rules: list) -> str:
    menu = settings.get("ivr_menu")
    if isinstance(menu, dict) and menu.get("prompt"):
        return menu["prompt"]
    if isinstance(menu, str) and menu.strip():
        return menu
    # Derive from routing rules with digit keys
    lines = ["Please make a selection."]
    for rule in routing_rules:
        digit = rule.get("digit") or rule.get("dtmf")
        label = rule.get("label") or rule.get("action") or "option"
        if digit is not None:
            lines.append(f"Press {digit} for {label}.")
    if settings.get("voicemail_email"):
        lines.append("Press 9 to leave a voicemail.")
    return " ".join(lines) if len(lines) > 1 else "Please hold while we connect you."


async def save_transcript(call_id: str, role: str, content: str):
    """Save a conversation turn to transcripts table and update turn_count."""
    tx_id = uuid.uuid4()
    async with db_pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                """
                INSERT INTO transcripts (id, call_id, role, content)
                VALUES ($1, $2, $3, $4)
                """,
                tx_id, uuid.UUID(call_id), role, content
            )
            # Increment turn count in calls table
            await conn.execute(
                "UPDATE calls SET turn_count = turn_count + 1 WHERE id = $1",
                uuid.UUID(call_id)
            )


async def end_call_record(call_id: str):
    """Mark call as completed."""
    await db_pool.execute(
        "UPDATE calls SET status = 'completed', end_time = NOW() WHERE id = $1",
        uuid.UUID(call_id)
    )


async def track_usage(company_id: str, llm_tokens: int = 0, stt_seconds: int = 0,
                      tts_characters: int = 0, call_minutes: int = 0):
    """
    Append a usage event row (ledger). GET /v1/usage sums these for the current period.
    Also notifies tenant-service so Redis cache stays consistent.
    """
    if not company_id:
        return
    if not any([llm_tokens, stt_seconds, tts_characters, call_minutes]):
        return
    await db_pool.execute(
        """
        INSERT INTO usage_metrics (id, company_id, llm_tokens, stt_seconds, tts_characters, call_minutes)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        uuid.uuid4(), uuid.UUID(company_id), llm_tokens, stt_seconds, tts_characters, call_minutes
    )
    # Best-effort cache sync via tenant-service internal increment
    tenant_url = os.getenv("TENANT_SERVICE_URL", "http://tenant-service:5002")
    secret = os.getenv("SERVICE_AUTH_SECRET")
    if secret:
        try:
            timestamp = str(int(time.time() * 1000))
            payload = f"orchestrator:{timestamp}"
            signature = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    f"{tenant_url}/api/tenant/usage/increment",
                    json={
                        "companyId": company_id,
                        "callMinutes": call_minutes,
                        "sttSeconds": stt_seconds,
                        "ttsCharacters": tts_characters,
                        "llmTokens": llm_tokens,
                        "ledgerWritten": True,
                    },
                    headers={"x-service-auth": f"Service orchestrator:{timestamp}:{signature}"},
                )
        except Exception as e:
            print(f"⚠️ usage cache sync skipped: {e}")

async def publish_event(event_type: str, payload: dict, source: str = "orchestrator"):
    if not redis_client:
        return
    event = {
        "type": event_type,
        "payload": json.dumps(payload),
        "timestamp": str(int(time.time() * 1000)),
        "source": source,
        "traceId": ""
    }
    try:
        await redis_client.xadd("markova_events", event)
    except Exception as e:
        print(f"⚠️ Failed to publish event: {e}")



# ─────────────────────────────────────────────────────────────────────────────
# ADAPTERS: LLM & EMBEDDING
# ─────────────────────────────────────────────────────────────────────────────

async def get_embedding(provider: str, model_id: str, text: str, api_key: str) -> list[float]:
    if provider == "openai":
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"input": text, "model": model_id or "text-embedding-3-small"}
            )
            resp.raise_for_status()
            return resp.json()["data"][0]["embedding"]
    # Fallback to empty vector if not supported
    return []

async def search_knowledge_chunks(company_id: str, query: str, api_key: str) -> str:
    """Retrieve relevant chunks from vector database."""
    try:
        # Default to OpenAI embeddings for now
        embedding = await get_embedding("openai", "text-embedding-3-small", query, api_key)
        if not embedding:
            return ""
            
        vector_str = f"[{','.join(map(str, embedding))}]"
        
        rows = await db_pool.fetch(
            """
            SELECT content, 1 - (embedding <=> $1::vector) AS similarity
            FROM knowledge_chunks
            WHERE company_id = $2
            ORDER BY embedding <=> $1::vector
            LIMIT 3
            """,
            vector_str,
            uuid.UUID(company_id)
        )
        
        # Filter chunks with good similarity
        context_chunks = [r["content"] for r in rows if r["similarity"] > 0.70]
        if not context_chunks:
            return ""
            
        return "\n\n".join(context_chunks)
    except Exception as e:
        print(f"⚠️ RAG Search Failed: {e}")
        return ""


async def llm_complete(provider: str, model_id: str, messages: list, api_key: str) -> tuple[str, int]:
    """
    Unified LLM completion adapter.
    Returns (response_text, tokens_used)
    """
    if provider == "openai":
        return await _openai_complete(model_id, messages, api_key)
    elif provider == "groq":
        return await _groq_complete(model_id, messages, api_key)
    elif provider == "gemini":
        return await _gemini_complete(model_id, messages, api_key)
    else:
        raise ValueError(f"Unsupported LLM provider: {provider}")


async def _openai_complete(model_id: str, messages: list, api_key: str) -> tuple[str, int]:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": model_id or "gpt-4o-mini", "messages": messages, "max_tokens": 300, "temperature": 0.7}
        )
        resp.raise_for_status()
        data = resp.json()
        text = data["choices"][0]["message"]["content"].strip()
        tokens = data["usage"]["total_tokens"]
        return text, tokens


async def _groq_complete(model_id: str, messages: list, api_key: str) -> tuple[str, int]:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": model_id or "llama-3.3-70b-versatile", "messages": messages, "max_tokens": 300}
        )
        resp.raise_for_status()
        data = resp.json()
        text = data["choices"][0]["message"]["content"].strip()
        tokens = data.get("usage", {}).get("total_tokens", 0)
        return text, tokens


async def _gemini_complete(model_id: str, messages: list, api_key: str) -> tuple[str, int]:
    # Convert messages to Gemini format
    contents = []
    for msg in messages:
        if msg["role"] == "system":
            contents.append({"role": "user", "parts": [{"text": msg["content"]}]})
        else:
            role = "model" if msg["role"] == "assistant" else "user"
            contents.append({"role": role, "parts": [{"text": msg["content"]}]})

    model = model_id or "gemini-1.5-flash"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
            json={"contents": contents}
        )
        resp.raise_for_status()
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        return text, 0  # Gemini doesn't return usage details in standard OpenAI format


# ─────────────────────────────────────────────────────────────────────────────
# ADAPTERS: STT
# ─────────────────────────────────────────────────────────────────────────────

async def stt_transcribe(provider: str, model_id: str, audio_bytes: bytes, filename: str, api_key: str, lang: str = "am") -> str:
    """
    Unified STT transcription adapter.
    Returns transcribed text.
    """
    if provider == "openai":
        return await _openai_stt(model_id, audio_bytes, filename, api_key, lang)
    elif provider == "groq":
        return await _groq_stt(model_id, audio_bytes, filename, api_key, lang)
    elif provider == "deepgram":
        return await _deepgram_stt(model_id, audio_bytes, api_key, lang)
    else:
        raise ValueError(f"Unsupported STT provider: {provider}")


async def _openai_stt(model_id: str, audio_bytes: bytes, filename: str, api_key: str, lang: str = "am") -> str:
    WHISPER_PROMPT = (
        "ሰላም የጂኤም ፈርኒቸር ደንበኛ ድጋፍ ነኝ። ሶፋ ዋጋ how much ነው? discount አለ? delivery free ነው? "
        "ወንበር price ስንት ነው? installation included ነው? "
        "አልጋ ጠረጴዛ ካቢኔ ዋርድሮብ መደርደሪያ ቲቪ ስታንድ ኪንግ ሳይዝ ኩዊን ኤል ቅርጽ ስዊቬል "
        "ሾሩም location Bole ቄራ Piassa ቶርሃይሎች ጉርድ ሾላ አለምገና። "
        "ዋጋ ብር ክፍያ ቅጣፍ ባንክ ዋስትና ትዕዛዝ order furniture desk chair bed style"
    )
    async with httpx.AsyncClient(timeout=30) as client:
        files = {
            "file": (filename, audio_bytes, "audio/wav" if filename.endswith(".wav") else "audio/mpeg")
        }
        data = {
            "model": model_id or "whisper-1",
            "language": lang,
            "prompt": WHISPER_PROMPT
        }
        resp = await client.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {api_key}"},
            files=files,
            data=data
        )
        resp.raise_for_status()
        return resp.json()["text"]


async def _groq_stt(model_id: str, audio_bytes: bytes, filename: str, api_key: str, lang: str = "am") -> str:
    WHISPER_PROMPT = (
        "ሰላም የጂኤም ፈርኒቸር ደንበኛ ድጋፍ ነኝ። ሶፋ ዋጋ how much ነው? discount አለ? delivery free ነው? "
        "ወንበር price ስንት ነው? installation included ነው? "
        "አልጋ ጠረጴዛ ካቢኔ ዋርድሮብ መደርደሪያ ቲቪ ስታንድ ኪንግ ሳይዝ ኩዊን ኤል ቅርጽ ስዊቬል "
        "ሾሩም location Bole ቄራ Piassa ቶርሃይሎች ጉርድ ሾላ አለምገና። "
        "ዋጋ ብር ክፍያ ቅጣፍ ባንክ ዋስትና ትዕዛዝ order furniture desk chair bed style"
    )
    async with httpx.AsyncClient(timeout=30) as client:
        files = {
            "file": (filename, audio_bytes, "audio/wav" if filename.endswith(".wav") else "audio/mpeg")
        }
        data = {
            "model": model_id or "whisper-large-v3-turbo",
            "language": lang,
            "prompt": WHISPER_PROMPT
        }
        resp = await client.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {api_key}"},
            files=files,
            data=data
        )
        resp.raise_for_status()
        return resp.json()["text"]


async def _deepgram_stt(model_id: str, audio_bytes: bytes, api_key: str, lang: str = "am") -> str:
    dg_lang = "am" if lang == "am" else "en"
    async with httpx.AsyncClient(timeout=30) as client:
        headers = {
            "Authorization": f"Token {api_key}",
            "Content-Type": "audio/wav"
        }
        resp = await client.post(
            f"https://api.deepgram.com/v1/listen?model={model_id or 'nova-2'}&language={dg_lang}&smart_format=true",
            headers=headers,
            content=audio_bytes
        )
        resp.raise_for_status()
        data = resp.json()
        return data["results"]["channels"][0]["alternatives"][0]["transcript"]


# ─────────────────────────────────────────────────────────────────────────────
# ADAPTERS: TTS
# ─────────────────────────────────────────────────────────────────────────────

async def tts_synthesize(provider: str, voice_id: str, text: str, api_key: str) -> bytes:
    """
    Unified TTS adapter.
    Returns audio bytes (MP3/WAV).
    """
    try:
        if provider == "elevenlabs":
            return await _elevenlabs_tts(voice_id, text, api_key)
        elif provider == "openai":
            return await _openai_tts(voice_id, text, api_key)
        elif provider == "azure":
            return await _azure_tts(voice_id, text, api_key)
        elif provider == "edge":
            return await _edge_tts(voice_id, text)
        elif provider == "google":
            return await _google_tts(voice_id or "am", text)
    except Exception as e:
        print(f"⚠️ Primary TTS {provider} failed: {e}. Falling back to edge-tts.")
        
    # Guaranteed fallback to edge-tts so Twilio <Say> doesn't butcher Amharic with an Arabic voice
    return await _edge_tts("am-ET-MekdesNeural", text)


async def _elevenlabs_tts(voice_id: str, text: str, api_key: str) -> bytes:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id or '21m00Tcm4TlvDq8ikWAM'}",
            headers={"xi-api-key": api_key, "Content-Type": "application/json"},
            json={"text": text, "model_id": "eleven_multilingual_v2",
                  "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}}
        )
        resp.raise_for_status()
        return resp.content


async def _openai_tts(voice_id: str, text: str, api_key: str) -> bytes:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.openai.com/v1/audio/speech",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": "tts-1", "voice": voice_id or "alloy", "input": text}
        )
        resp.raise_for_status()
        return resp.content


async def _azure_tts(voice_id: str, text: str, api_key: str) -> bytes:
    region = os.getenv("AZURE_REGION", "eastus")
    ssml = f"""<speak version="1.0" xml:lang="en-US">
        <voice name="{voice_id or 'en-US-JennyNeural'}">{text}</voice>
    </speak>"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1",
            headers={
                "Ocp-Apim-Subscription-Key": api_key,
                "Content-Type": "application/ssml+xml",
                "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3"
            },
            content=ssml.encode()
        )
        resp.raise_for_status()
        return resp.content


async def _edge_tts(voice_id: str, text: str) -> bytes:
    import edge_tts  # type: ignore
    voice = voice_id or "am-ET-MekdesNeural"
    communicate = edge_tts.Communicate(text, voice)
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp_name = tmp.name
    try:
        await communicate.save(tmp_name)
        with open(tmp_name, "rb") as f:
            mp3_bytes = f.read()
        
        # Try to convert to WAV using ffmpeg if available for better tele-compatibility
        try:
            wav_name = tmp_name.replace(".mp3", ".wav")
            # Run ffmpeg asynchronously to avoid blocking the event loop
            process = await asyncio.create_subprocess_exec(
                'ffmpeg', '-y', '-i', tmp_name, '-ar', '16000', '-ac', '1', wav_name,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            try:
                await asyncio.wait_for(process.communicate(), timeout=10.0)
                if process.returncode == 0:
                    with open(wav_name, "rb") as f:
                        wav_bytes = f.read()
                    try:
                        os.unlink(wav_name)
                    except:
                        pass
                    return wav_bytes
            except Exception as e:
                try:
                    process.kill()
                except:
                    pass
            return mp3_bytes
        except Exception as e:
            # Fallback to returning raw MP3
            return mp3_bytes
    finally:
        if os.path.exists(tmp_name):
            os.unlink(tmp_name)


async def _google_tts(lang: str, text: str) -> bytes:
    from urllib.parse import quote
    encoded_text = quote(text)
    speed = 0.9 if lang == "am" else 1.0
    url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={encoded_text}&tl={lang}&client=tw-ob&ttsspeed={speed}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'audio/mpeg, audio/*, */*',
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        return resp.content


# ─────────────────────────────────────────────────────────────────────────────
# SPEECH VALIDATION & NORMALIZATION (AMHARIC ENGINE)
# ─────────────────────────────────────────────────────────────────────────────

# Polite rotatable retries
POLITE_RETRY_RESPONSES = [
    "ይቅርታ፣ አንዴ ይድገሙልኝ?",
    "ይቅርታ፣ ግልፅ አልሆነልኝም። ደግመው ይንገሩኝ?",
    "ይቅርታ፣ ጥያቄዎን ትንሽ እንደገና ይንገሩኝ?",
    "እሺ፣ ይቅርታ ጎን ያሉኝ ድምፅ ብዙ ነው። እባክዎ ደግመው ይንገሩኝ?",
    "ይቅርታ፣ በደንብ አልሰማሁዎትም። እባክዎ ቀስ ብለው ይንገሩኝ?",
    "ይቅርታ፣ መስመሩ ትንሽ ደካማ ነው። እባክዎ ደግመው ይናገሩ?",
]
def get_polite_retry() -> str:
    return random.choice(POLITE_RETRY_RESPONSES)


# Homophone normalizer map
AMHARIC_NORMALIZER = str.maketrans({
    'ሐ': 'ሀ', 'ኀ': 'ሀ', 'ሑ': 'ሁ', 'ኁ': 'ሁ',
    'ሒ': 'ሂ', 'ኂ': 'ሂ', 'ሓ': 'ሃ', 'ኃ': 'ሃ',
    'ሔ': 'ሄ', 'ኄ': 'ሄ', 'ሕ': 'ህ', 'ኅ': 'ህ',
    'ሖ': 'ሆ', 'ኆ': 'ሆ',
    'ዐ': 'አ', 'ዑ': 'ኡ', 'ዒ': 'ኢ', 'ዓ': 'ኣ',
    'ዔ': 'ኤ', 'ዕ': 'እ', 'ዖ': 'ኦ',
    'ሠ': 'ሰ', 'ሡ': 'ሱ', 'ሢ': 'ሲ', 'ሣ': 'ሳ',
    'ሤ': 'ሴ', 'ሥ': 'ስ', 'ሦ': 'ሶ',
    'ፀ': 'ጸ', 'ፁ': 'ጹ', 'ፂ': 'ጺ', 'ፃ': 'ጻ',
    'ፄ': 'ጼ', 'ፅ': 'ጽ', 'ፆ': 'ጾ',
})


def normalize_amharic(text: str) -> str:
    """Normalize phonetically equivalent Amharic characters to a standard form."""
    if not text:
        return text
    return text.translate(AMHARIC_NORMALIZER)


def is_garbage_transcription(text: str) -> bool:
    """Detect if the transcription is Whisper/STT hallucination garbage."""
    if not text or len(text.strip()) < 2:
        return True

    text = text.strip()
    amharic_chars = 0
    garbage_chars = 0
    latin_chars = 0
    total_alpha = 0

    for char in text:
        code = ord(char)
        if 0x1200 <= code <= 0x139F or 0x2D80 <= code <= 0x2DDF:
            amharic_chars += 1
            total_alpha += 1
        elif char.isalpha():
            total_alpha += 1
            if (0x10D0 <= code <= 0x10FF or  # Georgian
                0x0E00 <= code <= 0x0E7F or  # Thai
                0x0400 <= code <= 0x04FF or  # Cyrillic
                0x4E00 <= code <= 0x9FFF or  # CJK
                0x0600 <= code <= 0x06FF or  # Arabic
                0x0900 <= code <= 0x097F or  # Devanagari
                0xAC00 <= code <= 0xD7AF):   # Korean
                garbage_chars += 1
            else:
                latin_chars += 1
        elif code == 0xFFFD:
            garbage_chars += 1

    if garbage_chars >= 2:
        return True
    if '' in text or '\ufffd' in text:
        return True
    
    # Check for repetitive characters
    for i in range(len(text) - 3):
        if text[i] == text[i+1] == text[i+2] == text[i+3] and text[i].isalpha():
            return True

    if total_alpha > 0 and amharic_chars == 0 and latin_chars < 3:
        return True
    if len(text) < 5 and amharic_chars == 0:
        return True

    # Numeric ratio check
    words = text.split()
    if len(words) >= 2:
        numeric_words = sum(1 for w in words if w.strip('.,?!').isdigit())
        if numeric_words / len(words) >= 0.7:
            return True

    # Hallucination keywords
    hallucination_phrases = [
        "subtitles by", "subscrib", "thank you for watching",
        "please subscribe", "like and subscribe", "ሰብስክራይብ",
        "feeding", "www.", "http"
    ]
    text_lower = text.lower()
    if any(phrase in text_lower for phrase in hallucination_phrases):
        return True

    return False


async def repair_amharic_transcription(text: str, api_key: str) -> str:
    """Repair Whisper phonetic errors using a fast LLM pass."""
    if not text or len(text) < 3 or not api_key:
        return text
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [{
                        "role": "system",
                        "content": (
                            "You are an Amharic text repair tool. Fix phonetic spelling mistakes in Amharic text "
                            "produced by speech recognition. The text may contain English words mixed in. "
                            "Only fix obvious character substitutions. Return ONLY the corrected text, nothing else."
                        )
                    }, {"role": "user", "content": text}],
                    "temperature": 0.0,
                    "max_tokens": 100
                }
            )
            if resp.status_code == 200:
                repaired = resp.json()["choices"][0]["message"]["content"].strip()
                return repaired or text
    except Exception as e:
        print(f"⚠️ Phonetic repair failed: {e}")
    return text


# ─────────────────────────────────────────────────────────────────────────────
# CONVERSATION STATE (Redis)
# ─────────────────────────────────────────────────────────────────────────────

async def get_conversation_state(call_sid: str) -> dict:
    raw = await redis_client.get(f"call:{call_sid}:state")
    if raw:
        return json.loads(raw)
    return {"messages": [], "turn_count": 0, "call_id": None}


async def save_conversation_state(call_sid: str, state: dict, ttl: int = 3600):
    await redis_client.setex(f"call:{call_sid}:state", ttl, json.dumps(state))


async def delete_conversation_state(call_sid: str):
    await redis_client.delete(f"call:{call_sid}:state")


async def get_audio_url_for_text(provider: str, voice_id: str, text: str, api_key: str, request: Request) -> Optional[str]:
    """Generates audio via TTS adapter and returns the static URL to serve it."""
    try:
        text_hash = hashlib.md5(f"{provider}_{voice_id}_{text}".encode('utf-8')).hexdigest()[:8]
        filename = f"tts_{text_hash}.wav"
        filepath = os.path.join(AUDIO_DIR, filename)

        if os.path.exists(filepath):
            return f"{str(request.base_url).rstrip('/')}/audio/{filename}"

        audio_bytes = await tts_synthesize(provider, voice_id, text, api_key)
        if audio_bytes:
            with open(filepath, "wb") as f:
                f.write(audio_bytes)
            return f"{str(request.base_url).rstrip('/')}/audio/{filename}"
    except Exception as e:
        print(f"Error generating audio URL: {e}")
    return None


# Twilio Language mappings for Say and Gather
TWILIO_VOICE_MAP = {
    "amharic": {"voice": "Polly.Zeina", "lang": "ar-EG", "stt": "am-ET"},
    "english": {"voice": "Polly.Joanna", "lang": "en-US", "stt": "en-US"},
    "spanish": {"voice": "Polly.Conchita", "lang": "es-ES", "stt": "es-ES"},
    "french": {"voice": "Polly.Celine", "lang": "fr-FR", "stt": "fr-FR"}
}


# ─────────────────────────────────────────────────────────────────────────────
# WEBSOCKETS & REAL-TIME LOGS
# ─────────────────────────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        # Dict mapping company_id to a list of active WebSockets
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, company_id: str):
        await websocket.accept()
        if company_id not in self.active_connections:
            self.active_connections[company_id] = []
        self.active_connections[company_id].append(websocket)

    def disconnect(self, websocket: WebSocket, company_id: str):
        if company_id in self.active_connections:
            if websocket in self.active_connections[company_id]:
                self.active_connections[company_id].remove(websocket)
            if not self.active_connections[company_id]:
                del self.active_connections[company_id]

    async def broadcast(self, message: str, company_id: str):
        if company_id in self.active_connections:
            for connection in self.active_connections[company_id]:
                try:
                    await connection.send_text(message)
                except Exception:
                    pass

manager = ConnectionManager()

async def listen_for_logs():
    """Background task to listen to Redis Pub/Sub for log events and broadcast them."""
    try:
        # Create a dedicated redis connection for pubsub
        pubsub_client = aioredis.from_url(REDIS_URL, decode_responses=True)
        pubsub = pubsub_client.pubsub()
        await pubsub.psubscribe("logs:*")
        
        async for message in pubsub.listen():
            if message["type"] == "pmessage":
                channel = message["channel"]
                data = message["data"]
                # Channel format: logs:{company_id}
                parts = channel.split(":")
                if len(parts) == 2:
                    company_id = parts[1]
                    await manager.broadcast(data, company_id)
    except Exception as e:
        print(f"⚠️ Redis Pub/Sub listener error: {e}")

async def broadcast_log(company_id: str, log_data: dict):
    """Helper to publish log to Redis so it goes to all workers and then to WebSockets."""
    if redis_client:
        await redis_client.publish(f"logs:{company_id}", json.dumps(log_data))

# ─────────────────────────────────────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.websocket("/ws/flow-monitor/{company_id}")
async def websocket_endpoint(websocket: WebSocket, company_id: str):
    # Phase 2: require company-scoped token query param matching path company_id
    token = websocket.query_params.get("token") or websocket.query_params.get("access_token")
    if not token:
        await websocket.close(code=4401)
        return
    # Lightweight check: token must be non-empty JWT-shaped; full verify is gateway's job
    # for browser clients that already authenticated. Path company_id must match claim if present.
    parts = token.split(".")
    if len(parts) != 3:
        await websocket.close(code=4401)
        return
    try:
        import base64
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=="))
        claim_company = payload.get("companyId") or payload.get("company_id")
        if claim_company and str(claim_company) != str(company_id):
            await websocket.close(code=4403)
            return
    except Exception:
        await websocket.close(code=4401)
        return

    await manager.connect(websocket, company_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, company_id)



@app.get("/health")
async def health():
    return {"status": "OK", "service": "orchestrator", "version": "2.0.0"}


async def _build_agent_gather_twiml(agent: dict, state: dict, request: Request) -> str:
    """AI agent speech gather (post-IVR or direct)."""
    agent_lang = "amharic"
    prompt = (agent.get("prompt") or "")
    if "english" in prompt.lower():
        agent_lang = "english"

    voice_config = TWILIO_VOICE_MAP.get(agent_lang, TWILIO_VOICE_MAP["amharic"])
    voice = voice_config["voice"]
    lang_code = voice_config["lang"]
    stt_code = voice_config["stt"]

    name = agent.get("agent_name") or "our assistant"
    welcome_text = (
        "Hello! You've reached {name}. How can I help you today?".format(name=name)
        if agent_lang == "english"
        else "ሰላም፣ እንዴት ልረዳዎ?"
    )

    recording_enabled = bool((state.get("phone_settings") or {}).get("recording_enabled", True))
    record_verbs = ""
    if recording_enabled:
        base = str(request.base_url).rstrip("/")
        record_verbs = f'<Start><Recording recordingStatusCallback="{base}/twilio/recording" /></Start>'

    tts_config = await get_provider_config(
        state["company_id"], "voice", agent.get("voice_provider") or "edge"
    )
    tts_key = tts_config.get("api_key") if tts_config else ""
    audio_url = None
    if agent.get("voice_provider") and agent.get("voice_id"):
        audio_url = await get_audio_url_for_text(
            agent["voice_provider"], agent["voice_id"], welcome_text, tts_key, request
        )

    if audio_url:
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    {record_verbs}
    <Play>{audio_url}</Play>
    <Gather input="speech" action="/twilio/respond" method="POST" speechTimeout="auto" language="{stt_code}">
        <Say voice="{voice}" language="{lang_code}">...</Say>
    </Gather>
    <Redirect>/twilio/respond</Redirect>
</Response>"""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    {record_verbs}
    <Gather input="speech" action="/twilio/respond" method="POST" speechTimeout="auto" language="{stt_code}">
        <Say voice="{voice}" language="{lang_code}">{welcome_text}</Say>
    </Gather>
    <Redirect>/twilio/respond</Redirect>
</Response>"""


@app.post("/incoming-call")
@app.post("/twilio/voice")
async def handle_inbound_call(
    request: Request,
    To: str = Form(...),
    From: str = Form(...),
    CallSid: str = Form(...),
):
    """
    Twilio inbound call webhook.
    Resolve number → optional IVR → agent gather; honor recording toggle.
    """
    print(f"📞 Inbound call: From={From} To={To} SID={CallSid}")

    agent = await get_agent_by_phone(To)

    if not agent:
        twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Sorry, this number is not currently configured. Please try again later.</Say>
    <Hangup/>
</Response>"""
        return PlainTextResponse(content=twiml, media_type="application/xml")

    settings = _parse_phone_settings(agent.get("phone_settings"))
    phone_number_id = str(agent["phone_number_id"]) if agent.get("phone_number_id") else None
    company_id = str(agent["company_id"])
    agent_id = str(agent["agent_id"]) if agent.get("agent_id") else None

    call_id = await create_call_record(company_id, agent_id, From, phone_number_id)
    routing_rules = (
        await get_routing_rules_for_phone(phone_number_id, company_id) if phone_number_id else []
    )

    state = {
        "messages": [{"role": "system", "content": agent.get("prompt") or "You are a helpful voice agent."}],
        "turn_count": 0,
        "call_id": call_id,
        "company_id": company_id,
        "agent_id": agent_id,
        "agent_name": agent.get("agent_name"),
        "voice_provider": agent.get("voice_provider"),
        "voice_id": agent.get("voice_id"),
        "model_provider": agent.get("model_provider"),
        "model_id": agent.get("model_id"),
        "phone_number_id": phone_number_id,
        "phone_settings": settings,
        "routing_rules": routing_rules,
        "caller_number": From,
        "to_number": To,
        "call_sid": CallSid,
    }
    await save_conversation_state(CallSid, state)

    await publish_event("call.started", {
        "tenantId": company_id,
        "callId": call_id,
        "callerNumber": From,
        "agentId": agent_id,
    })

    ivr_enabled = bool(settings.get("ivr_enabled")) or any(
        r.get("digit") is not None or r.get("dtmf") is not None for r in routing_rules
    )

    if ivr_enabled:
        prompt = _ivr_prompt_from_settings(settings, routing_rules)
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather numDigits="1" action="/twilio/ivr" method="POST" timeout="5">
        <Say>{prompt}</Say>
    </Gather>
    <Redirect>/twilio/ivr</Redirect>
</Response>"""
        return PlainTextResponse(content=twiml, media_type="application/xml")

    if not agent_id:
        twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>This number has no agent assigned. Goodbye.</Say>
    <Hangup/>
</Response>"""
        return PlainTextResponse(content=twiml, media_type="application/xml")

    twiml = await _build_agent_gather_twiml(agent, state, request)
    return PlainTextResponse(content=twiml, media_type="application/xml")


@app.post("/twilio/ivr")
async def handle_ivr(
    request: Request,
    CallSid: str = Form(...),
    Digits: str = Form(default=""),
):
    """DTMF IVR: route by digit to agent, transfer, or voicemail."""
    state = await get_conversation_state(CallSid)
    if not state.get("call_id"):
        return PlainTextResponse(
            content='<?xml version="1.0" encoding="UTF-8"?><Response><Say>Session expired.</Say><Hangup/></Response>',
            media_type="application/xml",
        )

    settings = state.get("phone_settings") or {}
    rules = state.get("routing_rules") or []
    digit = (Digits or "").strip()

    matched = None
    for rule in rules:
        d = str(rule.get("digit") if rule.get("digit") is not None else rule.get("dtmf", ""))
        if d and d == digit:
            matched = rule
            break

    action = (matched or {}).get("action") or ("voicemail" if digit == "9" else "agent")

    if action == "voicemail" or digit == "9":
        email = settings.get("voicemail_email") or (matched or {}).get("email")
        state["voicemail_email"] = email
        await save_conversation_state(CallSid, state)
        twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Please leave a message after the tone. Press hash when finished.</Say>
    <Record maxLength="120" playBeep="true" action="/twilio/voicemail" method="POST" finishOnKey="#"/>
    <Say>We did not receive a message. Goodbye.</Say>
    <Hangup/>
</Response>"""
        return PlainTextResponse(content=twiml, media_type="application/xml")

    if action in ("transfer", "human") or (matched and matched.get("to")):
        target = (matched or {}).get("to") or settings.get("transfer_number")
        if target:
            handoff = await _build_transfer_context(state["call_id"], target, reason="ivr")
            await db_pool.execute(
                "UPDATE calls SET transfer_context = $1::jsonb, status = 'transferred' WHERE id = $2",
                json.dumps(handoff), uuid.UUID(state["call_id"]),
            )
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Connecting you to an agent. Your conversation context has been prepared.</Say>
    <Dial>{target}</Dial>
</Response>"""
            return PlainTextResponse(content=twiml, media_type="application/xml")

    agent = {
        "prompt": (state.get("messages") or [{}])[0].get("content"),
        "agent_name": state.get("agent_name"),
        "voice_provider": state.get("voice_provider"),
        "voice_id": state.get("voice_id"),
    }
    twiml = await _build_agent_gather_twiml(agent, state, request)
    return PlainTextResponse(content=twiml, media_type="application/xml")


@app.post("/twilio/voicemail")
async def handle_voicemail(
    request: Request,
    CallSid: str = Form(...),
    RecordingUrl: str = Form(default=""),
    RecordingDuration: str = Form(default="0"),
):
    """Persist voicemail recording and queue voicemail-to-email delivery."""
    state = await get_conversation_state(CallSid)
    call_id = state.get("call_id")
    company_id = state.get("company_id")
    email = state.get("voicemail_email") or (state.get("phone_settings") or {}).get("voicemail_email")

    if call_id and RecordingUrl:
        await db_pool.execute(
            "UPDATE calls SET recording_url = $1, status = 'voicemail', end_time = COALESCE(end_time, NOW()) WHERE id = $2",
            RecordingUrl, uuid.UUID(call_id),
        )
        await save_transcript(
            call_id,
            "system",
            f"Voicemail recorded ({RecordingDuration}s). Delivery queued for {email or 'unconfigured'}.",
        )

    delivery = {
        "to": email,
        "call_id": call_id,
        "company_id": company_id,
        "recording_url": RecordingUrl,
        "caller": state.get("caller_number"),
        "duration": RecordingDuration,
    }
    if email and redis_client:
        await redis_client.lpush("voicemail:email:queue", json.dumps(delivery))
    print(f"📧 Voicemail-to-email queued: {delivery}")

    await publish_event("call.voicemail", {
        "tenantId": company_id,
        "callId": call_id,
        "email": email,
        "recordingUrl": RecordingUrl,
    })

    twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Thank you. Your message has been sent. Goodbye.</Say>
    <Hangup/>
</Response>"""
    return PlainTextResponse(content=twiml, media_type="application/xml")


@app.post("/twilio/recording")
async def handle_recording_callback(
    CallSid: str = Form(default=""),
    RecordingUrl: str = Form(default=""),
):
    """Twilio recording status — attach URL to call."""
    state = await get_conversation_state(CallSid) if CallSid else {}
    call_id = state.get("call_id")
    if call_id and RecordingUrl:
        await db_pool.execute(
            "UPDATE calls SET recording_url = $1 WHERE id = $2",
            RecordingUrl, uuid.UUID(call_id),
        )
    return {"status": "ok"}


async def _build_transfer_context(call_id: str, target: str, reason: str = "api") -> dict:
    """Full conversation handoff package for human agent."""
    call = await db_pool.fetchrow(
        """
        SELECT c.id, c.company_id, c.agent_id, c.caller_number, c.status, c.start_time,
               a.name AS agent_name
        FROM calls c
        LEFT JOIN agents a ON a.id = c.agent_id
        WHERE c.id = $1
        """,
        uuid.UUID(call_id),
    )
    rows = await db_pool.fetch(
        """
        SELECT role, content, created_at
        FROM transcripts
        WHERE call_id = $1
        ORDER BY created_at ASC
        """,
        uuid.UUID(call_id),
    )
    transcript = [
        {
            "role": r["role"],
            "content": r["content"],
            "at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]
    # Merge Redis live messages if present via call_sid on state keyed elsewhere — transcripts are source of truth
    summary_parts = [t["content"] for t in transcript if t["role"] in ("user", "assistant", "agent")][-8:]
    summary = " | ".join(summary_parts) if summary_parts else "No prior dialogue captured."

    return {
        "call_id": call_id,
        "target": target,
        "reason": reason,
        "caller_number": call["caller_number"] if call else None,
        "agent_id": str(call["agent_id"]) if call and call["agent_id"] else None,
        "agent_name": call["agent_name"] if call else None,
        "company_id": str(call["company_id"]) if call else None,
        "started_at": call["start_time"].isoformat() if call and call["start_time"] else None,
        "summary": summary,
        "transcript": transcript,
        "transcript_turns": len(transcript),
    }


@app.post("/handle-input")
@app.post("/twilio/respond")
async def handle_speech_response(
    request: Request,
    CallSid: str = Form(...),
    SpeechResult: str = Form(default=""),
    Confidence: str = Form(default="0"),
):
    """
    Twilio speech recognition result webhook.
    Processes user speech → LLM → TTS → Twilio TwiML.
    """
    print(f"🗣️ SID={CallSid} Speech='{SpeechResult}' Confidence={Confidence}")

    state = await get_conversation_state(CallSid)
    call_id = state.get("call_id")
    company_id = state.get("company_id")

    if not company_id:
        # Fallback if state has expired
        twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Call session expired. Goodbye.</Say>
    <Hangup/>
</Response>"""
        return PlainTextResponse(content=twiml, media_type="application/xml")

    # Detect agent language
    agent_lang = "amharic"
    for msg in state["messages"]:
        if msg["role"] == "system" and "english" in msg["content"].lower():
            agent_lang = "english"
            break

    voice_config = TWILIO_VOICE_MAP.get(agent_lang, TWILIO_VOICE_MAP["amharic"])
    voice = voice_config["voice"]
    lang_code = voice_config["lang"]
    stt_code = voice_config["stt"]

    user_text = SpeechResult.strip()

    # Normalize Amharic characters
    if agent_lang == "amharic":
        user_text = normalize_amharic(user_text)

    # Validate Whisper output (garbage detection / silence)
    if not user_text or (agent_lang == "amharic" and is_garbage_transcription(user_text)):
        retry_msg = get_polite_retry() if agent_lang == "amharic" else "I didn't catch that. Could you please repeat?"
        print(f"🔇 Garbage/Empty input. Prompting retry: {retry_msg}")
        
        # Get TTS configs
        tts_config = await get_provider_config(company_id, "voice", state["voice_provider"])
        tts_key = tts_config.get("api_key") if tts_config else ""
        audio_url = await get_audio_url_for_text(state["voice_provider"], state["voice_id"], retry_msg, tts_key, request)

        if audio_url:
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>{audio_url}</Play>
    <Gather input="speech" action="/twilio/respond" method="POST" speechTimeout="auto" language="{stt_code}">
        <Say voice="{voice}" language="{lang_code}">...</Say>
    </Gather>
</Response>"""
        else:
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" action="/twilio/respond" method="POST" speechTimeout="auto" language="{stt_code}">
        <Say voice="{voice}" language="{lang_code}">{retry_msg}</Say>
    </Gather>
</Response>"""
        return PlainTextResponse(content=twiml, media_type="application/xml")

    # Get LLM API credentials
    llm_config = await get_provider_config(company_id, "llm", state["model_provider"])
    llm_key = llm_config.get("api_key") if llm_config else ""
    if not llm_key:
        # Fallback to system env keys
        if state["model_provider"] == "openai":
            llm_key = os.getenv("OPENAI_API_KEY", "")
        elif state["model_provider"] == "groq":
            llm_key = os.getenv("GROQ_API_KEY", "")
        elif state["model_provider"] == "gemini":
            llm_key = os.getenv("GEMINI_API_KEY", "")

    # Run phonetic repair
    if agent_lang == "amharic":
        user_text = await repair_amharic_transcription(user_text, llm_key)

    # Save user transcript in database
    if call_id:
        await save_transcript(call_id, "user", user_text)

    # Append to messages history
    state["messages"].append({"role": "user", "content": user_text})
    state["turn_count"] += 1

    # RAG Injection
    if company_id and llm_key:
        rag_context = await search_knowledge_chunks(company_id, user_text, llm_key)
        if rag_context:
            rag_message = f"Relevant Knowledge Context:\\n{rag_context}\\n\\nUse this context to answer the user's latest message if applicable."
            state["messages"].append({"role": "system", "content": rag_message})

    # Check Semantic Cache before invoking LLM
    cached_hit = None
    user_emb = None
    if llm_key:
        try:
            user_emb = await get_embedding("openai", "text-embedding-3-small", user_text, llm_key)
            if user_emb:
                cached_hit = await semantic_cache.get(user_emb)
        except Exception as e:
            print(f"Cache lookup exception: {e}")

    if cached_hit:
        ai_text, tokens_used = cached_hit[0], 0
    else:
        # Generate AI response
        try:
            ai_text, tokens_used = await llm_complete(
                provider=state["model_provider"],
                model_id=state["model_id"],
                messages=state["messages"],
                api_key=llm_key
            )
            if user_emb and ai_text:
                await semantic_cache.set(user_emb, ai_text)
        except Exception as e:
            print(f"❌ LLM error: {e}")
            ai_text = "ይቅርታ፣ አሁን መስመር ላይ ችግር አለ። ቆይተው ይደውሉ።" if agent_lang == "amharic" else "I'm having trouble processing your request right now. Please try again."
            tokens_used = 0

    # Save AI transcript in database
    if call_id:
        await save_transcript(call_id, "assistant", ai_text)

    # Append to messages history
    state["messages"].append({"role": "assistant", "content": ai_text})

    # Track usage in Postgres
    if company_id:
        estimated_stt = max(1, len(user_text) // 15)
        await track_usage(
            company_id=company_id,
            llm_tokens=tokens_used,
            stt_seconds=estimated_stt,
            tts_characters=len(ai_text),
            call_minutes=0  # Increment dynamically in stats or status callback
        )

    await save_conversation_state(CallSid, state)

    # Check for end-of-conversation signals
    goodbye_signals = ["goodbye", "bye", "thank you bye", "that's all", "አመሰግናለሁ", "ቻው"]
    is_goodbye = any(signal in user_text.lower() for signal in goodbye_signals)

    # Generate Response Audio Url
    tts_config = await get_provider_config(company_id, "voice", state["voice_provider"])
    tts_key = tts_config.get("api_key") if tts_config else ""
    if not tts_key:
        if state["voice_provider"] == "openai":
            tts_key = os.getenv("OPENAI_API_KEY", "")
        elif state["voice_provider"] == "azure":
            tts_key = os.getenv("AZURE_API_KEY", "")
        elif state["voice_provider"] == "elevenlabs":
            tts_key = os.getenv("ELEVENLABS_API_KEY", "")

    audio_url = await get_audio_url_for_text(state["voice_provider"], state["voice_id"], ai_text, tts_key, request)

    if is_goodbye or state["turn_count"] >= 20:
        # End call TwiML
        if audio_url:
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>{audio_url}</Play>
    <Hangup/>
</Response>"""
        else:
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="{voice}" language="{lang_code}">{ai_text}</Say>
    <Hangup/>
</Response>"""
        
        # Cleanup
        if call_id:
            await end_call_record(call_id)
        await delete_conversation_state(CallSid)
    else:
        # Continue Gather TwiML
        if audio_url:
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>{audio_url}</Play>
    <Gather input="speech" action="/twilio/respond" method="POST" speechTimeout="auto" language="{stt_code}">
        <Say voice="{voice}" language="{lang_code}">...</Say>
    </Gather>
    <Redirect>/twilio/respond</Redirect>
</Response>"""
        else:
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" action="/twilio/respond" method="POST" speechTimeout="auto" language="{stt_code}">
        <Say voice="{voice}" language="{lang_code}">{ai_text}</Say>
    </Gather>
    <Redirect>/twilio/respond</Redirect>
</Response>"""

    return PlainTextResponse(content=twiml, media_type="application/xml")


@app.post("/twilio/status")
async def handle_call_status(
    CallSid: str = Form(...),
    CallStatus: str = Form(...),
    CallDuration: Optional[str] = Form(None),
):
    """Twilio call status callback — cleanup on call end and track usage minutes."""
    print(f"📊 Call status: SID={CallSid} Status={CallStatus} Duration={CallDuration}")

    if CallStatus in ["completed", "failed", "canceled", "busy", "no-answer"]:
        state = await get_conversation_state(CallSid)
        call_id = state.get("call_id")
        company_id = state.get("company_id")
        
        if call_id:
            await publish_event("call.ended", {
                "tenantId": company_id,
                "callId": call_id,
                "status": CallStatus,
                "durationSeconds": int(CallDuration) if CallDuration else 0
            })
            await end_call_record(call_id)
            
            # Save final call minutes metric
            if company_id and CallDuration:
                try:
                    duration_sec = int(CallDuration)
                    minutes = max(1, (duration_sec + 59) // 60)
                    await track_usage(company_id=company_id, call_minutes=minutes)
                except Exception as ex:
                    print(f"Error logging duration: {ex}")

        await delete_conversation_state(CallSid)

    return {"status": "ok"}


# ─────────────────────────────────────────────────────────────────────────────
# Internal API: For dashboard call logs, transcripts, and stats
# ─────────────────────────────────────────────────────────────────────────────

def _tenant_id(request: Request) -> str:
    company_id = request.headers.get("x-company-id") or request.headers.get("x-tenant-id")
    if not company_id:
        raise HTTPException(status_code=401, detail="Company ID header required")
    return company_id


def _serialize_call(r) -> dict:
    return {
        "id": str(r["id"]),
        "agent_id": str(r["agent_id"]) if r.get("agent_id") else None,
        "caller_number": r["caller_number"],
        "status": r["status"],
        "start_time": r["start_time"].isoformat() if r["start_time"] else None,
        "end_time": r["end_time"].isoformat() if r.get("end_time") else None,
        "turn_count": r["turn_count"],
        "recording_url": r.get("recording_url"),
        "agent_name": r.get("agent_name"),
    }


@app.get("/api/calls")
@app.get("/v1/calls")
async def list_calls(request: Request, agent_id: Optional[str] = None, status: Optional[str] = None):
    company_id = _tenant_id(request)
    clauses = ["c.company_id = $1"]
    args = [uuid.UUID(company_id)]
    if agent_id:
        args.append(uuid.UUID(agent_id))
        clauses.append(f"c.agent_id = ${len(args)}")
    if status:
        args.append(status)
        clauses.append(f"c.status = ${len(args)}")

    rows = await db_pool.fetch(
        f"""
        SELECT c.id, c.agent_id, c.caller_number, c.status, c.start_time, c.end_time,
               c.turn_count, c.recording_url, a.name as agent_name
        FROM calls c
        LEFT JOIN agents a ON a.id = c.agent_id
        WHERE {' AND '.join(clauses)}
        ORDER BY c.start_time DESC
        LIMIT 50
        """,
        *args,
    )
    return [_serialize_call(dict(r)) for r in rows]


@app.post("/v1/calls")
async def create_outbound_call(request: Request):
    """
    Place an outbound call (or sandbox simulated call).
    Sandbox (x-markova-env=test or body.sandbox=true): no Twilio spend — records a simulated call.
    """
    company_id = _tenant_id(request)
    body = await request.json()
    agent_id = body.get("agent_id")
    to_number = body.get("to_number")
    sandbox = body.get("sandbox") is True or (request.headers.get("x-markova-env") or "test") == "test"

    if not agent_id or not to_number:
        raise HTTPException(status_code=400, detail="agent_id and to_number are required")

    agent = await db_pool.fetchrow(
        "SELECT id, name FROM agents WHERE id = $1 AND company_id = $2",
        uuid.UUID(agent_id), uuid.UUID(company_id),
    )
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    call_id = uuid.uuid4()
    if sandbox:
        row = await db_pool.fetchrow(
            """
            INSERT INTO calls (id, company_id, agent_id, caller_number, status, turn_count)
            VALUES ($1, $2, $3, $4, 'completed', 0)
            RETURNING id, agent_id, caller_number, status, start_time, end_time, turn_count, recording_url
            """,
            call_id, uuid.UUID(company_id), uuid.UUID(agent_id), to_number,
        )
        agent_line = f"Hello — this is a sandbox test from agent {agent['name']}."
        await db_pool.execute(
            """
            INSERT INTO transcripts (call_id, role, content)
            VALUES ($1, 'system', $2), ($1, 'agent', $3)
            """,
            call_id,
            f"Sandbox test call to {to_number} (no live telephony).",
            agent_line,
        )
        # Meter sandbox activity (visible on /v1/usage; billed=false — no telephony spend)
        await track_usage(
            company_id=company_id,
            call_minutes=1,
            stt_seconds=2,
            tts_characters=len(agent_line),
            llm_tokens=50,
        )
        return {
            **_serialize_call(dict(row)),
            "sandbox": True,
            "billed": False,
            "agent_name": agent["name"],
            "message": "Sandbox call recorded; no Twilio spend.",
            "usage": {
                "call_minutes": 1,
                "stt_seconds": 2,
                "tts_characters": len(agent_line),
                "llm_tokens": 50,
            },
        }

    # Live outbound via Twilio REST if credentials present
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_FROM_NUMBER")
    public_base = os.getenv("PUBLIC_BASE_URL")
    if not all([account_sid, auth_token, from_number, public_base]):
        raise HTTPException(
            status_code=503,
            detail="Live outbound not configured (TWILIO_* / PUBLIC_BASE_URL). Use sandbox test key.",
        )

    row = await db_pool.fetchrow(
        """
        INSERT INTO calls (id, company_id, agent_id, caller_number, status, turn_count)
        VALUES ($1, $2, $3, $4, 'active', 0)
        RETURNING id, agent_id, caller_number, status, start_time, end_time, turn_count, recording_url
        """,
        call_id, uuid.UUID(company_id), uuid.UUID(agent_id), to_number,
    )
    try:
        from twilio.rest import Client
        client = Client(account_sid, auth_token)
        twilio_call = client.calls.create(
            to=to_number,
            from_=from_number,
            url=f"{public_base}/incoming-call",
        )
        return {
            **_serialize_call(dict(row)),
            "sandbox": False,
            "billed": True,
            "provider_call_sid": twilio_call.sid,
            "agent_name": agent["name"],
        }
    except Exception as e:
        await db_pool.execute(
            "UPDATE calls SET status = 'failed', end_time = NOW() WHERE id = $1",
            call_id,
        )
        raise HTTPException(status_code=502, detail=f"Twilio outbound failed: {e}")


@app.get("/v1/calls/{call_id}")
async def get_call(call_id: str, request: Request):
    company_id = _tenant_id(request)
    row = await db_pool.fetchrow(
        """
        SELECT c.id, c.agent_id, c.caller_number, c.status, c.start_time, c.end_time,
               c.turn_count, c.recording_url, a.name as agent_name
        FROM calls c
        LEFT JOIN agents a ON a.id = c.agent_id
        WHERE c.id = $1 AND c.company_id = $2
        """,
        uuid.UUID(call_id), uuid.UUID(company_id),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Call not found")
    return _serialize_call(dict(row))


@app.get("/api/calls/{call_id}/transcript")
@app.get("/v1/calls/{call_id}/transcript")
async def get_transcript(call_id: str, request: Request):
    company_id = _tenant_id(request)

    call = await db_pool.fetchrow(
        "SELECT id FROM calls WHERE id = $1 AND company_id = $2",
        uuid.UUID(call_id), uuid.UUID(company_id)
    )
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    rows = await db_pool.fetch(
        "SELECT role, content, created_at FROM transcripts WHERE call_id = $1 ORDER BY created_at ASC",
        uuid.UUID(call_id)
    )
    return [
        {
            "role": r["role"],
            "content": r["content"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None
        }
        for r in rows
    ]


@app.get("/v1/calls/{call_id}/recording")
async def get_recording(call_id: str, request: Request):
    company_id = _tenant_id(request)
    row = await db_pool.fetchrow(
        "SELECT id, recording_url FROM calls WHERE id = $1 AND company_id = $2",
        uuid.UUID(call_id), uuid.UUID(company_id),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Call not found")
    if not row["recording_url"]:
        return {"id": call_id, "recording_url": None, "available": False}
    return {"id": call_id, "recording_url": row["recording_url"], "available": True}


@app.post("/v1/calls/{call_id}/transfer")
async def transfer_call(call_id: str, request: Request):
    """
    Transfer to human/queue with full conversation context persisted on the call
    and returned to the caller for CRM / agent desktop handoff.
    """
    company_id = _tenant_id(request)
    body = await request.json()
    target = body.get("to") or body.get("queue") or body.get("target")
    if not target:
        raise HTTPException(status_code=400, detail="to / queue / target is required")

    row = await db_pool.fetchrow(
        "SELECT id, status FROM calls WHERE id = $1 AND company_id = $2",
        uuid.UUID(call_id), uuid.UUID(company_id),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Call not found")

    # Optionally merge the latest Redis turn if call_sid provided (avoid system prompt)
    call_sid = body.get("call_sid")
    if call_sid:
        state = await get_conversation_state(call_sid)
        existing = await db_pool.fetchval(
            "SELECT COUNT(*) FROM transcripts WHERE call_id = $1", uuid.UUID(call_id)
        )
        if int(existing or 0) == 0:
            for msg in state.get("messages") or []:
                if msg.get("role") in ("user", "assistant") and msg.get("content"):
                    await save_transcript(call_id, msg["role"], msg["content"])

    handoff = await _build_transfer_context(call_id, target, reason=body.get("reason") or "api")
    if body.get("notes"):
        handoff["notes"] = body["notes"]

    await db_pool.execute(
        """
        UPDATE calls
        SET status = 'transferred',
            end_time = COALESCE(end_time, NOW()),
            transfer_context = $1::jsonb
        WHERE id = $2
        """,
        json.dumps(handoff),
        uuid.UUID(call_id),
    )
    await db_pool.execute(
        "INSERT INTO transcripts (call_id, role, content) VALUES ($1, 'system', $2)",
        uuid.UUID(call_id),
        f"Call transferred to {target}. Handoff summary: {handoff.get('summary', '')[:500]}",
    )

    await publish_event("call.transferred", {
        "tenantId": company_id,
        "callId": call_id,
        "target": target,
        "transcriptTurns": handoff.get("transcript_turns"),
        "summary": handoff.get("summary"),
    })

    if redis_client:
        await redis_client.setex(
            f"transfer:{call_id}",
            86400,
            json.dumps(handoff),
        )

    return {
        "id": call_id,
        "status": "transferred",
        "target": target,
        "context": handoff,
        "webhook_event": "call.transferred",
    }


@app.get("/v1/calls/{call_id}/transfer-context")
async def get_transfer_context(call_id: str, request: Request):
    company_id = _tenant_id(request)
    row = await db_pool.fetchrow(
        "SELECT transfer_context FROM calls WHERE id = $1 AND company_id = $2",
        uuid.UUID(call_id), uuid.UUID(company_id),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Call not found")
    ctx = row["transfer_context"]
    if isinstance(ctx, str):
        ctx = json.loads(ctx)
    return {"id": call_id, "context": ctx, "available": bool(ctx)}


@app.get("/api/stats")
async def get_stats(request: Request):
    company_id = request.headers.get("x-company-id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Company ID header required")

    company_uuid = uuid.UUID(company_id)
    
    # Call stats
    total_calls = await db_pool.fetchval(
        "SELECT COUNT(*) FROM calls WHERE company_id = $1", company_uuid
    )
    active_calls = await db_pool.fetchval(
        "SELECT COUNT(*) FROM calls WHERE company_id = $1 AND status = 'active'", company_uuid
    )
    completed_calls = await db_pool.fetchval(
        "SELECT COUNT(*) FROM calls WHERE company_id = $1 AND status = 'completed'", company_uuid
    )

    # Usage totals
    usage = await db_pool.fetchrow(
        """
        SELECT 
            COALESCE(SUM(llm_tokens), 0) as total_tokens,
            COALESCE(SUM(call_minutes), 0) as total_minutes
        FROM usage_metrics WHERE company_id = $1
        """,
        company_uuid
    )

    return {
        "total_calls": total_calls or 0,
        "active_calls": active_calls or 0,
        "completed_calls": completed_calls or 0,
        "total_tokens": usage["total_tokens"] if usage else 0,
        "total_minutes": usage["total_minutes"] if usage else 0,
    }
