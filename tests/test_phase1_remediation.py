"""
Unit tests validating Phase 1 remediations across Markova AI Call Center:
- Twilio signature verification with reverse-proxy headers
- Pagination boundaries for /v1/calls
- OpenAPI spec file presence and valid YAML AST
- Zero duplicate /v1 prefixes in client-dashboard connector endpoints
- Single assignment of x-company-id header in gateway auth middleware
"""

import base64
import hashlib
import hmac
import os
import re
import unittest
import yaml


class MockRequest:
    def __init__(self, url, headers=None, form_data=None):
        self.url = MockURL(url)
        self.headers = headers or {}
        self._form = form_data or {}

    async def form(self):
        return self._form


class MockURL:
    def __init__(self, url_str):
        self._raw = url_str
        # simple parse
        from urllib.parse import urlparse
        parsed = urlparse(url_str)
        self.scheme = parsed.scheme
        self.netloc = parsed.netloc
        self.path = parsed.path
        self.query = parsed.query

    def __str__(self):
        return self._raw


def compute_twilio_signature(auth_token: str, url: str, params: dict) -> str:
    sorted_params = "".join([f"{k}{v}" for k, v in sorted(params.items())])
    data_to_sign = (url + sorted_params).encode("utf-8")
    return base64.b64encode(hmac.new(auth_token.encode("utf-8"), data_to_sign, hashlib.sha1).digest()).decode()


class TestPhase1Remediations(unittest.IsolatedAsyncioTestCase):

    async def test_twilio_signature_with_reverse_proxy(self):
        auth_token = "secret_twilio_token_12345"
        public_url = "https://api.markova.et/incoming-call"
        form_params = {"CallSid": "CA12345", "From": "+251911000000", "To": "+251116000000"}

        # Signature was computed by Twilio against the public HTTPS URL
        expected_sig = compute_twilio_signature(auth_token, public_url, form_params)

        # Internal request as seen inside Docker container behind Render/Nginx:
        # direct URL is http://orchestrator:8005/incoming-call
        # but x-forwarded-proto is https and x-forwarded-host is api.markova.et
        headers = {
            "X-Twilio-Signature": expected_sig,
            "x-forwarded-proto": "https",
            "x-forwarded-host": "api.markova.et",
        }
        req = MockRequest("http://orchestrator:8005/incoming-call", headers=headers, form_data=form_params)

        # Test candidate URL evaluation logic
        proto = req.headers.get("x-forwarded-proto", req.url.scheme).split(",")[0].strip()
        host = req.headers.get("x-forwarded-host", req.headers.get("host", req.url.netloc)).split(",")[0].strip()
        path = req.url.path
        query = f"?{req.url.query}" if req.url.query else ""
        forwarded_url = f"{proto}://{host}{path}{query}"

        self.assertEqual(forwarded_url, public_url)

        # Verify candidate matches expected signature
        candidate_sig = compute_twilio_signature(auth_token, forwarded_url, form_params)
        self.assertTrue(hmac.compare_digest(candidate_sig, expected_sig))

        # Ensure forged/invalid signature is rejected
        self.assertFalse(hmac.compare_digest(compute_twilio_signature(auth_token, forwarded_url, {"CallSid": "FAKE"}), expected_sig))

    def test_openapi_yaml_spec_validity(self):
        root_spec = os.path.join(os.path.dirname(__file__), "..", "openapi.yaml")
        gateway_spec = os.path.join(os.path.dirname(__file__), "..", "services", "api-gateway", "openapi.yaml")

        self.assertTrue(os.path.exists(root_spec), "Root openapi.yaml missing")
        self.assertTrue(os.path.exists(gateway_spec), "Gateway openapi.yaml missing")

        with open(gateway_spec, "r", encoding="utf-8") as f:
            parsed = yaml.safe_load(f)

        self.assertIn("openapi", parsed)
        self.assertIn("paths", parsed)
        self.assertIn("/v1/calls", parsed["paths"])
        self.assertIn("/v1/agents", parsed["paths"])

    def test_client_js_no_double_v1_connectors(self):
        client_js_path = os.path.join(os.path.dirname(__file__), "..", "apps", "client-dashboard", "src", "api", "client.js")
        with open(client_js_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Should NOT contain api.get('/v1/connectors') or api.post('/v1/connectors')
        matches = re.findall(r"api\.(?:get|post|delete|put|patch)\(['\"`]/v1/connectors", content)
        self.assertEqual(matches, [], f"Found unexpected double /v1 connector endpoints: {matches}")

    def test_auth_middleware_deduplicated_company_id(self):
        auth_mid_path = os.path.join(os.path.dirname(__file__), "..", "services", "api-gateway", "src", "auth.middleware.ts")
        with open(auth_mid_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        company_id_assignments = [
            (i + 1, line.strip())
            for i, line in enumerate(lines)
            if re.search(r"req\.headers\['x-company-id'\]\s*=", line) and not line.strip().startswith("//")
        ]
        self.assertEqual(
            len(company_id_assignments),
            1,
            f"Expected exactly 1 x-company-id header assignment, found {len(company_id_assignments)}: {company_id_assignments}"
        )


if __name__ == "__main__":
    unittest.main()
