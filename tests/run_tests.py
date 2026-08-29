"""
Fast test runner for Markova OS v3.0 core architecture tests using built-in unittest / asyncio.
"""

import asyncio
import sys
import os
import unittest

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


class TestMarkovaV3Core(unittest.TestCase):

    def test_amharic_normalization(self):
        raw_amharic = "ሐኪም ኀይል ሠላም ዐይነት ጸሀይ"
        normalized = normalize_amharic_text(raw_amharic)
        self.assertIn("ሀኪም", normalized)
        self.assertIn("ሰላም", normalized)
        self.assertIn("አይነት", normalized)

    def test_garbage_speech_detection(self):
        self.assertTrue(is_amharic_garbage(""))
        self.assertTrue(is_amharic_garbage("a"))
        self.assertTrue(is_amharic_garbage("กขคงจฉชซ"))
        self.assertTrue(is_amharic_garbage("አአአአአአአአአአ"))
        self.assertFalse(is_amharic_garbage("ሰላም እንዴት ነዎት? የእቃ ዋጋ ማወቅ እፈልጋለሁ።"))

    def test_fast_intent_routing(self):
        self.assertEqual(fast_intent_classify("የሶፋ ዋጋ ስንት ነው?"), "FAST_PATH")
        self.assertEqual(fast_intent_classify("የስራ ሰዓታችሁ መቼ ነው?"), "FAST_PATH")
        self.assertEqual(fast_intent_classify("ትዕዛዜን ሰርዝልኝ"), "WORKFLOW_PATH")
        self.assertEqual(fast_intent_classify("እባክዎ አካውንቴን ቀይሩልኝ"), "WORKFLOW_PATH")

    def test_capability_kernel_execution(self):
        async def _run():
            registry = CapabilityRegistry()

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

            res = await registry.execute(
                CapabilityExecutionRequest(
                    capability_name="TEST_TOOL",
                    tenant_id="t_123",
                    agent_id="a_456",
                    parameters={"item": "sofa"},
                )
            )
            self.assertEqual(res.status, "SUCCESS")
            self.assertEqual(res.output, {"result": "processed sofa"})
            self.assertGreaterEqual(res.execution_time_ms, 0)

        asyncio.run(_run())

    def test_capability_timeout(self):
        async def _run():
            registry = CapabilityRegistry()

            async def slow_handler(req: CapabilityExecutionRequest):
                await asyncio.sleep(0.5)
                return {"done": True}

            registry.register(
                CapabilityDefinition(
                    name="SLOW_TOOL",
                    description="Slow tool",
                    timeout_ms=50,  # 50ms timeout
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
            self.assertEqual(res.status, "TIMEOUT")

        asyncio.run(_run())

    def test_event_envelope_creation(self):
        env = EventEnvelope.create(
            event_type="call.started",
            tenant_id="tenant_gm_furniture",
            payload={"caller": "+251911223344", "channel": "SIP"},
            actor_id="telephony_edge",
            trace_id="tr_999",
        )
        self.assertEqual(env["event_type"], "call.started")
        self.assertEqual(env["tenant_id"], "tenant_gm_furniture")
        self.assertEqual(env["actor_id"], "telephony_edge")
        self.assertIn("caller", env["payload"])

    def test_fast_voice_turn_stream(self):
        async def _run():
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
            self.assertIn("TOKEN", types)
            self.assertIn("SENTENCE_CHUNK", types)
            self.assertIn("METRICS", types)

            metrics_chunk = next(c for c in chunks if c["type"] == "METRICS")
            self.assertEqual(metrics_chunk["metrics"]["routing_path"], "FAST_PATH")
            self.assertEqual(metrics_chunk["metrics"]["turn_index"], 1)

        asyncio.run(_run())


if __name__ == "__main__":
    unittest.main()
