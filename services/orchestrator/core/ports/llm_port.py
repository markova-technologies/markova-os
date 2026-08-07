from typing import Protocol, runtime_checkable

@runtime_checkable
class LLMPort(Protocol):
    async def complete(
        self,
        provider: str,
        model_id: str,
        messages: list,
        api_key: str
    ) -> tuple[str, int]: ...
