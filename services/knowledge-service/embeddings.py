"""
Deterministic local embeddings (1536-d) for pgvector cosine search.
When OPENAI_API_KEY / EMBEDDING_API_KEY is set, uses OpenAI text-embedding-3-small.
"""
from __future__ import annotations

import hashlib
import math
import os
import re
from typing import List, Optional

DIM = 1536
_TOKEN_RE = re.compile(r"[a-z0-9\u1200-\u137F]+", re.I)


def _tokenize(text: str) -> List[str]:
    return _TOKEN_RE.findall((text or "").lower())


def local_embed(text: str, dim: int = DIM) -> List[float]:
    """
    Hashing bag-of-words embedding — not a neural model, but real vectors with
    cosine similarity (overlapping tokens → higher score). Stable across restarts.
    """
    vec = [0.0] * dim
    tokens = _tokenize(text)
    if not tokens:
        return vec
    for tok in tokens:
        h = hashlib.sha256(tok.encode("utf-8")).digest()
        # Place mass in a few hashed buckets (signed)
        for i in range(0, 16, 4):
            idx = int.from_bytes(h[i : i + 2], "big") % dim
            sign = 1.0 if h[i + 2] % 2 == 0 else -1.0
            weight = 1.0 + (h[i + 3] / 255.0)
            vec[idx] += sign * weight
    # L2 normalize
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def openai_embed(text: str, api_key: str, model: str = "text-embedding-3-small") -> List[float]:
    import urllib.request
    import json

    payload = json.dumps({"input": text[:8000], "model": model}).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/embeddings",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    emb = data["data"][0]["embedding"]
    if len(emb) != DIM:
        # Pad or truncate to schema dim
        if len(emb) < DIM:
            emb = emb + [0.0] * (DIM - len(emb))
        else:
            emb = emb[:DIM]
    return emb


def embed_text(text: str) -> List[float]:
    key = os.getenv("EMBEDDING_API_KEY") or os.getenv("OPENAI_API_KEY")
    if key:
        try:
            return openai_embed(text, key)
        except Exception as e:
            print(f"OpenAI embedding failed, falling back to local: {e}")
    return local_embed(text)


def vector_literal(vec: List[float]) -> str:
    return "[" + ",".join(f"{v:.8f}" for v in vec) + "]"


def embedding_backend() -> str:
    if os.getenv("EMBEDDING_API_KEY") or os.getenv("OPENAI_API_KEY"):
        return "openai"
    return "local_hash"
