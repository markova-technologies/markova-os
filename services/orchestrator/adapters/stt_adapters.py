import os
import httpx
from core.ports.stt_port import STTPort

WHISPER_PROMPT = (
    "ሰላም የጂኤም ፈርኒቸር ደንበኛ ድጋፍ ነኝ። ሶፋ ዋጋ how much ነው? discount አለ? delivery free ነው? "
    "ወንበር price ስንት ነው? installation included ነው? "
    "አልጋ ጠረጴዛ ካቢኔ ዋርድሮብ መደርደሪያ ቲቪ ስታንድ ኪንግ ሳይዝ ኩዊን ኤል ቅርጽ ስዊቬል "
    "ሾሩም location Bole ቄራ Piassa ቶርሃይሎች ጉርድ ሾላ አለምገና። "
    "ዋጋ ብር ክፍያ ቅጣፍ ባንክ ዋስትና ትዕዛዝ order furniture desk chair bed style"
)

class UnifiedSTT(STTPort):
    """
    Unified STT transcription adapter dispatcher.
    """
    async def transcribe(self, provider: str, model_id: str, audio_bytes: bytes, filename: str, api_key: str, lang: str = "am") -> str:
        if provider == "hasab":
            return await self._hasab_stt(audio_bytes, filename, api_key, lang)
        elif provider == "elevenlabs":
            return await self._elevenlabs_stt(audio_bytes, filename, api_key, lang)
        elif provider == "openai":
            return await self._openai_stt(model_id, audio_bytes, filename, api_key, lang)
        elif provider == "groq":
            return await self._groq_stt(model_id, audio_bytes, filename, api_key, lang)
        elif provider == "deepgram":
            return await self._deepgram_stt(model_id, audio_bytes, api_key, lang)
        else:
            raise ValueError(f"Unsupported STT provider: {provider}")

    async def _hasab_stt(self, audio_bytes: bytes, filename: str, api_key: str, lang: str = "am") -> str:
        url = os.getenv("HASAB_API_URL", "https://api.hasab.ai/api/v1/upload-audio")
        headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}
        async with httpx.AsyncClient(timeout=30) as client:
            files = {"audio": (filename, audio_bytes, "audio/wav")}
            data = {"transcribe": "true", "translate": "false", "summarize": "false", "language": lang}
            resp = await client.post(url, headers=headers, files=files, data=data)
            if resp.status_code not in [200, 201]:
                files_alt = {"file": (filename, audio_bytes, "audio/wav")}
                resp = await client.post(url, headers=headers, files=files_alt, data=data)
            resp.raise_for_status()
            res_json = resp.json()
            text = res_json.get("transcription") or res_json.get("text")
            if not text and isinstance(res_json.get("result"), dict):
                text = res_json["result"].get("transcription") or res_json["result"].get("text")
            if not text and isinstance(res_json.get("data"), dict):
                text = res_json["data"].get("transcription") or res_json["data"].get("text")
            if not text and isinstance(res_json, str):
                text = res_json
            return str(text or "").strip()

    async def _elevenlabs_stt(self, audio_bytes: bytes, filename: str, api_key: str, lang: str = "am") -> str:
        async with httpx.AsyncClient(timeout=30) as client:
            files = {"file": (filename, audio_bytes, "audio/wav")}
            data = {"model_id": "scribe_v2", "language_code": lang}
            resp = await client.post(
                "https://api.elevenlabs.io/v1/speech-to-text",
                headers={"xi-api-key": api_key},
                files=files,
                data=data
            )
            resp.raise_for_status()
            return resp.json().get("text", "").strip()

    async def _openai_stt(self, model_id: str, audio_bytes: bytes, filename: str, api_key: str, lang: str = "am") -> str:
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

    async def _groq_stt(self, model_id: str, audio_bytes: bytes, filename: str, api_key: str, lang: str = "am") -> str:
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

    async def _deepgram_stt(self, model_id: str, audio_bytes: bytes, api_key: str, lang: str = "am") -> str:
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
