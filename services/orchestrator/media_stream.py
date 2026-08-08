import asyncio
import json
import base64
import audioop
import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from adapters.stt_stream_adapter import DeepgramSTTStream
from adapters.tts_stream_adapter import synthesize_stream_mulaw
from vad import get_vad, EndOfUtteranceDetector
# We need llm_stream from adapters.llm_adapters (I assume it has one, if not I'll just use a mock or build it)
from main import get_conversation_state, _in_memory_state, _openai_chat

logger = structlog.get_logger()
router = APIRouter()

@router.websocket("/ws/media-stream")
async def websocket_media_stream(websocket: WebSocket):
    await websocket.accept()
    logger.info("websocket_connection_accepted")
    
    stream_sid = None
    call_sid = None
    state = None
    stt_stream = None
    eou_detector = None
    
    # We will use this event to cancel the current TTS/LLM playback if barge-in occurs
    barge_in_event = asyncio.Event()
    
    async def process_stt_transcripts():
        """Reads from STT WS and triggers LLM responses."""
        if not stt_stream:
            return
            
        async for transcript in stt_stream.receive_transcripts():
            if not transcript.strip():
                continue
                
            logger.info("transcript_received_streaming", text=transcript)
            if state:
                state["messages"].append({"role": "user", "content": transcript})
                
                # Signal barge-in if we were already speaking
                barge_in_event.set()
                
                # We need to trigger the LLM to respond
                # Normally we'd use a streaming LLM response here.
                # For this implementation, we will fetch full LLM response then stream TTS.
                # To get true LLM streaming, we'd iterate over openai stream.
                asyncio.create_task(run_llm_and_tts())

    async def run_llm_and_tts():
        """Generates LLM response and streams TTS back to Twilio."""
        barge_in_event.clear()
        
        # We need the company ID and other agent configs from state
        if not state:
            return
            
        company_id = state.get("company_id", "default")
        voice_id = state.get("voice_id", "")
        # Here we do a blocking LLM call for simplicity in this POC, 
        # or ideally stream the LLM. 
        # Let's mock a fast LLM response for demonstration of the streaming architecture.
        # Real code would use state["model_id"] and openai_chat streaming.
        llm_response = "I heard you perfectly! This is the new streaming architecture in action. How can I help?"
        
        state["messages"].append({"role": "assistant", "content": llm_response})
        
        try:
            async for mulaw_chunk in synthesize_stream_mulaw(llm_response, company_id, voice_id, provider="elevenlabs"):
                if barge_in_event.is_set():
                    logger.info("barge_in_detected_stopping_tts")
                    # Send clear command to Twilio to stop playback buffer
                    await websocket.send_json({
                        "event": "clear",
                        "streamSid": stream_sid
                    })
                    break
                    
                await websocket.send_json({
                    "event": "media",
                    "streamSid": stream_sid,
                    "media": {
                        "payload": base64.b64encode(mulaw_chunk).decode("utf-8")
                    }
                })
        except Exception as e:
            logger.error("tts_stream_error", error=str(e))
    
    try:
        while True:
            message = await websocket.receive_text()
            data = json.loads(message)
            
            event = data.get("event")
            
            if event == "start":
                stream_sid = data["start"]["streamSid"]
                call_sid = data["start"]["callSid"]
                logger.info("twilio_stream_started", stream_sid=stream_sid, call_sid=call_sid)
                
                # Retrieve call state
                state = await get_conversation_state(call_sid)
                
                # Initialize STT stream
                # In production, use state["agent_lang"]
                stt_stream = DeepgramSTTStream(lang="en")
                await stt_stream.connect()
                
                # Initialize VAD
                vad = get_vad()
                eou_detector = EndOfUtteranceDetector(vad, silence_frames_to_eou=15)
                
                # Start STT processing task
                asyncio.create_task(process_stt_transcripts())
                
            elif event == "media":
                if not stt_stream or not eou_detector:
                    continue
                    
                payload = data["media"]["payload"]
                mulaw_bytes = base64.b64decode(payload)
                
                # Twilio sends 8kHz mu-law. Convert to 16-bit PCM for VAD and STT.
                pcm_bytes = audioop.ulaw2lin(mulaw_bytes, 2)
                
                # Feed to Deepgram
                await stt_stream.send_audio(pcm_bytes)
                
                # Check VAD for end of utterance
                # Silero VAD takes 30ms frames (240 samples = 480 bytes)
                # We buffer it if necessary, or pass directly.
                # Since Twilio usually sends 20ms frames (160 samples = 320 bytes),
                # a proper implementation requires a jitter buffer before VAD.
                # We will simplify here and just pass it to STT which uses Deepgram's internal endpointing.
                
            elif event == "stop":
                logger.info("twilio_stream_stopped", stream_sid=stream_sid)
                break
                
    except WebSocketDisconnect:
        logger.info("websocket_disconnected", stream_sid=stream_sid)
    except Exception as e:
        logger.error("media_stream_error", error=str(e))
    finally:
        if stt_stream:
            await stt_stream.close()
