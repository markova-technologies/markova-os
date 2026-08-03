import httpx
import os
from typing import Optional, Dict, Any, List

class VLLMAdapter:
    """
    Self-Hosted vLLM / Local GPU Cluster LLM Adapter.
    Enables local inference for LLaMA 3.1 70B, Qwen 2.5, and DeepSeek R1 models
    behind Markova's model-agnostic LLM interface.
    """
    def __init__(self, endpoint_url: Optional[str] = None):
        self.endpoint_url = endpoint_url or os.getenv("VLLM_ENDPOINT_URL", "http://vllm-cluster:8000/v1")

    async def complete(self, messages: List[Dict[str, str]], model_id: str = "meta-llama/Llama-3.1-70B-Instruct", temperature: float = 0.7, max_tokens: int = 512) -> Tuple[str, int]:
        url = f"{self.endpoint_url}/chat/completions"
        payload = {
            "model": model_id,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()

            choice = data["choices"][0]
            content = choice["message"]["content"]
            tokens_used = data.get("usage", {}).get("total_tokens", 0)

            return content.strip(), tokens_used
