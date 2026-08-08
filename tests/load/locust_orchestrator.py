"""
Locust load test for Markova Orchestrator.
Simulates concurrent Twilio webhooks and voice turns.
"""
from locust import HttpUser, task, between
import base64
import os

TEST_COMPANY_ID = os.getenv("LOAD_TEST_COMPANY_ID", "11111111-1111-1111-1111-111111111111")
TEST_JWT = os.getenv("LOAD_TEST_JWT", "")

class OrchestratorUser(HttpUser):
    wait_time = between(0.5, 2.0)
    
    def on_start(self):
        """Simulate an incoming Twilio call to get a CallSid."""
        # Using a deterministic CallSid base for tests to avoid infinite DB growth in dev
        self.call_sid = f"CAtest{id(self)}"
        resp = self.client.post(
            "/incoming-call",
            data={
                "CallSid": self.call_sid,
                "From": "+251912345678",
                "To": "+1234567890",
                "AccountSid": "AC_test",
            },
            headers={"x-company-id": TEST_COMPANY_ID},
        )
    
    @task(3)
    def voice_turn_text(self):
        """Simulate a text-based voice turn (most common path)."""
        self.client.post(
            "/twilio/respond",
            data={
                "CallSid": self.call_sid,
                "SpeechResult": "What is your return policy?",
                "Confidence": "0.95",
            }
        )
    
    @task(1)
    def get_stats(self):
        """Simulate a dashboard stats poll."""
        self.client.get(
            "/api/stats",
            headers={"Authorization": f"Bearer {TEST_JWT}", "x-company-id": TEST_COMPANY_ID}
        )

# Run with:
# locust -f tests/load/locust_orchestrator.py --host https://your-orchestrator.onrender.com
# --users 100 --spawn-rate 10 --run-time 60s
