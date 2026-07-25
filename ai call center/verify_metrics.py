import sqlite3


DB_PATH = "system.db"

def verify_metrics():
    print("🔍 Analyzing Metrics in system.db...")
    try:
        conn = sqlite3.connect(DB_PATH)
        
        # Check Response Times
        print("\n📊 Response Time Metrics:")
        df_resp = pd.read_sql_query("SELECT * FROM call_analytics WHERE metric_name='response_time_ms'", conn)
        if not df_resp.empty:
            print(df_resp.head())
            print(f"   > Average Response Time: {df_resp['metric_value'].mean():.2f} ms")
            print(f"   > Count: {len(df_resp)}")
        else:
            print("   ❌ No response time metrics found.")
            
        # Check Cache Hits
        print("\n📊 TTS Cache Metrics:")
        df_cache = pd.read_sql_query("SELECT * FROM call_analytics WHERE metric_name='tts_cache_hit'", conn)
        if not df_cache.empty:
            print(f"   > Cache Hits: {df_cache[df_cache['metric_value'] == 1.0].shape[0]}")
            print(f"   > Cache Misses: {df_cache[df_cache['metric_value'] == 0.0].shape[0]}")
        else:
            print("   ❌ No TTS cache metrics found (might be first run or using non-google).")
            
        conn.close()
        
    except Exception as e:
        print(f"❌ Error querying metrics: {e}")

if __name__ == "__main__":
    # Check if pandas is installed, if not fallback to raw sqlite
    try:
        import pandas
        verify_metrics()
    except ImportError:
        print("Pandas not found, using raw sqlite...")
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT metric_name, AVG(metric_value), COUNT(*) FROM call_analytics GROUP BY metric_name")
        for row in cursor.fetchall():
            print(f"Metric: {row[0]}, Avg: {row[1]}, Count: {row[2]}")
        conn.close()
