from fastapi import Request
import uuid

from core.ports.state_port import StatePort
from core.ports.event_port import EventPort
from adapters.db_adapter import DBAdapter
from core.domain.conversation import build_default_state, TWILIO_VOICE_MAP
from core.domain.tts_cache import get_cached_audio_url

class HandleInboundCallUseCase:
    def __init__(self, state_port: StatePort, event_port: EventPort, tts_port, db_adapter: DBAdapter):
        self.state_port = state_port
        self.event_port = event_port
        self.tts_port = tts_port
        self.db = db_adapter

    async def execute(self, call_sid: str, from_number: str, to_number: str, base_url: str) -> str:
        agent = await self.db.get_agent_by_phone(to_number)
        if not agent:
            print(f"❌ No active agent configured for phone {to_number}")
            return """<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, this number is not configured.</Say><Hangup/></Response>"""

        company_id = str(agent["company_id"])
        
        # Check routing rules
        rules = await self.db.get_routing_rules_for_phone(str(agent["phone_number_id"]), company_id)
        # simplified routing logic for extraction
        
        call_id = str(uuid.uuid4())
        
        try:
            await self.db.db_pool.execute(
                """
                INSERT INTO calls (id, company_id, agent_id, customer_phone, status, provider_call_id, started_at)
                VALUES ($1, $2, $3, $4, 'in-progress', $5, NOW())
                """,
                uuid.UUID(call_id), uuid.UUID(company_id), uuid.UUID(str(agent["agent_id"])), from_number, call_sid
            )
        except Exception as e:
            print(f"⚠️ Failed to insert call record: {e}")

        # Build initial state
        state = build_default_state()
        state.update({
            "call_id": call_id,
            "company_id": company_id,
            "agent_id": str(agent["agent_id"]),
            "voice_provider": agent["voice_provider"],
            "voice_id": agent["voice_id"],
            "model_provider": agent["model_provider"],
            "model_id": agent["model_id"]
        })
        
        prompt = agent.get("prompt", "You are a helpful AI assistant. Answer in Amharic.")
        state["messages"].append({"role": "system", "content": prompt})
        
        await self.state_port.save(call_sid, state)
        
        agent_lang = "amharic"
        if "english" in prompt.lower():
            agent_lang = "english"
            
        greeting = agent.get("phone_settings", {}).get("greeting", "Hello! How can I help you today?")
        
        tts_config = await self.db.get_provider_config(company_id, "voice", agent["voice_provider"])
        tts_key = tts_config.get("api_key") if tts_config else ""
        audio_url = await get_cached_audio_url(self.tts_port, agent["voice_provider"], agent["voice_id"], greeting, tts_key, base_url)

        voice_config = TWILIO_VOICE_MAP.get(agent_lang, TWILIO_VOICE_MAP["amharic"])
        voice = voice_config["voice"]
        lang_code = voice_config["lang"]
        stt_code = voice_config["stt"]

        if audio_url:
            return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>{audio_url}</Play>
    <Gather input="speech" action="/twilio/respond" method="POST" speechTimeout="auto" language="{stt_code}">
        <Say voice="{voice}" language="{lang_code}">...</Say>
    </Gather>
</Response>"""
        else:
            return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" action="/twilio/respond" method="POST" speechTimeout="auto" language="{stt_code}">
        <Say voice="{voice}" language="{lang_code}">{greeting}</Say>
    </Gather>
</Response>"""
