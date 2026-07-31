import asyncpg
import asyncio
import logging
import json
import os
import random
from datetime import datetime
from typing import List, Dict, Optional, Any

logger = logging.getLogger(__name__)

class ConversationDB:
    """
    Async Database Manager for National Scale AI Call Center using PostgreSQL.
    """
    
    def __init__(self):
        self.db_url = os.environ.get("DATABASE_URL")
        self.pool: Optional[asyncpg.Pool] = None

    async def get_pool(self) -> asyncpg.Pool:
        if not self.pool:
            if not self.db_url:
                raise ValueError("DATABASE_URL environment variable is not set. Make sure it is in your .env or Render dashboard.")
            self.pool = await asyncpg.create_pool(self.db_url, min_size=1, max_size=10)
        return self.pool

    async def init_schema(self):
        """Initialize database schema asynchronously"""
        try:
            pool = await self.get_pool()
            async with pool.acquire() as conn:
                # 1. Conversation Sessions
                await conn.execute('''
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
                await conn.execute('''
                CREATE TABLE IF NOT EXISTS conversation_messages (
                    id SERIAL PRIMARY KEY,
                    call_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    language TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (call_id) REFERENCES conversation_sessions(call_id)
                )
                ''')

                # 3. Call Analytics
                await conn.execute('''
                CREATE TABLE IF NOT EXISTS call_analytics (
                    id SERIAL PRIMARY KEY,
                    call_id TEXT NOT NULL,
                    metric_name TEXT NOT NULL,
                    metric_value REAL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (call_id) REFERENCES conversation_sessions(call_id)
                )
                ''')
                
                logger.info("✅ Async Database Schema Initialized (PostgreSQL)")
        except Exception as e:
            logger.error(f"❌ Failed to init DB schema: {e}")

    async def create_session(self, call_id: str, caller_number: str = "unknown"):
        """Create a new conversation session"""
        try:
            pool = await self.get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    '''INSERT INTO conversation_sessions 
                       (call_id, caller_number, start_time, status) 
                       VALUES ($1, $2, CURRENT_TIMESTAMP, 'active')
                       ON CONFLICT (call_id) DO NOTHING''',
                    call_id, caller_number
                )
        except Exception as e:
            logger.error(f"Failed to create session {call_id}: {e}")

    async def save_message(self, call_id: str, role: str, content: str, language: str = "amharic"):
        """Save a single message to history"""
        try:
            pool = await self.get_pool()
            async with pool.acquire() as conn:
                async with conn.transaction():
                    await conn.execute(
                        '''INSERT INTO conversation_messages 
                           (call_id, role, content, language) 
                           VALUES ($1, $2, $3, $4)''',
                        call_id, role, content, language
                    )
                    
                    # Update turn count
                    await conn.execute(
                        '''UPDATE conversation_sessions 
                           SET turn_count = turn_count + 1 
                           WHERE call_id = $1''',
                        call_id
                    )
        except Exception as e:
            logger.error(f"Failed to save message for {call_id}: {e}")

    async def load_conversation(self, call_id: str) -> List[Dict[str, str]]:
        """Load full conversation history"""
        try:
            pool = await self.get_pool()
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    '''SELECT role, content 
                       FROM conversation_messages 
                       WHERE call_id = $1 
                       ORDER BY id ASC''',
                    call_id
                )
                return [{"role": dict(row)["role"], "content": dict(row)["content"]} for row in rows]
        except Exception as e:
            logger.error(f"Failed to load conversation {call_id}: {e}")
            return []

    async def get_session_info(self, call_id: str) -> Optional[Dict[str, Any]]:
        """Get session metadata"""
        try:
            pool = await self.get_pool()
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT * FROM conversation_sessions WHERE call_id = $1", call_id
                )
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"Failed to get session info {call_id}: {e}")
            return None

    async def update_session_language(self, call_id: str, language: str):
        """Update the detected language for the session"""
        try:
            pool = await self.get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    "UPDATE conversation_sessions SET detected_language = $1 WHERE call_id = $2",
                    language, call_id
                )
        except Exception as e:
            logger.error(f"Failed to update session language {call_id}: {e}")

    async def end_session(self, call_id: str):
        """Mark session as completed"""
        try:
            pool = await self.get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    '''UPDATE conversation_sessions 
                       SET end_time = CURRENT_TIMESTAMP, status = 'completed' 
                       WHERE call_id = $1''',
                    call_id
                )
        except Exception as e:
            logger.error(f"Failed to end session {call_id}: {e}")

    async def save_metric(self, call_id: str, metric_name: str, value: float):
        """Save a performance metric"""
        try:
            pool = await self.get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    '''INSERT INTO call_analytics 
                       (call_id, metric_name, metric_value) 
                       VALUES ($1, $2, $3)''',
                    call_id, metric_name, value
                )
        except Exception as e:
            logger.error(f"Failed to save metric for {call_id}: {e}")

# Global Instance
db = ConversationDB()
