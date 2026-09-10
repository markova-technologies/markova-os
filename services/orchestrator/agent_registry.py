"""
Markova OS v3.0 — Agent Registry & Configuration Cache
─────────────────────────────────────────────────────────────────────────────
Manages runtime configuration, Redis caching, and deployment syncing for AI
agents across multi-tenant voice sessions.
─────────────────────────────────────────────────────────────────────────────
"""

import json
import logging
import uuid
from typing import Any, Dict, Optional
import structlog

logger = structlog.get_logger("markova.agent_registry")

AGENT_CACHE_PREFIX = "markova:agent:"
AGENT_CACHE_TTL = 86400  # 24 hours in Redis


class AgentRegistry:
    def __init__(self, redis_client=None, db_pool=None):
        self.redis_client = redis_client
        self.db_pool = db_pool
        self._memory_cache: Dict[str, Dict[str, Any]] = {}

    async def load_all(self):
        """Loads all active agents from database into Redis & in-memory cache."""
        if not self.db_pool:
            logger.warning("agent_registry_load_all_no_db_pool")
            return

        try:
            async with self.db_pool.acquire() as conn:
                rows = await conn.fetch("SELECT * FROM agents")
                count = 0
                for row in rows:
                    agent_dict = self._row_to_dict(row)
                    agent_id = str(agent_dict["id"])
                    self._memory_cache[agent_id] = agent_dict

                    if self.redis_client:
                        try:
                            await self.redis_client.set(
                                f"{AGENT_CACHE_PREFIX}{agent_id}",
                                json.dumps(agent_dict, default=str),
                                ex=AGENT_CACHE_TTL
                            )
                        except Exception as r_err:
                            logger.warning("redis_agent_cache_error", error=str(r_err), agent_id=agent_id)
                    count += 1

                logger.info("agent_registry_loaded", total_agents=count)
        except Exception as e:
            logger.error("agent_registry_load_all_failed", error=str(e))

    async def deploy(self, agent_id: str, body: Dict[str, Any]):
        """Deploys updated agent configuration to cache and database."""
        agent_id_str = str(agent_id)
        
        # Merge or set in memory
        existing = self._memory_cache.get(agent_id_str, {})
        updated = {**existing, **body, "id": agent_id_str}
        self._memory_cache[agent_id_str] = updated

        # Update Redis
        if self.redis_client:
            try:
                await self.redis_client.set(
                    f"{AGENT_CACHE_PREFIX}{agent_id_str}",
                    json.dumps(updated, default=str),
                    ex=AGENT_CACHE_TTL
                )
            except Exception as r_err:
                logger.warning("redis_deploy_cache_failed", error=str(r_err), agent_id=agent_id_str)

        # Update Database
        if self.db_pool:
            try:
                async with self.db_pool.acquire() as conn:
                    agent_uuid = uuid.UUID(agent_id_str)
                    
                    # Update fields if present
                    prompt = body.get("prompt")
                    voice_provider = body.get("voice_provider")
                    voice_id = body.get("voice_id")
                    model_provider = body.get("model_provider")
                    model_id = body.get("model_id")

                    await conn.execute(
                        """
                        UPDATE agents 
                        SET 
                            prompt = COALESCE($2, prompt),
                            voice_provider = COALESCE($3, voice_provider),
                            voice_id = COALESCE($4, voice_id),
                            model_provider = COALESCE($5, model_provider),
                            model_id = COALESCE($6, model_id),
                            updated_at = NOW()
                        WHERE id = $1
                        """,
                        agent_uuid, prompt, voice_provider, voice_id, model_provider, model_id
                    )

                    # Also append version record
                    try:
                        await conn.execute(
                            """
                            INSERT INTO agent_versions (agent_id, version_number, prompt, model_provider, model_id, voice_provider, voice_id)
                            SELECT id, COALESCE((SELECT MAX(version_number) + 1 FROM agent_versions WHERE agent_id = $1), 1),
                                   prompt, model_provider, model_id, voice_provider, voice_id
                            FROM agents WHERE id = $1
                            """,
                            agent_uuid
                        )
                    except Exception as ver_err:
                        logger.warning("agent_version_insert_failed", error=str(ver_err), agent_id=agent_id_str)

                logger.info("agent_deployed_successfully", agent_id=agent_id_str)
            except Exception as db_err:
                logger.error("agent_deploy_db_failed", error=str(db_err), agent_id=agent_id_str)

    async def get_config(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves agent config from memory, Redis, or DB fallback."""
        agent_id_str = str(agent_id)

        # 1. Check local memory
        if agent_id_str in self._memory_cache:
            return self._memory_cache[agent_id_str]

        # 2. Check Redis
        if self.redis_client:
            try:
                cached = await self.redis_client.get(f"{AGENT_CACHE_PREFIX}{agent_id_str}")
                if cached:
                    config = json.loads(cached)
                    self._memory_cache[agent_id_str] = config
                    return config
            except Exception as r_err:
                logger.warning("redis_get_config_failed", error=str(r_err), agent_id=agent_id_str)

        # 3. Fallback to Postgres
        if self.db_pool:
            try:
                async with self.db_pool.acquire() as conn:
                    row = await conn.fetchrow("SELECT * FROM agents WHERE id = $1", uuid.UUID(agent_id_str))
                    if row:
                        config = self._row_to_dict(row)
                        self._memory_cache[agent_id_str] = config
                        if self.redis_client:
                            try:
                                await self.redis_client.set(
                                    f"{AGENT_CACHE_PREFIX}{agent_id_str}",
                                    json.dumps(config, default=str),
                                    ex=AGENT_CACHE_TTL
                                )
                            except Exception:
                                pass
                        return config
            except Exception as db_err:
                logger.error("db_get_config_failed", error=str(db_err), agent_id=agent_id_str)

        return None

    def _row_to_dict(self, row) -> Dict[str, Any]:
        """Helper to convert asyncpg Record to dict with serializable types."""
        d = dict(row)
        for k, v in d.items():
            if isinstance(v, uuid.UUID):
                d[k] = str(v)
            elif hasattr(v, "isoformat"):
                d[k] = v.isoformat()
        return d
