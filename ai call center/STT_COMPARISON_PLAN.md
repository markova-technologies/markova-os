# STT Comparison Test — Implementation Plan

> **File to build:** `ai call center/test_stt_comparison.py`  
> **Goal:** Send the same Amharic audio to Groq Whisper (baseline), ElevenLabs Scribe v2,
> and Gladia Solaria-1, then calculate WER side-by-side to find the best STT for production.

---

## ⚠️ Important Discovery: No Audio Recordings Available

The `recordings/` folder contains only `.txt` transcript files — **no actual `.wav` audio files**.
This means we have nothing to benchmark against yet.

**You must create a test audio dataset first** (Step 1 below).

---

## What YOU Need to Do (Your Checklist)

### Step 1 — Create Audio Test Samples

You need **5–10 audio samples** of real Amharic speech, ideally:
- 15–60 seconds each
- Phone-call quality (not studio — we want to test real conditions)
- Mix of pure Amharic AND Amharic-English code-switching
- Saved as `.wav` files (16kHz mono preferred)

**How to get them (pick one):**

**Option A — Record yourself (fastest)**  
Record yourself or a native Amharic speaker saying phrases like:
- "ሶፋው ዋጋ ስንት ነው? Is there a discount?"
- "ዋርድሮቡ ምን ያህል ነው delivery ጨምሮ?"
- "ሾሩም ቦሌ ላይ ነው? What time do you close?"

Use your phone's voice memo app, then move the file to your PC.

**Option B — Extract from past Twilio recordings**  
If you have any Twilio call recordings from the demo phase,
download them from Twilio Console → Calls → Recordings.

**Option C — Use sample audio from online**  
Download any Amharic speech sample (news, radio clip, etc.) from YouTube
using a converter, trim to 30–60 seconds.

**Where to put them:**
```
ai call center/
  test_audio/
    sample_01_sofa_price.wav        ← pure Amharic
    sample_02_delivery_question.wav ← Amharic + English
    sample_03_showroom_location.wav ← Amharic + English
    sample_04_payment_query.wav     ← pure Amharic
    sample_05_noisy_call.wav        ← noisy phone-quality audio
```

**For each file, also create a reference transcript:**
```
test_audio/
  sample_01_sofa_price.txt        ← what was actually said (ground truth)
  sample_02_delivery_question.txt
  ...
```

---

### Step 2 — Get API Keys

#### A. ElevenLabs (Free — 30 min STT/month)
1. Go to **https://elevenlabs.io** → Sign Up (free account)
2. Once logged in → click your profile icon (top right) → **Profile + API key**
3. Copy the API key
4. Add to your `.env` file:
   ```
   ELEVENLABS_API_KEY=your_key_here
   ```

#### B. Gladia (Free — 10 hours STT/month)
1. Go to **https://app.gladia.io** → Sign Up (free account, no credit card)
2. Once logged in → **Settings** → **API Keys** → Create a new key
3. Copy the API key
4. Add to your `.env` file:
   ```
   GLADIA_API_KEY=your_key_here
   ```

#### C. Groq (Already have it — just verify)
Your existing `GROQ_API_KEY` in `.env` is enough. This is the baseline we're comparing against.

**Your `.env` additions needed:**
```env
# --- New STT Providers (for comparison testing) ---
ELEVENLABS_API_KEY=your_elevenlabs_key_here
GLADIA_API_KEY=your_gladia_key_here
```

---

### Step 3 — Install New Dependencies

After getting the keys, run this in the `ai call center/` folder
(with your `.venv` activated):

```powershell
# Activate venv first
.\.venv\Scripts\activate

# Install new packages
pip install elevenlabs jiwer requests
```

- `elevenlabs` — ElevenLabs official SDK
- `jiwer` — library for calculating WER (Word Error Rate)
- `requests` — for Gladia REST API calls (already installed but just in case)

---

## What the Script Will Do (Technical Design)

```
test_stt_comparison.py
│
├── Load all WAV files from test_audio/
├── Load matching .txt reference transcripts
│
├── For each audio file:
│   ├── Send to Groq Whisper (current baseline)
│   │   └── Returns: transcribed text
│   ├── Send to ElevenLabs Scribe v2
│   │   └── Returns: transcribed text
│   └── Send to Gladia Solaria-1 (with code_switching: ["am","en"])
│       └── Returns: transcribed text
│
├── For each result:
│   ├── Normalize text (lowercase, strip punctuation)
│   ├── Apply Amharic homophone normalization (reuse our existing normalizer)
│   └── Calculate WER against reference transcript using jiwer
│
└── Print & save results table:
    ┌──────────────────────┬────────┬────────────┬────────┐
    │ File                 │  Groq  │ ElevenLabs │ Gladia │
    ├──────────────────────┼────────┼────────────┼────────┤
    │ sample_01_sofa_price │ 87.3%  │  4.1%      │ 12.6%  │
    │ sample_02_delivery   │ 91.2%  │  6.8%      │  9.4%  │
    │ sample_05_noisy_call │ 99.8%  │ 18.2%      │ 22.1%  │
    ├──────────────────────┼────────┼────────────┼────────┤
    │ AVERAGE WER          │ 92.8%  │  9.7%      │ 14.7%  │
    └──────────────────────┴────────┴────────────┴────────┘
    
    → Saved to: test_audio/results_2026-07-24.json
```

---

## File Structure After Setup

```
ai call center/
├── main_natural_voice.py       ← (unchanged)
├── test_stt_comparison.py      ← (new — to be built)
├── STT_RESEARCH.md             ← (reference)
├── test_audio/                 ← (YOU create this)
│   ├── sample_01_sofa_price.wav
│   ├── sample_01_sofa_price.txt  ← ground truth transcript
│   ├── sample_02_delivery_question.wav
│   ├── sample_02_delivery_question.txt
│   └── ...
├── .env                        ← add ELEVENLABS_API_KEY + GLADIA_API_KEY
└── requirements.txt            ← add elevenlabs, jiwer
```

---

## Implementation Plan (What I Will Build)

### `test_stt_comparison.py` — Full Feature List

| Feature | Detail |
|---|---|
| Multi-file support | Scans `test_audio/*.wav` automatically |
| Groq adapter | Existing pattern from `main_natural_voice.py` |
| ElevenLabs adapter | Uses `client.speech_to_text.convert(model_id="scribe_v2")` |
| Gladia adapter | REST POST to `api.gladia.io/v2/transcription` with `code_switching: true` |
| WER calculation | Uses `jiwer.wer()` after normalizing both strings |
| Amharic normalization | Reuses our existing homophone map |
| Per-file results | Shows raw transcript + WER for each provider |
| Summary table | Averages + winner declared at end |
| JSON export | Results saved to `test_audio/results_{date}.json` |
| Timing | Measures latency per provider (how long each API call takes) |
| Error handling | Graceful failures if one provider is down or key is missing |

---

## Your Action Items (In Order)

```
[ ] 1. Create test_audio/ folder in ai call center/
[ ] 2. Record/collect 5+ Amharic audio samples → save as .wav
[ ] 3. Write a ground truth .txt file for each audio sample
[ ] 4. Sign up at elevenlabs.io → get API key → add to .env
[ ] 5. Sign up at app.gladia.io → get API key → add to .env
[ ] 6. Run: pip install elevenlabs jiwer  (in activated venv)
[ ] 7. Tell me "ready" → I will write the full script
[ ] 8. Run: python test_stt_comparison.py
[ ] 9. Share the results table → we decide which provider wins
```

---

## After the Test — What Happens Next

Based on results, we will:

| Outcome | Next Step |
|---|---|
| ElevenLabs wins clearly | Replace Groq Whisper with ElevenLabs Scribe v2 in `main_natural_voice.py` |
| Gladia wins clearly | Replace with Gladia Solaria-1, tune code-switching config |
| Both much better than Groq | Pick ElevenLabs (better published benchmarks, real-time support) |
| Neither beats Groq on our audio | Investigate fine-tuned Whisper models from HuggingFace |

The winner gets wired into the playground as the new primary STT, the fallback
chain becomes: `Winner → Groq (speed fallback) → Error retry`.

Once proven in the playground → promoted to `services/orchestrator/main.py`.
