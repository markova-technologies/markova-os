"""
Unit tests for Markova OS v3.0 Core Engine
Testing Voice Data Plane, Phone Registry, Capability Kernel, and Dual Event Bus.
"""

import asyncio
import sys
import os
import pytest

# Add services/orchestrator to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "orchestrator")))

from phone_registry import PhoneContext
from capability_kernel import (
    CapabilityDefinition,
    CapabilityParameter,
    CapabilityRegistry,
    CapabilityExecutionRequest,
)
from fast_voice_loop import (
    normalize_amharic_text,
    is_amharic_garbage,
    fast_intent_classify,
    FastVoiceTurnExecutor,
)
from event_bus import EventEnvelope
from telemetry import TurnLatencyMetric


def test_amharic_normalization():
    # Test canonicalization of homophones
    raw_amharic = "ሐኪም ኀይል ሠላም ዐይነት ጸሀይ"
    normalized = normalize_amharic_text(raw_amharic)
    assert "ሀኪም" in normalized
    assert "ሰላም" in normalized
    assert "አይነት" in normalized
    assert "ፀሀይ" in normalized or "ፀሀይ" in normalized or "ጸ" not in normalized


def test_garbage_speech_detection():
    assert is_amharic_garbage("") == True
    assert is_amharic_garbage("a") == True
    # Non-Ethiopic / Non-Latin random Unicode garbage
    assert is_amharic_garbage("กขคงจฉชซ") == True
    # Repetitive loop hallucination
    assert is_amharic_garbage("አአአአአአአአአአ") == True
    # Valid Amharic speech
    assert is_amharic_garbage("ሰላም እንዴት ነዎት? የእቃ ዋጋ ማወቅ እፈልጋለሁ።") == False


def test_fast_intent_routing():
    # Simple Q&A should hit FAST_PATH
    assert fast_intent_classify("የሶፋ ዋጋ ስንት ነው?") == "FAST_PATH"
    assert fast_intent_classify("የስራ ሰዓታችሁ መቼ ነው?") == "FAST_PATH"
    
    # Complex multi-step mutation should hit WORKFLOW_PATH
    assert fast_intent_classify("ትዕዛዜን ሰርዝልኝ") == "WORKFLOW_PATH"
    assert fast_intent_classify("እባክዎ አካውንቴን ቀይሩልኝ") == "WORKFLOW_PATH"


@pytest.mark.asyncio
async def test_capability_kernel_execution():
    registry = CapabilityRegistry()
    
    # Register a test tool
    async def sample_handler(req: CapabilityExecutionRequest):
        return {"result": f"processed {req.parameters.get('item')}"}

    registry.register(
        CapabilityDefinition(
            name="TEST_TOOL",
            description="A test tool",
            parameters=[CapabilityParameter(name="item", type="string", description="item name")],
            timeout_ms=1000,
        ),
        sample_handler,
    )

    # Execute successfully
    res = await registry.execute(
        CapabilityExecutionRequest(
            capability_name="TEST_TOOL",
            tenant_id="t_123",
            agent_id="a_456",
            parameters={"item": "sofa"},
        )
    )
    assert res.status == "SUCCESS"
    assert res.output == {"result": "processed sofa"}
    assert res.execution_time_ms >= 0


@pytest.mark.asyncio
async def test_capability_timeout():
    registry = CapabilityRegistry()
    
    async def slow_handler(req: CapabilityExecutionRequest):
        await asyncio.sleep(0.5)
        return {"done": True}

    registry.register(
        CapabilityDefinition(
            name="SLOW_TOOL",
            description="Slow tool",
            timeout_ms=100,  # 100ms timeout
        ),
        slow_handler,
    )

    res = await registry.execute(
        CapabilityExecutionRequest(
            capability_name="SLOW_TOOL",
            tenant_id="t_123",
            agent_id="a_456",
        )
    )
    assert res.status == "TIMEOUT"


def test_event_envelope_creation():
    env = EventEnvelope.create(
        event_type="call.started",
        tenant_id="tenant_gm_furniture",
        payload={"caller": "+251911223344", "channel": "SIP"},
        actor_id="telephony_edge",
        trace_id="tr_999",
    )
    assert env["event_type"] == "call.started"
    assert env["tenant_id"] == "tenant_gm_furniture"
    assert env["actor_id"] == "telephony_edge"
    assert "caller" in env["payload"]


@pytest.mark.asyncio
async def test_fast_voice_turn_stream():
    ctx = PhoneContext(
        tenant_id="t_test",
        company_name="GM Furniture",
        agent_id="a_test",
        agent_name="Almaz",
        system_prompt="You are Almaz",
        voice_id="am-ET-MekdesNeural",
    )

    executor = FastVoiceTurnExecutor(call_id="call_abc123", phone_ctx=ctx)
    chunks = []
    async for chunk in executor.execute_turn_stream("ሰላም ዋጋ ማወቅ እፈልጋለሁ", []):
        chunks.append(chunk)

    types = [c["type"] for c in chunks]
    assert "TOKEN" in types
    assert "SENTENCE_CHUNK" in types
    assert "METRICS" in types
    
    metrics_chunk = next(c for c in chunks if c["type"] == "METRICS")
    assert metrics_chunk["metrics"]["routing_path"] == "FAST_PATH"
    assert metrics_chunk["metrics"]["turn_index"] == 1
