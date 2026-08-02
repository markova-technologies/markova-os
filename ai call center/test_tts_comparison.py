import os
import sys
import time
import json
import base64
import asyncio
import httpx
from pathlib import Path
from dotenv import load_dotenv

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Load .env
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

ADDIS_AI_TTS_KEY = os.getenv("ADDIS_AI_TTS_KEY")
HASAB_API_KEY = os.getenv("HASAB_API_KEY")

OUTPUT_DIR = Path(__file__).parent / "tts_benchmark_audio"
OUTPUT_DIR.mkdir(exist_ok=True)

TEST_SENTENCES = [
    {
        "id": "greeting",
        "text": "ሰላም የጂኤም ፈርኒቸር ደንበኛ ድጋፍ ነኝ። ምን ልረዳዎ እችላለሁ?"
    },
    {
        "id": "price_quote",
        "text": "የኤል ቅርፅ ሶፋው ዋጋ አርባ ሰባት ሺህ ብር ነው። አምስት ፐርሰንት ቅናሽ አለው።"
    },
    {
        "id": "delivery_info",
        "text": "አዲስ አበባ ውስጥ ሆነው ካዘዙ እናደርስልዎታለን። ትእዛዝ መመዝገብ ይፈልጋሉ?"
    }
]

async def tts_edge(text: str, sample_id: str) -> tuple[bool, float, str, int]:
    """Microsoft Edge Neural TTS (am-ET-MekdesNeural)"""
    try:
        import edge_tts
    except ImportError:
        return False, 0.0, "edge-tts package not installed. Run: pip install edge-tts", 0

    start_time = time.time()
    voice = "am-ET-MekdesNeural"
    out_file = OUTPUT_DIR / f"edge_tts_{sample_id}.mp3"
    try:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(str(out_file))
        latency = round(time.time() - start_time, 3)
        size = out_file.stat().st_size if out_file.exists() else 0
        return True, latency, f"Saved ({size} bytes)", size
    except Exception as e:
        latency = round(time.time() - start_time, 3)
        return False, latency, str(e), 0


async def tts_addis_ai(text: str, sample_id: str) -> tuple[bool, float, str, int]:
    """Addis AI TTS API"""
    if not ADDIS_AI_TTS_KEY or ADDIS_AI_TTS_KEY.startswith("your_"):
        return False, 0.0, "Missing ADDIS_AI_TTS_KEY in .env", 0

    start_time = time.time()
    out_file = OUTPUT_DIR / f"addis_ai_{sample_id}.mp3"
    try:
        url = os.getenv("ADDIS_AI_TTS_URL", "https://api.addisassistant.com/api/v1/audio")
        headers = {"X-API-Key": ADDIS_AI_TTS_KEY, "Content-Type": "application/json"}
        payload = {"text": text, "language": "am"}
        
        async with httpx.AsyncClient(timeout=45) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                return False, round(time.time() - start_time, 3), f"HTTP {resp.status_code}: {resp.text[:150]}", 0
            
            data = resp.json()
            if "audio" in data:
                audio_str = data["audio"]
                if audio_str.startswith("data:"):
                    audio_str = audio_str.split(",")[1]
                audio_bytes = base64.b64decode(audio_str)
                out_file.write_bytes(audio_bytes)
                latency = round(time.time() - start_time, 3)
                return True, latency, f"Saved ({len(audio_bytes)} bytes)", len(audio_bytes)
            else:
                return False, round(time.time() - start_time, 3), f"Unexpected response shape: {list(data.keys())}", 0
    except Exception as e:
        return False, round(time.time() - start_time, 3), str(e), 0


async def tts_hasab_ai(text: str, sample_id: str) -> tuple[bool, float, str, int]:
    """Hasab AI TTS API"""
    if not HASAB_API_KEY or HASAB_API_KEY.startswith("your_"):
        return False, 0.0, "Missing HASAB_API_KEY in .env", 0

    start_time = time.time()
    out_file = OUTPUT_DIR / f"hasab_ai_{sample_id}.mp3"
    try:
        headers = {"Authorization": f"Bearer {HASAB_API_KEY}", "Content-Type": "application/json"}
        endpoints = [
            "https://api.hasab.ai/api/v1/tts/synthesize",
            "https://api.hasab.ai/v1/tts/synthesize",
            "https://api.hasab.ai/api/v1/text-to-speech"
        ]
        payload = {"text": text, "language": "am"}
        
        async with httpx.AsyncClient(timeout=45) as client:
            resp = None
            last_err = ""
            for ep in endpoints:
                try:
                    resp = await client.post(ep, headers=headers, json=payload)
                    if resp.status_code in [200, 201]:
                        break
                    else:
                        last_err = f"HTTP {resp.status_code} on {ep}: {resp.text[:100]}"
                except Exception as ex_ep:
                    last_err = str(ex_ep)
            
            if not resp or resp.status_code not in [200, 201]:
                return False, round(time.time() - start_time, 3), last_err or "All endpoint variations failed", 0
            
            content_type = resp.headers.get("content-type", "").lower()
            if "audio" in content_type or "mpeg" in content_type or "wav" in content_type or "octet-stream" in content_type:
                audio_bytes = resp.content
            else:
                try:
                    data = resp.json()
                    audio_str = data.get("audio") or data.get("url") or data.get("data")
                    if isinstance(audio_str, str):
                        if audio_str.startswith("data:"):
                            audio_str = audio_str.split(",")[1]
                        if audio_str.startswith("http://") or audio_str.startswith("https://"):
                            dl_resp = await client.get(audio_str)
                            audio_bytes = dl_resp.content
                        else:
                            audio_bytes = base64.b64decode(audio_str)
                    else:
                        audio_bytes = resp.content
                except Exception:
                    audio_bytes = resp.content
            
            if len(audio_bytes) < 100:
                return False, round(time.time() - start_time, 3), f"Received invalid audio (<100 bytes): {audio_bytes[:50]}", 0
                
            out_file.write_bytes(audio_bytes)
            latency = round(time.time() - start_time, 3)
            return True, latency, f"Saved ({len(audio_bytes)} bytes)", len(audio_bytes)
    except Exception as e:
        return False, round(time.time() - start_time, 3), str(e), 0


async def main():
    print("=" * 80)
    print("📢 AMHARIC TTS PROVIDER BENCHMARK SUITE (2026)")
    print(f"📁 Output Directory: {OUTPUT_DIR.resolve()}")
    print("=" * 80)

    providers = [
        ("Edge TTS (MekdesNeural)", tts_edge),
        ("Addis AI TTS", tts_addis_ai),
        ("Hasab AI TTS", tts_hasab_ai),
    ]

    report = {"summary": [], "details": []}
    stats = {p[0]: {"total_time": 0.0, "success_count": 0, "total_bytes": 0} for p in providers}

    for idx, item in enumerate(TEST_SENTENCES, 1):
        sample_id = item["id"]
        text = item["text"]
        print(f"\n--- [Test {idx}/{len(TEST_SENTENCES)}]: '{sample_id}' ---")
        print(f"📝 Text: \"{text}\"")
        
        detail_entry = {"sample_id": sample_id, "text": text, "results": {}}

        for name, func in providers:
            print(f"  ⏳ Generating with {name}...", end="", flush=True)
            success, latency, msg, size = await func(text, sample_id)
            status_icon = "✅" if success else "❌"
            print(f"\r  {status_icon} {name:24} | Latency: {latency:6.3f}s | Status: {msg}")
            
            detail_entry["results"][name] = {
                "success": success,
                "latency_sec": latency,
                "status": msg,
                "file_size_bytes": size
            }
            if success:
                stats[name]["total_time"] += latency
                stats[name]["success_count"] += 1
                stats[name]["total_bytes"] += size

        report["details"].append(detail_entry)

    print("\n" + "=" * 80)
    print("🏆 FINAL TTS BENCHMARK SUMMARY")
    print("=" * 80)
    print(f"{'Provider':26} | {'Avg Latency':12} | {'Success Rate':12} | {'Avg Size':10}")
    print("-" * 80)
    
    for name in stats:
        count = stats[name]["success_count"]
        total = len(TEST_SENTENCES)
        avg_lat = round(stats[name]["total_time"] / count, 3) if count > 0 else 0.0
        avg_size = int(stats[name]["total_bytes"] / count) if count > 0 else 0
        rate_str = f"{count}/{total}"
        print(f"{name:26} | {avg_lat:10.3f}s | {rate_str:12} | {avg_size:8} B")
        
        report["summary"].append({
            "provider": name,
            "avg_latency_sec": avg_lat,
            "success_rate": rate_str,
            "avg_file_size_bytes": avg_size
        })

    print("=" * 80)
    report_file = OUTPUT_DIR / "tts_benchmark_report.json"
    report_file.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"💾 Full report and audio files saved to: {OUTPUT_DIR.resolve()}")
    print("\n🎧 NEXT STEP: Open the folder above and play the generated .mp3 files to evaluate naturalness!")

if __name__ == "__main__":
    asyncio.run(main())
