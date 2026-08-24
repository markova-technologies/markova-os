"""
Markova OS v3.0 — Fast Voice Loop (Voice Data Plane)
─────────────────────────────────────────────────────────────────────────────
Ultra-low latency critical voice loop targeting <500ms TTFA (Time-to-First-Audio).

Flow:
  Audio Frame ➔ VAD ➔ Fast STT ➔ Amharic Normalizer ➔ Fast Intent Router
    ├─ [FAST PATH]: Direct RAG + LLM Stream ➔ Sentence Chunk ➔ Immediate TTS Stream
    └─ [WORKFLOW PATH]: Async Agent/Workflow Engine (CrewAI/Custom DAG)
─────────────────────────────────────────────────────────────────────────────
"""

import asyncio
import logging
import re
import time
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

from capability_kernel import CapabilityExecutionRequest, global_capability_registry
from phone_registry import PhoneContext
from telemetry import TurnLatencyMetric, log_turn_metrics

logger = logging.getLogger("markova.fast_voice_loop")

# Amharic homophone normalizer map (Ge'ez script canonical forms)
AMHARIC_NORMALIZATION_MAP = {
    'ሐ': 'ሀ', 'ሑ': 'ሁ', 'ሒ': 'ሂ', 'ሓ': 'ሃ', 'ሔ': 'ሄ', 'ሕ': 'ህ', 'ሖ': 'ሆ',
    'ኀ': 'ሀ', 'ኁ': 'ሁ', 'ኂ': 'ሂ', 'ኃ': 'ሃ', 'ኄ': 'ሄ', 'ኅ': 'ህ', 'ኆ': 'ሆ',
    'ሠ': 'ሰ', 'ሡ': 'ሱ', 'ሢ': 'ሲ', 'ሣ': 'ሳ', 'ሤ': 'ሴ', 'ሥ': 'ስ', 'ሦ': 'ሶ',
    'ዐ': 'አ', 'ዑ': 'ኡ', 'ዒ': 'ኢ', 'ዓ': 'ኣ', 'ዔ': 'ኤ', 'ዕ': 'እ', 'ዖ': 'ኦ',
    'ጸ': 'ፀ', 'ጹ': 'ፁ', 'ጺ': 'ፂ', 'ጻ': 'ፃ', 'ጼ': 'ፄ', 'ጽ': 'ፅ', 'ጾ': 'ፆ',
}

# Sentence boundary delimiters including Ge'ez full stop (።) and punctuation
SENTENCE_SPLIT_REGEX = re.compile(r'([።\.!\?\n])')


def normalize_amharic_text(text: str) -> str:
    """Canonicalize Amharic homophones to prevent model confusion."""
    if not text:
        return ""
    result = []
    for char in text:
        result.append(AMHARIC_NORMALIZATION_MAP.get(char, char))
    return "".join(result).strip()


def is_amharic_garbage(text: str) -> bool:
    """Detects Whisper hallucinations (wrong scripts, repetitive garbage, non-Amharic noise)."""
    if not text or len(text.strip()) < 2:
        return True
    
    # Check Unicode range: Ethiopic is 0x1200 - 0x137F
    amharic_chars = sum(1 for c in text if '\u1200' <= c <= '\u137F')
    total_chars = len(text.replace(" ", ""))
    
    if total_chars > 0 and (amharic_chars / total_chars) < 0.35:
        # Check if it's Latin/English (allowed for product names/numbers)
        latin_chars = sum(1 for c in text if c.isascii() and c.isalnum())
        if (latin_chars / total_chars) < 0.4:
            return True
            
    # Check for repetitive garbage loop
    if re.search(r'(.)\1{4,}', text):
        return True
        
    return False


def fast_intent_classify(text: str) -> str:
    """
    Ultra-fast heuristic intent classifier:
    - 'FAST_PATH': Direct Q&A, greetings, product pricing, FAQs.
    - 'WORKFLOW_PATH': Multi-step transaction, cancellation, database mutation.
    """
    lower = text.lower()
    complex_triggers = [
        "ሰርዝ", "አስተላልፍ", "ቀይር", "አካውንቴን", "ትዕዛዜን",
        "cancel", "reschedule", "update my account", "transfer to manager"
    ]
    if any(trigger in lower for trigger in complex_triggers):
        return "WORKFLOW_PATH"
    return "FAST_PATH"


class FastVoiceTurnExecutor:
    def __init__(
        self,
        call_id: str,
        phone_ctx: PhoneContext,
        turn_index: int = 1,
        trace_id: Optional[str] = None,
    ):
        self.call_id = call_id
        self.phone_ctx = phone_ctx
        self.turn_index = turn_index
        self.trace_id = trace_id or f"tr_{int(time.time()*1000)}"
        self.metric = TurnLatencyMetric(
            call_id=call_id,
            tenant_id=phone_ctx.tenant_id,
            turn_index=turn_index,
            trace_id=self.trace_id,
        )

    async def execute_turn_stream(
        self,
        transcript_raw: str,
        conversation_history: List[Dict[str, str]],
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Executes a single conversational turn with streaming token and audio chunks.
        Yields chunk payloads:
          { 'type': 'TOKEN', 'content': '...' }
          { 'type': 'SENTENCE_CHUNK', 'text': '...', 'audio_base64': '...' }
          { 'type': 'METRICS', 'metrics': TurnLatencyMetric }
        """
        turn_start = time.perf_counter()
        
        # 1. Amharic Normalization & Validation
        norm_start = time.perf_counter()
        cleaned_text = normalize_amharic_text(transcript_raw)
        self.metric.amharic_normalizer_ms = (time.perf_counter() - norm_start) * 1000.0

        if is_amharic_garbage(cleaned_text):
            logger.info(f"Garbage speech rejected: '{transcript_raw}'")
            yield {
                "type": "SENTENCE_CHUNK",
                "text": "ይቅርታ፣ ድምፅዎ በደንብ አልተሰማኝም። እባክዎ እንደገና ይድገሙልኝ?",
                "audio_url": None,
                "is_fallback": True,
            }
            return

        # 2. Fast Intent / Routing Path
        router_start = time.perf_counter()
        routing_path = fast_intent_classify(cleaned_text)
        self.metric.intent_router_ms = (time.perf_counter() - router_start) * 1000.0
        self.metric.routing_path = routing_path

        # 3. Fast RAG / Knowledge retrieval if applicable
        rag_context = ""
        if "SEARCH_KNOWLEDGE" in self.phone_ctx.capabilities:
            rag_start = time.perf_counter()
            kb_res = await global_capability_registry.execute(
                CapabilityExecutionRequest(
                    capability_name="SEARCH_KNOWLEDGE",
                    tenant_id=self.phone_ctx.tenant_id,
                    agent_id=self.phone_ctx.agent_id,
                    call_id=self.call_id,
                    parameters={"query": cleaned_text},
                    trace_id=self.trace_id,
                )
            )
            self.metric.rag_retrieval_ms = (time.perf_counter() - rag_start) * 1000.0
            if kb_res.status == "SUCCESS" and kb_res.output:
                results = kb_res.output.get("results", [])
                if results:
                    rag_context = "\n".join([r.get("content", "") for r in results])

        # 4. Stream LLM tokens and split on first sentence boundary
        llm_start = time.perf_counter()
        first_token_received = False
        sentence_buffer = ""
        first_sentence_emitted = False

        # In production this connects to Groq / VLLM streaming adapter
        async for token in self._mock_or_live_llm_stream(cleaned_text, rag_context, conversation_history):
            if not first_token_received:
                first_token_received = True
                self.metric.llm_ttft_ms = (time.perf_counter() - llm_start) * 1000.0

            yield {"type": "TOKEN", "content": token}
            sentence_buffer += token

            # Check if sentence end is reached
            match = SENTENCE_SPLIT_REGEX.search(sentence_buffer)
            if match:
                end_pos = match.end()
                sentence_to_tts = sentence_buffer[:end_pos].strip()
                sentence_buffer = sentence_buffer[end_pos:]

                if sentence_to_tts:
                    tts_start = time.perf_counter()
                    # Synthesize audio chunk
                    audio_payload = await self._synthesize_audio_chunk(sentence_to_tts)
                    
                    if not first_sentence_emitted:
                        first_sentence_emitted = True
                        self.metric.tts_ttfa_ms = (time.perf_counter() - turn_start) * 1000.0

                    yield {
                        "type": "SENTENCE_CHUNK",
                        "text": sentence_to_tts,
                        "audio_payload": audio_payload,
                        "tts_latency_ms": (time.perf_counter() - tts_start) * 1000.0,
                    }

        # Flush remaining sentence buffer if any
        if sentence_buffer.strip():
            sentence_to_tts = sentence_buffer.strip()
            tts_start = time.perf_counter()
            audio_payload = await self._synthesize_audio_chunk(sentence_to_tts)
            if not first_sentence_emitted:
                first_sentence_emitted = True
                self.metric.tts_ttfa_ms = (time.perf_counter() - turn_start) * 1000.0

            yield {
                "type": "SENTENCE_CHUNK",
                "text": sentence_to_tts,
                "audio_payload": audio_payload,
                "tts_latency_ms": (time.perf_counter() - tts_start) * 1000.0,
            }

        # Finalize turn metrics
        self.metric.total_turn_ms = (time.perf_counter() - turn_start) * 1000.0
        log_turn_metrics(self.metric)
        metric_data = self.metric.model_dump() if hasattr(self.metric, "model_dump") else self.metric.dict()
        yield {"type": "METRICS", "metrics": metric_data}

    async def _mock_or_live_llm_stream(
        self,
        user_text: str,
        rag_context: str,
        history: List[Dict[str, str]],
    ) -> AsyncGenerator[str, None]:
        """Streaming generator emitting response tokens."""
        # Simulated realistic Amharic tokens for rapid response
        sample_response = f"እንኳን ደህና መጡ! {self.phone_ctx.company_name} የደንበኞች አገልግሎት ነው። ምን ልርዳዎት?"
        words = sample_response.split(" ")
        for w in words:
            await asyncio.sleep(0.02)  # Simulate 20ms token stream
            yield w + " "

    async def _synthesize_audio_chunk(self, text: str) -> Dict[str, Any]:
        """Fast TTS synthesis for individual sentence chunks."""
        # Returns metadata ready for WebSocket audio playback
        return {
            "text": text,
            "voice": self.phone_ctx.voice_id,
            "format": "pcm_16khz",
            "duration_est_ms": len(text) * 45,
        }
