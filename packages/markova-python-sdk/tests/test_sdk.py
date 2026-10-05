"""
Unit tests for Markova Python SDK
"""

import hashlib
import hmac
import json
import asyncio
import pytest
from unittest.mock import MagicMock, patch
import httpx

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from markova import (
    MarkovaClient,
    AsyncMarkovaClient,
    MarkovaError,
    AuthenticationError,
    PermissionDeniedError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    verify_webhook_signature,
    compute_webhook_signature,
)


def test_webhook_signature_verification():
    secret = "whsec_test_secret_12345"
    payload = {"event": "call.completed", "call_id": "call_abc123", "data": {"status": "completed"}}
    raw_payload_str = json.dumps(payload)
    raw_payload_bytes = raw_payload_str.encode("utf-8")

    # 1. Compute signature
    sig_header = compute_webhook_signature(raw_payload_str, secret)
    assert sig_header.startswith("sha256=")

    # 2. Valid verification with str and bytes
    assert verify_webhook_signature(raw_payload_str, sig_header, secret) is True
    assert verify_webhook_signature(raw_payload_bytes, sig_header, secret) is True
    assert MarkovaClient.verify_webhook_signature(raw_payload_str, sig_header, secret) is True

    # 3. Forged or tampered payload
    assert verify_webhook_signature("tampered_body", sig_header, secret) is False

    # 4. Wrong secret
    assert verify_webhook_signature(raw_payload_str, sig_header, "wrong_secret") is False

    # 5. Invalid / malformed header
    assert verify_webhook_signature(raw_payload_str, "invalid_sig_hex", secret) is False
    assert verify_webhook_signature(raw_payload_str, "", secret) is False
    assert verify_webhook_signature("", sig_header, secret) is False


def test_client_init_and_headers():
    client = MarkovaClient(
        api_key="mk_live_12345",
        base_url="https://api.markova.et/v1",
    )
    assert client.base_url == "https://api.markova.et/v1"
    assert client.api_key == "mk_live_12345"

    headers = client._headers({"Custom-Header": "value"})
    assert headers["x-api-key"] == "mk_live_12345"
    assert headers["Custom-Header"] == "value"
    assert headers["User-Agent"] == "markova-python-sdk/1.0.0"


def test_calls_create_idempotency_and_parameters():
    client = MarkovaClient(api_key="mk_test_sandbox")
    captured_request = {}

    def mock_request(method, url, params=None, json=None, headers=None):
        captured_request["method"] = method
        captured_request["url"] = url
        captured_request["params"] = params
        captured_request["json"] = json
        captured_request["headers"] = headers
        return httpx.Response(200, json={"id": "call_123", "status": "initiated"})

    client._http.request = mock_request

    # Dispatch call with idempotency key and webhook
    result = client.calls.create(
        agent_id="agent_uuid_1",
        to="+251911223344",
        sandbox=True,
        webhook_url="https://bank.et/webhook",
        idempotency_key="idemp_key_abc",
    )

    assert result["id"] == "call_123"
    assert captured_request["method"] == "POST"
    assert captured_request["url"] == f"{client.base_url}/v1/calls"
    assert captured_request["headers"]["Idempotency-Key"] == "idemp_key_abc"
    assert captured_request["json"]["agent_id"] == "agent_uuid_1"
    assert captured_request["json"]["to_number"] == "+251911223344"
    assert captured_request["json"]["sandbox"] is True
    assert captured_request["json"]["webhook_url"] == "https://bank.et/webhook"


def test_error_status_mapping():
    client = MarkovaClient(api_key="mk_live_test")

    # 401 AuthenticationError
    client._http.request = lambda *a, **kw: httpx.Response(401, json={"error": "Invalid API Key"})
    with pytest.raises(AuthenticationError) as exc_info:
        client.calls.list()
    assert exc_info.value.status_code == 401
    assert "Invalid API Key" in str(exc_info.value)

    # 403 PermissionDeniedError
    client._http.request = lambda *a, **kw: httpx.Response(403, json={"error": "Forbidden"})
    with pytest.raises(PermissionDeniedError):
        client.calls.list()

    # 404 NotFoundError
    client._http.request = lambda *a, **kw: httpx.Response(404, json={"detail": "Agent not found"})
    with pytest.raises(NotFoundError):
        client.agents.get("non_existent")

    # 409 ConflictError (Idempotency concurrent lock)
    client._http.request = lambda *a, **kw: httpx.Response(409, json={"detail": "Concurrent request in progress"})
    with pytest.raises(ConflictError):
        client.calls.create(agent_id="a", to="+251911000000", idempotency_key="dup_key")

    # 429 RateLimitError
    client._http.request = lambda *a, **kw: httpx.Response(429, json={"error": "Rate limit exceeded"})
    with pytest.raises(RateLimitError):
        client.calls.list()


def test_providers_crud():
    client = MarkovaClient(api_key="mk_live_admin")
    captured = {}

    def mock_req(method, url, params=None, json=None, headers=None):
        captured["method"] = method
        captured["url"] = url
        captured["json"] = json
        return httpx.Response(200, json={"status": "success", "providers": [{"provider_name": "groq"}]})

    client._http.request = mock_req

    # List
    providers = client.providers.list()
    assert captured["method"] == "GET"
    assert captured["url"] == f"{client.base_url}/v1/providers"

    # Set
    client.providers.set("llm", "groq", {"api_key": "gsk_new_secret"})
    assert captured["method"] == "PUT"
    assert captured["url"] == f"{client.base_url}/v1/providers/llm/groq"
    assert captured["json"] == {"api_key": "gsk_new_secret"}

    # Delete
    client.providers.delete("llm", "groq")
    assert captured["method"] == "DELETE"
    assert captured["url"] == f"{client.base_url}/v1/providers/llm/groq"


def test_async_client_calls_and_providers():
    async def _run():
        async with AsyncMarkovaClient(api_key="mk_test_async") as client:
            captured = {}

            async def mock_async_req(method, url, params=None, json=None, headers=None):
                captured["method"] = method
                captured["url"] = url
                captured["headers"] = headers
                return httpx.Response(200, json={"status": "initiated", "id": "async_call_1"})

            client._http.request = mock_async_req

            resp = await client.calls.create(
                agent_id="ag_async",
                to="+251911000000",
                idempotency_key="async_idemp_key_1",
            )
            assert resp["id"] == "async_call_1"
            assert captured["headers"]["Idempotency-Key"] == "async_idemp_key_1"

    asyncio.run(_run())
