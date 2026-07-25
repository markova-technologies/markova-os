import asyncio
import httpx
import time
import uuid

BASE_URL = "http://localhost:8001"

async def simulate_call(i):
    call_id = f"perf-test-{i}-{uuid.uuid4().hex[:4]}"
    print(f"🚀 Call {i} started ({call_id})")
    
    async with httpx.AsyncClient() as client:
        start = time.time()
        try:
            response = await client.post(
                f"{BASE_URL}/handle-input",
                data={
                    "CallSid": call_id,
                    "SpeechResult": "Hello testing async speed"
                },
                timeout=30.0
            )
            duration = time.time() - start
            if response.status_code == 200:
                print(f"✅ Call {i} finished in {duration:.2f}s")
                return True
            else:
                print(f"❌ Call {i} failed: {response.status_code} | {response.text}")
                return False
        except Exception as e:
            print(f"❌ Call {i} error: {e}")
            return False

async def main():
    print("⚡ Starting Phase 3 Async Verification (5 Concurrent Calls)...")
    start_total = time.time()
    
    # Launch 5 calls simultaneously
    tasks = [simulate_call(i) for i in range(1, 6)]
    results = await asyncio.gather(*tasks)
    
    total_duration = time.time() - start_total
    
    success_count = results.count(True)
    print(f"\n📊 SUMMARY:")
    print(f"   - Total Time: {total_duration:.2f}s")
    print(f"   - Successful Calls: {success_count}/5")
    
    if success_count == 5:
        print("✅ SUCCESS: Async engine handled concurrent load!")
    else:
        print("❌ FAILURE: Some calls failed.")

if __name__ == "__main__":
    asyncio.run(main())
