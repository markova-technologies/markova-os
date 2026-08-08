import os
import httpx
from typing import List, Dict, Any, Optional
import structlog

logger = structlog.get_logger()

class QdrantAdapter:
    """
    Qdrant High-Density Vector Search Adapter.
    Used when document chunk embeddings exceed 10 million rows.
    """
    def __init__(self, qdrant_url: Optional[str] = None):
        self.qdrant_url = qdrant_url or os.getenv("QDRANT_URL", "http://qdrant:6333")
        self.api_key = os.getenv("QDRANT_API_KEY", "")
        headers = {"api-key": self.api_key} if self.api_key else {}
        self.client = httpx.AsyncClient(timeout=10.0, headers=headers)

    async def close(self):
        """Close the persistent HTTP client."""
        await self.client.aclose()

    async def ensure_collection(self, collection_name: str, vector_size: int = 1536):
        """Create the collection if it doesn't exist."""
        url = f"{self.qdrant_url}/collections/{collection_name}"
        res = await self.client.get(url)
        if res.status_code == 404:
            payload = {
                "vectors": {
                    "size": vector_size,
                    "distance": "Cosine"
                }
            }
            res = await self.client.put(url, json=payload)
            res.raise_for_status()
            logger.info("qdrant_collection_created", collection=collection_name)
    
    async def upsert_point(self, collection_name: str, point_id: str, vector: List[float], payload: Dict[str, Any]):
        """Upsert a single point into the collection."""
        url = f"{self.qdrant_url}/collections/{collection_name}/points"
        data = {
            "points": [
                {
                    "id": point_id,
                    "vector": vector,
                    "payload": payload
                }
            ]
        }
        res = await self.client.put(url, json=data)
        res.raise_for_status()

    async def search(self, collection_name: str, query_vector: List[float], tenant_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Hybrid keyword+vector search (using tenant_id filter)."""
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

        res = await self.client.post(url, json=payload)
        res.raise_for_status()
        data = res.json()
        return data.get("result", [])
