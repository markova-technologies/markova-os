import requests
import sqlite3
import time
import uuid

BASE_URL = "http://localhost:8001"
DB_PATH = "system.db"

def verify_isolation():
    print("🧪 Starting Phase 1 Verification: Session Isolation Test")
    
    # 1. Define two distinct callers
    caller_a_id = f"isolation-test-A-{uuid.uuid4().hex[:6]}"
    caller_b_id = f"isolation-test-B-{uuid.uuid4().hex[:6]}"
    
    print(f"👥 Callers defined:\n   - Caller A: {caller_a_id}\n   - Caller B: {caller_b_id}")

    # 2. Caller A speaks
    print("\n🗣️  Caller A says: 'Hello, I wait for B'")
    requests.post(f"{BASE_URL}/handle-input", data={
        "CallSid": caller_a_id,
        "SpeechResult": "Hello, I wait for B"
    })
    
    # 3. Caller B speaks
    print("🗣️  Caller B says: 'Hello, I am distinct from A'")
    requests.post(f"{BASE_URL}/handle-input", data={
        "CallSid": caller_b_id,
        "SpeechResult": "Hello, I am distinct from A"
    })

    # Wait for async DB writes
    print("⏳ Waiting to ensure data persistence...")
    time.sleep(2)

    # 4. Verify in Database
    print("\n🔍 Verifying Data Isolation in DB...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check Caller A history
    cursor.execute("SELECT content FROM conversation_messages WHERE call_id = ? AND role = 'user'", (caller_a_id,))
    msgs_a = [row[0] for row in cursor.fetchall()]
    
    # Check Caller B history
    cursor.execute("SELECT content FROM conversation_messages WHERE call_id = ? AND role = 'user'", (caller_b_id,))
    msgs_b = [row[0] for row in cursor.fetchall()]
    
    conn.close()

    # 5. Assertions
    print(f"   [A History]: {msgs_a}")
    print(f"   [B History]: {msgs_b}")

    isolation_success = True
    
    # Verify A only has A's messages
    if any("distinct from A" in msg for msg in msgs_a):
        print("❌ FAILURE: Caller A saw Caller B's messages!")
        isolation_success = False
        
    # Verify B only has B's messages
    if any("wait for B" in msg for msg in msgs_b):
        print("❌ FAILURE: Caller B saw Caller A's messages!")
        isolation_success = False
        
    if isolation_success and len(msgs_a) > 0 and len(msgs_b) > 0:
        print("\n✅ SUCCESS: Sessions are completely isolated!")
    else:
        print("\n❌ FAILURE: Session isolation verification failed.")

if __name__ == "__main__":
    verify_isolation()
