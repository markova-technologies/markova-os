"""
Markova OS v3.0 — Dual-Tier Event Bus
─────────────────────────────────────────────────────────────────────────────
Architectural Division:
  1. Redis Pub/Sub: Ephemeral live state (UI waveforms, barge-in flags, stream locks).
  2. Redis Streams: Durable business events (call lifecycle, tool executions, billing metrics).
─────────────────────────────────────────────────────────────────────────────
"""

import json
import logging
import time
from typing import Any, Dict, Optional
import redis.asyncio as aioredis  # type: ignore

logger = logging.getLogger("markova.event_bus")

# Stream definitions
PLATFORM_STREAM_KEY = "markova:events:platform"
DEFAULT_CONSUMER_GROUP = "markova_workers_group"


class EventEnvelope:
    @staticmethod
    def create(
        event_type: str,
        tenant_id: str,
        payload: Dict[str, Any],
        actor_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> Dict[str, str]:
        """
        Creates a standardized event payload with tenant isolation & tracing tags.
        """
        return {
            "event_type": event_type,
            "tenant_id": tenant_id,
            "actor_id": actor_id or "system",
            "trace_id": trace_id or f"trace_{int(time.time()*1000)}",
            "session_id": session_id or "",
            "timestamp": str(time.time()),
            "payload": json.dumps(payload),
        }


async def publish_live_event(
    redis_client: Optional[aioredis.Redis],
    channel: str,
    event_data: Dict[str, Any],
) -> bool:
    """
    Publishes an ephemeral live event via Redis Pub/Sub.
    Ideal for real-time dashboard UI waveform updates, barge-in interruptions, and audio locks.
    """
    if not redis_client:
        return False
    try:
        payload_str = json.dumps(event_data)
        await redis_client.publish(channel, payload_str)
        return True
    except Exception as e:
        logger.warning(f"Failed to publish live event to {channel}: {e}")
        return False


async def emit_platform_event(
    redis_client: Optional[aioredis.Redis],
    event_type: str,
    tenant_id: str,
    payload: Dict[str, Any],
    actor_id: Optional[str] = None,
    trace_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> Optional[str]:
    """
    Appends a durable business event to Redis Streams.
    Guarantees persistence and at-least-once delivery for workers (billing, analytics, audit).
    """
    if not redis_client:
        logger.error(f"Cannot emit platform event {event_type}: Redis client is not available.")
        return None

    try:
        envelope = EventEnvelope.create(
            event_type=event_type,
            tenant_id=tenant_id,
            payload=payload,
            actor_id=actor_id,
            trace_id=trace_id,
            session_id=session_id,
        )

        message_id = await redis_client.xadd(PLATFORM_STREAM_KEY, envelope)
        
        # Dual-emit to legacy stream for backwards compatibility with existing workers
        try:
            legacy_envelope = {
                "type": event_type,
                "tenantId": tenant_id,
                "payload": json.dumps(payload),
                "source": actor_id or "orchestrator",
                "traceId": trace_id or "",
                "timestamp": str(int(time.time() * 1000)),
            }
            await redis_client.xadd("markova_events", legacy_envelope)
        except Exception as leg_err:
            logger.debug(f"Legacy stream mirror skipped: {leg_err}")

        logger.debug(f"Emitted durable event {event_type} (ID: {message_id}) for tenant {tenant_id}")
        return message_id
    except Exception as e:
        logger.error(f"Failed to emit platform stream event {event_type}: {e}")
        return None


async def ensure_stream_group(
    redis_client: aioredis.Redis,
    stream_key: str = PLATFORM_STREAM_KEY,
    group_name: str = DEFAULT_CONSUMER_GROUP,
):
    """
    Ensures that the consumer group exists for Redis Stream processing.
    """
    try:
        await redis_client.xgroup_create(stream_key, group_name, id="0", mkstream=True)
        logger.info(f"Created consumer group {group_name} on {stream_key}")
    except aioredis.ResponseError as e:
        if "BUSYGROUP" in str(e):
            pass  # Group already exists
        else:
            raise e
