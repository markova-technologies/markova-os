"""
Streaming TTS adapter.
Yields μ-law audio chunks as they are synthesized.
Primary: ElevenLabs streaming endpoint.
Fallback: Edge TTS (batch, but free).
"""
import os
import asyncio
import audioop
from typing import AsyncGenerator
import httpx
import structlog

logger = structlog.get_logger()

MULAW_CHUNK_BYTES = 160 * 20  # 20ms of μ-law audio at 8kHz = 160 bytes per ms × 20ms

async def synthesize_stream_mulaw(
    text: str,
    company_id: str,
    voice_id: str = "",
    provider: str = "elevenlabs"
) -> AsyncGenerator[bytes, None]:
    """
    Yields μ-law encoded audio chunks suitable for Twilio Media Streams.
    Each chunk is MULAW_CHUNK_BYTES bytes = 20ms of audio.
    """
    from opentelemetry import trace
    tracer = trace.get_tracer("markova.orchestrator.tts")
    with tracer.start_as_current_span("tts_synthesize_stream") as span:
        span.set_attribute("tts.provider", provider)
        span.set_attribute("tts.text_length", len(text))
        try:
            from services.orchestrator.circuit_breaker import tts_breaker
            if provider == "elevenlabs":
                async for chunk in tts_breaker.call_generator(_elevenlabs_stream, text, voice_id):
                    # Convert MP3 chunk → μ-law
                    mulaw = await _mp3_chunk_to_mulaw(chunk)
                    if mulaw:
                        # Emit in 20ms frames
                        for i in range(0, len(mulaw), MULAW_CHUNK_BYTES):
                            yield mulaw[i:i + MULAW_CHUNK_BYTES]
            else:
                # Fallback: Edge TTS (full synthesis, then chunk)
                audio_bytes = await tts_breaker.call(_edge_tts_full, text, voice_id)
                mulaw = audioop.lin2ulaw(audio_bytes, 2)
                for i in range(0, len(mulaw), MULAW_CHUNK_BYTES):
                    yield mulaw[i:i + MULAW_CHUNK_BYTES]
            span.set_status(trace.StatusCode.OK)
        except Exception as e:
            span.record_exception(e)
            span.set_status(trace.StatusCode.ERROR)
            raise

async def _elevenlabs_stream(text: str, voice_id: str) -> AsyncGenerator[bytes, None]:
    """
    Streams audio from ElevenLabs text-to-speech streaming endpoint.
    Returns raw MP3 bytes in chunks as they arrive.
    """
    api_key = os.getenv("ELEVENLABS_API_KEY", "")
    vid = voice_id or os.getenv("ELEVENLABS_DEFAULT_VOICE_ID", "pNInz6obpgDQGcFmaJcg")
    
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{vid}/stream"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    payload = {
        "text": text,
        "model_id": "eleven_turbo_v2_5",   # Turbo model has lowest latency
        "output_format": "pcm_8000",         # Request 8kHz PCM directly (no MP3 decode needed)
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
        }
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as resp:
            resp.raise_for_status()
            async for chunk in resp.aiter_bytes(chunk_size=4096):
                if chunk:
                    yield chunk

async def _mp3_chunk_to_mulaw(mp3_chunk: bytes) -> bytes:
    """
    Convert MP3/PCM chunk to μ-law.
    If output_format=pcm_8000 is used in ElevenLabs, input is already PCM.
    """
    # If ElevenLabs returns raw 16-bit PCM at 8kHz (output_format=pcm_8000):
    try:
        mulaw = audioop.lin2ulaw(mp3_chunk, 2)
        return mulaw
    except audioop.error:
        # If it's MP3, we need pydub or ffmpeg to decode (rare fallback)
        return b""

async def _edge_tts_full(text: str, voice_id: str) -> bytes:
    """Edge TTS full synthesis — used as fallback when ElevenLabs is unavailable."""
    import edge_tts
    import tempfile
    import os as _os
    communicate = edge_tts.Communicate(text, voice_id or "en-US-GuyNeural")
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as fp:
        temp_path = fp.name
    await communicate.save(temp_path)
    with open(temp_path, "rb") as f:
        data = f.read()
    _os.remove(temp_path)
    return data
