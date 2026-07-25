import requests
import sqlite3
import time
import uuid

BASE_URL = "http://localhost:8001"
DB_PATH = "system.db"

def verify_persistence():
    # 1. Simulate a Call
    call_id = f"test-call-{uuid.uuid4()}"
    print(f"📞 Simulating call: {call_id}")
    
    payload = {
        "CallSid": call_id,
        "SpeechResult": "Hello Almaz backend test"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/handle-input", data=payload)
        if response.status_code == 200:
            print("✅ API Request successful")
        else:
            print(f"❌ API Request failed: {response.text}")
            return
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return

    # Wait for async DB write
    print("⏳ Waiting for async DB write...")
    time.sleep(2)

    # 2. Check Database
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check Session
        cursor.execute("SELECT * FROM conversation_sessions WHERE call_id=?", (call_id,))
        session = cursor.fetchone()
        
        if session:
            print(f"✅ Session found in DB: {session}")
        else:
            print("❌ Session NOT found in DB")
            
        # Check Messages
        cursor.execute("SELECT role, content FROM conversation_messages WHERE call_id=?", (call_id,))
        messages = cursor.fetchall()
        
        if len(messages) >= 2:
            print(f"✅ Messages persisted: {len(messages)}")
            for role, content in messages:
                print(f"   - {role}: {content[:50]}...")
        else:
            print(f"❌ Insufficient messages found: {len(messages)}")
            
        conn.close()
        
    except Exception as e:
        print(f"❌ Database check failed: {e}")

if __name__ == "__main__":
    verify_persistence()
