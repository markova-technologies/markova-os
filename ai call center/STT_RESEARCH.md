# Amharic STT Research — Provider Evaluation & Testing Guide

> **Date:** July 2026  
> **Purpose:** Find the best STT provider for the Markova AI Call Center playground,
> specifically for **Amharic-primary + Amharic-English code-switching** in
> **telephony-grade audio** (noisy, 8kHz, compressed).

---

## The Hard Truth About Amharic STT (Confirmed)

Amharic is a **genuinely difficult low-resource language** for global ASR models.
The critical findings, confirmed across multiple sources:

- **Base OpenAI Whisper / Groq Whisper Large v3 Turbo**: ~99.8% WER on Amharic FLEURS.
  Effectively broken. Produces wrong character sets, repetitive letters, hallucinations.
  This is the model we are currently using in the playground.

- **Deepgram Nova-2**: ~100% WER on Amharic FLEURS. Skip entirely.

- **Google Cloud STT**: Consistently last in independent real-world benchmarks even
  for major languages. Skip.

- **Microsoft MAI-Transcribe-1**: Released April 2026. Only covers **25 major languages**.
  Amharic is NOT in that list. Confirmed: skip for our use case.

- **Azure Speech (legacy am-ET)**: Exists in Azure's API but with no published WER.
  Community reports suggest it is unusable for production call center audio.

**The Whisper we rely on today is producing bad Amharic transcriptions.**
Our garbage detection, normalization, and LLM repair are compensating — but they
are workarounds for a fundamentally broken STT. We need to replace the STT layer.

---

## Candidates Worth Testing

### 🥇 Tier 1 — Clear Leaders

---

#### 1. ElevenLabs Scribe v2 (Batch) + Scribe v2 Realtime (Streaming)

**Why it matters:**
The only provider with *published, verified Amharic WER benchmarks*:
- **3.1% WER on FLEURS** (vs Whisper's 99.8%)
- **5.5% WER on Common Voice**
- 90+ languages with actual training data behind them, not just a language ID flag

**What we get:**
- `scribe_v2` — batch file upload, highest accuracy
- `scribe_v2_realtime` — WebSocket streaming, ~150ms latency
- Built-in VAD (Voice Activity Detection)
- Word-level timestamps
- Speaker diarization (up to 32 speakers)
- Audio event tagging (laughter, applause, etc.)

**Free Tier:**
- 10,000 credits/month shared across all features
- Scribe v2 costs **330 credits/minute** of audio
- = **~30 minutes of free transcription per month** if used exclusively for STT
- ⚠️ Free tier is personal use only, no commercial license

**Paid:**
- $0.22/hour (batch)
- $0.39–$0.48/hour (real-time)
- Pay-as-you-go available (no forced subscription)

**Integration (Python):**
```python
pip install elevenlabs
```
```python
from elevenlabs.client import ElevenLabs

client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

with open("recording.wav", "rb") as f:
    result = client.speech_to_text.convert(
        file=f,
        model_id="scribe_v2",
        language_code="am"     # ISO 639-1 Amharic
    )

print(result.text)
```

**Verdict:** 🟢 **Test first. Highest confidence. Only provider with verified Amharic numbers.**

---

#### 2. Gladia Solaria-1 (Batch + Real-Time WebSocket)

**Why it matters:**
Architecturally designed for **mid-sentence code-switching** — exactly our problem
when Ethiopian callers mix Amharic and English within the same sentence.
Unlike most APIs that route language per-segment, Solaria-1 detects language
at the **token level**.

**What we get:**
- `solaria-1` — 100+ language universal model (use for Amharic)
- `solaria-3` — optimized for noisy/telephony BUT only covers 5 European languages (no Amharic)
- Native code-switching: set `language_config: ["am", "en"]` and it handles mid-sentence switches
- REST (batch) + WebSocket (real-time streaming)
- Built-in sentiment analysis, entity recognition, summarization (bonus for analytics)
- ~100–270ms latency for real-time

**⚠️ Important Finding:**
Gladia has **no published Amharic WER** for Solaria-1. The model supports Amharic
(ISO `am`) but Gladia only publishes benchmarks for major European languages.
This means we must test with our own audio to know the actual accuracy.

**Free Tier:**
- **10 hours of transcription per month** (both async and real-time)
- ✅ Much more generous than ElevenLabs for testing
- No commercial license restriction mentioned for free tier

**Paid:**
- Starter (pay-as-you-go): $0.61/hour async, $0.75/hour real-time
- Growth plan: ~$0.20/hour async (volume discounts)
- Enterprise: custom

**Integration (Python):**
```python
pip install gladia-client
```
```python
import requests

headers = {"x-gladia-key": os.getenv("GLADIA_API_KEY")}

with open("recording.wav", "rb") as f:
    files = {"audio": f}
    data = {
        "language_config": '{"languages": ["am", "en"], "code_switching": true}'
    }
    resp = requests.post(
        "https://api.gladia.io/v2/transcription",
        headers=headers,
        files=files,
        data=data
    )

print(resp.json()["result"]["transcription"]["full_transcript"])
```

**Verdict:** 🟡 **Test second. Best architecture for code-switching. Accuracy unknown for Amharic.**

---

### 🥈 Tier 2 — Open Source / Self-Hosted

---

#### 3. Fine-Tuned Whisper (HuggingFace Community Models)

The base Whisper is broken for Amharic, but the *fine-tuned* community models
show meaningful improvement:

| Model | Architecture | WER | Dataset | Notes |
|---|---|---|---|---|
| `waxal-benchmarking/whisper-small-waxal-amh` | Whisper Small | **33.6%** | WAXAL conversational | Spontaneous speech, realistic |
| `chappM/whisper-amharic-small-v2` | Whisper Small | **69%** | Mozilla Common Voice | Read speech |
| `badrex/Ethio-ASR-amharic` | wav2vec2-bert-2.0 | **22.37%** | WAXAL | Best open-source, not Whisper |

**Key insights from research:**
1. Fine-tuning on **mixed datasets** (FLEURS + local Amharic data) is critical —
   training on new data alone gives poor results
2. **Homophone normalization** is mandatory post-processing (we already do this ✅)
3. Custom character-level tokenizers improve performance (Whisper's byte-level
   tokenizer is inefficient for Ge'ez script)

**These are NOT plug-and-play replacements.** They require:
- A GPU to run inference (6–10GB VRAM for Whisper Large)
- Self-hosting infrastructure
- Integration with our audio pipeline

**Verdict:** 🔵 **Explore as a long-term option. Not for immediate testing. 22–33% WER
is a massive improvement over 99.8% but still not production-quality.**

---

### ❌ Tier 3 — Skip

| Provider | Reason |
|---|---|
| **Groq Whisper Large v3 Turbo (current)** | ~99.8% WER on Amharic. Broken for our use case. |
| **OpenAI Whisper-1** | Same base model, same problem. |
| **Deepgram Nova-2** | 100% WER on Amharic FLEURS. Confirmed broken. |
| **Google Cloud STT** | Consistently worst in benchmarks, even for major languages. |
| **Microsoft MAI-Transcribe-1** | Amharic not in its 25-language list. |
| **Azure Speech (am-ET)** | No published benchmarks, community reports are poor. |

---

## Our Specific Context: Telephony Challenges

Our audio is **uniquely hard**:
- 8kHz/16kHz compressed phone audio (not studio-quality)
- Noisy call environments (background noise, echo, low bitrate)
- Amharic-English code-switching mid-sentence
- Multiple speakers (customer + agent)
- Ethiopian regional accents

This means even ElevenLabs' 3.1% FLEURS WER is measured on **clean read speech**.
Our real-world telephony WER will be higher. The 30-minute free tier is enough to
test with our actual recorded call audio.

---

## Testing Plan

### Phase 1 — Quick Accuracy Shootout (Can Do Today)

**What you need:**
1. An ElevenLabs API key (free account at elevenlabs.io)
2. A Gladia API key (free account at gladia.io)
3. 5–10 sample WAV recordings of real Amharic calls from our playground `recordings/` folder

**Test script** (to be built in the playground):
```
ai call center/test_stt_comparison.py
```

The script will:
1. Take a set of reference audio files + their correct transcriptions
2. Send each file to ElevenLabs Scribe v2 and Gladia Solaria-1
3. Also send to Groq Whisper (current baseline)
4. Calculate WER for each provider
5. Log results to a comparison table

### Phase 2 — Real-Time Integration Test

After Phase 1, wire the winning provider into the playground's
`main_natural_voice.py` as the primary STT and run live call tests.

### Phase 3 — Promotion

After the playground proves the new STT is better than Groq Whisper,
promote the adapter to `services/orchestrator/main.py`.

---

## Recommendation Summary

| Priority | Provider | Action | Free? |
|---|---|---|---|
| **1st** | ElevenLabs Scribe v2 | Test immediately — only verified Amharic WER | ✅ 30 min/month |
| **2nd** | Gladia Solaria-1 | Test for code-switching quality | ✅ 10 hours/month |
| **3rd** | Fine-tuned Whisper (HuggingFace) | Research only for now | ✅ Free (GPU needed) |
| **Skip** | Groq/OpenAI/Deepgram/Google | Confirmed broken for Amharic | - |

---

## Cost Projection (Production)

Assuming **500 calls/month × 3 minutes avg = 25 hours/month**:

| Provider | Monthly Cost |
|---|---|
| ElevenLabs Scribe v2 (batch) | $0.22 × 25 = **$5.50** |
| ElevenLabs Scribe v2 Realtime | $0.43 × 25 = **$10.75** |
| Gladia Solaria-1 (Growth plan) | $0.20 × 25 = **$5.00** |
| Groq Whisper (current) | **~$0.00** (free tier) but ~99.8% WER |

The accuracy improvement is worth the cost. $5–$10/month for production Amharic STT
is negligible compared to the customer experience cost of bad transcription.

---

*Next step: Build `test_stt_comparison.py` in the playground and run against real audio.*
