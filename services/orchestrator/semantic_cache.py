import time
import math
from typing import Optional, Tuple

class SemanticCache:
    """
    Semantic Cache for LLM prompts to eliminate redundant costs & latency.
    Stores (prompt_embedding, response_text, timestamp) in memory/Redis.
    """
    def __init__(self, similarity_threshold: float = 0.95, ttl_seconds: int = 3600):
        self.threshold = similarity_threshold
        self.ttl = ttl_seconds
        # In-memory fallback cache: list of {"embedding": [...], "response": "...", "timestamp": float}
        self._cache = []

    def _cosine_similarity(self, vec1: list[float], vec2: list[float]) -> float:
        if not vec1 or not vec2 or len(vec1) != len(vec2):
            return 0.0
        dot = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = math.sqrt(sum(a * a for a in vec1))
        norm2 = math.sqrt(sum(b * b for b in vec2))
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return dot / (norm1 * norm2)

    async def get(self, embedding: list[float]) -> Optional[Tuple[str, float]]:
        """Return (cached_response, similarity) if hit, else None."""
        now = time.time()
        # Clean expired
        self._cache = [c for c in self._cache if now - c["timestamp"] < self.ttl]

        best_score = 0.0
        best_resp = None

        for item in self._cache:
            sim = self._cosine_similarity(embedding, item["embedding"])
            if sim > best_score:
                best_score = sim
                best_resp = item["response"]

        if best_score >= self.threshold:
            print(f"🎯 Semantic Cache HIT! (Similarity: {best_score:.4f})")
            return best_resp, best_score

        return None

    async def set(self, embedding: list[float], response: str):
        """Cache response for given prompt embedding."""
        if not embedding or not response:
            return
        self._cache.append({
            "embedding": embedding,
            "response": response,
            "timestamp": time.time()
        })
        print("💾 Cached prompt response in SemanticCache")
