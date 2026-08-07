import random
import httpx

# Polite rotatable retries
POLITE_RETRY_RESPONSES = [
    "ይቅርታ፣ አንዴ ይድገሙልኝ?",
    "ይቅርታ፣ ግልፅ አልሆነልኝም። ደግመው ይንገሩኝ?",
    "ይቅርታ፣ ጥያቄዎን ትንሽ እንደገና ይንገሩኝ?",
    "እሺ፣ ይቅርታ ጎን ያሉኝ ድምፅ ብዙ ነው። እባክዎ ደግመው ይንገሩኝ?",
    "ይቅርታ፣ በደንብ አልሰማሁዎትም። እባክዎ ቀስ ብለው ይንገሩኝ?",
    "ይቅርታ፣ መስመሩ ትንሽ ደካማ ነው። እባክዎ ደግመው ይናገሩ?",
]

def get_polite_retry() -> str:
    return random.choice(POLITE_RETRY_RESPONSES)

# Homophone normalizer map
AMHARIC_NORMALIZER = str.maketrans({
    'ሐ': 'ሀ', 'ኀ': 'ሀ', 'ሑ': 'ሁ', 'ኁ': 'ሁ',
    'ሒ': 'ሂ', 'ኂ': 'ሂ', 'ሓ': 'ሃ', 'ኃ': 'ሃ',
    'ሔ': 'ሄ', 'ኄ': 'ሄ', 'ሕ': 'ህ', 'ኅ': 'ህ',
    'ሖ': 'ሆ', 'ኆ': 'ሆ',
    'ዐ': 'አ', 'ዑ': 'ኡ', 'ዒ': 'ኢ', 'ዓ': 'ኣ',
    'ዔ': 'ኤ', 'ዕ': 'እ', 'ዖ': 'ኦ',
    'ሠ': 'ሰ', 'ሡ': 'ሱ', 'ሢ': 'ሲ', 'ሣ': 'ሳ',
    'ሤ': 'ሴ', 'ሥ': 'ስ', 'ሦ': 'ሶ',
    'ፀ': 'ጸ', 'ፁ': 'ጹ', 'ፂ': 'ጺ', 'ፃ': 'ጻ',
    'ፄ': 'ጼ', 'ፅ': 'ጽ', 'ፆ': 'ጾ',
})

def normalize_amharic(text: str) -> str:
    """Normalize phonetically equivalent Amharic characters to a standard form."""
    if not text:
        return text
    return text.translate(AMHARIC_NORMALIZER)

def is_garbage_transcription(text: str) -> bool:
    """Detect if the transcription is Whisper/STT hallucination garbage."""
    if not text or len(text.strip()) < 2:
        return True

    text = text.strip()
    amharic_chars = 0
    garbage_chars = 0
    latin_chars = 0
    total_alpha = 0

    for char in text:
        code = ord(char)
        if 0x1200 <= code <= 0x139F or 0x2D80 <= code <= 0x2DDF:
            amharic_chars += 1
            total_alpha += 1
        elif char.isalpha():
            total_alpha += 1
            if (0x10D0 <= code <= 0x10FF or  # Georgian
                0x0E00 <= code <= 0x0E7F or  # Thai
                0x0400 <= code <= 0x04FF or  # Cyrillic
                0x4E00 <= code <= 0x9FFF or  # CJK
                0x0600 <= code <= 0x06FF or  # Arabic
                0x0900 <= code <= 0x097F or  # Devanagari
                0xAC00 <= code <= 0xD7AF):   # Korean
                garbage_chars += 1
            else:
                latin_chars += 1
        elif code == 0xFFFD:
            garbage_chars += 1

    if garbage_chars >= 2:
        return True
    if '' in text or '\ufffd' in text:
        return True
    
    # Check for repetitive characters
    for i in range(len(text) - 3):
        if text[i] == text[i+1] == text[i+2] == text[i+3] and text[i].isalpha():
            return True

    if total_alpha > 0 and amharic_chars == 0 and latin_chars < 3:
        return True
    if len(text) < 5 and amharic_chars == 0:
        return True

    # Numeric ratio check
    words = text.split()
    if len(words) >= 2:
        numeric_words = sum(1 for w in words if w.strip('.,?!').isdigit())
        if numeric_words / len(words) >= 0.7:
            return True

    # Hallucination keywords
    hallucination_phrases = [
        "subtitles by", "subscrib", "thank you for watching",
        "please subscribe", "like and subscribe", "ሰብስክራይብ",
        "feeding", "www.", "http"
    ]
    text_lower = text.lower()
    if any(phrase in text_lower for phrase in hallucination_phrases):
        return True

    return False

async def repair_amharic_transcription(text: str, api_key: str) -> str:
    """Repair Whisper phonetic errors using a fast LLM pass."""
    if not text or len(text) < 3 or not api_key:
        return text
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [{
                        "role": "system",
                        "content": (
                            "You are an Amharic text repair tool. Fix phonetic spelling mistakes in Amharic text "
                            "produced by speech recognition. The text may contain English words mixed in. "
                            "Only fix obvious character substitutions. Return ONLY the corrected text, nothing else."
                        )
                    }, {"role": "user", "content": text}],
                    "temperature": 0.0,
                    "max_tokens": 100
                }
            )
            if resp.status_code == 200:
                repaired = resp.json()["choices"][0]["message"]["content"].strip()
                return repaired or text
    except Exception as e:
        print(f"⚠️ Phonetic repair failed: {e}")
    return text
