# Markova AI Call Center — Python SDK

The official Python client library for the [Markova AI Call Center Platform](https://markova.et).

## Installation

```bash
pip install markova
```

## Quick Start

### 1. Initializing the Client

```python
from markova import MarkovaClient

# Live or Sandbox API Key
client = MarkovaClient(
    api_key="mk_live_your_api_key_here",
    base_url="https://api.markova.et",
)
```

### 2. Displacing an Outbound Call with Idempotency

```python
import uuid

# Place an outbound call with an Idempotency-Key to prevent duplicate calls and double billing
call = client.calls.create(
    agent_id="00000000-0000-0000-0000-000000000001",
    to="+251911223344",
    webhook_url="https://api.yourbank.et/webhooks/voice",
    idempotency_key=str(uuid.uuid4()),
)

print(f"Call initiated: {call['id']} (Status: {call['status']})")
```

### 3. Asynchronous Client (FastAPI / Celery)

```python
import asyncio
from markova import AsyncMarkovaClient

async def main():
    async with AsyncMarkovaClient(api_key="mk_test_sandbox_key") as client:
        calls = await client.calls.list(limit=10)
        for c in calls:
            print(c["id"], c["status"])

asyncio.run(main())
```

### 4. Verifying Incoming Webhook Signatures

When Markova dispatches webhooks (e.g. `call.completed`, `call.started`), requests include an `X-Markova-Signature` HMAC-SHA256 header. Verify it securely:

```python
from fastapi import FastAPI, Request, HTTPException
from markova import verify_webhook_signature

app = FastAPI()
WEBHOOK_SECRET = "whsec_your_tenant_secret"

@app.post("/webhooks/markova")
async def handle_markova_webhook(request: Request):
    signature = request.headers.get("X-Markova-Signature", "")
    raw_body = await request.body()

    # Constant-time cryptographic verification
    if not verify_webhook_signature(raw_body, signature, WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    payload = await request.json()
    event_type = payload.get("event")
    print(f"Verified webhook received: {event_type} for call {payload.get('call_id')}")

    return {"status": "received"}
```

### 5. Managing Custom Provider API Keys (AES-256-GCM)

```python
# Programmatically configure or rotate Groq / OpenAI / Twilio credentials
client.providers.set(
    provider_type="llm",
    provider_name="groq",
    config={"api_key": "gsk_new_production_key_here"}
)

# List registered providers (returns masked key previews)
providers = client.providers.list()
print(providers)
```
