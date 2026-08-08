import httpx
from core.ports.llm_port import LLMPort

class UnifiedLLM(LLMPort):
    """
    Unified LLM completion adapter dispatcher.
    """
    async def complete(self, provider: str, model_id: str, messages: list, api_key: str) -> tuple[str, int]:
        from opentelemetry import trace
        tracer = trace.get_tracer("markova.orchestrator.llm")
        with tracer.start_as_current_span("llm_complete") as span:
            span.set_attribute("llm.provider", provider)
            span.set_attribute("llm.model_id", model_id)
            span.set_attribute("llm.message_count", len(messages))
            try:
                from services.orchestrator.circuit_breaker import llm_breaker
                if provider == "openai":
                    result = await llm_breaker.call(self._openai_complete, model_id, messages, api_key)
                elif provider == "groq":
                    result = await llm_breaker.call(self._groq_complete, model_id, messages, api_key)
                elif provider == "gemini":
                    result = await llm_breaker.call(self._gemini_complete, model_id, messages, api_key)
                elif provider == "vllm":
                    from services.orchestrator.vllm_adapter import VLLMAdapter
                    adapter = VLLMAdapter()
                    result = await llm_breaker.call(adapter.complete, messages, model_id=model_id)
                else:
                    raise ValueError(f"Unsupported LLM provider: {provider}")
                
                span.set_attribute("llm.tokens_used", result[1])
                return result
            except Exception as e:
                span.record_exception(e)
                span.set_status(trace.StatusCode.ERROR)
                raise

    async def _openai_complete(self, model_id: str, messages: list, api_key: str) -> tuple[str, int]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model_id or "gpt-4o-mini", "messages": messages, "max_tokens": 300, "temperature": 0.7}
            )
            resp.raise_for_status()
            data = resp.json()
            text = data["choices"][0]["message"]["content"].strip()
            tokens = data["usage"]["total_tokens"]
            return text, tokens

    async def _groq_complete(self, model_id: str, messages: list, api_key: str) -> tuple[str, int]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model_id or "llama-3.3-70b-versatile", "messages": messages, "max_tokens": 300}
            )
            resp.raise_for_status()
            data = resp.json()
            text = data["choices"][0]["message"]["content"].strip()
            tokens = data.get("usage", {}).get("total_tokens", 0)
            return text, tokens

    async def _gemini_complete(self, model_id: str, messages: list, api_key: str) -> tuple[str, int]:
        # Convert messages to Gemini format
        contents = []
        for msg in messages:
            if msg["role"] == "system":
                contents.append({"role": "user", "parts": [{"text": msg["content"]}]})
            else:
                role = "model" if msg["role"] == "assistant" else "user"
                contents.append({"role": role, "parts": [{"text": msg["content"]}]})

        model = model_id or "gemini-1.5-flash"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
                json={"contents": contents}
            )
            resp.raise_for_status()
            data = resp.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            return text, 0
