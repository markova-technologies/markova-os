import asyncio
import os
import uuid
import structlog
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
import httpx

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/campaigns", tags=["Outbound Campaigns"])

# Dependency placeholders - these will be attached to app state or imported
def get_db_pool(request: Request):
    return request.app.state.db_pool

def get_tenant_id(request: Request) -> str:
    # Similar to main.py _tenant_id, normally extracted from JWT or headers
    company_id = request.headers.get("X-Company-ID")
    if not company_id:
        raise HTTPException(status_code=401, detail="Unauthorized: Missing X-Company-ID")
    return company_id

class CampaignCreate(BaseModel):
    name: str
    agent_id: str
    phone_number_id: str
    prompt_template: Optional[str] = None

class CampaignContactCreate(BaseModel):
    phone_number: str
    metadata: Optional[Dict[str, Any]] = {}

@router.post("")
async def create_campaign(
    campaign: CampaignCreate,
    company_id: str = Depends(get_tenant_id),
    db_pool = Depends(get_db_pool)
):
    campaign_id = str(uuid.uuid4())
    await db_pool.execute(
        """INSERT INTO campaigns (id, company_id, name, agent_id, phone_number_id, prompt_template)
           VALUES ($1, $2, $3, $4, $5, $6)""",
        uuid.UUID(campaign_id), uuid.UUID(company_id), campaign.name, 
        uuid.UUID(campaign.agent_id), uuid.UUID(campaign.phone_number_id), campaign.prompt_template
    )
    return {"id": campaign_id, "status": "draft"}

@router.post("/{campaign_id}/contacts")
async def add_contacts(
    campaign_id: str,
    contacts: List[CampaignContactCreate],
    company_id: str = Depends(get_tenant_id),
    db_pool = Depends(get_db_pool)
):
    # Verify campaign ownership
    row = await db_pool.fetchrow("SELECT id FROM campaigns WHERE id=$1 AND company_id=$2", uuid.UUID(campaign_id), uuid.UUID(company_id))
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")

    args = []
    for c in contacts:
        args.append((uuid.UUID(campaign_id), c.phone_number, c.metadata))

    await db_pool.executemany(
        """INSERT INTO campaign_contacts (campaign_id, phone_number, metadata) VALUES ($1, $2, $3)""",
        args
    )
    return {"message": f"Added {len(contacts)} contacts"}

@router.post("/{campaign_id}/launch")
async def launch_campaign(
    campaign_id: str,
    company_id: str = Depends(get_tenant_id),
    db_pool = Depends(get_db_pool)
):
    row = await db_pool.fetchrow("SELECT id FROM campaigns WHERE id=$1 AND company_id=$2", uuid.UUID(campaign_id), uuid.UUID(company_id))
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    await db_pool.execute("UPDATE campaigns SET status = 'running' WHERE id=$1", uuid.UUID(campaign_id))
    # Note: In a true production app, we would push an event to Redis/RabbitMQ.
    # Here, our background task will pick it up automatically.
    return {"message": "Campaign launched"}

# Background worker for dispatching calls
async def process_campaigns(db_pool):
    """
    Background worker that polls for 'running' campaigns and dispatches calls.
    Respects DNC lists and Twilio rate limits.
    """
    logger.info("campaign_engine_started")
    while True:
        try:
            # Find running campaigns
            campaigns = await db_pool.fetch("SELECT * FROM campaigns WHERE status = 'running'")
            for camp in campaigns:
                # Get next pending contact
                contact = await db_pool.fetchrow(
                    "SELECT * FROM campaign_contacts WHERE campaign_id = $1 AND status = 'pending' LIMIT 1 FOR UPDATE SKIP LOCKED",
                    camp["id"]
                )
                if not contact:
                    # No more pending contacts, mark campaign complete
                    await db_pool.execute("UPDATE campaigns SET status = 'completed' WHERE id = $1", camp["id"])
                    continue
                
                # Check DNC
                dnc = await db_pool.fetchrow(
                    "SELECT id FROM dnc_list WHERE company_id = $1 AND phone_number = $2",
                    camp["company_id"], contact["phone_number"]
                )
                if dnc:
                    await db_pool.execute(
                        "UPDATE campaign_contacts SET status = 'dnc_skipped' WHERE id = $1", 
                        contact["id"]
                    )
                    continue

                # Retrieve Twilio credentials and from_number
                number_row = await db_pool.fetchrow(
                    "SELECT phone_number, account_sid, auth_token FROM phone_numbers WHERE id = $1",
                    camp["phone_number_id"]
                )
                if not number_row:
                    await db_pool.execute(
                        "UPDATE campaign_contacts SET status = 'failed', error_message = 'Missing phone configuration' WHERE id = $1", 
                        contact["id"]
                    )
                    continue
                
                # Mark in progress
                await db_pool.execute("UPDATE campaign_contacts SET status = 'in_progress' WHERE id = $1", contact["id"])
                
                # Dispatch via Orchestrator's internal /v1/calls if we wanted, or call Twilio directly.
                # To avoid circular HTTP calls, we'll call Twilio directly.
                account_sid = number_row["account_sid"]
                auth_token = number_row["auth_token"]
                from_number = number_row["phone_number"]
                to_number = contact["phone_number"]
                
                # Generate Webhook URL for Twilio to call us back
                base_url = os.getenv("ORCHESTRATOR_BASE_URL", "")
                webhook_url = f"{base_url}/incoming-call?campaign_id={camp['id']}"

                try:
                    # Basic Twilio API Call
                    async with httpx.AsyncClient() as client:
                        resp = await client.post(
                            f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Calls.json",
                            auth=(account_sid, auth_token),
                            data={
                                "From": from_number,
                                "To": to_number,
                                "Url": webhook_url
                            }
                        )
                        if resp.status_code in (200, 201):
                            await db_pool.execute(
                                "UPDATE campaign_contacts SET status = 'completed' WHERE id = $1", 
                                contact["id"]
                            )
                        else:
                            await db_pool.execute(
                                "UPDATE campaign_contacts SET status = 'failed', error_message = $1 WHERE id = $2", 
                                resp.text, contact["id"]
                            )
                except Exception as ex:
                    await db_pool.execute(
                        "UPDATE campaign_contacts SET status = 'failed', error_message = $1 WHERE id = $2", 
                        str(ex), contact["id"]
                    )
                    
                # Rate limit pacing (e.g. 1 call per second per worker)
                await asyncio.sleep(1)

        except Exception as e:
            logger.error("campaign_processor_error", error=str(e))
        
        await asyncio.sleep(5)
