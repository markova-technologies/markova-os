"""
Stripe Billing integration.
Syncs usage_metrics to Stripe Metered Usage API via nightly cron.
"""
import os
import asyncio
import httpx
import structlog
from datetime import datetime, timedelta, timezone

logger = structlog.get_logger()
STRIPE_API_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_BASE = "https://api.stripe.com/v1"

async def sync_usage_to_stripe(db_pool):
    """
    Called nightly. Aggregates yesterday's usage_metrics and reports to Stripe Metered Usage.
    """
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date()
    
    rows = await db_pool.fetch(
        """
        SELECT c.stripe_customer_id, 
               SUM(um.call_minutes) AS total_minutes,
               SUM(um.llm_tokens) AS total_tokens
        FROM usage_metrics um
        JOIN companies c ON um.company_id = c.id
        WHERE DATE(um.recorded_at) = $1
          AND c.stripe_customer_id IS NOT NULL
        GROUP BY c.stripe_customer_id
        """,
        yesterday
    )
    
    for row in rows:
        if not row["stripe_customer_id"]:
            continue
        await _report_stripe_usage(
            customer_id=row["stripe_customer_id"],
            quantity=int(row["total_minutes"] or 0),
            metric="call_minutes",
        )
        logger.info(
            "stripe_usage_reported",
            customer=row["stripe_customer_id"],
            minutes=row["total_minutes"],
            date=str(yesterday)
        )

async def _report_stripe_usage(customer_id: str, quantity: int, metric: str):
    """POST usage to Stripe Metered Billing API."""
    subscription_item_id = os.getenv(f"STRIPE_ITEM_{metric.upper()}", "")
    if not subscription_item_id:
        return
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{STRIPE_BASE}/subscription_items/{subscription_item_id}/usage_records",
            auth=(STRIPE_API_KEY, ""),
            data={
                "quantity": str(quantity),
                "timestamp": "now",
                "action": "increment",
            }
        )
        if resp.status_code != 200:
            logger.error("stripe_usage_report_failed", status=resp.status_code, body=resp.text[:200])
