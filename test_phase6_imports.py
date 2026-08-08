import sys
import os

try:
    from services.orchestrator.media_stream_handler import MediaStreamHandler
    from services.orchestrator.vad import SileroVAD, EndOfUtteranceDetector
    from services.orchestrator.adapters.stt_stream_adapter import transcribe_stream
    from services.orchestrator.adapters.tts_stream_adapter import synthesize_stream_mulaw
    print("All modules imported successfully.")
except Exception as e:
    print(f"Import error: {e}")
    sys.exit(1)
