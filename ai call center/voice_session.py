"""
Markova OS v3.0 — Voice Session Bridge for Test Sandbox & Live Calls
─────────────────────────────────────────────────────────────────────────────
Manages turn-by-turn conversational state, streaming audio transcription (STT),
LLM reasoning with agent system prompts, and speech synthesis (TTS).
─────────────────────────────────────────────────────────────────────────────
"""

import os
import io
import json
import asyncio
import tempfile
from typing import Any, AsyncGenerator, Dict, List, Optional
import httpx
import structlog

logger = structlog.get_logger("markova.voice_session")

AMHARIC_PROMPT_HINT = "ሰላም የደንበኞች አገልግሎት ድጋፍ ነኝ። ሶፋ ወንበር አልጋ ዋጋ ክፍያ"

GROQ_MODEL_MAP = {
    "llama-3.3-70b-versatile": "groq/compound-mini",
    "llama-3.1-70b-versatile": "groq/compound-mini",
    "llama-3.1-8b-instant": "groq/compound-mini",
    "llama3-70b-8192": "groq/compound-mini",
    "llama3-8b-8192": "groq/compound-mini",
}

NOISE_TOKENS = {
    "[noise]", "(noise)", "[silence]", "(silence)", 
    "[cough]", "(cough)", "[laughter]", "(laughter)", 
    "[clears throat]", "(clears throat)", "[gasp]", 
    "[music]", "(music)", "[applause]", "(applause)",
    "[inaudible]", "(inaudible)", "...", "…", "noise"
}


class VoiceSession:
    def __init__(self, http_client: Optional[httpx.AsyncClient] = None):
        self.http_client = http_client or httpx.AsyncClient(timeout=30.0)
        self._owns_client = http_client is None
        self.session_id: str = ""
        self.config: Dict[str, Any] = {}
        self.conversation_history: List[Dict[str, str]] = []
        self.is_active: bool = False

        # Provider keys from environment
        self.elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY", "")
        self.groq_api_key = os.getenv("GROQ_API_KEY", "")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "")

    async def start(self, session_id: str, config: Dict[str, Any]):
        """Initializes conversation state and system prompt."""
        self.session_id = session_id
        self.config = config or {}
        self.is_active = True

        system_prompt = self.config.get("prompt") or (
            "You are Markova, a helpful and polite AI voice assistant for Markova AI Call Center. "
            "Respond concisely and naturally in Amharic (or English if addressed in English). "
            "Keep voice responses short and easy to listen to (1-2 sentences max)."
        )

        self.conversation_history = [
            {"role": "system", "content": system_prompt}
        ]
        logger.info("voice_session_started", session_id=session_id, agent_name=self.config.get("name"))

    async def process_audio(self, audio_data: bytes) -> Optional[str]:
        """Transcribes incoming audio bytes using STT cascade (ElevenLabs -> Groq -> OpenAI)."""
        if not audio_data or len(audio_data) < 100:
            return None

        # 1. Primary STT: ElevenLabs Scribe v2
        if self.elevenlabs_api_key and not self.elevenlabs_api_key.startswith("your_"):
            try:
                files = {"file": ("input.wav", audio_data, "audio/wav")}
                data = {"model_id": "scribe_v2", "language_code": "am"}
                resp = await self.http_client.post(
                    "https://api.elevenlabs.io/v1/speech-to-text",
                    headers={"xi-api-key": self.elevenlabs_api_key},
                    files=files,
                    data=data,
                    timeout=20.0
                )
                if resp.status_code == 200:
                    text = resp.json().get("text", "").strip()
                    if text:
                        logger.info("stt_success_elevenlabs", session_id=self.session_id, text=text)
                        return text
            except Exception as e:
                logger.warning("stt_elevenlabs_failed", error=str(e), session_id=self.session_id)

        # 2. Secondary STT: Groq Whisper Large v3 Turbo
        if self.groq_api_key and not self.groq_api_key.startswith("your_"):
            try:
                files = {"file": ("input.wav", audio_data, "audio/wav")}
                data = {
                    "model": "whisper-large-v3-turbo",
                    "language": "am",
                    "prompt": AMHARIC_PROMPT_HINT
                }
                resp = await self.http_client.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {self.groq_api_key}"},
                    files=files,
                    data=data,
                    timeout=15.0
                )
                if resp.status_code == 200:
                    text = resp.json().get("text", "").strip()
                    if text:
                        logger.info("stt_success_groq", session_id=self.session_id, text=text)
                        return text
            except Exception as e:
                logger.warning("stt_groq_failed", error=str(e), session_id=self.session_id)

        # 3. Emergency Fallback: OpenAI Whisper-1
        if self.openai_api_key and not self.openai_api_key.startswith("your_"):
            try:
                files = {"file": ("input.wav", audio_data, "audio/wav")}
                data = {
                    "model": "whisper-1",
                    "language": "am",
                    "prompt": AMHARIC_PROMPT_HINT
                }
                resp = await self.http_client.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {self.openai_api_key}"},
                    files=files,
                    data=data,
                    timeout=15.0
                )
                if resp.status_code == 200:
                    text = resp.json().get("text", "").strip()
                    if text:
                        logger.info("stt_success_openai", session_id=self.session_id, text=text)
                        return text
            except Exception as e:
                logger.warning("stt_openai_failed", error=str(e), session_id=self.session_id)

        return None

    async def process_text(self, text: str) -> AsyncGenerator[bytes, None]:
        """Generates LLM response and streams synthesized TTS audio bytes back."""
        cleaned = text.strip() if text else ""
        if not cleaned or cleaned.lower() in NOISE_TOKENS:
            logger.info("ignoring_noise_transcript", session_id=self.session_id, text=cleaned)
            return

        self.conversation_history.append({"role": "user", "content": cleaned})

        # 1. Generate text response via LLM
        assistant_reply = await self._generate_llm_response()
        self.conversation_history.append({"role": "assistant", "content": assistant_reply})
        logger.info("llm_response_generated", session_id=self.session_id, reply=assistant_reply)

        # 2. Synthesize audio with TTS and yield chunks
        async for audio_chunk in self._synthesize_tts(assistant_reply):
            yield audio_chunk

    async def _generate_llm_response(self) -> str:
        """Calls Groq, Gemini, or OpenAI chat completions API with automatic model mapping and fallbacks."""
        model_provider = (self.config.get("model_provider") or "groq").lower()
        requested_model = self.config.get("model_id") or "groq/compound-mini"
        temperature = float(self.config.get("temperature", 0.3))

        # 1. Groq path (primary for voice due to ultra-low latency)
        if (model_provider == "groq" or self.groq_api_key) and not self.groq_api_key.startswith("your_"):
            mapped_model = GROQ_MODEL_MAP.get(requested_model, requested_model)
            groq_candidates = [mapped_model]
            for alt in ["groq/compound-mini", "groq/compound", "qwen/qwen3.6-27b"]:
                if alt not in groq_candidates:
                    groq_candidates.append(alt)

            for g_model in groq_candidates:
                try:
                    payload = {
                        "model": g_model,
                        "messages": self.conversation_history[-10:],
                        "temperature": temperature,
                        "max_tokens": 150
                    }
                    resp = await self.http_client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={"Authorization": f"Bearer {self.groq_api_key}", "Content-Type": "application/json"},
                        json=payload,
                        timeout=12.0
                    )
                    if resp.status_code == 200:
                        content = resp.json()["choices"][0]["message"]["content"].strip()
                        if content:
                            return content
                    else:
                        logger.warning("groq_model_attempt_failed", model=g_model, status=resp.status_code, body=resp.text[:150])
                except Exception as e:
                    logger.warning("groq_model_exception", model=g_model, error=str(e))

        # 2. Google Gemini fallback / direct provider (flawless native Amharic capability)
        if self.gemini_api_key and not self.gemini_api_key.startswith("your_"):
            gemini_models = ["gemini-flash-latest", "gemini-3.6-flash", "gemini-2.5-flash-lite"]
            system_text = ""
            contents = []
            for msg in self.conversation_history[-10:]:
                if msg["role"] == "system":
                    system_text = msg["content"]
                elif msg["role"] == "user":
                    contents.append({"role": "user", "parts": [{"text": msg["content"]}]})
                elif msg["role"] == "assistant":
                    contents.append({"role": "model", "parts": [{"text": msg["content"]}]})

            for g_model in gemini_models:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{g_model}:generateContent?key={self.gemini_api_key}"
                    gemini_payload = {
                        "contents": contents,
                        "generationConfig": {
                            "maxOutputTokens": 150,
                            "temperature": temperature
                        }
                    }
                    if system_text:
                        gemini_payload["system_instruction"] = {"parts": [{"text": system_text}]}

                    resp = await self.http_client.post(url, json=gemini_payload, timeout=12.0)
                    if resp.status_code == 200:
                        candidates = resp.json().get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts and "text" in parts[0]:
                                text_reply = parts[0]["text"].strip()
                                if text_reply:
                                    logger.info("gemini_llm_success", model=g_model)
                                    return text_reply
                    else:
                        logger.warning("gemini_model_attempt_failed", model=g_model, status=resp.status_code, body=resp.text[:150])
                except Exception as e:
                    logger.warning("gemini_model_exception", model=g_model, error=str(e))

        # 3. OpenAI fallback
        if self.openai_api_key and not self.openai_api_key.startswith("your_"):
            try:
                payload = {
                    "model": "gpt-4o-mini",
                    "messages": self.conversation_history[-10:],
                    "temperature": temperature,
                    "max_tokens": 150
                }
                resp = await self.http_client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {self.openai_api_key}", "Content-Type": "application/json"},
                    json=payload,
                    timeout=12.0
                )
                if resp.status_code == 200:
                    return resp.json()["choices"][0]["message"]["content"].strip()
                else:
                    logger.warning("openai_failed", status=resp.status_code, body=resp.text[:150])
            except Exception as e:
                logger.warning("llm_openai_failed", error=str(e))

        # Emergency Fallback if all LLM providers fail
        logger.error("all_llm_providers_failed", session_id=self.session_id)
        return "ይቅርታ፣ አሁን መልስ መስጠት አልቻልኩም። እባክዎ ጥያቄዎን በድጋሚ ይጠይቁኝ።"


    async def _synthesize_tts(self, text: str) -> AsyncGenerator[bytes, None]:
        """Synthesizes speech using edge-tts (primary) or ElevenLabs / gTTS."""
        voice_id = self.config.get("voice_id") or "am-ET-MekdesNeural"

        # Edge-TTS
        try:
            import edge_tts
            communicate = edge_tts.Communicate(text, voice_id)
            audio_buffer = bytearray()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_buffer.extend(chunk["data"])
            if audio_buffer:
                yield bytes(audio_buffer)
                return
        except Exception as edge_err:
            logger.warning("edge_tts_failed_trying_fallback", error=str(edge_err))

        # Fallback: ElevenLabs TTS if configured
        if self.elevenlabs_api_key and not self.elevenlabs_api_key.startswith("your_"):
            try:
                el_voice = "21m00Tcm4TlvDq8ikWAM"  # Rachel
                url = f"https://api.elevenlabs.io/v1/text-to-speech/{el_voice}/stream"
                headers = {"xi-api-key": self.elevenlabs_api_key, "Content-Type": "application/json"}
                payload = {"text": text, "model_id": "eleven_multilingual_v2"}
                audio_buffer = bytearray()
                async with self.http_client.stream("POST", url, headers=headers, json=payload, timeout=20.0) as resp:
                    if resp.status_code == 200:
                        async for chunk in resp.aiter_bytes():
                            audio_buffer.extend(chunk)
                        if audio_buffer:
                            yield bytes(audio_buffer)
                            return
            except Exception as el_err:
                logger.warning("elevenlabs_tts_failed", error=str(el_err))

    async def end(self):
        """Terminates session and frees resources."""
        self.is_active = False
        if self._owns_client:
            await self.http_client.aclose()
        logger.info("voice_session_ended", session_id=self.session_id)
