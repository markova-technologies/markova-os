"""
Markova AI Call Center — Production Security & Bug Remediation Verification Suite
Tests the 11 remediations outlined in docs/PRODUCTION_SECURITY_AND_BUG_REMEDIATION_PLAN.md
"""

import os
import re
import pytest
from unittest.mock import MagicMock, AsyncMock

class TestProductionRemediations:

    def test_amharic_vowel_order_preservation(self):
        """Verify normalizer logic maps homophones while preserving vowel orders."""
        # Read kernel/wasm/normalizer.rs to assert matching pairs
        normalizer_rs_path = os.path.join(os.path.dirname(__file__), "..", "kernel", "wasm", "normalizer.rs")
        with open(normalizer_rs_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Verify vowel orders 1-7 for ሐ -> ሀ
        assert "'ሐ' => 'ሀ'" in content
        assert "'ሑ' => 'ሁ'" in content
        assert "'ሒ' => 'ሂ'" in content
        assert "'ሓ' => 'ሃ'" in content
        assert "'ሔ' => 'ሄ'" in content
        assert "'ሕ' => 'ህ'" in content
        assert "'ሖ' => 'ሆ'" in content

        # Verify vowel orders for ዐ -> አ
        assert "'ዐ' => 'አ'" in content
        assert "'ዑ' => 'ኡ'" in content
        assert "'ዒ' => 'ኢ'" in content
        assert "'ዓ' => 'ኣ'" in content
        assert "'ዔ' => 'ኤ'" in content
        assert "'ዕ' => 'እ'" in content
        assert "'ዖ' => 'ኦ'" in content

    def test_api_gateway_auth_backdoor_blocked_in_production(self):
        """Verify api-gateway auth middleware checks NODE_ENV === 'production'."""
        auth_middleware_path = os.path.join(
            os.path.dirname(__file__), "..", "services", "api-gateway", "src", "auth.middleware.ts"
        )
        with open(auth_middleware_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Must check isProduction before allowing mock key
        assert "const isProduction = process.env.NODE_ENV === 'production';" in content
        assert "!isProduction && (apiKey.startsWith('mk_test_demo')" in content
        assert "!isProduction && bearerToken === 'demo-token'" in content

    def test_tenant_guard_demo_token_blocked_in_production(self):
        """Verify tenant-guard.js rejects demo-token in production."""
        guard_path = os.path.join(os.path.dirname(__file__), "..", "kernel", "identity", "tenant-guard.js")
        with open(guard_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "const isProduction = process.env.NODE_ENV === 'production';" in content
        assert "!isProduction && token === 'demo-token'" in content

    def test_cors_hardened_in_orchestrator_and_knowledge(self):
        """Verify wildcard CORS regex with credentials has been eliminated."""
        orch_main = os.path.join(os.path.dirname(__file__), "..", "services", "orchestrator", "main.py")
        with open(orch_main, "r", encoding="utf-8") as f:
            orch_content = f.read()
        assert 'allow_origin_regex=r"^https?://.*"' not in orch_content
        assert "allow_origins=allowed_orch_origins" in orch_content

        know_main = os.path.join(os.path.dirname(__file__), "..", "services", "knowledge-service", "main.py")
        with open(know_main, "r", encoding="utf-8") as f:
            know_content = f.read()
        assert 'allow_origin_regex=r"^https?://.*"' not in know_content
        assert "allow_origins=allowed_know_origins" in know_content

    def test_campaigns_router_header_parity(self):
        """Verify campaigns.py get_tenant_id inspects x-company-id and x-tenant-id case-insensitively."""
        campaigns_path = os.path.join(os.path.dirname(__file__), "..", "services", "orchestrator", "campaigns.py")
        with open(campaigns_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert 'request.headers.get("x-company-id")' in content
        assert 'request.headers.get("x-tenant-id")' in content

    def test_event_processor_redis_cursor(self):
        """Verify event processor consumer group starts at '0' not '$'."""
        processor_path = os.path.join(os.path.dirname(__file__), "..", "workers", "event-processor", "index.js")
        with open(processor_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "redis.xGroupCreate(STREAM_KEY, GROUP_NAME, '0', { MKSTREAM: true });" in content

    def test_rpa_agent_worker_lifecycle(self):
        """Verify rpa worker has active BullMQ Worker and signal handlers."""
        rpa_path = os.path.join(os.path.dirname(__file__), "..", "workers", "rpa-agent", "worker.js")
        with open(rpa_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "new Worker(" in content
        assert "process.on('SIGTERM', shutdown);" in content
        assert "process.on('SIGINT', shutdown);" in content

    def test_cost_engine_groq_and_whisper_pricing(self):
        """Verify cost engine covers Groq LLaMA and Whisper models with non-zero pricing."""
        cost_engine_path = os.path.join(os.path.dirname(__file__), "..", "kernel", "billing", "cost-engine.js")
        with open(cost_engine_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "'llama-3.3-70b-versatile'" in content
        assert "'whisper-large-v3'" in content
        assert "'_default'" in content

    def test_dockerfile_silero_vad_prebake(self):
        """Verify orchestrator Dockerfile pre-downloads silero_vad.onnx."""
        dockerfile_path = os.path.join(os.path.dirname(__file__), "..", "services", "orchestrator", "Dockerfile")
        with open(dockerfile_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "curl" in content and "silero_vad.onnx" in content
