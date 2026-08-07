import json
import time
import redis.asyncio as aioredis
from core.ports.event_port import EventPort

class RedisEventAdapter(EventPort):
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client

    async def publish(self, event_type: str, payload: dict, source: str = "orchestrator") -> None:
        if not self.redis:
            return
        event = {
            "type": event_type,
            "payload": json.dumps(payload),
            "timestamp": str(int(time.time() * 1000)),
            "source": source,
            "traceId": ""
        }
        try:
            await self.redis.xadd("markova_events", event)
        except Exception as e:
            print(f"⚠️ Failed to publish event: {e}")

    async def broadcast_log(self, company_id: str, log_data: dict) -> None:
        """Publish log to Redis so it goes to all workers and WebSockets."""
        if self.redis:
            await self.redis.publish(f"logs:{company_id}", json.dumps(log_data))
