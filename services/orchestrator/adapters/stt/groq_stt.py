import httpx
from core.ports.stt_port import STTPort

WHISPER_PROMPT = (
    "ሰላም የጂኤም ፈርኒቸር ደንበኛ ድጋፍ ነኝ። ሶፋ ዋጋ how much ነው? discount አለ? delivery free ነው? "
    "ወንበር price ስንት ነው? installation included ነው? "
    "አልጋ ጠረጴዛ ካቢኔ ዋርድሮብ መደርደሪያ ቲቪ ስታንድ ኪንግ ሳይዝ ኩዊን ኤል ቅርጽ ስዊቬል "
    "ሾሩም location Bole ቄራ Piassa ቶርሃይሎች ጉርድ ሾላ አለምገና። "
    "ዋጋ ብር ክፍያ ቅጣፍ ባንክ ዋስትና ትዕዛዝ order furniture desk chair bed style"
)

class GroqSTT(STTPort):
    async def transcribe(self, audio_bytes: bytes, filename: str, api_key: str, lang: str = "am") -> str:
        async with httpx.AsyncClient(timeout=30) as client:
            files = {
                "file": (filename, audio_bytes, "audio/wav" if filename.endswith(".wav") else "audio/mpeg")
            }
            data = {
                "model": "whisper-large-v3-turbo",
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
