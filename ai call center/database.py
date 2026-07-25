import aiosqlite
import asyncio
import logging
import json
import sqlite3
import random
from datetime import datetime
from typing import List, Dict, Optional, Any

logger = logging.getLogger(__name__)

DB_PATH = "system.db"

async def retry_db_op(func, *args, **kwargs):
    """Retry DB operation on locking error"""
    retries = 15 # Increased for high concurrency
    for i in range(retries):
        try:
            return await func(*args, **kwargs)
        except sqlite3.OperationalError as e:
            if "locked" in str(e):
                wait = (i + 1) * 0.1 + random.uniform(0, 0.1)
                await asyncio.sleep(wait)
                continue
            raise
        except Exception:
            raise
    raise Exception("DB Operation failed after retries")

class ConversationDB:
    """
    Async Database Manager for National Scale AI Call Center.
    Handles persistence of sessions, messages, and analytics.
    """
    
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path

    async def init_schema(self):
        """Initialize database schema asynchronously"""
        async def _op():
            async with aiosqlite.connect(self.db_path) as db:
                # Enable WAL mode for concurrency
                await db.execute("PRAGMA journal_mode=WAL;")
                # Set busy timeout
                await db.execute("PRAGMA busy_timeout=5000;")
                
                # 1. Conversation Sessions
                await db.execute('''
                CREATE TABLE IF NOT EXISTS conversation_sessions (
                    call_id TEXT PRIMARY KEY,
                    caller_number TEXT,
                    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    end_time TIMESTAMP,
                    detected_language TEXT DEFAULT 'amharic',
                    turn_count INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'active'
                )
                ''')

                # 2. Message History
                await db.execute('''
                CREATE TABLE IF NOT EXISTS conversation_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    call_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    language TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (call_id) REFERENCES conversation_sessions(call_id)
                )
                ''')

                # 3. Call Analytics
                await db.execute('''
                CREATE TABLE IF NOT EXISTS call_analytics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    call_id TEXT NOT NULL,
                    metric_name TEXT NOT NULL,
                    metric_value REAL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (call_id) REFERENCES conversation_sessions(call_id)
                )
                ''')
                
                await db.commit()
                logger.info("✅ Async Database Schema Initialized")

        try:
             await retry_db_op(_op)
        except Exception as e:
            logger.error(f"❌ Failed to init DB schema: {e}")

    async def create_session(self, call_id: str, caller_number: str = "unknown"):
        """Create a new conversation session"""
        async def _op():
             async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    '''INSERT OR IGNORE INTO conversation_sessions 
                       (call_id, caller_number, start_time, status) 
                       VALUES (?, ?, ?, 'active')''',
                    (call_id, caller_number, datetime.now())
                )
                await db.commit()
        
        try:
             await retry_db_op(_op)
        except Exception as e:
            logger.error(f"Failed to create session {call_id}: {e}")

    async def save_message(self, call_id: str, role: str, content: str, language: str = "amharic"):
        """Save a single message to history"""
        async def _op():
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    '''INSERT INTO conversation_messages 
                       (call_id, role, content, language) 
                       VALUES (?, ?, ?, ?)''',
                    (call_id, role, content, language)
                )
                
                # Update turn count
                await db.execute(
                    '''UPDATE conversation_sessions 
                       SET turn_count = turn_count + 1 
                       WHERE call_id = ?''',
                    (call_id,)
                )
                await db.commit()
                
        try:
            await retry_db_op(_op)
        except Exception as e:
            logger.error(f"Failed to save message for {call_id}: {e}")

    async def load_conversation(self, call_id: str) -> List[Dict[str, str]]:
        """Load full conversation history"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row
                async with db.execute(
                    '''SELECT role, content 
                       FROM conversation_messages 
                       WHERE call_id = ? 
                       ORDER BY id ASC''',
                    (call_id,)
                ) as cursor:
                    rows = await cursor.fetchall()
                    return [{"role": row["role"], "content": row["content"]} for row in rows]
        except Exception as e:
            logger.error(f"Failed to load conversation {call_id}: {e}")
            return []

    async def get_session_info(self, call_id: str) -> Optional[Dict[str, Any]]:
        """Get session metadata"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row
                async with db.execute(
                    "SELECT * FROM conversation_sessions WHERE call_id = ?", (call_id,)
                ) as cursor:
                    row = await cursor.fetchone()
                    return dict(row) if row else None
        except Exception as e:
            logger.error(f"Failed to get session info {call_id}: {e}")
            return None

    async def update_session_language(self, call_id: str, language: str):
        """Update the detected language for the session"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    "UPDATE conversation_sessions SET detected_language = ? WHERE call_id = ?",
                    (language, call_id)
                )
                await db.commit()
        except Exception as e:
            logger.error(f"Failed to update session language {call_id}: {e}")

    async def end_session(self, call_id: str):
        """Mark session as completed"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    '''UPDATE conversation_sessions 
                       SET end_time = ?, status = 'completed' 
                       WHERE call_id = ?''',
                    (datetime.now(), call_id)
                )
                await db.commit()
        except Exception as e:
            logger.error(f"Failed to end session {call_id}: {e}")

    async def save_metric(self, call_id: str, metric_name: str, value: float):
        """Save a performance metric"""
        async def _op():
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    '''INSERT INTO call_analytics 
                       (call_id, metric_name, metric_value) 
                       VALUES (?, ?, ?)''',
                    (call_id, metric_name, value)
                )
                await db.commit()
        
        try:
            await retry_db_op(_op)
        except Exception as e:
            logger.error(f"Failed to save metric for {call_id}: {e}")

# Global Instance
db = ConversationDB()
