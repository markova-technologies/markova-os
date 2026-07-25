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
import json
import os
import re
import tempfile
import time
import uuid
from contextlib import asynccontextmanager
from typing import Optional, Tuple

import asyncpg
import httpx
import redis.asyncio as aioredis
from dotenv import load_dotenv
from fastapi import FastAPI, Form, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://markova:markova_pass@postgres:5432/markova_db")
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
            pn.phone_number,
            pn.company_id,
            a.id as agent_id,
            a.name as agent_name,
            a.prompt,
            a.voice_provider,
            a.voice_id,
            a.model_provider,
            a.model_id
        FROM phone_numbers pn
        JOIN agents a ON a.id = pn.agent_id
        WHERE pn.phone_number = $1 AND pn.status = 'active'
        """,
        phone_number
    )
    return dict(row) if row else None


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
        return json.loads(config) if isinstance(config, str) else config
    return None


async def create_call_record(company_id: str, agent_id: str, caller_number: str) -> str:
    """Create a call record and return its ID."""
    call_id = uuid.uuid4()
    await db_pool.execute(
        """
        INSERT INTO calls (id, company_id, agent_id, caller_number, status, turn_count)
        VALUES ($1, $2, $3, $4, 'active', 0)
        """,
        call_id, uuid.UUID(company_id), uuid.UUID(agent_id) if agent_id else None, caller_number
    )
    return str(call_id)


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
    """Record usage metrics per call."""
    await db_pool.execute(
        """
        INSERT INTO usage_metrics (id, company_id, llm_tokens, stt_seconds, tts_characters, call_minutes)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        uuid.uuid4(), uuid.UUID(company_id), llm_tokens, stt_seconds, tts_characters, call_minutes
    )

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
# ADAPTERS: LLM
# ─────────────────────────────────────────────────────────────────────────────

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
    else:
        # Fallback to edge
        return await _edge_tts(voice_id or "am-ET-MekdesNeural", text)


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
    import edge_tts
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
            import subprocess
            wav_name = tmp_name.replace(".mp3", ".wav")
            subprocess.run(
                ['ffmpeg', '-y', '-i', tmp_name, '-ar', '16000', '-ac', '1', wav_name],
                check=True, capture_output=True, timeout=10
            )
            with open(wav_name, "rb") as f:
                wav_bytes = f.read()
            try:
                os.unlink(wav_name)
            except:
                pass
            return wav_bytes
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
_retry_index = 0


def get_polite_retry() -> str:
    global _retry_index
    response = POLITE_RETRY_RESPONSES[_retry_index % len(POLITE_RETRY_RESPONSES)]
    _retry_index += 1
    return response


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
    await manager.connect(websocket, company_id)
    try:
        while True:
            # We don't expect client to send much, but keep the connection open
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, company_id)



@app.get("/health")
async def health():
    return {"status": "OK", "service": "orchestrator", "version": "2.0.0"}


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
    Step 1: Identify agent → Step 2: Create call record → Step 3: Gather speech
    """
    print(f"📞 Inbound call: From={From} To={To} SID={CallSid}")

    # Look up which agent owns this number
    agent = await get_agent_by_phone(To)

    if not agent:
        # No agent configured for this number
        twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Sorry, this number is not currently configured. Please try again later.</Say>
    <Hangup/>
</Response>"""
        return PlainTextResponse(content=twiml, media_type="application/xml")

    # Create call record in DB
    call_id = await create_call_record(
        str(agent["company_id"]),
        str(agent["agent_id"]),
        From
    )

    # Initialize conversation state
    state = {
        "messages": [{"role": "system", "content": agent["prompt"]}],
        "turn_count": 0,
        "call_id": call_id,
        "company_id": str(agent["company_id"]),
        "agent_id": str(agent["agent_id"]),
        "agent_name": agent["agent_name"],
        "voice_provider": agent["voice_provider"],
        "voice_id": agent["voice_id"],
        "model_provider": agent["model_provider"],
        "model_id": agent["model_id"],
    }
    await save_conversation_state(CallSid, state)

    await publish_event("call.started", {
        "tenantId": str(agent["company_id"]),
        "callId": call_id,
        "callerNumber": From,
        "agentId": str(agent["agent_id"])
    })

    # Language mapping
    agent_lang = "amharic"
    if "english" in agent["prompt"].lower():
        agent_lang = "english"

    voice_config = TWILIO_VOICE_MAP.get(agent_lang, TWILIO_VOICE_MAP["amharic"])
    voice = voice_config["voice"]
    lang_code = voice_config["lang"]
    stt_code = voice_config["stt"]

    welcome_text = "ሰላም፣ ጂኤም ፈርኒቸር ነው። እንዴት ልረዳዎ?" if agent_lang == "amharic" else f"Hello! You've reached {agent['agent_name']}. How can I help you today?"
    
    # Try generating natural voice file
    tts_config = await get_provider_config(state["company_id"], "voice", agent["voice_provider"])
    tts_key = tts_config.get("api_key") if tts_config else ""
    
    audio_url = await get_audio_url_for_text(agent["voice_provider"], agent["voice_id"], welcome_text, tts_key, request)

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
        <Say voice="{voice}" language="{lang_code}">{welcome_text}</Say>
    </Gather>
    <Redirect>/twilio/respond</Redirect>
</Response>"""

    return PlainTextResponse(content=twiml, media_type="application/xml")


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

    # Generate AI response
    try:
        ai_text, tokens_used = await llm_complete(
            provider=state["model_provider"],
            model_id=state["model_id"],
            messages=state["messages"],
            api_key=llm_key
        )
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
        await track_usage(
            company_id=company_id,
            llm_tokens=tokens_used,
            stt_seconds=3,
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

@app.get("/api/calls")
async def list_calls(request: Request):
    company_id = request.headers.get("x-company-id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Company ID header required")

    rows = await db_pool.fetch(
        """
        SELECT c.id, c.caller_number, c.status, c.start_time, c.end_time,
               c.turn_count, a.name as agent_name
        FROM calls c
        LEFT JOIN agents a ON a.id = c.agent_id
        WHERE c.company_id = $1
        ORDER BY c.start_time DESC
        LIMIT 50
        """,
        uuid.UUID(company_id)
    )
    return [
        {
            "id": str(r["id"]),
            "caller_number": r["caller_number"],
            "status": r["status"],
            "start_time": r["start_time"].isoformat() if r["start_time"] else None,
            "end_time": r["end_time"].isoformat() if r["end_time"] else None,
            "turn_count": r["turn_count"],
            "agent_name": r["agent_name"]
        }
        for r in rows
    ]


@app.get("/api/calls/{call_id}/transcript")
async def get_transcript(call_id: str, request: Request):
    company_id = request.headers.get("x-company-id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Company ID header required")

    # Verify call belongs to company
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
