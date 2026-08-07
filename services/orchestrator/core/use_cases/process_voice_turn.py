from typing import Optional
from fastapi import Request

from core.ports.state_port import StatePort
from core.ports.knowledge_port import KnowledgePort
from core.ports.event_port import EventPort
from core.ports.llm_port import LLMPort
from core.ports.tts_port import TTSPort
from adapters.db_adapter import DBAdapter
from core.domain.amharic_engine import normalize_amharic, is_garbage_transcription, repair_amharic_transcription, get_polite_retry
from core.domain.conversation import TWILIO_VOICE_MAP
from core.domain.tts_cache import get_cached_audio_url

class ProcessVoiceTurnUseCase:
    def __init__(
        self,
        state_port: StatePort,
        knowledge_port: KnowledgePort,
        event_port: EventPort,
        llm_port: LLMPort,
        tts_port: TTSPort,
        db_adapter: DBAdapter,
        semantic_cache,
    ):
        self.state_port = state_port
        self.knowledge_port = knowledge_port
        self.event_port = event_port
        self.llm_port = llm_port
        self.tts_port = tts_port
        self.db = db_adapter
        self.semantic_cache = semantic_cache

    async def execute(self, call_sid: str, user_text: str, request: Request, mode: str = "gather", base_url: str = "") -> str:
        state = await self.state_port.get(call_sid)
        call_id = state.get("call_id")
        company_id = state.get("company_id")

        if not company_id:
            return """<?xml version="1.0" encoding="UTF-8"?><Response><Say>Call session expired. Goodbye.</Say><Hangup/></Response>"""

        # Detect agent language
        agent_lang = "amharic"
        for msg in state.get("messages", []):
            if msg["role"] == "system" and "english" in msg["content"].lower():
                agent_lang = "english"
                break

        voice_config = TWILIO_VOICE_MAP.get(agent_lang, TWILIO_VOICE_MAP["amharic"])
        voice = voice_config["voice"]
        lang_code = voice_config["lang"]
        stt_code = voice_config["stt"]

        if agent_lang == "amharic":
            user_text = normalize_amharic(user_text)

        if not user_text or (agent_lang == "amharic" and is_garbage_transcription(user_text)):
            empty_count = state.get("empty_turns", 0) + 1
            state["empty_turns"] = empty_count
            await self.state_port.save(call_sid, state)
            
            if empty_count >= 3:
                bye_msg = "ይቅርታ፣ ድምፅዎ በደንብ አልተሰማንም። እባክዎ መስመሩ ሲሻሻል ደግመው ይደውሉልን።" if agent_lang == "amharic" else "We are having trouble hearing you clearly. Goodbye."
                tts_config = await self.db.get_provider_config(company_id, "voice", state.get("voice_provider"))
                tts_key = tts_config.get("api_key") if tts_config else ""
                audio_url = await get_cached_audio_url(self.tts_port, state.get("voice_provider"), state.get("voice_id"), bye_msg, tts_key, base_url)
                if call_id:
                    await self.db.end_call_record(call_id)
                await self.state_port.delete(call_sid)
                if audio_url:
                    return f"""<?xml version="1.0" encoding="UTF-8"?><Response><Play>{audio_url}</Play><Hangup/></Response>"""
                return f"""<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="{voice}" language="{lang_code}">{bye_msg}</Say><Hangup/></Response>"""

            retry_msg = get_polite_retry() if agent_lang == "amharic" else "I didn't catch that. Could you please repeat?"
            tts_config = await self.db.get_provider_config(company_id, "voice", state.get("voice_provider"))
            tts_key = tts_config.get("api_key") if tts_config else ""
            audio_url = await get_cached_audio_url(self.tts_port, state.get("voice_provider"), state.get("voice_id"), retry_msg, tts_key, base_url)

            if audio_url:
                if mode == "record":
                    return f"""<?xml version="1.0" encoding="UTF-8"?><Response><Play>{audio_url}</Play><Record action="/twilio/respond-audio" maxLength="15" playBeep="false" timeout="3" finishOnKey="#" /></Response>"""
                else:
                    return f"""<?xml version="1.0" encoding="UTF-8"?><Response><Play>{audio_url}</Play><Gather input="speech" action="/twilio/respond" method="POST" speechTimeout="auto" language="{stt_code}"><Say voice="{voice}" language="{lang_code}">...</Say></Gather></Response>"""
            else:
                if mode == "record":
                    return f"""<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="{voice}" language="{lang_code}">{retry_msg}</Say><Record action="/twilio/respond-audio" maxLength="15" playBeep="false" timeout="3" finishOnKey="#" /></Response>"""
                else:
                    return f"""<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="speech" action="/twilio/respond" method="POST" speechTimeout="auto" language="{stt_code}"><Say voice="{voice}" language="{lang_code}">{retry_msg}</Say></Gather></Response>"""

        if state.get("empty_turns", 0) > 0:
            state["empty_turns"] = 0

        llm_config = await self.db.get_provider_config(company_id, "llm", state.get("model_provider"))
        llm_key = llm_config.get("api_key") if llm_config else ""

        if not llm_key:
            err_speech = "ይቅርታ፣ የኤአይ አገልግሎት በአግባቡ አልተዘጋጀም።" if agent_lang == "amharic" else "Service is not configured properly."
            return f'<?xml version="1.0" encoding="UTF-8"?><Response><Say>{err_speech}</Say><Hangup/></Response>'

        if agent_lang == "amharic":
            user_text = await repair_amharic_transcription(user_text, llm_key)

        if call_id:
            await self.db.save_transcript(call_id, "user", user_text)

        state["messages"].append({"role": "user", "content": user_text})
        state["turn_count"] = state.get("turn_count", 0) + 1

        rag_context = await self.knowledge_port.query(company_id, user_text)
        if not rag_context and company_id and llm_key:
            rag_context = await self.knowledge_port.search_chunks(company_id, user_text, llm_key)

        messages_for_llm = list(state["messages"])
        if rag_context:
            messages_for_llm.insert(len(messages_for_llm) - 1, {
                "role": "system",
                "content": f"Relevant knowledge from this company's KB. Use it to answer:\n\n{rag_context}"
            })

        cached_hit = None
        user_emb = None
        if self.semantic_cache:
            try:
                # Fast embedding calculation using httpx
                import httpx
                async with httpx.AsyncClient() as client:
                    resp = await client.post(
                        "https://api.openai.com/v1/embeddings",
                        headers={"Authorization": f"Bearer {llm_key}"},
                        json={"input": user_text, "model": "text-embedding-3-small"}
                    )
                    if resp.status_code == 200:
                        user_emb = resp.json()["data"][0]["embedding"]
                        cached_hit = await self.semantic_cache.get(user_emb, company_id=company_id, prompt_text=user_text)
            except Exception:
                pass

        if cached_hit:
            ai_text, tokens_used = cached_hit[0], 0
        else:
            try:
                ai_text, tokens_used = await self.llm_port.complete(
                    provider=state.get("model_provider"),
                    model_id=state.get("model_id"),
                    messages=messages_for_llm,
                    api_key=llm_key
                )
                if user_emb and ai_text and self.semantic_cache:
                    await self.semantic_cache.set(user_emb, ai_text, company_id=company_id, prompt_text=user_text)
            except Exception as e:
                print(f"❌ LLM error: {e}")
                ai_text = "ይቅርታ፣ አሁን መስመር ላይ ችግር አለ። ቆይተው ይደውሉ።" if agent_lang == "amharic" else "I'm having trouble processing your request."
                tokens_used = 0

        if call_id:
            await self.db.save_transcript(call_id, "assistant", ai_text)

        state["messages"].append({"role": "assistant", "content": ai_text})

        if company_id:
            estimated_stt = max(1, len(user_text) // 15)
            await self.db.track_usage(company_id, 0, estimated_stt, len(ai_text), tokens_used)

        await self.state_port.save(call_sid, state)

        tts_config = await self.db.get_provider_config(company_id, "voice", state.get("voice_provider"))
        tts_key = tts_config.get("api_key") if tts_config else ""
        audio_url = await get_cached_audio_url(self.tts_port, state.get("voice_provider"), state.get("voice_id"), ai_text, tts_key, base_url)

        if audio_url:
            if mode == "record":
                return f"""<?xml version="1.0" encoding="UTF-8"?><Response><Play>{audio_url}</Play><Record action="/twilio/respond-audio" maxLength="15" playBeep="false" timeout="3" finishOnKey="#" /></Response>"""
            else:
                return f"""<?xml version="1.0" encoding="UTF-8"?><Response><Play>{audio_url}</Play><Gather input="speech" action="/twilio/respond" method="POST" speechTimeout="auto" language="{stt_code}"><Say voice="{voice}" language="{lang_code}">...</Say></Gather></Response>"""
        else:
            if mode == "record":
                return f"""<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="{voice}" language="{lang_code}">{ai_text}</Say><Record action="/twilio/respond-audio" maxLength="15" playBeep="false" timeout="3" finishOnKey="#" /></Response>"""
            else:
                return f"""<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="speech" action="/twilio/respond" method="POST" speechTimeout="auto" language="{stt_code}"><Say voice="{voice}" language="{lang_code}">{ai_text}</Say></Gather></Response>"""
