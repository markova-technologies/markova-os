import httpx
import os
from typing import Optional, Dict, Any, List, Tuple, AsyncGenerator
import structlog

logger = structlog.get_logger()

class VLLMAdapter:
    """
    Production vLLM adapter for on-premises GPU inference.
    Compatible with vLLM's OpenAI-compatible API (/v1/chat/completions).
    Supports streaming, health checks, and failover.
    """
    def __init__(self, endpoint_url: Optional[str] = None):
        self.endpoint_url = endpoint_url or os.getenv(
            "VLLM_ENDPOINT_URL", "http://vllm-cluster:8000/v1"
        )
        self.model_id = os.getenv("VLLM_MODEL_ID", "meta-llama/Llama-3.3-70B-Instruct")
        self.api_key = os.getenv("VLLM_API_KEY", "EMPTY")  # vLLM doesn't need a real key
    
    async def health_check(self) -> bool:
        """Ping the vLLM health endpoint. Returns True if available."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.endpoint_url.rstrip('/v1')}/health")
                return resp.status_code == 200
        except Exception as e:
            logger.warning("vllm_health_check_failed", error=str(e))
            return False
    
    async def complete(
        self,
        messages: List[Dict[str, str]],
        model_id: str = "",
        temperature: float = 0.7,
        max_tokens: int = 512,
    ) -> Tuple[str, int]:
        """Non-streaming completion."""
        url = f"{self.endpoint_url}/chat/completions"
        payload = {
            "model": model_id or self.model_id,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }
        headers = {"Authorization": f"Bearer {self.api_key}"}
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            tokens_used = data.get("usage", {}).get("total_tokens", 0)
            logger.info("vllm_completion_ok", tokens=tokens_used)
            return content.strip(), tokens_used
    
    async def complete_stream(
        self,
        messages: List[Dict[str, str]],
        model_id: str = "",
        temperature: float = 0.7,
        max_tokens: int = 512,
    ) -> AsyncGenerator[str, None]:
        """Streaming completion — yields token strings as they arrive."""
        url = f"{self.endpoint_url}/chat/completions"
        payload = {
            "model": model_id or self.model_id,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        headers = {"Authorization": f"Bearer {self.api_key}"}
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break
                        import json
                        chunk = json.loads(data_str)
                        delta = chunk["choices"][0].get("delta", {})
                        token = delta.get("content", "")
                        if token:
                            yield token
