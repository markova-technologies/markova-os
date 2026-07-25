import os
import logging
import asyncio
from datetime import datetime
from database import db as conversation_db

logger = logging.getLogger(__name__)

class MetricsCollector:
    """Collects and persists system performance metrics"""
    
    async def record_metric(self, call_id: str, metric_name: str, value: float):
        """Record a performance metric to DB"""
        try:
            # We will add a generalized save_metric method to database.py
            await conversation_db.save_metric(call_id, metric_name, value)
        except Exception as e:
            logger.error(f"Failed to record metric {metric_name}: {e}")

    async def record_response_time(self, call_id: str, duration_s: float):
        await self.record_metric(call_id, "response_time_ms", duration_s * 1000)

    async def record_tts_cache_hit(self, call_id: str, hit: bool):
        await self.record_metric(call_id, "tts_cache_hit", 1.0 if hit else 0.0)

class AlertManager:
    """Handles critical system alerts"""
    
    def __init__(self):
        self.admin_email = os.getenv("ADMIN_EMAIL")
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_pass = os.getenv("SMTP_PASS")

    async def send_alert(self, subject: str, message: str):
        """Send alert via email or log if credentials missing"""
        if not (self.admin_email and self.smtp_user and self.smtp_pass):
            logger.critical(f"🚨 ALERT (No Email Configured): {subject} - {message}")
            return

        try:
            import aiosmtplib
            from email.message import EmailMessage

            msg = EmailMessage()
            msg["From"] = self.smtp_user
            msg["To"] = self.admin_email
            msg["Subject"] = f"🚨 ALMAZ AI ALERT: {subject}"
            msg.set_content(message)

            await aiosmtplib.send(
                msg,
                hostname=self.smtp_server,
                port=self.smtp_port,
                start_tls=True,
                username=self.smtp_user,
                password=self.smtp_pass
            )
            logger.info(f"📧 Sent alert email: {subject}")
        except Exception as e:
            logger.error(f"Failed to send alert email: {e}")

# Global Instances
metrics = MetricsCollector()
alerts = AlertManager()
