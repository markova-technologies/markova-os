"""
DistributedSemanticCache — Redis hot tier + pgvector similarity tier.
Thread-safe across all orchestrator replicas and pod restarts.
"""
import hashlib
import json
import time
from typing import Optional, Tuple

import redis.asyncio as aioredis
import asyncpg


class DistributedSemanticCache:
    """
    Two-tier distributed semantic cache.
    Tier 1: Redis hash lookup (exact prompt, sub-millisecond, 30-min TTL)
    Tier 2: pgvector similarity search (semantic match, 24-hour TTL)
    Falls back silently if either tier is unavailable.
    """

    def __init__(
        self,
        redis_client: aioredis.Redis,
        db_pool: asyncpg.Pool,
        similarity_threshold: float = 0.92,
        hot_ttl_seconds: int = 1800,    # 30 min Redis TTL
        cold_ttl_hours: int = 24,
    ):
        self._redis = redis_client
        self._pool = db_pool
        self.threshold = similarity_threshold
        self._hot_ttl = hot_ttl_seconds
        self._cold_ttl_hours = cold_ttl_hours

    def _prompt_hash(self, text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    async def get(
        self, embedding: list[float], company_id: str, prompt_text: str = ""
    ) -> Optional[Tuple[str, float]]:
        """
        Returns (response_text, similarity_score) if cache hit, else None.
        Never raises — cache misses are safe.
        """

        # Tier 1: Redis exact hash lookup (zero embedding cost)
        if prompt_text and self._redis:
            try:
                cache_key = f"sc:{company_id}:{self._prompt_hash(prompt_text)}"
                hit = await self._redis.get(cache_key)
                if hit:
                    print(f"🎯 Semantic Cache TIER-1 HIT (exact match)")
                    return json.loads(hit)["response"], 1.0
            except Exception as e:
                print(f"⚠️ Redis cache read skipped: {e}")

        # Tier 2: pgvector cosine similarity search
        if self._pool and embedding:
            try:
                vector_str = f"[{','.join(map(str, embedding))}]"
                row = await self._pool.fetchrow(
                    """
                    SELECT response_text,
                           1 - (embedding <=> $1::vector) AS similarity
                    FROM semantic_response_cache
                    WHERE company_id = $2
                      AND expires_at > NOW()
                    ORDER BY embedding <=> $1::vector
                    LIMIT 1
                    """,
                    vector_str,
                    company_id
                )
                if row and row["similarity"] >= self.threshold:
                    print(f"🎯 Semantic Cache TIER-2 HIT! (Similarity: {row['similarity']:.4f})")
                    # Promote to hot tier for next request
                    if prompt_text and self._redis:
                        await self._promote_to_hot(company_id, prompt_text, row["response_text"])
                    return row["response_text"], row["similarity"]
            except Exception as e:
                print(f"⚠️ pgvector cache read skipped: {e}")

        return None

    async def set(
        self,
        embedding: list[float],
        response: str,
        company_id: str,
        prompt_text: str = "",
    ) -> None:
        """Cache response. Never raises — cache writes are best-effort."""
        if not embedding or not response:
            return

        # Write to Tier 2: pgvector (durable, cross-replica)
        if self._pool:
            try:
                from datetime import datetime, timedelta, timezone
                vector_str = f"[{','.join(map(str, embedding))}]"
                prompt_hash = self._prompt_hash(prompt_text) if prompt_text else ""
                expires_at = datetime.now(timezone.utc) + timedelta(hours=self._cold_ttl_hours)

                await self._pool.execute(
                    """
                    INSERT INTO semantic_response_cache
                        (company_id, prompt_hash, embedding, response_text, expires_at)
                    VALUES ($1, $2, $3::vector, $4, $5)
                    ON CONFLICT (company_id, prompt_hash) DO UPDATE
                        SET response_text = EXCLUDED.response_text,
                            expires_at = EXCLUDED.expires_at,
                            hit_count = semantic_response_cache.hit_count + 1
                    """,
                    company_id, prompt_hash, vector_str, response, expires_at
                )
                print("💾 Semantic cache written to pgvector (distributed)")
            except Exception as e:
                print(f"⚠️ pgvector cache write skipped: {e}")

        # Write to Tier 1: Redis hot cache (fast reads)
        if prompt_text and self._redis:
            await self._promote_to_hot(company_id, prompt_text, response)

    async def _promote_to_hot(self, company_id: str, prompt_text: str, response: str):
        try:
            cache_key = f"sc:{company_id}:{self._prompt_hash(prompt_text)}"
            await self._redis.setex(
                cache_key,
                self._hot_ttl,
                json.dumps({"response": response, "ts": time.time()})
            )
        except Exception as e:
            print(f"⚠️ Redis hot cache write skipped: {e}")
