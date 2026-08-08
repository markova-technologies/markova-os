"""
MediaStreamHandler — orchestrates the real-time voice pipeline for a single call.
Architecture: Twilio WebSocket → μ-law decode → STT stream → LLM stream → TTS stream → Twilio
"""
import asyncio
import base64
import json
import audioop  # Python stdlib — μ-law codec
import structlog
from fastapi import WebSocket

logger = structlog.get_logger()

class MediaStreamHandler:
    """
    Manages a single Twilio Media Streams WebSocket session.
    
    Internal state machine:
      IDLE → LISTENING (VAD detects speech) → PROCESSING (STT→LLM→TTS) → SPEAKING → LISTENING
    """
    
    STATE_LISTENING = "listening"
    STATE_PROCESSING = "processing"
    STATE_SPEAKING = "speaking"
    
    def __init__(self, websocket, call_sid, company_id, agent_id, 
                 db_pool, redis, semantic_cache):
        self.ws = websocket
        self.call_sid = call_sid
        self.company_id = company_id
        self.agent_id = agent_id
        self.db_pool = db_pool
        self.redis = redis
        self.semantic_cache = semantic_cache
        
        # Audio buffers
        self._audio_buffer: list[bytes] = []       # Raw μ-law frames accumulate here
        self._stream_sid: str = ""                  # Twilio stream SID (needed to clear)
        
        # State machine
        self._state = self.STATE_LISTENING
        self._stop_event = asyncio.Event()
        self._speak_task: asyncio.Task | None = None
        
        # VAD will be loaded lazily (Part 6.3)
        self._vad = None
        self._eou_detector = None
        self._speech_buffer: list[bytes] = []
    
    async def run(self):
        """Main loop: receive Twilio media events and dispatch them."""
        # Setup VAD when starting
        from vad import SileroVAD, EndOfUtteranceDetector
        self._vad = SileroVAD(threshold=0.5)
        self._eou_detector = EndOfUtteranceDetector(self._vad, silence_frames_to_eou=15)

        async for raw_msg in self.ws.iter_text():
            msg = json.loads(raw_msg)
            event = msg.get("event")
            
            if event == "connected":
                logger.info("media_stream_connected", call_sid=self.call_sid)
            
            elif event == "start":
                self._stream_sid = msg["start"]["streamSid"]
                logger.info("media_stream_started", call_sid=self.call_sid, stream_sid=self._stream_sid)
                # Load call state from Redis
                await self._load_call_state()
            
            elif event == "media":
                # Payload is base64-encoded μ-law audio (8kHz, mono)
                payload = base64.b64decode(msg["media"]["payload"])
                await self._on_audio_frame(payload)
            
            elif event == "stop":
                logger.info("media_stream_stopped", call_sid=self.call_sid)
                self._stop_event.set()
                break
    
    async def _on_audio_frame(self, mulaw_bytes: bytes):
        """
        Called for each 20ms audio frame from Twilio.
        Accumulates into buffer; VAD decides when an utterance ends.
        """
        if self._state == self.STATE_SPEAKING:
            # Barge-in: check if caller is speaking over the AI
            pcm = audioop.ulaw2lin(mulaw_bytes, 2)
            if self._vad.is_speech(pcm[:self._vad.FRAME_SAMPLES * 2]):
                await self._cancel_tts_and_barge_in()
            return
        
        # Convert frame to PCM and feed to VAD
        pcm_frame = audioop.ulaw2lin(mulaw_bytes, 2)
        self._speech_buffer.append(pcm_frame)
        
        eou = self._eou_detector.push_frame(pcm_frame[:self._vad.FRAME_SAMPLES * 2])
        if eou:
            combined_pcm = b"".join(self._speech_buffer)
            self._speech_buffer.clear()
            self._eou_detector.reset()
            self._state = self.STATE_PROCESSING
            asyncio.create_task(self._process_turn(combined_pcm, mulaw_bytes))
            
    async def _cancel_tts_and_barge_in(self):
        """Interrupt TTS playback when caller speaks over the AI."""
        # Send Twilio 'clear' event to stop audio playback
        clear_event = {
            "event": "clear",
            "streamSid": self._stream_sid
        }
        await self.ws.send_text(json.dumps(clear_event))
        self._state = self.STATE_LISTENING
        self._eou_detector.reset()
        logger.info("barge_in_detected", call_sid=self.call_sid)

    
    async def _process_turn(self, pcm_bytes: bytes, mulaw_bytes: bytes):
        """
        Core turn-processing pipeline:
        1. STT (transcribe)
        2. LLM (generate response)  
        3. TTS (synthesize)
        4. Send audio back to Twilio
        """
        try:
            # Step 1: STT
            transcript = await self._transcribe(pcm_bytes)
            if not transcript or not transcript.strip():
                self._state = self.STATE_LISTENING
                return
            
            logger.info("media_stream_transcript", text=transcript[:80], call_sid=self.call_sid)
            
            # Step 2: LLM
            ai_response = await self._generate_response(transcript)
            if not ai_response:
                self._state = self.STATE_LISTENING
                return
            
            # Step 3: TTS + stream back
            self._state = self.STATE_SPEAKING
            await self._speak(ai_response)
            
        except Exception as e:
            logger.error("media_stream_turn_error", error=str(e), call_sid=self.call_sid)
        finally:
            self._state = self.STATE_LISTENING
    
    async def _transcribe(self, pcm_bytes: bytes) -> str:
        """STT dispatch — see Part 6.2 for Deepgram streaming implementation."""
        # Import at runtime to avoid circular import
        from adapters.stt_stream_adapter import transcribe_stream
        # We need the language, ideally from state
        state = await self._load_call_state()
        lang = state.get("agent_lang", "am")
        return await transcribe_stream(pcm_bytes, company_id=self.company_id, lang=lang)
    
    async def _generate_response(self, user_text: str) -> str:
        """LLM call — reuses existing llm_complete with call state from Redis."""
        from adapters.llm_adapters import UnifiedLLM
        # Load state (messages history, model config) from Redis
        state = await self._load_call_state()
        
        # Add user text to history
        if "messages" not in state:
            state["messages"] = []
        state["messages"].append({"role": "user", "content": user_text})
        
        llm = UnifiedLLM()
        response, _ = await llm.complete(
            provider=state.get("model_provider", "openai"),
            model_id=state.get("model_id", "gpt-4o-mini"),
            messages=state["messages"],
            api_key=state.get("llm_key", "")
        )
        
        # Append to history and save
        state["messages"].append({"role": "assistant", "content": response})
        await self._save_call_state(state)
        return response
    
    async def _speak(self, text: str):
        """TTS → encode as μ-law → send frames to Twilio WebSocket."""
        from adapters.tts_stream_adapter import synthesize_stream_mulaw
        state = await self._load_call_state()
        voice_id = state.get("voice_id", "")
        voice_provider = state.get("voice_provider", "elevenlabs")
        
        async for mulaw_chunk in synthesize_stream_mulaw(text, company_id=self.company_id, voice_id=voice_id, provider=voice_provider):
            if self._stop_event.is_set() or self._state != self.STATE_SPEAKING:
                break
            
            # Twilio Media Streams expects base64-encoded μ-law audio
            media_event = {
                "event": "media",
                "streamSid": self._stream_sid,
                "media": {
                    "payload": base64.b64encode(mulaw_chunk).decode("utf-8")
                }
            }
            await self.ws.send_text(json.dumps(media_event))
        
        # Signal end of TTS playback
        mark_event = {
            "event": "mark",
            "streamSid": self._stream_sid,
            "mark": {"name": "tts_complete"}
        }
        await self.ws.send_text(json.dumps(mark_event))
    
    async def _load_call_state(self) -> dict:
        """Load call state from Redis (same key format as existing orchestrator)."""
        if self.redis:
            raw = await self.redis.get(f"call:{self.call_sid}:state")
            if raw:
                import json
                return json.loads(raw)
        return {"messages": [], "turn_count": 0}
    
    async def _save_call_state(self, state: dict):
        """Save call state to Redis."""
        if self.redis:
            import json
            await self.redis.setex(
                f"call:{self.call_sid}:state",
                3600,  # 1 hour TTL
                json.dumps(state)
            )
    
    async def cleanup(self):
        """Release resources on disconnect."""
        if self._speak_task and not self._speak_task.done():
            self._speak_task.cancel()
        self._stop_event.set()
        if self.redis and not self._stop_event.is_set():
            # Unexpected disconnect — flag for fallback
            await self.redis.setex(f"call:{self.call_sid}:fallback", 300, "1")
            logger.warning("media_stream_unexpected_disconnect_flagging_fallback", call_sid=self.call_sid)
        logger.info("media_stream_cleanup_done", call_sid=self.call_sid)
