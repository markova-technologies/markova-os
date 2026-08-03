import os
import httpx
from typing import List, Dict, Any, Optional

class QdrantAdapter:
    """
    Qdrant High-Density Vector Search Adapter.
    Used when document chunk embeddings exceed 10 million rows.
    """
    def __init__(self, qdrant_url: Optional[str] = None):
        self.qdrant_url = qdrant_url or os.getenv("QDRANT_URL", "http://qdrant:6333")

    async def search(self, collection_name: str, query_vector: List[float], tenant_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        url = f"{self.qdrant_url}/collections/{collection_name}/points/search"
        payload = {
            "vector": query_vector,
            "limit": limit,
            "filter": {
                "must": [
                    { "key": "company_id", "match": { "value": tenant_id } }
                ]
            },
            "with_payload": True
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, json=payload)
            res.raise_for_status()
            data = res.json()
            return data.get("result", [])
