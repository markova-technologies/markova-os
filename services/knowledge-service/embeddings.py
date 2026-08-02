"""
Embedding backends for the Markova Knowledge Service.

Priority order (first key found wins):
  1. JINA_API_KEY   → jina-embeddings-v3 (free 10M tokens/month, multilingual, 1024-d)
  2. OPENAI_API_KEY → text-embedding-3-small (paid, 1536-d)
  3. fallback       → local_embed hash-based (free, offline, 1536-d)

The pgvector column is 1536-d. Jina returns 1024-d vectors, which we zero-pad
to 1536-d so the schema stays consistent. Cosine similarity is unaffected by
zero-padding because L2 normalisation happens before comparison.
"""
from __future__ import annotations

import hashlib
import math
import os
import re
from typing import List

DIM = 1536           # pgvector column dimension (do NOT change without a migration)
JINA_DIM = 1024      # jina-embeddings-v3 native output size

_TOKEN_RE = re.compile(r"[a-z0-9\u1200-\u137F]+", re.I)


# ─────────────────────────────────────────────────────────────────────────────
# LOCAL FALLBACK (hash-based, zero dependencies, works offline)
# ─────────────────────────────────────────────────────────────────────────────

def _tokenize(text: str) -> List[str]:
    return _TOKEN_RE.findall((text or "").lower())


def local_embed(text: str, dim: int = DIM) -> List[float]:
    """
    Hashing bag-of-words embedding — not a neural model, but produces real
    vectors with cosine similarity (overlapping tokens → higher score).
    Stable across restarts. 100% free, runs locally.
    """
    vec = [0.0] * dim
    tokens = _tokenize(text)
    if not tokens:
        return vec
    for tok in tokens:
        h = hashlib.sha256(tok.encode("utf-8")).digest()
        for i in range(0, 16, 4):
            idx = int.from_bytes(h[i : i + 2], "big") % dim
            sign = 1.0 if h[i + 2] % 2 == 0 else -1.0
            weight = 1.0 + (h[i + 3] / 255.0)
            vec[idx] += sign * weight
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


# ─────────────────────────────────────────────────────────────────────────────
# JINA AI (free, 10M tokens/month, no credit card required)
# https://jina.ai/embeddings  — get your key at jina.ai
# ─────────────────────────────────────────────────────────────────────────────

def jina_embed(text: str, api_key: str) -> List[float]:
    """
    Call Jina AI's embedding API with jina-embeddings-v3.
    Returns a 1536-d vector (1024-d output zero-padded to match pgvector schema).
    
    Free tier: 10,000,000 tokens/month — no credit card required.
    Sign up at: https://jina.ai
    """
    import urllib.request
    import json

    payload = json.dumps({
        "model": "jina-embeddings-v3",
        "task": "retrieval.passage",       # optimised for RAG/search
        "late_chunking": False,
        "dimensions": JINA_DIM,
        "embedding_type": "float",
        "input": [text[:8000]],            # Jina accepts a list; we embed one at a time
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.jina.ai/v1/embeddings",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    emb: List[float] = data["data"][0]["embedding"]

    # Zero-pad from 1024-d to 1536-d so it fits the pgvector schema
    if len(emb) < DIM:
        emb = emb + [0.0] * (DIM - len(emb))
    else:
        emb = emb[:DIM]

    return emb


# ─────────────────────────────────────────────────────────────────────────────
# OPENAI (paid, kept as secondary option)
# ─────────────────────────────────────────────────────────────────────────────

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
    if len(emb) < DIM:
        emb = emb + [0.0] * (DIM - len(emb))
    else:
        emb = emb[:DIM]
    return emb


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API — called by main.py
# ─────────────────────────────────────────────────────────────────────────────

def embed_text(text: str) -> List[float]:
    """
    Priority: JINA_API_KEY → OPENAI_API_KEY → local hash fallback.
    Never raises — always returns a valid vector.
    """
    jina_key = os.getenv("JINA_API_KEY")
    if jina_key:
        try:
            return jina_embed(text, jina_key)
        except Exception as e:
            print(f"⚠️ Jina embedding failed, trying next backend: {e}")

    openai_key = os.getenv("EMBEDDING_API_KEY") or os.getenv("OPENAI_API_KEY")
    if openai_key:
        try:
            return openai_embed(text, openai_key)
        except Exception as e:
            print(f"⚠️ OpenAI embedding failed, falling back to local: {e}")

    return local_embed(text)


def vector_literal(vec: List[float]) -> str:
    return "[" + ",".join(f"{v:.8f}" for v in vec) + "]"


def embedding_backend() -> str:
    if os.getenv("JINA_API_KEY"):
        return "jina_v3"
    if os.getenv("EMBEDDING_API_KEY") or os.getenv("OPENAI_API_KEY"):
        return "openai"
    return "local_hash"
