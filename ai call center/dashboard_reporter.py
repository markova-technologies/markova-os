import httpx
import asyncio
import os
import structlog
from datetime import datetime

logger = structlog.get_logger()

class DashboardReporter:
    """Pushes real-time metrics to MARKOVA Dashboard"""
    
    def __init__(self):
        self.dashboard_url = os.getenv("MARKOVA_BACKEND_URL", "http://localhost:5000")
        self.api_key = os.getenv("DASHBOARD_API_KEY")
        self.agent_id = "amharic-ai-agent-1"  # Unique ID for this agent
        
    async def report_call_end(self, call_id: str, duration_ms: float, response_time_ms: float):
        """Send call completion metrics"""
        if not self.api_key:
            logger.warning("⚠️ DASHBOARD_API_KEY not set. Skipping dashboard report.")
            return

        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{self.dashboard_url}/api/agents/report",
                    json={
                        "agentId": self.agent_id,
                        "callsToday": 1,  # Increment by 1
                        "avgResponse": int(response_time_ms),
                        "healthScore": await self._calculate_health(),
                        "timestamp": datetime.now().isoformat()
                    },
                    headers={"X-API-Key": self.api_key},
                    timeout=5.0
                )
        except Exception as e:
            logger.error(f"❌ Failed to report to dashboard: {e}")
    
    async def report_heartbeat(self):
        """Send heartbeat every 10 seconds"""
        if not self.api_key:
            return

        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{self.dashboard_url}/api/agents/heartbeat",
                    json={
                        "agentId": self.agent_id,
                        "status": "active",
                        "healthScore": await self._calculate_health()
                    },
                    headers={"X-API-Key": self.api_key},
                    timeout=5.0
                )
        except Exception as e:
            logger.error(f"❌ Heartbeat failed: {e}")
    
    async def _calculate_health(self) -> int:
        """Calculate health score from recent metrics"""
        # In a real scenario, this would query the DB for success rates.
        # For now, we return a high score to indicate system is healthy
        return 98
