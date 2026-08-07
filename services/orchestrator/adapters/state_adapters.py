import json
import redis.asyncio as aioredis
from core.ports.state_port import StatePort

class RedisStateAdapter(StatePort):
    def __init__(self, redis_client: aioredis.Redis, memory_fallback: dict, degraded_flag: list):
        self.redis = redis_client
        self.memory = memory_fallback
        # Pass a list [False] to allow pass-by-reference mutation of the global degraded flag
        self.degraded = degraded_flag

    async def get(self, call_sid: str) -> dict:
        if not self.degraded[0] and self.redis:
            try:
                raw = await self.redis.get(f"call:{call_sid}:state")
                if raw:
                    return json.loads(raw)
                return {"messages": [], "turn_count": 0, "call_id": None}
            except Exception as e:
                print(f"⚠️ Redis read failure ({e}). Degrading to in-memory state.")
                self.degraded[0] = True

        raw = self.memory.get(f"call:{call_sid}:state")
        if raw:
            return json.loads(raw)
        return {"messages": [], "turn_count": 0, "call_id": None}

    async def save(self, call_sid: str, state: dict, ttl: int = 3600) -> None:
        serialized = json.dumps(state)
        if not self.degraded[0] and self.redis:
            try:
                await self.redis.setex(f"call:{call_sid}:state", ttl, serialized)
                return
            except Exception as e:
                print(f"⚠️ Redis write failure ({e}). Degrading to in-memory state.")
                self.degraded[0] = True
        self.memory[f"call:{call_sid}:state"] = serialized

    async def delete(self, call_sid: str) -> None:
        if not self.degraded[0] and self.redis:
            try:
                await self.redis.delete(f"call:{call_sid}:state")
            except Exception:
                self.degraded[0] = True
        self.memory.pop(f"call:{call_sid}:state", None)
