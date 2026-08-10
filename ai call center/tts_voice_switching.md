Searched web: "edge-tts list voices Amharic Oromo Ethiopian"
Searched web: ""Addis AI" text to speech API voice options Amharic Afaan Oromo"
Searched web: "python edge-tts voice selection example am-ET-MekdesNeural"
Searched web: ""addisassistant.com" voice generations payload voice_id text"

Both **Edge-TTS** and **Addis AI TTS** support **voice switching over an API**, but they differ significantly in language coverage (especially for **Afaan Oromo**) and accent/dialect support.

Below is a detailed technical breakdown based on current API specifications.

---

### 📊 Feature Comparison Overview

| Feature | Microsoft Edge-TTS | Addis AI TTS (`addisassistant.com`) |
| :--- | :--- | :--- |
| **Voice Switching via API** | ✅ **Yes** (via `voice` parameter) | ✅ **Yes** (via `voice_id` in payload) |
| **Amharic (`am-ET`)** | ✅ Supported (2 neural voices) | ✅ Supported (Multiple custom voices) |
| **Afaan Oromo (`om-ET`)** | ❌ **Not Supported** | ✅ **Supported** (Native voice models) |
| **Regional Ethiopian Accents** | Standard Microsoft Neural (`am-ET`) | Purpose-built for Ethiopian linguistic nuances |
| **Streaming Support** | ✅ Yes (WebSocket) | ✅ Yes (Streaming HTTP/SDK) |
| **Pricing / Access** | Free / Open-source wrapper | Commercial API Key required (`x-api-key`) |

---

### 1. Edge-TTS (Microsoft Edge Read Aloud API)

`edge-tts` allows programmatically switching between any Microsoft Neural voice using the `voice` parameter.

#### **Voice Availability:**
* **Amharic (`am-ET`)**: Supports **2 voices**:
  * `am-ET-MekdesNeural` (Female)
  * `am-ET-AmehaNeural` (Male)
* **Afaan Oromo**: **Not supported**. Microsoft does not currently provide neural voices for Afaan Oromo.
* **Accents**: Limited to standard `am-ET` national pronunciation. No sub-regional dialect or accent selection flags are available.

#### **API Usage Example (Python):**
```python
import asyncio
import edge_tts

async def generate_speech(text: str, voice_id: str, output_file: str):
    # Switch voices by passing different voice IDs:
    # "am-ET-MekdesNeural" (Female) or "am-ET-AmehaNeural" (Male)
    communicate = edge_tts.Communicate(text, voice_id)
    await communicate.save(output_file)

# Amharic example:
asyncio.run(generate_speech("ጤና ይስጥልኝ፣ እንዴት ነዎት?", "am-ET-MekdesNeural", "amharic.mp3"))
```

---

### 2. Addis AI TTS (`Addis Voices 2` API)

Addis AI provides a dedicated, purpose-built API specifically trained on Ethiopian languages, supporting dynamic voice switching via their **Addis Voices** catalog.

#### **Voice & Accent Capabilities:**
* **Amharic**: Offers multiple distinct speaker profiles (`voice_id`), allowing selection between different genders, tones, and speaking styles.
* **Afaan Oromo**: **Fully supported** with native voice models tuned for Afaan Oromo phonetics.
* **Accents & Nuances**: Built specifically to capture local pitch, stress, and pronunciation rules that global engines often miss.

#### **API Usage Example (REST):**

**Endpoint:** `POST https://api.addisassistant.com/api/v1/voice/generations`

```json
// Headers:
// x-api-key: YOUR_ADDIS_AI_API_KEY
// Content-Type: application/json

// Amharic Request:
{
  "text": "ሰላም፣ ይህ የአዲስ ድምፅ ሁለት ሙከራ ነው።",
  "voice_id": "amharic_female_speaker_1"
}

// Afaan Oromo Request (Switching voice_id):
{
  "text": "Akkam jirtu, nagaa jirtuu?",
  "voice_id": "oromo_male_speaker_1"
}
```

---

### 💡 Summary Recommendation

1. **For Amharic Only (Free / Zero-Cost)**: Use **Edge-TTS**. You can switch between `am-ET-MekdesNeural` (Female) and `am-ET-AmehaNeural` (Male) dynamically in your code.
2. **For Afaan Oromo or Custom Ethiopian Accents**: Use **Addis AI TTS API**, as Microsoft Edge TTS does not support Afaan Oromo.