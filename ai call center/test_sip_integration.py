
import os
import sqlite3
import pytest
from fastapi.testclient import TestClient
from main_natural_voice import app, DB_PATH, init_database

client = TestClient(app)

def test_sip_incoming_call():
    # Clean up old DB
    if os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
            print("🗑️ Removed existing system.db")
        except:
            pass

    # Initialize DB for test
    print("🔄 Calling init_database()...")
    init_database()
    print("✅ init_database() returned")
    
    if not os.path.exists(DB_PATH):
        print("❌ system.db was NOT created!")
    else:
        print(f"✅ system.db exists at {os.path.abspath(DB_PATH)}")
    
    # Simulate FreeSWITCH mod_curl params
    data = {
        "uuid": "test-uuid-12345",
        "caller_id": "+251911234567",
        "destination": "1234",
        "From": None, # Twilio uses From, FS uses caller_id but we just send what FS sends
    }
    
    # FreeSWITCH sends caller_id, not "From" by default in some simple configs,
    # but our dialplan sends: caller_id=${caller_id_number}
    
    response = client.post("/incoming-call", data=data)
    
    # 1. Verify Status
    assert response.status_code == 200, f"Status code failed: {response.status_code}, Body: {response.text}"
    
    # 2. Verify Content Type
    assert "application/xml" in response.headers["content-type"], f"Bad Content-Type: {response.headers.get('content-type')}"
    
    # 3. Verify TwiML Body
    xml = response.text
    assert "<Response>" in xml, "Missing <Response> tag"
    assert "ሰላም" in xml or "Polly.Zeina" in xml, "Missing expected text in TwiML" # Check for Amharic greeting
    
    # 4. Verify DB creation
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM call_logs")
    rows = cursor.fetchall()
    print(f"DEBUG: All call_logs: {rows}")
    
    cursor.execute("SELECT * FROM call_logs WHERE call_id=?", ("test-uuid-12345",))
    row = cursor.fetchone()
    conn.close()
    
    assert row is not None
    print(f"\n✅ SIP Integration Test Passed! Found log: {row}")
    assert row[1] == "test-uuid-12345" # call_id
    assert row[3] == "+251911234567" # caller_number

if __name__ == "__main__":
    try:
        test_sip_incoming_call()
        print("🎉 ALL TESTS PASSED")
    except AssertionError as e:
        print(f"❌ Test Failed: {e}")
    except Exception as e:
        print(f"❌ Error: {e}")
