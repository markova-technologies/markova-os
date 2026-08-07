import hashlib
import os
from typing import Optional
from core.ports.tts_port import TTSPort

AUDIO_DIR = os.getenv("AUDIO_DIR", "/app/audio")
os.makedirs(AUDIO_DIR, exist_ok=True)

async def get_cached_audio_url(
    tts_port: TTSPort,
    provider: str,
    voice_id: str,
    text: str,
    api_key: str,
    base_url: str
) -> Optional[str]:
    """
    Generates audio via TTS port and returns the static URL to serve it,
    validating file size to prevent playing corrupt audio.
    """
    try:
        text_hash = hashlib.md5(f"{provider}_{voice_id}_{text}".encode('utf-8')).hexdigest()[:8]
        filename = f"tts_{text_hash}.wav"
        filepath = os.path.join(AUDIO_DIR, filename)

        if os.path.exists(filepath):
            if os.path.getsize(filepath) > 100:
                return f"{base_url.rstrip('/')}/audio/{filename}"
            else:
                print(f"⚠️ Corrupted or zero-byte TTS cache file detected ({filename}). Regenerating...")
                try:
                    os.remove(filepath)
                except OSError:
                    pass

        audio_bytes = await tts_port.synthesize(voice_id, text, api_key)
        if audio_bytes and len(audio_bytes) > 100:
            with open(filepath, "wb") as f:
                f.write(audio_bytes)
            return f"{base_url.rstrip('/')}/audio/{filename}"
    except Exception as e:
        print(f"Error generating audio URL: {e}")
    return None
