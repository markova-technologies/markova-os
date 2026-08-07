TWILIO_VOICE_MAP = {
    "amharic": {"voice": "Polly.Zeina", "lang": "ar-EG", "stt": "am-ET"},
    "english": {"voice": "Polly.Joanna", "lang": "en-US", "stt": "en-US"},
    "spanish": {"voice": "Polly.Conchita", "lang": "es-ES", "stt": "es-ES"},
    "french": {"voice": "Polly.Celine", "lang": "fr-FR", "stt": "fr-FR"}
}

def build_default_state() -> dict:
    return {
        "messages": [],
        "turn_count": 0,
        "call_id": None,
        "empty_turns": 0
    }
