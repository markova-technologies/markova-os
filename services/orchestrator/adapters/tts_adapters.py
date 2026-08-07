import httpx
import os
from core.ports.tts_port import TTSPort

class UnifiedTTS(TTSPort):
    """
    Unified TTS adapter dispatcher.
    """
    async def synthesize(self, provider: str, voice_id: str, text: str, api_key: str) -> bytes:
        if provider in ["edge", "addisai", "amharic", ""] or not provider:
            print(f"🎙️ Generating voice using primary Edge TTS ({voice_id or 'am-ET-MekdesNeural'})...")
            try:
                return await self._edge_tts(voice_id or "am-ET-MekdesNeural", text)
            except Exception as err:
                print(f"⚠️ Primary Edge TTS failed ({err}), falling back to Addis AI TTS...")
                return await self._addisai_tts(text, api_key)
        elif provider == "elevenlabs":
            return await self._elevenlabs_tts(voice_id, text, api_key)
        elif provider == "openai":
            return await self._openai_tts(voice_id, text, api_key)
        elif provider == "azure":
            return await self._azure_tts(voice_id, text, api_key)
        elif provider == "google":
            return await self._google_tts(voice_id, text, api_key)
        else:
            raise ValueError(f"Unsupported TTS provider: {provider}")

    async def _edge_tts(self, voice_id: str, text: str) -> bytes:
        import edge_tts
        import tempfile
        communicate = edge_tts.Communicate(text, voice_id)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as fp:
            temp_path = fp.name
        await communicate.save(temp_path)
        with open(temp_path, "rb") as f:
            audio_bytes = f.read()
        os.remove(temp_path)
        return audio_bytes

    async def _addisai_tts(self, text: str, api_key: str) -> bytes:
        key = api_key or os.getenv("ADDIS_AI_TTS_KEY", "")
        if not key or key.startswith("your_"):
            raise ValueError("Missing ADDIS_AI_TTS_KEY for fallback TTS")
        url = os.getenv("ADDIS_AI_TTS_URL", "https://api.addisassistant.com/api/v1/audio")
        headers = {"X-API-Key": key, "Content-Type": "application/json"}
        payload = {"text": text, "language": "am"}
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            audio_str = data.get("audio", "")
            if audio_str.startswith("data:"):
                audio_str = audio_str.split(",")[1]
            import base64
            return base64.b64decode(audio_str)

    async def _elevenlabs_tts(self, voice_id: str, text: str, api_key: str) -> bytes:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id or 'pNInz6obpgDQGcFmaJcg'}?output_format=mp3_44100_128",
                headers={"xi-api-key": api_key},
                json={"text": text, "model_id": "eleven_multilingual_v2"}
            )
            resp.raise_for_status()
            return resp.content

    async def _openai_tts(self, voice_id: str, text: str, api_key: str) -> bytes:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.openai.com/v1/audio/speech",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": "tts-1", "voice": voice_id or "alloy", "input": text, "response_format": "mp3"}
            )
            resp.raise_for_status()
            return resp.content

    async def _azure_tts(self, voice_id: str, text: str, api_key: str) -> bytes:
        region = os.getenv("AZURE_SPEECH_REGION", "eastus")
        url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
        headers = {
            "Ocp-Apim-Subscription-Key": api_key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
        }
        ssml = f"""<speak version='1.0' xml:lang='en-US'>
<voice xml:lang='en-US' name='{voice_id or "en-US-JennyNeural"}'>
{text}
</voice></speak>"""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, headers=headers, content=ssml)
            resp.raise_for_status()
            return resp.content

    async def _google_tts(self, voice_id: str, text: str, api_key: str) -> bytes:
        url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}"
        payload = {
            "input": {"text": text},
            "voice": {"languageCode": "en-US", "name": voice_id or "en-US-Journey-F"},
            "audioConfig": {"audioEncoding": "MP3"}
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            import base64
            return base64.b64decode(resp.json()["audioContent"])
