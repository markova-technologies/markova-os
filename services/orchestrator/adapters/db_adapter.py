import json
import uuid
import os
import time
import httpx
import hashlib
import hmac

class DBAdapter:
    def __init__(self, db_pool):
        self.db_pool = db_pool

    async def save_transcript(self, call_id: str, role: str, content: str) -> None:
        if not self.db_pool or not call_id:
            return
        try:
            await self.db_pool.execute(
                "INSERT INTO transcripts (call_id, role, content) VALUES ($1, $2, $3)",
                uuid.UUID(call_id), role, content
            )
        except Exception as e:
            print(f"⚠️ Transcript save failure: {e}")

    async def get_provider_config(self, company_id: str, service_type: str, provider_name: str) -> dict:
        if not self.db_pool or not company_id or not provider_name:
            return {}
        try:
            row = await self.db_pool.fetchrow(
                """
                SELECT config FROM ai_providers
                WHERE company_id = $1 AND service_type = $2 AND provider_name = $3
                """,
                uuid.UUID(company_id), service_type, provider_name
            )
            if row and row["config"]:
                config = row["config"]
                if isinstance(config, str):
                    return json.loads(config)
                return config
        except Exception as e:
            print(f"⚠️ Provider config lookup failure: {e}")
        return {}

    async def end_call_record(self, call_id: str) -> None:
        if not self.db_pool:
            return
        try:
            await self.db_pool.execute(
                "UPDATE calls SET status = 'completed', end_time = NOW() WHERE id = $1 AND status != 'completed'",
                uuid.UUID(call_id)
            )
        except Exception as e:
            print(f"⚠️ Call record update failure: {e}")

    async def track_usage(
        self, company_id: str, call_minutes: int, stt_seconds: int, tts_characters: int, llm_tokens: int
    ) -> None:
        if not self.db_pool:
            return
        try:
            await self.db_pool.execute(
                """
                INSERT INTO usage_ledger (company_id, call_minutes, stt_seconds, tts_characters, llm_tokens)
                VALUES ($1, $2, $3, $4, $5)
                """,
                uuid.UUID(company_id), call_minutes, stt_seconds, tts_characters, llm_tokens
            )
        except Exception as e:
            print(f"⚠️ Non-fatal: Failed to record usage metric in DB: {e}")
            
        tenant_url = os.getenv("TENANT_SERVICE_URL", "http://tenant-service:5002")
        secret = os.getenv("SERVICE_AUTH_SECRET")
        if secret:
            try:
                timestamp = str(int(time.time() * 1000))
                payload = f"orchestrator:{timestamp}"
                signature = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.post(
                        f"{tenant_url}/api/tenant/usage/increment",
                        json={
                            "companyId": company_id,
                            "callMinutes": call_minutes,
                            "sttSeconds": stt_seconds,
                            "ttsCharacters": tts_characters,
                            "llmTokens": llm_tokens,
                            "ledgerWritten": True,
                        },
                        headers={"x-service-auth": f"Service orchestrator:{timestamp}:{signature}"},
                    )
            except Exception as e:
                print(f"⚠️ usage cache sync skipped: {e}")

    async def get_agent_by_phone(self, phone_number: str) -> dict | None:
        if not self.db_pool:
            raise RuntimeError("DB pool not initialized in get_agent_by_phone")
        try:
            row = await self.db_pool.fetchrow(
                """
                SELECT 
                    pn.id as phone_number_id,
                    pn.phone_number,
                    pn.company_id,
                    pn.settings as phone_settings,
                    a.id as agent_id,
                    a.name as agent_name,
                    a.prompt,
                    a.voice_provider,
                    a.voice_id,
                    a.model_provider,
                    a.model_id
                FROM phone_numbers pn
                LEFT JOIN agents a ON a.id = pn.agent_id
                WHERE pn.phone_number = $1 AND pn.status = 'active'
                """,
                phone_number
            )
            if not row:
                return None
            data = dict(row)
            settings = data.get("phone_settings") or {}
            if isinstance(settings, str):
                settings = json.loads(settings)
            data["phone_settings"] = settings
            return data
        except Exception as e:
            print(f"❌ Critical DB failure in get_agent_by_phone({phone_number}): {e}")
            raise e

    async def get_routing_rules_for_phone(self, phone_number_id: str, company_id: str) -> list:
        if not self.db_pool:
            return []
        try:
            rows = await self.db_pool.fetch(
                """
                SELECT rules FROM routing_rules
                WHERE phone_number_id = $1 AND company_id = $2
                ORDER BY created_at ASC
                """,
                uuid.UUID(phone_number_id), uuid.UUID(company_id),
            )
            out = []
            for r in rows:
                rules = r["rules"]
                if isinstance(rules, str):
                    rules = json.loads(rules)
                if isinstance(rules, list):
                    out.extend(rules)
            return out
        except Exception:
            return []
