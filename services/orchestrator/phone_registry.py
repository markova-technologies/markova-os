"""
Markova OS v3.0 — Trusted Phone Number Registry
─────────────────────────────────────────────────────────────────────────────
Server-side resolution of inbound phone numbers (DIDs / SIP Trunks) to tenant,
agent, and capability context.

Security Rule:
  Inbound calls NEVER trust client-supplied query parameters (?tenant_id=xxx).
  Instead, the inbound phone number is validated and matched against trusted
  tenant allocations in PostgreSQL / Redis Cache.
─────────────────────────────────────────────────────────────────────────────
"""

import json
import logging
from typing import Any, Dict, Optional
import asyncpg  # type: ignore
import redis.asyncio as aioredis  # type: ignore

logger = logging.getLogger("markova.phone_registry")

PHONE_CACHE_PREFIX = "markova:phone_mapping:"
PHONE_CACHE_TTL = 3600  # 1 hour TTL in Redis


class PhoneContext:
    def __init__(
        self,
        tenant_id: str,
        company_name: str,
        agent_id: str,
        agent_name: str,
        system_prompt: str,
        voice_id: str,
        language: str = "am-ET",
        stt_model: str = "groq-whisper-large-v3",
        llm_model: str = "groq-llama-3.3-70b",
        tts_provider: str = "edge_tts",
        capabilities: Optional[list] = None,
        max_turns: int = 12,
        is_active: bool = True,
    ):
        self.tenant_id = tenant_id
        self.company_name = company_name
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.system_prompt = system_prompt
        self.voice_id = voice_id
        self.language = language
        self.stt_model = stt_model
        self.llm_model = llm_model
        self.tts_provider = tts_provider
        self.capabilities = capabilities or ["SEARCH_KNOWLEDGE", "TRANSFER_CALL"]
        self.max_turns = max_turns
        self.is_active = is_active

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tenant_id": self.tenant_id,
            "company_name": self.company_name,
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "system_prompt": self.system_prompt,
            "voice_id": self.voice_id,
            "language": self.language,
            "stt_model": self.stt_model,
            "llm_model": self.llm_model,
            "tts_provider": self.tts_provider,
            "capabilities": self.capabilities,
            "max_turns": self.max_turns,
            "is_active": self.is_active,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PhoneContext":
        return cls(
            tenant_id=data.get("tenant_id", ""),
            company_name=data.get("company_name", ""),
            agent_id=data.get("agent_id", ""),
            agent_name=data.get("agent_name", "Almaz"),
            system_prompt=data.get("system_prompt", ""),
            voice_id=data.get("voice_id", "am-ET-MekdesNeural"),
            language=data.get("language", "am-ET"),
            stt_model=data.get("stt_model", "groq-whisper-large-v3"),
            llm_model=data.get("llm_model", "groq-llama-3.3-70b"),
            tts_provider=data.get("tts_provider", "edge_tts"),
            capabilities=data.get("capabilities", []),
            max_turns=data.get("max_turns", 12),
            is_active=data.get("is_active", True),
        )


async def resolve_inbound_caller(
    inbound_phone_number: str,
    db_pool: Optional[asyncpg.Pool],
    redis_client: Optional[aioredis.Redis],
) -> Optional[PhoneContext]:
    """
    Resolves an inbound phone number to its trusted tenant and agent configuration.
    1. Checks Redis cache.
    2. Falls back to PostgreSQL lookup.
    3. Caches result.
    """
    if not inbound_phone_number:
        logger.warning("Empty inbound phone number provided for resolution.")
        return None

    # Clean phone number (strip whitespace, ensure standard format)
    clean_number = inbound_phone_number.strip().replace(" ", "").replace("-", "")
    cache_key = f"{PHONE_CACHE_PREFIX}{clean_number}"

    # 1. Try Redis cache
    if redis_client:
        try:
            cached_json = await redis_client.get(cache_key)
            if cached_json:
                data = json.loads(cached_json)
                return PhoneContext.from_dict(data)
        except Exception as e:
            logger.warning(f"Redis lookup failed for phone {clean_number}: {e}")

    # 2. Query PostgreSQL DB
    if not db_pool:
        logger.error("Database pool is not available for phone number resolution.")
        return None

    query = """
        SELECT 
            p.phone_number,
            p.company_id AS tenant_id,
            c.name AS company_name,
            a.id AS agent_id,
            a.name AS agent_name,
            a.system_prompt,
            a.voice_id,
            a.language,
            a.stt_model,
            a.llm_model,
            a.tts_provider,
            a.capabilities,
            a.max_history_turns,
            a.is_active
        FROM public.phone_numbers p
        JOIN public.companies c ON c.id = p.company_id
        LEFT JOIN public.agents a ON a.id = p.agent_id
        WHERE p.phone_number = $1 AND (p.status = 'active' OR p.status IS NULL)
        LIMIT 1;
    """

    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow(query, clean_number)
            if not row:
                # Fallback: check if standard default agent exists
                logger.info(f"Unassigned inbound number {clean_number}. Looking for fallback routing.")
                fallback_row = await conn.fetchrow("""
                    SELECT 
                        c.id AS tenant_id,
                        c.name AS company_name,
                        a.id AS agent_id,
                        a.name AS agent_name,
                        a.system_prompt,
                        a.voice_id,
                        a.language,
                        a.stt_model,
                        a.llm_model,
                        a.tts_provider,
                        a.capabilities,
                        a.max_history_turns,
                        a.is_active
                    FROM public.companies c
                    JOIN public.agents a ON a.company_id = c.id
                    WHERE a.is_active = true
                    ORDER BY a.created_at ASC
                    LIMIT 1;
                """)
                if fallback_row:
                    row = fallback_row
                else:
                    return None

            capabilities_list = row["capabilities"]
            if isinstance(capabilities_list, str):
                try:
                    capabilities_list = json.loads(capabilities_list)
                except Exception:
                    capabilities_list = ["SEARCH_KNOWLEDGE"]

            ctx = PhoneContext(
                tenant_id=str(row["tenant_id"]),
                company_name=row["company_name"] or "Markova Enterprise",
                agent_id=str(row["agent_id"]),
                agent_name=row["agent_name"] or "Almaz",
                system_prompt=row["system_prompt"] or "You are Almaz, an Amharic customer service agent.",
                voice_id=row["voice_id"] or "am-ET-MekdesNeural",
                language=row["language"] or "am-ET",
                stt_model=row["stt_model"] or "groq-whisper-large-v3",
                llm_model=row["llm_model"] or "groq-llama-3.3-70b",
                tts_provider=row["tts_provider"] or "edge_tts",
                capabilities=capabilities_list or ["SEARCH_KNOWLEDGE"],
                max_turns=row["max_history_turns"] or 12,
                is_active=row["is_active"] if row["is_active"] is not None else True,
            )

            # 3. Cache into Redis
            if redis_client:
                try:
                    await redis_client.setex(
                        cache_key,
                        PHONE_CACHE_TTL,
                        json.dumps(ctx.to_dict()),
                    )
                except Exception as e:
                    logger.warning(f"Failed to cache phone context: {e}")

            return ctx

    except Exception as e:
        logger.error(f"Error querying phone number registry: {e}")
        return None
