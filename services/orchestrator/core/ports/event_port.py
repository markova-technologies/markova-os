from typing import Protocol, runtime_checkable

@runtime_checkable
class EventPort(Protocol):
    async def publish(self, event_type: str, payload: dict, source: str = "orchestrator") -> None: ...
