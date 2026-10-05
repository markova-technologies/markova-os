"""
Markova AI Call Center — Outbound Call Dispatch Recipe (Python)
Demonstrates dispatching an outbound AI voice call with:
- Idempotency-Key protection (safe retry without duplicate calls / billing)
- Dedicated webhook_url for call lifecycle events
- Error handling with specific SDK exception types
"""

import os
import uuid
from markova import MarkovaClient, ConflictError, AuthenticationError, MarkovaError

MARKOVA_API_KEY = os.getenv("MARKOVA_API_KEY", "mk_test_sandbox_secret")
MARKOVA_BASE_URL = os.getenv("MARKOVA_BASE_URL", "https://api.markova.tech")

client = MarkovaClient(
    api_key=MARKOVA_API_KEY,
    base_url=MARKOVA_BASE_URL,
)

def initiate_customer_appointment_reminder(customer_phone: str, appointment_id: str):
    # Derive or generate a unique idempotency key tied to this specific business transaction
    idempotency_key = f"appt-reminder-{appointment_id}"

    try:
        call = client.calls.create(
            agent_id="00000000-0000-0000-0000-000000000001",
            to=customer_phone,
            webhook_url="https://api.clinic.et/webhooks/voice-events",
            idempotency_key=idempotency_key,
            sandbox=True,  # Set to False in production for real GSM/PSTN call
        )
        print(f"Call successfully queued: ID {call['id']} (Status: {call['status']})")
        return call

    except ConflictError:
        print(f"Idempotency warning: Call {idempotency_key} is already processing concurrently.")
    except AuthenticationError:
        print("Authentication failure: Please verify MARKOVA_API_KEY.")
    except MarkovaError as e:
        print(f"Failed to place call: {e.message} (HTTP {e.status_code})")

if __name__ == "__main__":
    initiate_customer_appointment_reminder("+251911223344", "apt_8831")
