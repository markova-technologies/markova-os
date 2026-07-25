import sys
import os
import re
import json
import time
import asyncio
import httpx
from dotenv import load_dotenv

# Ensure utf-8 output encoding for Windows terminal
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


# Load environment variables from .env
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path=env_path)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
GLADIA_API_KEY = os.getenv("GLADIA_API_KEY")
GROQ_WHISPER_MODEL = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")

# Amharic homophone normalizer map
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

def normalize_text(text: str) -> str:
    """Normalize text for fair WER/CER calculation."""
    if not text:
        return ""
    text = text.translate(AMHARIC_NORMALIZER)
    # Strip punctuation except Amharic/English alphanumeric and space
    text = re.sub(r'[^\w\s\u1200-\u137F]', '', text)
    return " ".join(text.lower().split())

def calculate_levenshtein(ref_tokens: list, hyp_tokens: list) -> int:
    """Compute Levenshtein edit distance between reference and hypothesis tokens."""
    r_len, h_len = len(ref_tokens), len(hyp_tokens)
    dp = [[0] * (h_len + 1) for _ in range(r_len + 1)]
    for i in range(r_len + 1):
        dp[i][0] = i
    for j in range(h_len + 1):
        dp[0][j] = j
    for i in range(1, r_len + 1):
        for j in range(1, h_len + 1):
            if ref_tokens[i - 1] == hyp_tokens[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    return dp[r_len][h_len]

def calculate_wer(reference: str, hypothesis: str) -> float:
    """Calculate Word Error Rate (WER)."""
    ref_norm = normalize_text(reference)
    hyp_norm = normalize_text(hypothesis)
    ref_words = ref_norm.split()
    hyp_words = hyp_norm.split()
    if not ref_words:
        return 0.0 if not hyp_words else 1.0
    dist = calculate_levenshtein(ref_words, hyp_words)
    return round((dist / len(ref_words)) * 100, 2)

def calculate_cer(reference: str, hypothesis: str) -> float:
    """Calculate Character Error Rate (CER)."""
    ref_norm = normalize_text(reference).replace(" ", "")
    hyp_norm = normalize_text(hypothesis).replace(" ", "")
    ref_chars = list(ref_norm)
    hyp_chars = list(hyp_norm)
    if not ref_chars:
        return 0.0 if not hyp_chars else 1.0
    dist = calculate_levenshtein(ref_chars, hyp_chars)
    return round((dist / len(ref_chars)) * 100, 2)

# --- Provider Adapters ---

async def transcribe_groq(file_path: str) -> tuple[str, float, str]:
    """Transcribe using Groq Whisper API."""
    if not GROQ_API_KEY or GROQ_API_KEY.startswith("your_"):
        return "", 0.0, "Missing GROQ_API_KEY"
    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            with open(file_path, "rb") as f:
                files = {"file": (os.path.basename(file_path), f, "audio/wav")}
                data = {
                    "model": GROQ_WHISPER_MODEL,
                    "language": "am",
                    "prompt": "ሰላም የጂኤም ፈርኒቸር ደንበኛ ድጋፍ ነኝ። ሶፋ ወንበር አልጋ ዋጋ ክፍያ"
                }
                resp = await client.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                    files=files,
                    data=data
                )
            latency = round(time.time() - start_time, 3)
            if resp.status_code == 200:
                return resp.json().get("text", "").strip(), latency, "OK"
            return "", latency, f"HTTP {resp.status_code}: {resp.text[:100]}"
    except Exception as e:
        return "", round(time.time() - start_time, 3), str(e)

async def transcribe_openai(file_path: str) -> tuple[str, float, str]:
    """Transcribe using OpenAI Whisper-1 API."""
    if not OPENAI_API_KEY or OPENAI_API_KEY.startswith("your_"):
        return "", 0.0, "Missing OPENAI_API_KEY"
    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            with open(file_path, "rb") as f:
                files = {"file": (os.path.basename(file_path), f, "audio/wav")}
                data = {
                    "model": "whisper-1",
                    "language": "am",
                    "prompt": "ሰላም የጂኤም ፈርኒቸር ደንበኛ ድጋፍ ነኝ። ሶፋ ወንበር አልጋ ዋጋ ክፍያ"
                }
                resp = await client.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
                    files=files,
                    data=data
                )
            latency = round(time.time() - start_time, 3)
            if resp.status_code == 200:
                return resp.json().get("text", "").strip(), latency, "OK"
            return "", latency, f"HTTP {resp.status_code}: {resp.text[:100]}"
    except Exception as e:
        return "", round(time.time() - start_time, 3), str(e)

async def transcribe_elevenlabs(file_path: str) -> tuple[str, float, str]:
    """Transcribe using ElevenLabs Scribe v2 API."""
    if not ELEVENLABS_API_KEY or ELEVENLABS_API_KEY.startswith("your_"):
        return "", 0.0, "Missing ELEVENLABS_API_KEY"
    start_time = time.time()
    try:
        # First try Python SDK if available
        try:
            from elevenlabs.client import ElevenLabs
            client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
            with open(file_path, "rb") as f:
                res = client.speech_to_text.convert(file=f, model_id="scribe_v2", language_code="am")
            latency = round(time.time() - start_time, 3)
            text = getattr(res, "text", str(res))
            return text.strip(), latency, "OK (SDK)"
        except Exception as sdk_err:
            # Fallback to direct REST API
            async with httpx.AsyncClient(timeout=30) as client:
                with open(file_path, "rb") as f:
                    files = {"file": (os.path.basename(file_path), f, "audio/wav")}
                    data = {"model_id": "scribe_v2", "language_code": "am"}
                    resp = await client.post(
                        "https://api.elevenlabs.io/v1/speech-to-text",
                        headers={"xi-api-key": ELEVENLABS_API_KEY},
                        files=files,
                        data=data
                    )
                latency = round(time.time() - start_time, 3)
                if resp.status_code == 200:
                    return resp.json().get("text", "").strip(), latency, "OK (REST)"
                return "", latency, f"HTTP {resp.status_code}: {resp.text[:100]}"
    except Exception as e:
        return "", round(time.time() - start_time, 3), str(e)

async def transcribe_gladia(file_path: str) -> tuple[str, float, str]:
    """Transcribe using Gladia Solaria-1 API (v2 REST API)."""
    if not GLADIA_API_KEY or GLADIA_API_KEY.startswith("your_"):
        return "", 0.0, "Missing GLADIA_API_KEY"
    start_time = time.time()
    try:
        headers = {"x-gladia-key": GLADIA_API_KEY}
        async with httpx.AsyncClient(timeout=60) as client:
            # Step 1: Upload file
            with open(file_path, "rb") as f:
                files = {"audio": (os.path.basename(file_path), f, "audio/wav")}
                upload_resp = await client.post(
                    "https://api.gladia.io/v2/upload",
                    headers=headers,
                    files=files
                )
            
            if upload_resp.status_code not in [200, 201]:
                # Fallback to v1 direct transcription if upload v2 fails
                with open(file_path, "rb") as f:
                    v1_files = {"audio": (os.path.basename(file_path), f, "audio/wav")}
                    v1_data = {"language": "am", "toggle_code_switching": "true"}
                    v1_resp = await client.post(
                        "https://api.gladia.io/v1/audio/text/audio-transcription",
                        headers=headers,
                        files=v1_files,
                        data=v1_data
                    )
                latency = round(time.time() - start_time, 3)
                if v1_resp.status_code == 200:
                    txt = v1_resp.json().get("prediction", "")
                    return txt.strip(), latency, "OK (v1)"
                return "", latency, f"Upload error: HTTP {upload_resp.status_code}"

            audio_url = upload_resp.json().get("audio_url")
            
            # Step 2: Post transcription request
            tx_payload = {
                "audio_url": audio_url,
                "language_config": {
                    "languages": ["am", "en"],
                    "code_switching": True
                }
            }
            tx_resp = await client.post(
                "https://api.gladia.io/v2/transcription",
                headers={**headers, "Content-Type": "application/json"},
                json=tx_payload
            )
            
            if tx_resp.status_code not in [200, 201]:
                latency = round(time.time() - start_time, 3)
                return "", latency, f"Tx error: HTTP {tx_resp.status_code}: {tx_resp.text[:100]}"
            
            tx_data = tx_resp.json()
            result_url = tx_data.get("result_url")
            
            # Step 3: Poll for completion
            for _ in range(20):
                await asyncio.sleep(1.0)
                poll_resp = await client.get(result_url, headers=headers)
                if poll_resp.status_code == 200:
                    res_body = poll_resp.json()
                    status = res_body.get("status")
                    if status == "done":
                        latency = round(time.time() - start_time, 3)
                        transcript = res_body.get("result", {}).get("transcription", {}).get("full_transcript", "")
                        return transcript.strip(), latency, "OK (v2)"
                    elif status == "error":
                        latency = round(time.time() - start_time, 3)
                        return "", latency, f"Gladia processing error: {res_body.get('error')}"
            
            return "", round(time.time() - start_time, 3), "Timeout polling Gladia"
    except Exception as e:
        return "", round(time.time() - start_time, 3), str(e)

# --- Main Benchmark Runner ---

async def main():
    test_dir = os.path.join(os.path.dirname(__file__), "test_audio")
    if not os.path.exists(test_dir):
        print(f"❌ Directory {test_dir} not found!")
        return

    # Find all wav files with matching ground truth txt files
    wav_files = [f for f in os.listdir(test_dir) if f.endswith(".wav")]
    test_cases = []

    for wav in sorted(wav_files):
        base_name = os.path.splitext(wav)[0]
        txt_path = os.path.join(test_dir, f"{base_name}.txt")
        wav_path = os.path.join(test_dir, wav)
        if os.path.exists(txt_path):
            with open(txt_path, "r", encoding="utf-8") as f:
                ground_truth = f.read().strip()
            test_cases.append({
                "name": base_name,
                "audio_path": wav_path,
                "ground_truth": ground_truth
            })

    if not test_cases:
        print("❌ No matching .wav and .txt pairs found in test_audio/")
        return

    print("=" * 80)
    print("📊 AMHARIC STT PROVIDER BENCHMARK SUITE (2026)")
    print(f"📁 Found {len(test_cases)} audio test samples in test_audio/")
    print("=" * 80)

    providers = [
        ("Groq (Whisper-v3-Turbo)", transcribe_groq),
        ("OpenAI (Whisper-1)", transcribe_openai),
        ("ElevenLabs (Scribe v2)", transcribe_elevenlabs),
        ("Gladia (Solaria-1)", transcribe_gladia),
    ]

    all_results = []
    summary_stats = {p[0]: {"total_wer": 0.0, "total_cer": 0.0, "total_latency": 0.0, "count": 0} for p in providers}

    for idx, case in enumerate(test_cases, 1):
        print(f"\n--- [Sample {idx}/{len(test_cases)}]: {case['name']} ---")
        print(f"🎯 Ground Truth: \"{case['ground_truth']}\"")
        
        sample_results = {
            "sample_name": case["name"],
            "ground_truth": case["ground_truth"],
            "providers": {}
        }

        for provider_name, func in providers:
            text, latency, status = await func(case["audio_path"])
            wer = calculate_wer(case["ground_truth"], text) if text else 100.0
            cer = calculate_cer(case["ground_truth"], text) if text else 100.0

            sample_results["providers"][provider_name] = {
                "transcription": text,
                "latency_sec": latency,
                "status": status,
                "wer": wer,
                "cer": cer
            }

            if status.startswith("OK"):
                summary_stats[provider_name]["total_wer"] += wer
                summary_stats[provider_name]["total_cer"] += cer
                summary_stats[provider_name]["total_latency"] += latency
                summary_stats[provider_name]["count"] += 1

            print(f"  🔹 {provider_name:24} | WER: {wer:6.2f}% | CER: {cer:6.2f}% | Time: {latency:5.2f}s | Result: \"{text}\" ({status})")

        all_results.append(sample_results)

    # --- Summary Table ---
    print("\n" + "=" * 80)
    print("🏆 FINAL BENCHMARK SUMMARY")
    print("=" * 80)
    print(f"{'Provider':<26} | {'Avg WER':<9} | {'Avg CER':<9} | {'Avg Latency':<12} | {'Success Rate'}")
    print("-" * 80)

    leaderboard = []
    for provider_name, stats in summary_stats.items():
        count = stats["count"]
        if count > 0:
            avg_wer = stats["total_wer"] / count
            avg_cer = stats["total_cer"] / count
            avg_latency = stats["total_latency"] / count
            success_rate = f"{count}/{len(test_cases)}"
        else:
            avg_wer = 100.0
            avg_cer = 100.0
            avg_latency = 0.0
            success_rate = "0/5 (Failed)"

        leaderboard.append({
            "provider": provider_name,
            "avg_wer": round(avg_wer, 2),
            "avg_cer": round(avg_cer, 2),
            "avg_latency": round(avg_latency, 2),
            "success_rate": success_rate
        })
        print(f"{provider_name:<26} | {avg_wer:7.2f}% | {avg_cer:7.2f}% | {avg_latency:9.2f}s | {success_rate}")

    # Declare winner
    valid_leaderboard = [l for l in leaderboard if l["success_rate"] != "0/5 (Failed)"]
    if valid_leaderboard:
        valid_leaderboard.sort(key=lambda x: x["avg_wer"])
        winner = valid_leaderboard[0]
        print("=" * 80)
        print(f"🎉 WINNER: {winner['provider']} with Average WER of {winner['avg_wer']}% and CER of {winner['avg_cer']}%!")
        print("=" * 80)

    # Save detailed JSON report
    report_path = os.path.join(test_dir, "benchmark_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump({"summary": leaderboard, "samples": all_results}, f, ensure_ascii=False, indent=2)

    print(f"\n💾 Full detailed report saved to: {report_path}")

if __name__ == "__main__":
    asyncio.run(main())
