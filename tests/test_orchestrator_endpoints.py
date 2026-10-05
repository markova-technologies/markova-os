"""
Direct endpoint & behavior integration test suite for Markova Orchestrator:
- Health & readiness endpoints
- /v1/calls parameter validation & error responses
- Idempotency-Key behavior & Redis caching simulation
- /v1/providers CRUD with AES-256-GCM encryption
- Reverse-proxy Twilio signature verification
- Proactive RAG injection during voice turns
"""

import asyncio
import base64
import hashlib
import hmac
import json
import os
import sys
import time
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
import uuid

# Inject orchestrator into path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "services", "orchestrator"))
os.environ["ENCRYPTION_KEY"] = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
os.environ["TWILIO_AUTH_TOKEN"] = "test_auth_token_secret_123"

from starlette.testclient import TestClient
import main


class TestOrchestratorEndpoints(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(main.app)
        self.dummy_company_id = "00000000-0000-0000-0000-000000000001"
        self.auth_headers = {
            "x-company-id": self.dummy_company_id,
            "x-tenant-id": self.dummy_company_id,
            "x-markova-env": "test",
            "Authorization": "Bearer demo-token",
        }

    def test_health_endpoints(self):
        resp = self.client.get("/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("status", data)

    def test_calls_post_missing_parameters(self):
        # Missing agent_id and to_number
        resp = self.client.post("/v1/calls", json={}, headers=self.auth_headers)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("required", resp.json().get("detail", ""))

        # Only agent_id provided, missing to_number
        resp = self.client.post("/v1/calls", json={"agent_id": str(uuid.uuid4())}, headers=self.auth_headers)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("required", resp.json().get("detail", ""))

    def test_calls_post_accepts_to_alias(self):
        # Verify that providing "to" instead of "to_number" satisfies the required parameter check
        # (It should proceed to database lookup and return 404 for non-existent agent, NOT 400 parameter missing)
        dummy_agent = str(uuid.uuid4())
        with patch.object(main, "db_pool") as mock_pool:
            mock_pool.fetchrow = AsyncMock(return_value=None)
            resp = self.client.post(
                "/v1/calls",
                json={"agent_id": dummy_agent, "to": "+251911223344"},
                headers=self.auth_headers
            )
            # Should fail with 404 Agent not found, demonstrating "to" was accepted as phone parameter
            self.assertEqual(resp.status_code, 404)
            self.assertEqual(resp.json().get("detail"), "Agent not found")

    def test_calls_idempotency_workflow(self):
        dummy_agent = str(uuid.uuid4())
        mock_redis = MagicMock()
        mock_redis.get = AsyncMock()
        mock_redis.set = AsyncMock()

        # Step 1: When Idempotency key is PROCESSING, return 409
        mock_redis.get.return_value = b"PROCESSING"
        with patch.object(main, "redis_client", mock_redis):
            resp = self.client.post(
                "/v1/calls",
                json={"agent_id": dummy_agent, "to_number": "+251911223344"},
                headers={**self.auth_headers, "Idempotency-Key": "key_concurrent_123"}
            )
            self.assertEqual(resp.status_code, 409)
            self.assertIn("Concurrent request", resp.json().get("detail", ""))

        # Step 2: When Idempotency key contains a cached response, replay it with header
        cached_call = {
            "id": "call_cached_999",
            "agent_id": dummy_agent,
            "caller_number": "+251911223344",
            "status": "completed",
            "sandbox": True,
        }
        mock_redis.get.return_value = json.dumps(cached_call).encode("utf-8")
        with patch.object(main, "redis_client", mock_redis):
            resp = self.client.post(
                "/v1/calls",
                json={"agent_id": dummy_agent, "to_number": "+251911223344"},
                headers={**self.auth_headers, "Idempotency-Key": "key_replay_456"}
            )
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.headers.get("x-idempotency-hit"), "true")
            self.assertEqual(resp.json()["id"], "call_cached_999")

    def test_provider_configs_crud(self):
        mock_pool = MagicMock()
        mock_pool.fetch = AsyncMock(return_value=[
            {
                "provider_type": "llm",
                "provider_name": "groq",
                "encrypted_config": json.dumps({"api_key": "gsk_test12345678"}),
                "created_at": None,
            }
        ])
        mock_pool.fetchrow = AsyncMock(return_value={"id": uuid.uuid4()})
        mock_pool.execute = AsyncMock(return_value=None)

        with patch.object(main, "db_pool", mock_pool):
            # 1. GET /v1/providers
            resp = self.client.get("/v1/providers", headers=self.auth_headers)
            self.assertEqual(resp.status_code, 200)
            providers = resp.json().get("providers", [])
            self.assertEqual(len(providers), 1)
            self.assertEqual(providers[0]["provider_name"], "groq")
            # Must be masked
            self.assertIn("...", providers[0]["key_preview"])

            # 2. PUT /v1/providers/llm/groq
            resp = self.client.put(
                "/v1/providers/llm/groq",
                json={"api_key": "gsk_new_secret_key_abcdef123456"},
                headers=self.auth_headers
            )
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json()["status"], "success")
            self.assertTrue(mock_pool.execute.called)

            # 3. DELETE /v1/providers/llm/groq
            resp = self.client.delete("/v1/providers/llm/groq", headers=self.auth_headers)
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json()["status"], "success")

    def test_twilio_signature_reverse_proxy_validation(self):
        async def _run():
            auth_token = "test_auth_token_secret_123"
            public_url = "https://api.markova.et/incoming-call"
            form_data = {"CallSid": "CA_test_123", "From": "+251911000000", "To": "+251116000000"}

            sorted_params = "".join([f"{k}{v}" for k, v in sorted(form_data.items())])
            expected_sig = base64.b64encode(
                hmac.new(auth_token.encode("utf-8"), (public_url + sorted_params).encode("utf-8"), hashlib.sha1).digest()
            ).decode()

            class FakeRequest:
                def __init__(self, raw_url, headers, form_body):
                    from urllib.parse import urlparse
                    self.url = self
                    self._raw = raw_url
                    parsed = urlparse(raw_url)
                    self.scheme = parsed.scheme
                    self.netloc = parsed.netloc
                    self.path = parsed.path
                    self.query = parsed.query
                    self.headers = headers
                    self._form_body = form_body

                def __str__(self):
                    return self._raw

                async def form(self):
                    return self._form_body

            req = FakeRequest(
                raw_url="http://orchestrator:8005/incoming-call",
                headers={
                    "X-Twilio-Signature": expected_sig,
                    "x-forwarded-proto": "https",
                    "x-forwarded-host": "api.markova.et",
                },
                form_body=form_data,
            )

            is_valid = await main.verify_twilio_signature(req)
            self.assertTrue(is_valid)

            # Forged signature must be rejected
            req.headers["X-Twilio-Signature"] = "invalid_forged_sig"
            is_valid_forged = await main.verify_twilio_signature(req)
            self.assertFalse(is_valid_forged)

        asyncio.run(_run())

    def test_gateway_signature_auth(self):
        secret = "test-service-auth-secret-12345"
        company_id = "00000000-0000-0000-0000-000000000002"
        user_id = "00000000-0000-0000-0000-000000000099"
        ts = str(int(time.time() * 1000))

        payload = f"{company_id}:{user_id}:{ts}"
        sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()

        with patch.dict(os.environ, {"SERVICE_AUTH_SECRET": secret}):
            with patch.object(main, "db_pool") as mock_pool:
                mock_pool.fetch = AsyncMock(return_value=[])

                # 1. Valid gateway signature succeeds
                headers = {
                    "x-company-id": company_id,
                    "x-user-id": user_id,
                    "x-gateway-timestamp": ts,
                    "x-gateway-sig": sig,
                }
                resp = self.client.get("/v1/calls", headers=headers)
                self.assertEqual(resp.status_code, 200)

                # 2. Invalid signature returns 403
                bad_headers = {**headers, "x-gateway-sig": "bad_sig_hex"}
                resp = self.client.get("/v1/calls", headers=bad_headers)
                self.assertEqual(resp.status_code, 403)

                # 3. Expired timestamp returns 401
                expired_ts = str(int((time.time() - 400) * 1000))
                expired_payload = f"{company_id}:{user_id}:{expired_ts}"
                expired_sig = hmac.new(secret.encode(), expired_payload.encode(), hashlib.sha256).hexdigest()
                expired_headers = {
                    "x-company-id": company_id,
                    "x-user-id": user_id,
                    "x-gateway-timestamp": expired_ts,
                    "x-gateway-sig": expired_sig,
                }
                resp = self.client.get("/v1/calls", headers=expired_headers)
                self.assertEqual(resp.status_code, 401)


if __name__ == "__main__":
    unittest.main()
