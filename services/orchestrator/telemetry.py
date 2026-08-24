"""
Markova OS v3.0 — Telemetry & Distributed Tracing
─────────────────────────────────────────────────────────────────────────────
Captures OpenTelemetry-compatible traces and exact sub-500ms TTFA breakdown
for every voice turn.
─────────────────────────────────────────────────────────────────────────────
"""

import logging
import time
from typing import Dict, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("markova.telemetry")


class TurnLatencyMetric(BaseModel):
    call_id: str
    tenant_id: str
    turn_index: int = 1
    trace_id: str
    
    # Timing breakdown (in milliseconds)
    telephony_ingress_ms: float = 0.0
    vad_chunking_ms: float = 0.0
    stt_latency_ms: float = 0.0
    amharic_normalizer_ms: float = 0.0
    intent_router_ms: float = 0.0
    rag_retrieval_ms: float = 0.0
    llm_ttft_ms: float = 0.0  # Time to First Token
    tts_ttfa_ms: float = 0.0  # Time to First Audio
    audio_egress_ms: float = 0.0
    total_turn_ms: float = 0.0
    
    # Flags
    sub_500ms_achieved: bool = False
    routing_path: str = "FAST_PATH"  # "FAST_PATH" or "WORKFLOW_PATH"


class TraceSpan:
    def __init__(self, name: str, parent: Optional["TraceSpan"] = None):
        self.name = name
        self.parent = parent
        self.start_time: float = 0.0
        self.end_time: float = 0.0
        self.duration_ms: float = 0.0
        self.attributes: Dict[str, str] = {}

    def __enter__(self):
        self.start_time = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.perf_counter()
        self.duration_ms = (self.end_time - self.start_time) * 1000.0


def log_turn_metrics(metric: TurnLatencyMetric):
    """
    Logs and records turn latency metrics against the <500ms benchmark.
    """
    metric.sub_500ms_achieved = metric.tts_ttfa_ms < 500.0
    status_icon = "⚡ [SUB-500MS PASS]" if metric.sub_500ms_achieved else "⚠️ [LATENCY BUDGET EXCEEDED]"
    
    logger.info(
        f"{status_icon} Call: {metric.call_id} | Path: {metric.routing_path} | "
        f"TTFA: {metric.tts_ttfa_ms:.1f}ms | STT: {metric.stt_latency_ms:.1f}ms | "
        f"TTFT: {metric.llm_ttft_ms:.1f}ms | Total Turn: {metric.total_turn_ms:.1f}ms"
    )
