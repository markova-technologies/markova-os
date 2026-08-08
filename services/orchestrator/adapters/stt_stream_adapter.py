"""
Streaming STT adapter.
For English: Uses Deepgram WebSockets API for true streaming STT.
For Amharic: Falls back to Hasab AI batch endpoint with a VAD collection window.
"""
import asyncio
import audioop
import base64
import os
import wave
import io
import json
import httpx
import structlog
from typing import AsyncGenerator, Optional

logger = structlog.get_logger()

# Deepgram WebSockets
try:
    import websockets
except ImportError:
    websockets = None

class DeepgramSTTStream:
    """True streaming STT via Deepgram WebSockets."""
    def __init__(self, lang: str = "en"):
        self.api_key = os.getenv("DEEPGRAM_API_KEY", "")
        self.lang = lang
        self.ws = None
        self._connected = False
        
    async def connect(self):
        if not self.api_key:
            raise ValueError("DEEPGRAM_API_KEY not set")
        if not websockets:
            raise ImportError("websockets library is not installed")
            
        url = f"wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=8000&channels=1&language={self.lang}&endpointing=500&smart_format=true"
        self.ws = await websockets.connect(
            url,
            extra_headers={"Authorization": f"Token {self.api_key}"}
        )
        self._connected = True
        logger.info("deepgram_stt_ws_connected", lang=self.lang)
        
    async def send_audio(self, pcm_data: bytes):
        if self._connected and self.ws:
            try:
                await self.ws.send(pcm_data)
            except websockets.exceptions.ConnectionClosed:
                self._connected = False
                
    async def receive_transcripts(self) -> AsyncGenerator[str, None]:
        """Yields completed transcripts as they are finalized by endpointing."""
        if not self._connected or not self.ws:
            return
            
        try:
            async for msg in self.ws:
                data = json.loads(msg)
                if data.get("type") == "Results":
                    is_final = data.get("is_final", False)
                    alts = data.get("channel", {}).get("alternatives", [])
                    if is_final and alts:
                        transcript = alts[0].get("transcript", "").strip()
                        if transcript:
                            yield transcript
        except websockets.exceptions.ConnectionClosed:
            self._connected = False
            
    async def close(self):
        if self._connected and self.ws:
            try:
                await self.ws.send(json.dumps({"type": "CloseStream"}))
                await self.ws.close()
            except Exception:
                pass
        self._connected = False

# Batch fallback methods
async def transcribe_stream(pcm_bytes: bytes, company_id: str, lang: str = "en") -> str:
    """
    Fallback method for chunk-based STT (Amharic or English REST fallback).
    """
    from opentelemetry import trace
    tracer = trace.get_tracer("markova.orchestrator.stt")
    with tracer.start_as_current_span("stt_transcribe_stream") as span:
        span.set_attribute("stt.lang", lang)
        span.set_attribute("stt.company_id", company_id)
        span.set_attribute("stt.pcm_bytes_len", len(pcm_bytes))
        try:
            from services.orchestrator.circuit_breaker import stt_breaker
            if lang == "am" or lang == "amharic":
                result = await stt_breaker.call(_transcribe_hasab_batch, pcm_bytes)
            else:
                result = await stt_breaker.call(_transcribe_deepgram_rest, pcm_bytes, lang)
            
            span.set_attribute("stt.transcript_len", len(result))
            return result
        except Exception as e:
            span.record_exception(e)
            span.set_status(trace.StatusCode.ERROR)
            raise

async def _transcribe_deepgram_rest(pcm_bytes: bytes, lang: str = "en") -> str:
    api_key = os.getenv("DEEPGRAM_API_KEY", "")
    if not api_key:
        return ""
    wav_bytes = _pcm_to_wav(pcm_bytes, sample_rate=8000, channels=1, sample_width=2)
    headers = {"Authorization": f"Token {api_key}", "Content-Type": "audio/wav"}
    params = {"model": "nova-2", "language": lang, "smart_format": "true"}
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post("https://api.deepgram.com/v1/listen", headers=headers, params=params, content=wav_bytes)
        resp.raise_for_status()
        data = resp.json()
        alternatives = data["results"]["channels"][0]["alternatives"]
        if not alternatives:
            return ""
        transcript = alternatives[0]["transcript"]
        confidence = alternatives[0].get("confidence", 0)
        if confidence < 0.5:
            return ""
        return transcript.strip()

async def _transcribe_hasab_batch(pcm_bytes: bytes) -> str:
    api_key = os.getenv("HASAB_API_KEY", "")
    api_url = os.getenv("HASAB_API_URL", "https://api.hasab.ai/api/v1/upload-audio")
    if not api_key:
        return ""
    wav_bytes = _pcm_to_wav(pcm_bytes, sample_rate=8000, channels=1, sample_width=2)
    async with httpx.AsyncClient(timeout=15.0) as client:
        files = {"audio": ("audio.wav", wav_bytes, "audio/wav")}
        data = {"transcribe": "true", "translate": "false", "language": "am"}
        resp = await client.post(api_url, headers={"Authorization": f"Bearer {api_key}"}, files=files, data=data)
        resp.raise_for_status()
        result = resp.json()
        text = result.get("transcription") or result.get("text") or result.get("result", {}).get("transcription", "")
        return str(text).strip() if text else ""

def _pcm_to_wav(pcm_bytes: bytes, sample_rate: int, channels: int, sample_width: int) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)
    return buf.getvalue()
