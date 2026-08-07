from typing import Protocol, runtime_checkable

@runtime_checkable
class TTSPort(Protocol):
    async def synthesize(
        self,
        provider: str,
        voice_id: str,
        text: str,
        api_key: str
    ) -> bytes: ...
