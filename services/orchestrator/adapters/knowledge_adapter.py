import os
import uuid
import httpx
from core.ports.knowledge_port import KnowledgePort

KNOWLEDGE_SERVICE_URL = os.getenv("KNOWLEDGE_SERVICE_URL", "http://knowledge-service:5006")

class KnowledgeAdapter(KnowledgePort):
    def __init__(self, db_pool):
        self.db_pool = db_pool

    async def query(self, company_id: str, query: str, limit: int = 3) -> str:
        if not company_id or not query:
            return ""
        
        from opentelemetry import trace
        tracer = trace.get_tracer("markova.orchestrator.knowledge")
        with tracer.start_as_current_span("knowledge_query") as span:
            span.set_attribute("knowledge.company_id", company_id)
            span.set_attribute("knowledge.query_length", len(query))
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    resp = await client.post(
                        f"{KNOWLEDGE_SERVICE_URL}/api/knowledge/search",
                        json={"query": query, "limit": limit},
                        headers={"X-Company-ID": company_id}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        results = data.get("results", [])
                        if results:
                            parts = [r["content"] for r in results if r.get("content")]
                            context = "\n\n---\n\n".join(parts)
                            span.set_attribute("knowledge.chunks_found", len(results))
                            print(f"📚 RAG: {len(results)} chunks injected ({len(context)} chars)")
                            return context
                    span.set_attribute("knowledge.chunks_found", 0)
            except Exception as e:
                span.record_exception(e)
                span.set_status(trace.StatusCode.ERROR)
                print(f"⚠️ Knowledge service unavailable (degrading gracefully): {e}")
            return ""

    async def search_chunks(self, company_id: str, query: str, api_key: str) -> str:
        try:
            # Get embedding using OpenAI for now
            embedding = await self._get_embedding("openai", "text-embedding-3-small", query, api_key)
            if not embedding:
                return ""
                
            vector_str = f"[{','.join(map(str, embedding))}]"
            
            rows = await self.db_pool.fetch(
                """
                SELECT content, 1 - (embedding <=> $1::vector) AS similarity
                FROM knowledge_chunks
                WHERE company_id = $2
                ORDER BY embedding <=> $1::vector
                LIMIT 3
                """,
                vector_str,
                uuid.UUID(company_id)
            )
            
            context_chunks = [r["content"] for r in rows if r["similarity"] > 0.70]
            if not context_chunks:
                return ""
                
            return "\n\n".join(context_chunks)
        except Exception as e:
            print(f"⚠️ RAG Search Failed: {e}")
            return ""

    async def _get_embedding(self, provider: str, model_id: str, text: str, api_key: str) -> list[float]:
        if provider == "openai":
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/embeddings",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"input": text, "model": model_id or "text-embedding-3-small"}
                )
                resp.raise_for_status()
                return resp.json()["data"][0]["embedding"]
        return []
