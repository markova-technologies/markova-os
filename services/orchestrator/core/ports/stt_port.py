from typing import Protocol, runtime_checkable

@runtime_checkable
class STTPort(Protocol):
    async def transcribe(
        self,
        provider: str,
        model_id: str,
        audio_bytes: bytes,
        filename: str,
        api_key: str,
        lang: str = "am"
    ) -> str: ...
