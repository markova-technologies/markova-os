import asyncio
import json
import os
import redis.asyncio as aioredis
from actions import perform_action
from fastapi import FastAPI
import uvicorn

app = FastAPI()

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
RPA_QUEUE = "rpa_task_queue"
RPA_RESULT_QUEUE = "rpa_result_queue"

@app.get("/health")
def health():
    return {"status": "OK", "service": "rpa-agent"}

async def worker_loop():
    print("🚀 RPA Agent Worker starting...")
    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    
    while True:
        try:
            # Block until a job is available
            result = await redis_client.blpop(RPA_QUEUE, timeout=5)
            if not result:
                continue
                
            _, job_raw = result
            job = json.loads(job_raw)
            print(f"⚙️ Processing RPA job {job.get('job_id')}...")
            
            action_type = job.get("action_type")
            data = job.get("data", {})
            
            try:
                action_result = await perform_action(action_type, data)
                response = {
                    "job_id": job.get("job_id"),
                    "status": "success",
                    "result": action_result
                }
            except Exception as e:
                response = {
                    "job_id": job.get("job_id"),
                    "status": "error",
                    "error": str(e)
                }
                
            # Push result back
            await redis_client.rpush(RPA_RESULT_QUEUE, json.dumps(response))
            print(f"✅ Job {job.get('job_id')} completed. Status: {response['status']}")
            
        except Exception as e:
            print(f"⚠️ RPA Worker Error: {e}")
            await asyncio.sleep(2)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(worker_loop())

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=7000)
