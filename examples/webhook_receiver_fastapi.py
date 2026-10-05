"""
Markova AI Call Center — Webhook Receiver Recipe (FastAPI)
Demonstrates:
- Constant-time HMAC-SHA256 signature verification via verify_webhook_signature
- Handling call.started, call.completed, call.failed, and recording.ready events
- Returning fast 200 OK responses to avoid webhook retry queues
"""

import os
from fastapi import FastAPI, Request, HTTPException, status
from markova import verify_webhook_signature

app = FastAPI(title="Markova Webhook Receiver Example")

# Client organization's webhook signing secret configured in Markova dashboard
MARKOVA_WEBHOOK_SECRET = os.getenv("MARKOVA_WEBHOOK_SECRET", "whsec_sample_secret_key_12345")


@app.post("/webhooks/markova", status_code=status.HTTP_200_OK)
async def receive_markova_event(request: Request):
    # 1. Extract signature header
    signature_header = request.headers.get("X-Markova-Signature")
    if not signature_header:
        raise HTTPException(status_code=401, detail="Missing X-Markova-Signature header")

    # 2. Get the raw unparsed request body for cryptographic verification
    raw_body = await request.body()

    # 3. Perform constant-time HMAC-SHA256 verification
    is_valid = verify_webhook_signature(
        raw_payload=raw_body,
        signature_header=signature_header,
        secret=MARKOVA_WEBHOOK_SECRET,
    )
    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # 4. Parse verified payload
    payload = await request.json()
    event_type = payload.get("event")
    call_id = payload.get("call_id")
    data = payload.get("data", {})

    print(f"[Markova Webhook] Event: {event_type} | Call ID: {call_id}")

    # 5. Process business logic based on event type
    if event_type == "call.completed":
        duration = data.get("duration_seconds", 0)
        status_result = data.get("status")
        transcript = data.get("transcript", [])
        print(f"Call {call_id} ended. Duration: {duration}s. Status: {status_result}. Turns: {len(transcript)}")
        # Example: Update internal CRM record, trigger SMS summary, etc.

    elif event_type == "call.failed":
        reason = data.get("error") or data.get("failure_reason")
        print(f"Call {call_id} failed: {reason}")

    elif event_type == "recording.ready":
        recording_url = data.get("recording_url")
        print(f"Recording ready for call {call_id}: {recording_url}")

    return {"status": "success", "event": event_type}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000)
