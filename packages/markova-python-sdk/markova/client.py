"""
Markova Python SDK — Client Implementation
Synchronous and Asynchronous clients for Markova AI Call Center API.
"""

from typing import Any, Dict, List, Optional, Union
import json
import os
import httpx

from markova.exceptions import (
    MarkovaError,
    AuthenticationError,
    PermissionDeniedError,
    NotFoundError,
    ConflictError,
    RateLimitError,
)
from markova.webhook import verify_webhook_signature, compute_webhook_signature


def _handle_response_error(response: httpx.Response) -> None:
    status = response.status_code
    try:
        data = response.json()
        message = data.get("error") or data.get("detail") or data.get("message") or response.text
    except Exception:
        data = None
        message = response.text or f"HTTP {status}"

    if status in (401,):
        raise AuthenticationError(message, status_code=status, response_body=data)
    elif status in (403,):
        raise PermissionDeniedError(message, status_code=status, response_body=data)
    elif status in (404,):
        raise NotFoundError(message, status_code=status, response_body=data)
    elif status in (409,):
        raise ConflictError(message, status_code=status, response_body=data)
    elif status in (429,):
        raise RateLimitError(message, status_code=status, response_body=data)
    else:
        raise MarkovaError(message, status_code=status, response_body=data)


class _BaseCallsResource:
    pass


class CallsResource:
    def __init__(self, client: "MarkovaClient"):
        self._client = client

    def create(
        self,
        agent_id: str,
        to: str,
        sandbox: Optional[bool] = None,
        webhook_url: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        headers = {}
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key

        payload: Dict[str, Any] = {
            "agent_id": agent_id,
            "to_number": to,
        }
        if sandbox is not None:
            payload["sandbox"] = sandbox
        if webhook_url:
            payload["webhook_url"] = webhook_url

        return self._client.request("POST", "/v1/calls", json=payload, headers=headers)

    def list(
        self,
        agent_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        params: Dict[str, Any] = {"limit": limit, "offset": offset}
        if agent_id:
            params["agent_id"] = agent_id
        if status:
            params["status"] = status
        return self._client.request("GET", "/v1/calls", params=params)

    def get(self, call_id: str) -> Dict[str, Any]:
        return self._client.request("GET", f"/v1/calls/{call_id}")

    def get_transcript(self, call_id: str) -> Dict[str, Any]:
        return self._client.request("GET", f"/v1/calls/{call_id}/transcript")

    def get_recording(self, call_id: str) -> Dict[str, Any]:
        return self._client.request("GET", f"/v1/calls/{call_id}/recording")

    def transfer(self, call_id: str, to: str) -> Dict[str, Any]:
        return self._client.request("POST", f"/v1/calls/{call_id}/transfer", json={"to": to})


class AgentsResource:
    def __init__(self, client: "MarkovaClient"):
        self._client = client

    def list(self) -> List[Dict[str, Any]]:
        return self._client.request("GET", "/v1/agents")

    def get(self, agent_id: str) -> Dict[str, Any]:
        return self._client.request("GET", f"/v1/agents/{agent_id}")

    def create(self, **kwargs) -> Dict[str, Any]:
        return self._client.request("POST", "/v1/agents", json=kwargs)

    def update(self, agent_id: str, **kwargs) -> Dict[str, Any]:
        return self._client.request("PUT", f"/v1/agents/{agent_id}", json=kwargs)

    def delete(self, agent_id: str) -> Dict[str, Any]:
        return self._client.request("DELETE", f"/v1/agents/{agent_id}")

    def list_versions(self, agent_id: str) -> List[Dict[str, Any]]:
        return self._client.request("GET", f"/v1/agents/{agent_id}/versions")

    def rollback(self, agent_id: str, version_id: str) -> Dict[str, Any]:
        return self._client.request("POST", f"/v1/agents/{agent_id}/versions/{version_id}/rollback")


class ProvidersResource:
    def __init__(self, client: "MarkovaClient"):
        self._client = client

    def list(self) -> Dict[str, Any]:
        return self._client.request("GET", "/v1/providers")

    def set(self, provider_type: str, provider_name: str, config: Dict[str, Any]) -> Dict[str, Any]:
        return self._client.request("PUT", f"/v1/providers/{provider_type}/{provider_name}", json=config)

    def delete(self, provider_type: str, provider_name: str) -> Dict[str, Any]:
        return self._client.request("DELETE", f"/v1/providers/{provider_type}/{provider_name}")


class WebhooksResource:
    def __init__(self, client: "MarkovaClient"):
        self._client = client

    def list(self) -> List[Dict[str, Any]]:
        return self._client.request("GET", "/v1/webhooks")

    def create(self, url: str, events: Optional[List[str]] = None, description: Optional[str] = None) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"url": url}
        if events:
            payload["events"] = events
        if description:
            payload["description"] = description
        return self._client.request("POST", "/v1/webhooks", json=payload)

    def delete(self, webhook_id: str) -> Dict[str, Any]:
        return self._client.request("DELETE", f"/v1/webhooks/{webhook_id}")


class MarkovaClient:
    """
    Synchronous Markova AI Call Center API Client.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        token: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: float = 30.0,
    ):
        self.base_url = (base_url or os.environ.get("MARKOVA_API_URL", "https://api.markova.tech")).rstrip("/")
        self.api_key = api_key
        self.token = token
        self.timeout = timeout
        self._http = httpx.Client(timeout=timeout)

        # Resource namespaces
        self.calls = CallsResource(self)
        self.agents = AgentsResource(self)
        self.providers = ProvidersResource(self)
        self.webhooks = WebhooksResource(self)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def close(self):
        self._http.close()

    def _headers(self, custom_headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers: Dict[str, str] = {
            "Content-Type": "application/json",
            "User-Agent": "markova-python-sdk/1.0.0",
        }
        if self.api_key:
            headers["x-api-key"] = self.api_key
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if custom_headers:
            headers.update(custom_headers)
        return headers

    def request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Any:
        url = f"{self.base_url}{path}"
        req_headers = self._headers(headers)

        resp = self._http.request(
            method=method,
            url=url,
            params=params,
            json=json,
            headers=req_headers,
        )

        if not resp.is_success:
            _handle_response_error(resp)

        if resp.status_code == 204 or not resp.content:
            return None

        try:
            return resp.json()
        except Exception:
            return resp.text

    @staticmethod
    def verify_webhook_signature(raw_payload: Union[str, bytes], signature_header: str, secret: str) -> bool:
        return verify_webhook_signature(raw_payload, signature_header, secret)


# ─────────────────────────────────────────────────────────────────────────────
# Asynchronous Client Implementation
# ─────────────────────────────────────────────────────────────────────────────

class AsyncCallsResource:
    def __init__(self, client: "AsyncMarkovaClient"):
        self._client = client

    async def create(
        self,
        agent_id: str,
        to: str,
        sandbox: Optional[bool] = None,
        webhook_url: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        headers = {}
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key

        payload: Dict[str, Any] = {
            "agent_id": agent_id,
            "to_number": to,
        }
        if sandbox is not None:
            payload["sandbox"] = sandbox
        if webhook_url:
            payload["webhook_url"] = webhook_url

        return await self._client.request("POST", "/v1/calls", json=payload, headers=headers)

    async def list(
        self,
        agent_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        params: Dict[str, Any] = {"limit": limit, "offset": offset}
        if agent_id:
            params["agent_id"] = agent_id
        if status:
            params["status"] = status
        return await self._client.request("GET", "/v1/calls", params=params)

    async def get(self, call_id: str) -> Dict[str, Any]:
        return await self._client.request("GET", f"/v1/calls/{call_id}")

    async def get_transcript(self, call_id: str) -> Dict[str, Any]:
        return await self._client.request("GET", f"/v1/calls/{call_id}/transcript")

    async def get_recording(self, call_id: str) -> Dict[str, Any]:
        return await self._client.request("GET", f"/v1/calls/{call_id}/recording")

    async def transfer(self, call_id: str, to: str) -> Dict[str, Any]:
        return await self._client.request("POST", f"/v1/calls/{call_id}/transfer", json={"to": to})


class AsyncProvidersResource:
    def __init__(self, client: "AsyncMarkovaClient"):
        self._client = client

    async def list(self) -> Dict[str, Any]:
        return await self._client.request("GET", "/v1/providers")

    async def set(self, provider_type: str, provider_name: str, config: Dict[str, Any]) -> Dict[str, Any]:
        return await self._client.request("PUT", f"/v1/providers/{provider_type}/{provider_name}", json=config)

    async def delete(self, provider_type: str, provider_name: str) -> Dict[str, Any]:
        return await self._client.request("DELETE", f"/v1/providers/{provider_type}/{provider_name}")


class AsyncMarkovaClient:
    """
    Asynchronous Markova AI Call Center API Client.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        token: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: float = 30.0,
    ):
        self.base_url = (base_url or os.environ.get("MARKOVA_API_URL", "https://api.markova.tech")).rstrip("/")
        self.api_key = api_key
        self.token = token
        self.timeout = timeout
        self._http = httpx.AsyncClient(timeout=timeout)

        self.calls = AsyncCallsResource(self)
        self.providers = AsyncProvidersResource(self)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    async def close(self):
        await self._http.aclose()

    def _headers(self, custom_headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers: Dict[str, str] = {
            "Content-Type": "application/json",
            "User-Agent": "markova-python-sdk/1.0.0",
        }
        if self.api_key:
            headers["x-api-key"] = self.api_key
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if custom_headers:
            headers.update(custom_headers)
        return headers

    async def request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Any:
        url = f"{self.base_url}{path}"
        req_headers = self._headers(headers)

        resp = await self._http.request(
            method=method,
            url=url,
            params=params,
            json=json,
            headers=req_headers,
        )

        if not resp.is_success:
            _handle_response_error(resp)

        if resp.status_code == 204 or not resp.content:
            return None

        try:
            return resp.json()
        except Exception:
            return resp.text

    @staticmethod
    def verify_webhook_signature(raw_payload: Union[str, bytes], signature_header: str, secret: str) -> bool:
        return verify_webhook_signature(raw_payload, signature_header, secret)
