#!/usr/bin/env python3
"""
IMMEDIATE SOLUTION: Natural Amharic Voice Without Azure
This creates professional Amharic TTS using multiple fallback options that work instantly.
"""

import os
import logging
import hashlib
import sqlite3
import json
import asyncio
import traceback
import smtplib
import aiohttp
import aiosqlite
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Union, Any, Tuple
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import FastAPI, Request, Form, HTTPException, BackgroundTasks, Depends, Security, File, UploadFile
from fastapi.responses import Response, JSONResponse
from fastapi.security.api_key import APIKeyHeader, APIKey
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
from groq import Groq
from openai import OpenAI, AsyncOpenAI  # OpenAI for GPT-4o + Whisper-1 (primary)
import httpx
from urllib.parse import quote
from database import db as conversation_db
from monitoring import metrics, alerts
from dashboard_reporter import DashboardReporter
import time
import wave
from fastapi.responses import FileResponse
from barge_in_manager import barge_in_manager, start_barge_in_listener

# Initialize Database
DB_PATH = os.getenv("DB_PATH", "system.db")

# === RAG Knowledge Base ===
KB_PATH = Path(__file__).parent / "knowledge_base.json"

def load_knowledge_base():
    """Load GM Furniture knowledge base for RAG retrieval"""
    try:
        with open(KB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"WARNING: Could not load knowledge base: {e}")
        return {}

KNOWLEDGE_BASE = load_knowledge_base()

# Keyword maps for matching user queries to product categories and topics
# Massively expanded to include common Whisper phonetic garbage/misspellings
KB_KEYWORD_MAP = {
    # Product categories (Amharic + English + Phonetic Garbage)
    "sofa": ["sofa", "ሶፋ", "couch", "ስፋ", "ሰፋ", "ሱፋ", "ሳፋ", "sf"],
    "bed": ["bed", "አልጋ", "alga", "ኪንግ", "ኩዊን", "king", "queen", "single", "ነጠላ", "አለጋ", "አልገ", "አлга"],
    "chair": ["chair", "ወንበር", "wenber", "swivel", "ስዊቬል", "visitor", "እንግዳ", "dining chair", "የመመገቢያ ወንበር", "ወንበ", "ወንፐር", "wember"],
    "dining": ["dining", "የመመገቢያ", "ጠረጴዛ", "table", "ዳይኒንግ", "ምግብ", "መመገቢያ", "ምሳ", "እራት"],
    "office_desk": ["desk", "office", "ቢሮ", "ጠረጴዛ", "ኮምፒውተር", "computer", "manager", "ማኔጀር", "ኦፊስ", "ዴስክ"],
    "cabinet": ["cabinet", "ካቢኔ", "wardrobe", "ዋርድሮብ", "filing", "ፋይል", "shelv", "መደርደሪያ", "ካቢኔት", "ካብኔ", "cabnet"],
    "shelf": ["shelf", "bookshelf", "መደርደሪያ", "መጽሐፍ", "ዲክሰን", "dixon", "ሼልፍ", "ሸልፍ"],
    "tv_stand": ["tv", "ቲቪ", "television", "stand", "ስታንድ", "ቴሌቪዥን"],
    "table": ["table", "ጠረጴዛ", "coffee", "center", "ሴንተር", "ቡና", "dressing", "ድሬሲንግ", "መስታወት", "ጠረቤዛ", "ጠረጵዛ"],
    "bar": ["bar", "ባር", "stool", "ስቱል", "cafeteria"],
    "storage": ["drawer", "መሳቢያ", "chest", "ቼስት", "storage", "ዕቃ"],
    
    # Topics
    "showroom": ["showroom", "ሾሩም", "ሱቅ", "shop", "store", "branch", "where", "location", "የት", "ቦሌ", "bole", "ቄራ", "kera", "ፒያሳ", "piassa", "ቶርሃይሎች", "torhailoch", "ጉርድ", "gurd", "shola", "አለምገና", "alemgena", "ቦታ", "አድራሻ", "address"],
    "delivery": ["delivery", "ዴሊቨሪ", "deliver", "ያድርሱ", "ማድረስ", "ship", "transport", "ትራንስፖርት", "መውሰድ"],
    "price": ["price", "ዋጋ", "cost", "ስንት", "birr", "ብር", "how much", "ምን ያህል", "ክፍያው", "ዋጋው", "ስንትነው"],
    "payment": ["payment", "ክፍያ", "pay", "ይከፈላል", "bank", "ባንክ", "installment", "ቅጣፍ", "cash", "ጥሬ", "ቼክ", "transfer", "ዘዋዋሪ"],
    "warranty": ["warranty", "ዋስትና", "guarantee", "ዋስ", "ጋራንቲ"],
    "custom": ["custom", "ብጁ", "made to order", "ልዩ", "order", "special", "ትዕዛዝ", "ማሰራት", "እንሰራለን"],
    "installation": ["install", "መትከያ", "ማስገጠም", "assemble", "ማገጣጠም", "technician", "ቴክኒሻን", "ገጠማ"],
    "hours": ["hours", "ሰዓት", "open", "ክፍት", "close", "working", "ሥራ", "መቼ", "ቀን"],
    "contact": ["phone", "ስልክ", "call", "ደውል", "email", "ኢሜይል", "number", "ቁጥር", "ስልካችሁ"],
}

def retrieve_knowledge(user_input: str) -> str:
    """RAG retrieval: find relevant knowledge base entries for the user's query"""
    if not KNOWLEDGE_BASE:
        return ""
    
    user_lower = user_input.lower()
    matched_categories = set()
    matched_topics = set()
    
    # Match keywords
    for category, keywords in KB_KEYWORD_MAP.items():
        for keyword in keywords:
            if keyword in user_lower:
                if category in ["showroom", "delivery", "price", "payment", "warranty", "custom", "installation", "hours", "contact"]:
                    matched_topics.add(category)
                else:
                    matched_categories.add(category)
                break
    
    # If user mentioned price but no specific product, still flag price
    if "price" in matched_topics and not matched_categories:
        # They asked about price generally — show a few popular items
        matched_categories = {"sofa", "bed", "chair", "dining"}
    
    context_parts = []
    
    # 1. Retrieve matching products (or ALL products if none matched)
    if "products" in KNOWLEDGE_BASE:
        matched_products = []
        if matched_categories:
            for product in KNOWLEDGE_BASE["products"]:
                if product.get("category") in matched_categories:
                    matched_products.append(product)
        else:
            # CRITICAL FALLBACK: If Whisper generated phonetic garbage that missed our exact keywords,
            # we inject the ENTIRE catalog (condensed) so the LLM can perform fuzzy phonetic matching!
            matched_products = KNOWLEDGE_BASE["products"]
            logger.info("📚 Full catalog injected into LLM context (keyword miss)")

        if matched_products:
            context_parts.append("=== PRODUCT INFORMATION (from database) ===")
            for p in matched_products:
                line = f"• {p['name_amharic']} ({p['name']}): {p['price']:,} ብር"
                if p.get("price_range"):
                    line += f" (range: {p['price_range']} ብር)"
                if p.get("colors"):
                    line += f" | Colors: {', '.join(p['colors'][:3])}"
                if p.get("in_stock"):
                    line += " | In Stock ✓"
                if p.get("delivery_days"):
                    line += f" | Delivery: {p['delivery_days']} days"
                context_parts.append(line)
    
    # 2. Retrieve showroom info
    if "showroom" in matched_topics and "showrooms" in KNOWLEDGE_BASE:
        context_parts.append("\n=== SHOWROOM LOCATIONS ===")
        for s in KNOWLEDGE_BASE["showrooms"]:
            context_parts.append(f"• {s['name_amharic']}: {s['location_amharic']} | Phone: {s['phone']}")
    
    # 3. Retrieve delivery info
    if "delivery" in matched_topics and "company" in KNOWLEDGE_BASE:
        delivery = KNOWLEDGE_BASE["company"].get("delivery_info", {})
        context_parts.append("\n=== DELIVERY INFORMATION ===")
        if delivery.get("addis_ababa"):
            context_parts.append(f"• Addis Ababa: {delivery['addis_ababa']}")
        if delivery.get("outside_addis"):
            context_parts.append(f"• Outside Addis: {delivery['outside_addis']}")
        if delivery.get("installation"):
            context_parts.append(f"• Installation: {delivery['installation']}")
    
    # 4. Retrieve payment info
    if "payment" in matched_topics and "company" in KNOWLEDGE_BASE:
        payments = KNOWLEDGE_BASE["company"].get("payment_methods", [])
        context_parts.append(f"\n=== PAYMENT METHODS ===\n• {', '.join(payments)}")
    
    # 5. Retrieve warranty info
    if "warranty" in matched_topics and "company" in KNOWLEDGE_BASE:
        warranty = KNOWLEDGE_BASE["company"].get("warranty", "")
        context_parts.append(f"\n=== WARRANTY ===\n• {warranty}")
    
    # 6. Retrieve custom order info
    if "custom" in matched_topics and "company" in KNOWLEDGE_BASE:
        custom = KNOWLEDGE_BASE["company"].get("custom_orders", "")
        context_parts.append(f"\n=== CUSTOM ORDERS ===\n• {custom}")
    
    # 7. Retrieve working hours
    if "hours" in matched_topics and "company" in KNOWLEDGE_BASE:
        hours = KNOWLEDGE_BASE["company"].get("working_hours", "")
        context_parts.append(f"\n=== WORKING HOURS ===\n• {hours}")
    
    # 8. Retrieve contact info
    if "contact" in matched_topics and "company" in KNOWLEDGE_BASE:
        phones = KNOWLEDGE_BASE["company"].get("phone_main", [])
        email = KNOWLEDGE_BASE["company"].get("email", "")
        context_parts.append(f"\n=== CONTACT ===\n• Phone: {', '.join(phones)}\n• Email: {email}")
    
    # 9. Check FAQ
    if "faq" in KNOWLEDGE_BASE:
        for faq in KNOWLEDGE_BASE["faq"]:
            q_lower = faq.get("question", "").lower()
            if any(word in user_lower for word in q_lower.split()[:3]):
                context_parts.append(f"\n=== FAQ MATCH ===\nQ: {faq['question_amharic']}\nA: {faq['answer_amharic']}")
                break
    
    # 10. Installation info
    if "installation" in matched_topics and "company" in KNOWLEDGE_BASE:
        inst = KNOWLEDGE_BASE["company"].get("delivery_info", {}).get("installation", "")
        if inst:
            context_parts.append(f"\n=== INSTALLATION ===\n• {inst}")
    
    if context_parts:
        return "\n".join(context_parts)
    return ""


# === STT GARBAGE DETECTION SYSTEM ===
# Detects when Whisper produces garbage and triggers polite retry

import random
import re

# === STAGE 5: SSML — Natural Amharic Speech Fillers ===
# These filler words make Almaz sound like a real Ethiopian customer service rep
AMHARIC_FILLERS = [
    "እሺ፣ ",           # Okay,
    "አዎ፣ ",           # Yes,
    "ጥሩ፣ ",           # Good,
    "በርግጥ፣ ",        # Of course,
    "እንግዲህ፣ ",       # Well then,
]

_filler_index = 0

def add_natural_filler(text: str) -> str:
    """Prepend a natural Amharic filler to make responses feel more human."""
    global _filler_index
    # Only add fillers to Amharic substantive responses (not 1-word or error replies)
    if not text or len(text) < 15:
        return text
    # Don't double-add if already starts with a filler
    if any(text.startswith(f.strip()) for f in AMHARIC_FILLERS):
        return text
    # Only for Amharic text (contains Ge'ez script)
    has_amharic = any(0x1200 <= ord(c) <= 0x139F for c in text)
    if not has_amharic:
        return text
    filler = AMHARIC_FILLERS[_filler_index % len(AMHARIC_FILLERS)]
    _filler_index += 1
    return filler + text

def wrap_with_natural_pauses(text: str) -> str:
    """Add breathing pauses using punctuation that OpenAI TTS understands."""
    # Amharic full stop (።) → ellipsis pause
    text = text.replace('።', '... ')
    # Amharic semicolon (፤) → comma pause  
    text = text.replace('፤', ', ')
    # Amharic comma (፣) → keep but add space
    text = text.replace('፣', '፣ ')
    # Add breathing pause after 'አንድ ደቂቃ' (one moment)
    text = text.replace('አንድ ደቂቃ', 'አንድ ደቂቃ... ')
    return text

# === STAGE 7: Call Recording Session ===
class CallSession:
    """Tracks a single call's audio turns and transcript for dashboard recording."""
    
    def __init__(self, call_sid: str, caller: str = "unknown"):
        self.call_sid = call_sid
        self.caller = caller
        self.transcript: list = []  # [{speaker, text, timestamp}]
        self.audio_paths: list = []  # Paths to per-turn WAV files
        self.start_time = datetime.now()
    
    def add_user_turn(self, text: str, audio_path: str = None):
        self.transcript.append({
            "speaker": "user",
            "text": text,
            "timestamp": datetime.now().isoformat()
        })
        if audio_path and Path(audio_path).exists():
            self.audio_paths.append(audio_path)
    
    def add_ai_turn(self, text: str):
        self.transcript.append({
            "speaker": "assistant",
            "text": text,
            "timestamp": datetime.now().isoformat()
        })
    
    def save(self) -> dict:
        """Save transcript as .txt. Returns metadata dict for dashboard."""
        recordings_dir = Path("recordings")
        recordings_dir.mkdir(exist_ok=True)
        
        # Save transcript
        txt_path = recordings_dir / f"{self.call_sid}.txt"
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(f"Call ID: {self.call_sid}\n")
            f.write(f"Caller: {self.caller}\n")
            f.write(f"Date: {self.start_time.isoformat()}\n")
            f.write("=" * 50 + "\n\n")
            for line in self.transcript:
                f.write(f"[{line['speaker'].upper()}]: {line['text']}\n")
        
        duration_sec = (datetime.now() - self.start_time).total_seconds()
        return {
            "id": self.call_sid,
            "call_sid": self.call_sid,
            "customer": self.caller,
            "agent": "Almaz (AI)",
            "type": "voice",
            "date": self.start_time.isoformat(),
            "timestamp": self.start_time.isoformat(),
            "duration": round(duration_sec / 60, 1),
            "transcript": self.transcript,
            "transcript_url": f"/recordings/{self.call_sid}.txt",
            "audio_url": None,  # Future: merged WAV path
            "summary": self.transcript[-1]["text"][:120] if self.transcript else "",
            "size": f"{txt_path.stat().st_size // 1024}KB" if txt_path.exists() else "0KB"
        }

# Global call sessions store (in-memory, keyed by call_sid)
_active_call_sessions: dict = {}

def get_call_session(call_sid: str, caller: str = "unknown") -> CallSession:
    if call_sid not in _active_call_sessions:
        _active_call_sessions[call_sid] = CallSession(call_sid, caller)
    return _active_call_sessions[call_sid]

def end_call_session(call_sid: str) -> dict:
    session = _active_call_sessions.pop(call_sid, None)
    if session:
        return session.save()
    return {}

# Polite "please repeat" responses in natural Amharic — rotated to sound natural
POLITE_RETRY_RESPONSES = [
    "ይቅርታ፣ አንዴ ይድገሙልኝ?",
    "ይቅርታ፣ ግልፅ አልሆነልኝም። ደግመው ይንገሩኝ?",
    "ይቅርታ፣ ጥያቄዎን ትንሽ እንደገና ይንገሩኝ?",
    "እሺ፣ ይቅርታ ጎን ያሉኝ ድምፅ ብዙ ነው። እባክዎ ደግመው ይንገሩኝ?",
    "ይቅርታ፣ በደንብ አልሰማሁዎትም። እባክዎ ቀስ ብለው ይንገሩኝ?",
    "ይቅርታ፣ መስመሩ ትንሽ ደካማ ነው። እባክዎ ደግመው ይናገሩ?",
]

_retry_index = 0

def get_polite_retry() -> str:
    """Get the next polite retry message, cycling through to avoid repetition"""
    global _retry_index
    response = POLITE_RETRY_RESPONSES[_retry_index % len(POLITE_RETRY_RESPONSES)]
    _retry_index += 1
    return response

# Amharic homophone normalization map
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

def normalize_amharic(text: str) -> str:
    """Normalize phonetically equivalent Amharic characters to a standard form."""
    if not text:
        return text
    return text.translate(AMHARIC_NORMALIZER)

def is_garbage_transcription(text: str) -> bool:
    """
    Detect if Whisper output is garbage (non-Amharic noise).
    
    Checks for:
    1. Too few real Amharic characters (Ge'ez script: U+1200–U+137F)
    2. Foreign script contamination (Georgian, Thai, Cyrillic, CJK, etc.)
    3. Unicode replacement characters (�)
    4. Repetitive character patterns (ንንንንን, etc.)
    5. Text too short to be meaningful
    """
    if not text or len(text.strip()) < 2:
        return True
    
    text = text.strip()
    
    # Count character types
    amharic_chars = 0    # Ge'ez: U+1200–U+137F, U+1380–U+139F, U+2D80–U+2DDF
    garbage_chars = 0    # Georgian, Thai, Cyrillic, CJK, replacement chars
    latin_chars = 0      # a-zA-Z
    total_alpha = 0      # All alphabetic characters
    
    for char in text:
        code = ord(char)
        if 0x1200 <= code <= 0x139F or 0x2D80 <= code <= 0x2DDF:
            amharic_chars += 1
            total_alpha += 1
        elif char.isalpha():
            total_alpha += 1
            if (0x10D0 <= code <= 0x10FF or   # Georgian
                0x0E00 <= code <= 0x0E7F or   # Thai
                0x0400 <= code <= 0x04FF or   # Cyrillic
                0x4E00 <= code <= 0x9FFF or   # CJK
                0x0600 <= code <= 0x06FF or   # Arabic
                0x0900 <= code <= 0x097F or   # Devanagari
                0xAC00 <= code <= 0xD7AF):    # Korean
                garbage_chars += 1
            else:
                latin_chars += 1
        elif code == 0xFFFD:  # Replacement character
            garbage_chars += 1
    
    # Rule 1: If there are foreign script characters, it's garbage
    if garbage_chars >= 2:
        logger.info(f"🗑️ Garbage detected: {garbage_chars} foreign script chars")
        return True
    
    # Rule 2: If text has replacement characters (�)
    if '�' in text or '\ufffd' in text:
        logger.info(f"🗑️ Garbage detected: replacement characters found")
        return True
    
    # Rule 3: Check for repetitive patterns (same char repeated 4+ times)
    for i in range(len(text) - 3):
        if text[i] == text[i+1] == text[i+2] == text[i+3] and text[i].isalpha():
            logger.info(f"🗑️ Garbage detected: repetitive character pattern")
            return True
    
    # Rule 4: If mostly non-Amharic non-Latin with few alpha chars
    if total_alpha > 0 and amharic_chars == 0 and latin_chars < 3:
        logger.info(f"🗑️ Garbage detected: no Amharic chars, insufficient Latin")
        return True
    
    # Rule 5: Very short with no Amharic (e.g., "Lim", "strat")
    if len(text) < 5 and amharic_chars == 0:
        logger.info(f"🗑️ Garbage detected: too short with no Amharic")
        return True
    
    # Rule 6: Mostly or purely numeric output (Whisper hallucinating tone digits/DTMF)
    # e.g.: "90 100 100 91 102 103 104" — clearly not speech
    words = text.split()
    if len(words) >= 2:
        numeric_words = sum(1 for w in words if w.strip('.,?!').isdigit())
        if numeric_words / len(words) >= 0.7:  # 70%+ of words are numbers
            logger.info(f"🗑️ Garbage detected: numeric-only output ({numeric_words}/{len(words)} words are digits)")
            return True
    
    # Rule 7: Known Whisper hallucination phrases (when it has silence/noise)
    hallucination_phrases = [
        "subtitles by", "subscrib", "thank you for watching",
        "please subscribe", "like and subscribe", "ሰብስክራይብ",
        "feeding", "www.", "http"
    ]
    text_lower = text.lower()
    if any(phrase in text_lower for phrase in hallucination_phrases):
        logger.info(f"🗑️ Garbage detected: known Whisper hallucination phrase")
        return True
    
    return False


def init_database():
    """Initialize SQLite database with required tables"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # 1. System Configuration
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS system_config (
            id INTEGER PRIMARY KEY,
            active_route VARCHAR(20) NOT NULL,
            last_updated TIMESTAMP NOT NULL,
            updated_by VARCHAR(100),
            reason TEXT
        )
        ''')
        
        # 2. Route Health
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS route_health (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            route_name VARCHAR(20) NOT NULL,
            status VARCHAR(20) NOT NULL,
            last_check TIMESTAMP NOT NULL,
            failure_count INTEGER DEFAULT 0,
            last_success TIMESTAMP,
            metadata JSON
        )
        ''')
        
        # 3. Call Logs
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS call_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            call_id VARCHAR(100) UNIQUE NOT NULL,
            route VARCHAR(20) NOT NULL,
            caller_number VARCHAR(50),
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP,
            duration INTEGER,
            status VARCHAR(20),
            error_message TEXT
        )
        ''')
        
        # 4. Failover Events
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS failover_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_time TIMESTAMP NOT NULL,
            from_route VARCHAR(20) NOT NULL,
            to_route VARCHAR(20) NOT NULL,
            trigger VARCHAR(50) NOT NULL,
            triggered_by VARCHAR(100),
            reason TEXT,
            notification_sent BOOLEAN DEFAULT FALSE
        )
        ''')
        
        # 5. Alert Recipients
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS alert_recipients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email VARCHAR(255) NOT NULL UNIQUE,
            name VARCHAR(100),
            active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        # Initialize default config if empty
        cursor.execute('SELECT count(*) FROM system_config')
        if cursor.fetchone()[0] == 0:
            cursor.execute(
                'INSERT INTO system_config (active_route, last_updated, updated_by, reason) VALUES (?, ?, ?, ?)',
                ('sip_bridge', datetime.now(), 'system_init', 'Initial setup')
            )
            
        conn.commit()
        conn.close()
        logging.info("✅ Database initialized successfully")
    except Exception as e:
        logging.error(f"❌ Database initialization failed: {e}")

# --- New Classes for Phase 1 ---

class RouteManager:
    """Manages active call routing between SIP and Twilio"""
    
    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path
    
    def get_active_route(self) -> str:
        """Get currently active route"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT active_route FROM system_config ORDER BY id DESC LIMIT 1')
                result = cursor.fetchone()
                return result[0] if result else 'sip_bridge'
        except Exception as e:
            logging.error(f"Error reading active route: {e}")
            return 'sip_bridge'  # Default fallback
            
    def set_active_route(self, route: str, reason: str, triggered_by: str):
        """Change active route"""
        if route not in ['sip_bridge', 'twilio']:
            raise ValueError("Invalid route name")
            
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Get current route for logging
                current = self.get_active_route()
                
                if current != route:
                    # Update config
                    cursor.execute(
                        'INSERT INTO system_config (active_route, last_updated, updated_by, reason) VALUES (?, ?, ?, ?)',
                        (route, datetime.now(), triggered_by, reason)
                    )
                    
                    # Log event
                    cursor.execute(
                        'INSERT INTO failover_events (event_time, from_route, to_route, trigger, triggered_by, reason) VALUES (?, ?, ?, ?, ?, ?)',
                        (datetime.now(), current, route, 'manual' if 'user' in triggered_by else 'automatic', triggered_by, reason)
                    )
                    conn.commit()
                    logging.info(f"🔄 Route switched: {current} -> {route}")
        except Exception as e:
            logging.error(f"Error setting active route: {e}")
            raise

class HealthMonitor:
    """Monitors SIP bridge health"""
    
    def __init__(self, check_interval=30):
        self.check_interval = check_interval
        self.sip_endpoint = os.getenv('SIP_BRIDGE_HEALTH_URL')
        self.failure_threshold = int(os.getenv('FAILURE_THRESHOLD', 3))
    
    async def check_sip_health(self) -> bool:
        """Check if SIP bridge is responsive"""
        if not self.sip_endpoint:
            return True # Assume healthy if not configured (for dev)
            
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.sip_endpoint, timeout=5) as resp:
                    return resp.status == 200
        except:
            return False

class AlertManager:
    """Sends email notifications"""
    
    def __init__(self):
        self.smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', 587))
        self.sender = os.getenv('ALERT_EMAIL_FROM')
        self.password = os.getenv('ALERT_EMAIL_PASSWORD')
        
    async def send_alert(self, subject: str, message: str):
        """Send email alert"""
        if not self.sender or not self.password:
            logging.warning("⚠️ Email alerts not configured (missing credentials)")
            return
            
        try:
            msg = MIMEMultipart()
            msg['From'] = self.sender
            msg['Subject'] = f"[URGENT] Almaz AI Alert: {subject}"
            msg.attach(MIMEText(message, 'plain'))
            
            # Get recipients
            recipients = self.get_recipients()
            if not recipients:
                return
                
            msg['To'] = ", ".join(recipients)
            
            await aiosmtplib.send(
                msg,
                hostname=self.smtp_server,
                port=self.smtp_port,
                username=self.sender,
                password=self.password,
                start_tls=True
            )
                    
            logging.info(f"📧 Alert sent: {subject}")
            
        except Exception as e:
            logging.error(f"❌ Failed to send alert: {e}")
            
    def get_recipients(self) -> List[str]:
        """Get active alert recipients from DB"""
        try:
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT email FROM alert_recipients WHERE active = 1')
                return [row[0] for row in cursor.fetchall()]
        except:
            return []

# Instantiate Managers
route_manager = RouteManager()
health_monitor = HealthMonitor()
alert_manager = AlertManager()
dashboard_reporter = DashboardReporter()



# Try to import TTS, but handle gracefully if not available
try:
    from TTS.api import TTS as CoquiTTS
    TTS_AVAILABLE = True
except ImportError:
    CoquiTTS = None
    TTS_AVAILABLE = False
    logging.warning("Coqui TTS not available. Using fallback TTS methods.")

# Create audio directory
AUDIO_DIR = Path(os.getenv("AUDIO_DIR", "./audio"))
AUDIO_DIR.mkdir(exist_ok=True)

# Configure logging
import structlog
import logging.config

# JSON logging configuration for production
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)
logger = structlog.get_logger()

app = FastAPI(title="Natural Amharic AI Call System")

# Mount static files for audio serving
app.mount("/audio", StaticFiles(directory="audio"), name="audio")

# Add favicon route to prevent 404 errors
@app.get("/favicon.ico", include_in_schema=False)
async def favicon_icon():
    return Response(content="", media_type="image/x-icon")

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        logger.error(f"❌ Uncaught Exception: {e}", exc_info=True)
        # Send critical alert
        await alerts.send_alert("Uncaught Exception in Endpoint", str(e))
        return Response("Internal Server Error", status_code=500)

@app.on_event("startup")
async def startup_event():
    """Initialize system on startup"""
    init_database()
    await conversation_db.init_schema()
    logging.info("🚀 System initialized")
    
    # Start Dashboard Heartbeat
    async def heartbeat_loop():
        while True:
            await dashboard_reporter.report_heartbeat()
            await asyncio.sleep(10)
    asyncio.create_task(heartbeat_loop())
    
    # Start background monitoring in production
    # asyncio.create_task(health_monitor.monitor_loop())

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Initialize LLM client (Groq or Gemini based on LLM_PROVIDER env var)
groq_client = None
llm_provider = os.getenv("LLM_PROVIDER", "groq").lower()

try:
    if llm_provider == "gemini":
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if gemini_api_key:
            # Gemini uses OpenAI-compatible API — no code changes needed elsewhere!
            groq_client = OpenAI(
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                api_key=gemini_api_key
            )
            logger.info("✅ Gemini client initialized successfully (via OpenAI-compatible API)")
        else:
            logger.warning("⚠️ GEMINI_API_KEY not found — falling back to Groq")
            llm_provider = "groq"

    if llm_provider == "groq":
        groq_api_key = os.getenv('GROQ_API_KEY')
        if groq_api_key:
            groq_client = Groq(api_key=groq_api_key)
            logger.info("✅ Groq client initialized successfully")
        else:
            logger.warning("⚠️ GROQ_API_KEY not found in environment")

except Exception as e:
    logger.error(f"❌ Failed to initialize LLM client: {e}")

# Always keep a dedicated Groq client for Whisper STT fallback
# (Gemini has no Whisper endpoint, so STT always uses Groq regardless of LLM_PROVIDER)
stt_client = None
try:
    groq_api_key = os.getenv('GROQ_API_KEY')
    if groq_api_key:
        stt_client = Groq(api_key=groq_api_key)
        logger.info("✅ Groq STT (Whisper) client ready")
except Exception as e:
    logger.error(f"❌ Failed to initialize STT client: {e}")

# === STAGE 1: OpenAI GPT-4o + Whisper-1 clients (Primary) ===
# Groq above is the fallback. OpenAI is primary when OPENAI_API_KEY is real.
openai_async_client = None
openai_sync_client = None
try:
    openai_api_key = os.getenv('OPENAI_API_KEY', '')
    # Only activate OpenAI if key looks real (not placeholder)
    if openai_api_key and not openai_api_key.startswith('your_'):
        openai_async_client = AsyncOpenAI(api_key=openai_api_key)
        openai_sync_client = OpenAI(api_key=openai_api_key)
        logger.info("✅ OpenAI client (GPT-4o + Whisper-1) initialized — PRIMARY provider")
    else:
        logger.info("ℹ️ OpenAI key not set — using Groq as primary (add OPENAI_API_KEY to .env to enable GPT-4o)")
except Exception as e:
    logger.error(f"❌ Failed to initialize OpenAI client: {e}")

# Serve call recordings as static files for the dashboard
recordings_dir = Path("recordings")
recordings_dir.mkdir(exist_ok=True)
app.mount("/recordings", StaticFiles(directory="recordings"), name="recordings")


# Enhanced TTS System with Multiple Fallbacks
# Language Code Map for TTS
LANG_TTS_MAP = {
    "amharic": "am",
    "english": "en",
    "spanish": "es",
    "french": "fr"
}

# Enhanced TTS System with Multiple Fallbacks
# Edge TTS voice map — native neural voices per language
EDGE_TTS_VOICE_MAP = {
    "am": "am-ET-MekdesNeural",      # Native Amharic female
    "en": "en-US-JennyNeural",        # English female
    "es": "es-ES-ElviraNeural",       # Spanish female
    "fr": "fr-FR-DeniseNeural",       # French female
}

# === STAGE 2: TTS Pre-Warm Cache ===
# These phrases are pre-generated on startup so the first caller never waits
TTS_PREWARM_PHRASES = [
    ("ሰላም፣ ጂኤም ፈርኒቸር ነው። እንዴት ልረዳዎ?", "amharic"),      # Greeting
    ("ይቅርታ፣ አንዴ ይድገሙልኝ?", "amharic"),                       # Retry 1
    ("ይቅርታ፣ ትንሽ ጫጫታ አለ። ደግመው ይናገሩ?", "amharic"),          # Retry 2
    ("አንድ ደቂቃ ይጠብቁ... ", "amharic"),                          # Hold
    ("እሺ፣ እኔ እያዘጋጀሁ ነኝ።", "amharic"),                        # Processing
    ("ምንም አይደለም! ሌላ ነገር ካለ ይንገሩኝ።", "amharic"),            # Thanks reply
]

@app.on_event("startup")
async def startup_event():
    """Startup tasks: cleanup temp files, pre-warm TTS cache, and start barge-in listener."""
    logger.info("🧹 Cleaning up stale temp files...")
    import glob, time
    now = time.time()
    for f in glob.glob("temp_*.wav") + glob.glob("temp_*.webm"):
        if os.path.exists(f) and os.path.getmtime(f) < now - 600:
            try: os.remove(f)
            except: pass

    logger.info("🔥 Pre-warming TTS cache for common phrases...")
    tasks = [
        generate_multilingual_voice(text, lang)
        for text, lang in TTS_PREWARM_PHRASES
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    hits = sum(1 for r in results if isinstance(r, str))
    logger.info(f"✅ TTS pre-warm complete: {hits}/{len(TTS_PREWARM_PHRASES)} phrases cached")

    # Start ESL barge-in listener safely
    try:
        start_barge_in_listener()
        logger.info("🎯 Barge-in ESL listener started → FreeSWITCH port 8021")
    except Exception as e:
        logger.warning(f"⚠️ Could not start Barge-in ESL listener (is FreeSWITCH running?): {e}")


async def generate_multilingual_voice(text: str, lang_name: str = "amharic", method: str = "auto", call_id: str = None) -> Optional[str]:
    """
    Generate natural voice using multiple methods:
    1. Edge TTS (FREE, native Amharic neural voice — best quality)
    2. Enhanced Google Translate TTS (fallback)
    3. OpenAI TTS (if available)
    """
    # Map friendly language name to ISO code
    lang_code = LANG_TTS_MAP.get(lang_name.lower(), "am")
    
    # Method 0: Addis AI TTS (Primary for Amharic)
    if method in ["auto", "addisai"]:
        audio_url = await generate_addis_ai_tts(text, lang_code, call_id)
        if audio_url:
            return audio_url
    
    # Method 1: Edge TTS (FREE native neural voices — Fallback 1)
    if method in ["auto", "edge"]:
        audio_url = await generate_edge_tts(text, lang_code, call_id)
        if audio_url:
            return audio_url
    
    # Method 2: Google Translate TTS (Fallback 2)
    if method in ["auto", "google"]:
        audio_url = await generate_enhanced_google_tts(text, lang_code, call_id)
        if audio_url:
            return audio_url
    
    # Method 3: Try OpenAI TTS (if configured)
    if method in ["auto", "openai"]:
        audio_url = await generate_openai_tts(text, lang_code)
        if audio_url:
            return audio_url
    
    return None

async def generate_addis_ai_tts(text: str, lang: str = "am", call_id: str = None) -> Optional[str]:
    """Generate TTS using Addis AI API (Primary for Amharic)"""
    try:
        addis_ai_key = os.getenv('ADDIS_AI_TTS_KEY')
        if not addis_ai_key or addis_ai_key == "your_addis_ai_api_key_here":
            return None
            
        # Create unique filename
        text_hash = hashlib.md5(f"addisai_{lang}_{text}".encode('utf-8')).hexdigest()[:8]
        wav_filename = f"addisai_{lang}_{text_hash}.wav"
        wav_path = AUDIO_DIR / wav_filename
        
        # Check if WAV already cached
        if wav_path.exists():
            logger.info(f"✅ Using cached Addis AI TTS {lang} audio: {wav_filename}")
            if call_id:
                asyncio.create_task(metrics.record_tts_cache_hit(call_id, True))
            return f"/audio/{wav_filename}"
            
        if call_id:
            asyncio.create_task(metrics.record_tts_cache_hit(call_id, False))
            
        async with httpx.AsyncClient(timeout=30) as client:
            payload = {
                "text": text,
                "language": lang
            }
            headers = {
                "X-API-Key": addis_ai_key,
                "Content-Type": "application/json"
            }
            # Verify endpoint URL, default to the official one
            base_url = os.getenv("ADDIS_AI_TTS_URL", "https://api.addisassistant.com/api/v1/audio")
            
            resp = await client.post(base_url, json=payload, headers=headers)
            if resp.status_code == 200:
                resp_json = resp.json()
                if "audio" in resp_json:
                    audio_data = resp_json["audio"]
                    # Usually returned as data:audio/wav;base64,...
                    if audio_data.startswith("data:"):
                        audio_data = audio_data.split(",")[1]
                    
                    import base64
                    wav_bytes = base64.b64decode(audio_data)
                    
                    with open(wav_path, "wb") as f:
                        f.write(wav_bytes)
                        
                    logger.info(f"✅ Generated Addis AI TTS {lang} audio: {wav_filename}")
                    return f"/audio/{wav_filename}"
            else:
                logger.warning(f"Addis AI API Error: {resp.status_code} {resp.text}")
                
        return None
    except Exception as e:
        logger.error(f"Addis AI TTS failed for {lang}: {e}")
        return None

async def generate_edge_tts(text: str, lang: str = "am", call_id: str = None) -> Optional[str]:
    """Generate native neural TTS using Microsoft Edge TTS (100% FREE, no API key needed)"""
    try:
        import edge_tts
        
        # Create unique filename
        text_hash = hashlib.md5(f"edge_{lang}_{text}".encode('utf-8')).hexdigest()[:8]
        mp3_filename = f"edge_{lang}_{text_hash}.mp3"
        wav_filename = f"edge_{lang}_{text_hash}.wav"
        mp3_path = AUDIO_DIR / mp3_filename
        wav_path = AUDIO_DIR / wav_filename
        
        # Check if WAV already cached
        if wav_path.exists():
            logger.info(f"✅ Using cached Edge TTS {lang} audio: {wav_filename}")
            if call_id:
                asyncio.create_task(metrics.record_tts_cache_hit(call_id, True))
            return f"/audio/{wav_filename}"
        
        if call_id:
            asyncio.create_task(metrics.record_tts_cache_hit(call_id, False))
        
        # Get the correct voice for this language
        voice = EDGE_TTS_VOICE_MAP.get(lang, "am-ET-MekdesNeural")
        
        # Generate audio with Edge TTS
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(str(mp3_path))
        
        # Verify MP3 was created
        if not mp3_path.exists() or mp3_path.stat().st_size < 100:
            logger.warning(f"Edge TTS generated empty/tiny file for {lang}")
            return None
        
        # Convert to WAV for FreeSWITCH compatibility (16kHz, mono)
        import subprocess
        try:
            subprocess.run(
                ['ffmpeg', '-y', '-i', str(mp3_path), '-ar', '16000', '-ac', '1', str(wav_path)],
                check=True, capture_output=True, timeout=10
            )
            logger.info(f"✅ Generated Edge TTS {lang} audio ({voice}): {wav_filename}")
            
            # Clean up MP3
            try:
                mp3_path.unlink()
            except Exception:
                pass
            
            return f"/audio/{wav_filename}"
        except Exception as ffmpeg_err:
            logger.error(f"FFmpeg conversion failed: {ffmpeg_err}")
            return f"/audio/{mp3_filename}"
    
    except Exception as e:
        logger.error(f"Edge TTS failed for {lang}: {e}")
        return None

async def generate_enhanced_google_tts(text: str, lang: str = "am", call_id: str = None) -> Optional[str]:
    """Enhanced Google Translate TTS with long text support and audio concatenation"""
    try:
        # Create unique filename including language
        text_hash = hashlib.md5(f"{lang}_{text}".encode('utf-8')).hexdigest()[:8]
        mp3_filename = f"tts_{lang}_{text_hash}.mp3"
        wav_filename = f"tts_{lang}_{text_hash}.wav"
        mp3_path = AUDIO_DIR / mp3_filename
        wav_path = AUDIO_DIR / wav_filename
        
        # Check if WAV already exists
        if wav_path.exists():
            logger.info(f"✅ Using cached {lang} audio: {wav_filename}")
            if call_id:
                 asyncio.create_task(metrics.record_tts_cache_hit(call_id, True))
            return f"/audio/{wav_filename}"
        
        if call_id:
             asyncio.create_task(metrics.record_tts_cache_hit(call_id, False))
        
        # Split text into chunks if it's too long (> 180 chars)
        chunks = []
        if len(text) > 180:
            import re
            # Split by sentence endings or commas, then recombine if still too small
            raw_chunks = re.split('([.!?፣።]|\n)', text)
            current_chunk = ""
            for part in raw_chunks:
                if len(current_chunk) + len(part) < 180:
                    current_chunk += part
                else:
                    if current_chunk: chunks.append(current_chunk.strip())
                    current_chunk = part
            if current_chunk: chunks.append(current_chunk.strip())
            logger.info(f"📝 Text length {len(text)} too long, split into {len(chunks)} chunks")
        else:
            chunks = [text]

        # Use speed 1.0 for most languages, 0.9 for Amharic for clarity
        speed = 0.9 if lang == "am" else 1.0
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'audio/mpeg, audio/*, */*',
        }
        
        all_audio_bytes = b""
        async with httpx.AsyncClient() as client:
            for chunk in chunks:
                if not chunk: continue
                encoded_chunk = quote(chunk)
                url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={encoded_chunk}&tl={lang}&client=tw-ob&ttsspeed={speed}"
                
                try:
                    response = await client.get(url, headers=headers, timeout=15)
                    if response.status_code == 200 and len(response.content) > 100:
                        all_audio_bytes += response.content
                    else:
                        logger.warning(f"Failed to get audio for chunk: {chunk[:20]}...")
                except Exception as e:
                    logger.error(f"Chunk TTS error: {e}")
                    continue

        if all_audio_bytes:
            # Save MP3 first
            with open(mp3_path, 'wb') as f:
                f.write(all_audio_bytes)
            
            # Convert to WAV for FreeSWITCH compatibility (16kHz, mono)
            import subprocess
            try:
                subprocess.run(['ffmpeg', '-y', '-i', str(mp3_path), '-ar', '16000', '-ac', '1', str(wav_path)], check=True, capture_output=True)
                logger.info(f"✅ Generated and converted {lang} audio to WAV: {wav_filename} ({len(chunks)} chunks)")
                
                # Try to clean up the temporary mp3 file
                try:
                    mp3_path.unlink()
                except Exception:
                    pass
                    
                return f"/audio/{wav_filename}"
            except Exception as ffmpeg_err:
                logger.error(f"FFmpeg conversion failed: {ffmpeg_err}")
                # Fallback to returning MP3 if conversion fails
                return f"/audio/{mp3_filename}"
        
        return None
        
    except Exception as e:
        logger.error(f"Error generating enhanced Google TTS for {lang}: {e}")
        return None

async def generate_openai_tts(text: str, lang: str = "am") -> Optional[str]:
    """Try OpenAI TTS if API key is available with multi-language support"""
    try:
        openai_key = os.getenv('OPENAI_API_KEY')
        if not openai_key:
            return None
            
        import openai
        from openai import AsyncOpenAI
        
        # Create unique filename including language
        text_hash = hashlib.md5(f"{lang}_{text}".encode('utf-8')).hexdigest()[:8]
        mp3_filename = f"openai_{lang}_{text_hash}.mp3"
        wav_filename = f"openai_{lang}_{text_hash}.wav"
        mp3_path = AUDIO_DIR / mp3_filename
        wav_path = AUDIO_DIR / wav_filename
        
        if wav_path.exists():
            return f"/audio/{wav_filename}"
        
        client = AsyncOpenAI(api_key=openai_key)
        
        response = await client.audio.speech.create(
            model="tts-1-hd",
            voice="nova",
            input=text,
            speed=1.0 # Normal speed for other languages
        )
        
        # Save MP3 audio file
        async with aiofiles.open(mp3_path, 'wb') as f:
            await f.write(response.content)
            
        # Convert to WAV for FreeSWITCH compatibility
        import subprocess
        try:
            subprocess.run(['ffmpeg', '-y', '-i', str(mp3_path), '-ar', '16000', '-ac', '1', str(wav_path)], check=True, capture_output=True)
            logger.info(f"✅ Generated and converted OpenAI {lang} audio to WAV: {wav_filename}")
            
            # Try to clean up the temporary mp3 file
            try:
                mp3_path.unlink()
            except Exception:
                pass
                
            return f"/audio/{wav_filename}"
        except Exception as ffmpeg_err:
            logger.error(f"FFmpeg conversion failed: {ffmpeg_err}")
            return f"/audio/{mp3_filename}"
        
    except Exception as e:
        logger.warning(f"OpenAI TTS failed for {lang}: {e}")
        return None

# Enhanced Amharic AI Assistant with Conversation Memory

class AmharicAIAssistant:
    def __init__(self, call_id: str = None):
        """Initialize the Multi-Language AI Assistant with Groq LLM"""
        self.call_id = call_id
        self.groq_client = groq_client  # Use existing client
        self.conversation_history = []
        self.detected_language = "amharic"
        self.detected_language = "amharic"
        self.is_first_turn = True
        self.db = conversation_db
        
        # GM Furniture system prompt — optimized for noisy phone audio + RAG
        self.amharic_system_prompt = (
            'You are "Almaz", a friendly Ethiopian customer service agent for GM Furniture.\n\n'
            "CRITICAL: Customer input comes from a NOISY PHONE LINE and may be garbled, unclear, or contain random characters.\n"
            "When input is unclear, DO NOT generate random or meaningless text.\n"
            "Instead, PROACTIVELY offer useful information about our products.\n\n"
            "LANGUAGE: Always respond in natural Amharic (Ge'ez script). Keep responses SHORT (1-2 sentences max).\n"
            "Start responses with: እሺ, አዎ, or እንግዲኛ.\n\n"
            "CRITICAL INSTRUCTION FOR ACCURACY:\n"
            "- You MUST rely EXACTLY on the Knowledge Base / Product Catalog provided to you in the system message.\n"
            "- NEVER INVENT OR GUESS A PRICE. If they ask for a price, you MUST quote the EXACT price from the catalog.\n"
            "- DO NOT answer generally. If they ask about a chair (ወንበር), you MUST state the exact price of the chairs we have (e.g. \"የመመገቢያ ወንበር 3,500 ብር፣ የእንግዳ ወንበር 5,500 ብር፣ የስዊቬል ወንበር 15,000 ብር ነው\").\n"
            "- ALWAYS state the specific facts: exact birr amounts, exact showroom locations, exact delivery days. Act like a precision lookup tool but speak with a warm human voice.\n\n"
            "WHEN INPUT IS UNCLEAR OR GARBLED:\n"
            "- Do your best to SOUND MATCH the garbage text to real products in the catalog (e.g. 'ቲን ሀቤ' -> 'dining table', 'ስፋ' -> 'sofa').\n"
            "- If you can guess the product from the noise, IMMEDIATELY give the exact price from the catalog.\n"
            "- If completely unclear: say 'እሺ፣ ስለ ፈርኒቸር ዋጋ፣ ሾሩም ቦታ፣ ወይም ዴሊቨሪ ሊጠይቁ ይችላሉ። ምን ልረዳዎ?'\n\n"
            "NEVER generate random Amharic text. Every response must be meaningful and helpful.\n"
            "Tone: warm, friendly Ethiopian salesperson on the phone."
        )
        
        # Language-specific prompts for multilingual support
        self.language_prompts = {
            "english": (
                "You are Almaz, a friendly customer service representative for GM Furniture in Ethiopia. "
                "GM Furniture makes modern office and home furniture — sofas, chairs, beds, desks. "
                "Keep responses SHORT (max 2 sentences). Be warm and helpful. Speak in English."
            ),
            "spanish": (
                "Eres Almaz, representante de atención al cliente de GM Furniture en Etiopía. "
                "Respuestas CORTAS (máximo 2 oraciones). Amable y profesional. Solo en español."
            ),
            "french": (
                "Vous êtes Almaz, représentante du service client de GM Furniture en Éthiopie. "
                "Réponses COURTES (max 2 phrases). Aimable et professionnelle. Uniquement en français."
            ),
            # Arabic removed — Whisper confuses Arabic with Amharic
        }
        
        # Initialize conversation
        self.conversation_history = [
            {"role": "system", "content": self.amharic_system_prompt}
        ]

    async def transcribe_audio(self, audio_file: UploadFile) -> tuple[str, str]:
        """
        Transcribe audio using OpenAI Whisper-1 (primary) or Groq whisper-large-v3-turbo (fallback).
        Stage 6: whisper-1 is the best available API model for Amharic accuracy.
        """
        if not self.groq_client and not openai_async_client: return "", "amharic"
        
        temp_path = None
        processed_path = None
        
        try:
            # Save temp file - preserve original extension (.wav, .webm, .mp3, etc.)
            original_ext = Path(audio_file.filename).suffix or ".webm"
            temp_filename = f"temp_{hashlib.md5(audio_file.filename.encode()).hexdigest()}{original_ext}"
            temp_path = Path(temp_filename)
            
            with open(temp_path, "wb") as buffer:
                content = await audio_file.read()
                buffer.write(content)
            
            # === ADVANCED AUDIO PREPROCESSING FOR WHISPER ===
            # FreeSWITCH 8kHz phone audio needs heavy processing for Whisper to work
            processed_path = Path(f"temp_processed_{hashlib.md5(audio_file.filename.encode()).hexdigest()}.wav")
            import subprocess
            try:
                # Advanced ffmpeg pipeline:
                # 1. highpass=300  — remove phone line rumble/hum below 300Hz
                # 2. lowpass=3400  — remove noise above phone speech band (300-3400Hz)
                # 3. loudnorm      — normalize volume (quiet speakers become audible)
                # 4. ar=16000      — upsample to 16kHz (Whisper's native rate)
                # 5. acodec=pcm_s16le — 16-bit PCM for maximum compatibility
                subprocess.run(
                    [
                        'ffmpeg', '-y', '-i', str(temp_path),
                        '-af', 'highpass=f=300,lowpass=f=3400,loudnorm=I=-16:TP=-1.5:LRA=11',
                        '-ar', '16000', '-ac', '1', '-acodec', 'pcm_s16le',
                        str(processed_path)
                    ],
                    check=True, capture_output=True, timeout=15
                )
                transcribe_path = processed_path
                transcribe_filename = processed_path.name
                logger.info(f"🔄 Audio enhanced: {original_ext} → 16kHz WAV (filtered + normalized)")
            except Exception as ffmpeg_err:
                logger.warning(f"FFmpeg enhancement failed, using basic conversion: {ffmpeg_err}")
                # Fallback: basic conversion without filters
                try:
                    subprocess.run(
                        ['ffmpeg', '-y', '-i', str(temp_path), '-ar', '16000', '-ac', '1', '-acodec', 'pcm_s16le', str(processed_path)],
                        check=True, capture_output=True, timeout=10
                    )
                    transcribe_path = processed_path
                    transcribe_filename = processed_path.name
                except:
                    transcribe_path = temp_path
                    transcribe_filename = temp_filename
                
            # === STAGE 1+6: OpenAI whisper-1 (primary) or Groq fallback ===
            WHISPER_PROMPT = (
                "ሰላም የጂኤም ፈርኒቸር ደንበኛ ድጋፍ ነኝ። ሶፋ ዋጋ how much ነው? discount አለ? delivery free ነው? "
                "ወንበር price ስንት ነው? installation included ነው? "
                "አልጋ ጠረጴዛ ካቢኔ ዋርድሮብ መደርደሪያ ቲቪ ስታንድ ኪንግ ሳይዝ ኩዊን ኤል ቅርጽ ስዊቬል "
                "ሾሩም location Bole ቄራ Piassa ቶርሃይሎች ጉርድ ሾላ አለምገና። "
                "ዋጋ ብር ክፍያ ቅጣፍ ባንክ ዋስትና ትዕዛዝ order furniture desk chair bed style"
            )

            transcription_text = None
            detected_lang = "amharic"
            stt_provider_used = "none"

            # === STT PROVIDER ROUTING ===
            # Change ONE LINE in .env to switch:
            #   STT_PROVIDER=elevenlabs → ElevenLabs (primary) + Groq (fallback)
            #   STT_PROVIDER=groq       → Groq (primary) + ElevenLabs (fallback)
            #   STT_PROVIDER=openai     → OpenAI (primary) + Groq (fallback)
            stt_provider = os.getenv("STT_PROVIDER", "elevenlabs").lower()
            groq_model   = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")
            elevenlabs_key = os.getenv("ELEVENLABS_API_KEY")

            async def try_elevenlabs_stt():
                nonlocal transcription_text, stt_provider_used, detected_lang
                if not elevenlabs_key or elevenlabs_key.startswith("your_"):
                    return False
                try:
                    async with httpx.AsyncClient(timeout=30) as client:
                        with open(transcribe_path, "rb") as audio_f:
                            files = {"file": (transcribe_filename, audio_f, "audio/wav")}
                            data = {"model_id": "scribe_v2", "language_code": "am"}
                            resp = await client.post(
                                "https://api.elevenlabs.io/v1/speech-to-text",
                                headers={"xi-api-key": elevenlabs_key},
                                files=files,
                                data=data
                            )
                        if resp.status_code == 200:
                            transcription_text = resp.json().get("text", "").strip()
                            stt_provider_used = "elevenlabs-scribe_v2"
                            detected_lang = "amharic"
                            logger.info("🎤 STT: ElevenLabs Scribe v2")
                            return True
                        else:
                            logger.warning(f"ElevenLabs HTTP Error: {resp.status_code} {resp.text}")
                            return False
                except Exception as e:
                    logger.warning(f"ElevenLabs STT failed: {e}")
                    return False

            async def try_openai_stt():
                nonlocal transcription_text, stt_provider_used, detected_lang
                if not openai_async_client:
                    return False
                try:
                    with open(transcribe_path, "rb") as audio_f:
                        transcription = await openai_async_client.audio.transcriptions.create(
                            file=(transcribe_filename, audio_f.read()),
                            model="whisper-1",
                            language="am",
                            response_format="verbose_json",
                            prompt=WHISPER_PROMPT
                        )
                    transcription_text = transcription.text.strip()
                    detected_lang = getattr(transcription, 'language', None) or "amharic"
                    stt_provider_used = "openai-whisper-1"
                    logger.info("🎤 STT: OpenAI whisper-1")
                    return True
                except Exception as e:
                    logger.warning(f"OpenAI STT failed: {e}")
                    return False

            def try_groq_stt():
                nonlocal transcription_text, stt_provider_used, detected_lang
                if not stt_client:
                    return False
                try:
                    with open(transcribe_path, "rb") as audio_f:
                        transcription = stt_client.audio.transcriptions.create(
                            file=(transcribe_filename, audio_f.read()),
                            model=groq_model,
                            response_format="verbose_json",
                            prompt=WHISPER_PROMPT
                        )
                    transcription_text = transcription.text.strip()
                    detected_lang = getattr(transcription, 'language', None) or "amharic"
                    stt_provider_used = f"groq-{groq_model}"
                    logger.info(f"🎤 STT: Groq {groq_model}")
                    return True
                except Exception as e:
                    logger.warning(f"Groq STT failed: {e}")
                    return False

            # Route execution based on provider
            if stt_provider == "elevenlabs":
                if not await try_elevenlabs_stt():
                    try_groq_stt()
            elif stt_provider == "openai":
                if not await try_openai_stt():
                    try_groq_stt()
            else:
                if not try_groq_stt():
                    await try_elevenlabs_stt()

            if transcription_text is None:
                logger.error("No STT provider available")
                return "", "amharic"

            # CRITICAL: Redirect Arabic to Amharic (Whisper constantly confuses them)
            if detected_lang.lower() in ["arabic", "ar"]:
                detected_lang = "amharic"

            logger.info(f"🎤 [{stt_provider_used}] detected [{detected_lang}]: {transcription_text}")
            return transcription_text, detected_lang

        except Exception as e:
            logger.error(f"Whisper transcription failed: {e}")
            return "", "amharic"
            
        finally:
            # Cleanup temp files (always runs)
            for p in [temp_path, processed_path]:
                if p and p.exists():
                    try:
                        os.remove(p)
                    except:
                        pass

    def _analyze_and_repair(self, user_input: str) -> dict:
        """
        Unified function to Detect Language AND Repair Phonetic Input simultaneously.
        This solves the issue where 'Amharic' verification blocks repair of phonetic English.
        """
        if not self.groq_client: return {"language": "amharic", "text": user_input}
        llm_model = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")
        
        try:
            response = self.groq_client.chat.completions.create(
                model=llm_model,
                messages=[
                    {"role": "system", "content": """Analyze the user's text. It might be in Amharic script (Ge'ez) but actually be phonetic English/Spanish/French.
                    
                    Your job is to:
                    1. Identify the TRUE underlying language.
                    2. If it is phonetic (e.g. 'ከሃው አር ዩ' -> 'How are you'), REPAIR it to the correct script.
                    3. If it is standard Amharic, keep it as is.
                    
                    Examples:
                    Input: 'ከሃው አር ዩ' -> Output JSON: {"language": "english", "text": "How are you"}
                    Input: 'ሰላም ነው' -> Output JSON: {"language": "amharic", "text": "ሰላም ነው"}
                    Input: 'Hello' -> Output JSON: {"language": "english", "text": "Hello"}
                    
                    Respond with VALID JSON ONLY: {"language": "...", "text": "..."}"""},
                    {"role": "user", "content": user_input}
                ],
                max_tokens=150,
                temperature=0.0
                # Note: response_format removed — not supported by Gemini
            )
            raw = response.choices[0].message.content.strip()
            # Extract JSON from response (works even if model wraps it in markdown)
            import re
            json_match = re.search(r'\{.*?\}', raw, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
            else:
                result = json.loads(raw)
            return {
                "language": result.get("language", "english").lower(), 
                "text": result.get("text", user_input)
            }
        except Exception as e:
            logger.warning(f"Analysis failed: {e}")
            # Fallback: heavily bias towards English if we can't be sure, as Amharic usually works fine
            return {"language": "english", "text": user_input}

    def generate_response(self, user_input: str) -> str:
        """Generate response with multi-language routing and Amharic-first policy"""
        if not self.groq_client:
            return "ይቅርታ፣ ቴክኒካል ችግር ተፈጥሯል። እባክዎ ቆይተው ይደውሉ።"
        
        # 1. Analyze and Repair Input — ONLY for non-Amharic text
        # Skip repair for Amharic because _analyze_and_repair mangles 
        # Whisper's noisy output into random English, breaking the AI
        if self.detected_language == "amharic":
            # Trust the raw input — the LLM can handle noisy Amharic
            new_lang = "amharic"
        else:
            analysis = self._analyze_and_repair(user_input)
            new_lang = analysis["language"]
            repaired_input = analysis["text"]
            
            if repaired_input != user_input:
                 logger.info(f"🔧 Input Repaired: {user_input} -> {repaired_input}")
                 user_input = repaired_input

        # Redirect Arabic to Amharic (Whisper confuses them)
        if new_lang == "arabic":
            new_lang = "amharic"
        if new_lang not in ["english", "spanish", "french", "amharic"]:
            new_lang = "amharic" # Safety fallback — default to Amharic

        if new_lang != self.detected_language:
            logger.info(f"🌐 Language switch: {self.detected_language} -> {new_lang}")
            self.detected_language = new_lang
            if self.call_id:
                asyncio.create_task(self.db.update_session_language(self.call_id, new_lang))

        # 2. Choose Model Routing (Updated for 2026 decommissionings)
        # Spanish, French, English, Amharic, Arabic -> Llama 3.3 70B (Versatile)
        # Note: All DeepSeek-R1 distill models have been decommissioned on Groq as of early 2026.
        model = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")

        # 3. EN-Specific Fallback (Groq only)
        if self.detected_language == "english" and os.getenv("USE_ENGLISH_FALLBACK") == "true" and os.getenv("LLM_PROVIDER", "groq") == "groq":
             model = "llama-3.1-8b-instant"

        try:
            # 4. Update system prompt based on policy
            if self.is_first_turn:
                # FORCE Amharic response for the very first turn (Amharic-First Policy)
                active_system_prompt = self.amharic_system_prompt
            else:
                # Subsequent turns: Use the prompt for the detected language
                active_system_prompt = self.language_prompts.get(self.detected_language, self.amharic_system_prompt)
            
            # Ensure index 0 is always the current appropriate system prompt
            if self.conversation_history and self.conversation_history[0]["role"] == "system":
                self.conversation_history[0] = {"role": "system", "content": active_system_prompt}
            else:
                self.conversation_history.insert(0, {"role": "system", "content": active_system_prompt})

            self.conversation_history.append({"role": "user", "content": user_input})
            
            # 5. RAG: Retrieve relevant knowledge base context
            rag_context = retrieve_knowledge(user_input)
            if rag_context:
                logger.info(f"📚 RAG: Found relevant knowledge for query")
                # Inject knowledge as a system-level context message right before the LLM call
                rag_message = {
                    "role": "system",
                    "content": (
                        "KNOWLEDGE BASE DATA (use this to answer the customer's question accurately):\n"
                        f"{rag_context}\n\n"
                        "INSTRUCTION: Use the above data to answer the customer. "
                        "Give specific prices, locations, and details from the data. "
                        "Keep your response SHORT (1-2 sentences in Amharic). "
                        "Start with a conversational word like እሺ, አዎ, or እንግዲኛ."
                    )
                }
                # Build messages with RAG context injected
                messages_with_rag = self.conversation_history.copy()
                messages_with_rag.insert(-1, rag_message)  # Insert before last user message
            else:
                messages_with_rag = self.conversation_history
            
            # 6. Call LLM — OpenAI GPT-4o (primary) or Groq (fallback)
            ai_response = None
            llm_provider = os.getenv("LLM_PROVIDER", "groq")

            if llm_provider == "openai" and openai_async_client:
                try:
                    # GPT-4o — best multilingual quality
                    import asyncio
                    oai_resp = asyncio.get_event_loop().run_until_complete(
                        openai_async_client.chat.completions.create(
                            model="gpt-4o",
                            messages=messages_with_rag,
                            temperature=0.7,
                            max_tokens=300
                        )
                    ) if False else None  # Placeholder — sync wrapper below
                    # Use sync OpenAI client for LLM (avoids event loop issues in sync context)
                    if openai_sync_client:
                        oai_resp = openai_sync_client.chat.completions.create(
                            model="gpt-4o",
                            messages=messages_with_rag,
                            temperature=0.7,
                            max_tokens=300
                        )
                        ai_response = oai_resp.choices[0].message.content.strip()
                        logger.info("🤖 LLM: Using OpenAI GPT-4o")
                except Exception as oai_err:
                    logger.warning(f"OpenAI LLM failed, falling back to Groq: {oai_err}")

            if ai_response is None:
                # Groq fallback
                response = self.groq_client.chat.completions.create(
                    model=model,
                    messages=messages_with_rag,
                    temperature=0.7,
                    max_tokens=400
                )
                ai_response = response.choices[0].message.content.strip()
                logger.info(f"🤖 LLM: Using Groq {model} (fallback)")

            # Clean DeepSeek thinking blocks
            if "<think>" in ai_response:
                ai_response = ai_response.split("</think>")[-1].strip()

            # === STAGE 5: Add natural Amharic filler + breathing pauses ===
            ai_response = add_natural_filler(ai_response)
            ai_response = wrap_with_natural_pauses(ai_response)

            self.conversation_history.append({"role": "assistant", "content": ai_response})
            self.is_first_turn = False

            return ai_response

        except Exception as e:
            logger.error(f"❌ Error generating response: {e}")
            return "ይቅርታ፣ ልክ እንደዚህ አልገባኝም። እባክዎ እንደገና ይንገሩኝ。"

    async def load_from_db(self):
        """Restore conversation from persistent storage"""
        if not self.call_id: return
        
        # 1. Load History
        history = await self.db.load_conversation(self.call_id)
        if history:
            # Reconstruct history with system prompt first
            self.conversation_history = [{"role": "system", "content": self.amharic_system_prompt}]
            self.conversation_history.extend(history)
            self.is_first_turn = False
            
            # 2. Load Session Metadata (Language)
            session_info = await self.db.get_session_info(self.call_id)
            if session_info:
                self.detected_language = session_info.get('detected_language', 'amharic')
                
            logger.info(f"📥 Restored {len(history)} turns [{self.detected_language}] for {self.call_id}")

    def reset_conversation(self):
        """Reset conversation history"""
        self.conversation_history = [
            {"role": "system", "content": self.amharic_system_prompt}
        ]
        logger.info("🔄 Conversation history reset")

class SessionManager:
    """Manages isolated AI assistant instances per call"""
    
    def __init__(self):
        self.sessions: Dict[str, AmharicAIAssistant] = {}
        self.lock = asyncio.Lock()
    
    async def get_session(self, call_id: str) -> AmharicAIAssistant:
        """
        Get session for a specific call.
        For Multi-Worker scaling, we treat this as stateless:
        Always create a fresh instance and load latest state from DB.
        """
        if not call_id:
            call_id = "default_session"
            
        # Create fresh instance
        assistant = AmharicAIAssistant(call_id)
        
        # Ensure session exists in DB
        await conversation_db.create_session(call_id)
        
        # Load latest history (syncs state across workers)
        await assistant.load_from_db()
        
        return assistant
    
    async def end_session(self, call_id: str):
        """Clean up session when call ends"""
        async with self.lock:
            if call_id in self.sessions:
                # Mark as completed in DB
                await conversation_db.end_session(call_id)
                del self.sessions[call_id]
                logger.info(f"🗑️ Ended session: {call_id}")

# Initialize Session Manager (Replaces single global instance)
session_manager = SessionManager()

# Enhanced response system with both predefined and dynamic responses
AMHARIC_RESPONSES = {
    "ሰላም": "ሰላም፣ ጂኤም ፈርኒቸር ነው። እንዴት ልረዳዎ?",
    "እንዴት ነህ": "ደህና ነኝ እናመሰግናለሁ! እርስዎስ እንዴት ነዎት?",
    "እንዴት ነሽ": "ደህና ነኝ እናመሰግናለሁ! እርስዎስ እንዴት ነዎት?", 
    "እንዴት ነዎት": "ደህና ነኝ እናመሰግናለሁ! እርስዎስ እንዴት ነዎት?",
    "መረጃ": "በምን መረጃ ልረዳዎት? እባክዎ ይንገሩኝ።",
    "ረዳኝ": "በመቶ ደስታ! በምን ልረዳዎት?",
    "ማን ነህ": "እኔ አልማዝ ነኝ። የጂኤም ፈርኒቸር የደንበኞች አገልግሎት ተወካይ ነኝ።",
    "ማን ነሽ": "እኔ አልማዝ ነኝ። የጂኤም ፈርኒቸር የደንበኞች አገልግሎት ተወካይ ነኝ።",
    "አመሰግናለሁ": "ምንም አይደለም! ሌላ ነገር ካለ ይንገሩኝ።",
    "ይቅርታ": "ምንም ችግር የለም። በምን ልረዳዎት?",
    "default": "ይቅርታ፣ ጥያቄዎን ትንሽ እንደገና ይግለጹልኝ?"
}


# Twilio Voice Map for Multilingual Fallback and STT Configuration
TWILIO_VOICE_MAP = {
    "amharic": {"voice": "Polly.Zeina", "lang": "ar-EG", "stt": "am-ET"}, # Best approximation for Amharic
    "english": {"voice": "Polly.Joanna", "lang": "en-US", "stt": "en-US"},
    "spanish": {"voice": "Polly.Conchita", "lang": "es-ES", "stt": "es-ES"},
    "french": {"voice": "Polly.Celine", "lang": "fr-FR", "stt": "fr-FR"}
}

def create_enhanced_twiml_with_audio(text: str, audio_url: Optional[str] = None, lang_name: str = "amharic") -> str:
    """Create TwiML with audio file or enhanced voice settings for specific language"""
    # Get Twilio voice settings for this language
    voice_config = TWILIO_VOICE_MAP.get(lang_name.lower(), TWILIO_VOICE_MAP["amharic"])
    voice = voice_config["voice"]
    lang_code = voice_config["lang"]
    stt_code = voice_config["stt"]
    
    if audio_url:
        # Use generated audio file
        return f'''<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>{audio_url}</Play>
    <Gather input="speech dtmf" timeout="15" speechTimeout="3" finishOnKey="#" action="/handle-input" method="POST" language="{stt_code}" speechModel="experimental_conversations">
        <Say voice="{voice}" language="{lang_code}" rate="0.8">...</Say>
    </Gather>
</Response>'''
    else:
        # Enhanced Twilio TTS fallback
        return f'''<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="{voice}" language="{lang_code}" rate="0.9">{text}</Say>
    <Gather input="speech dtmf" timeout="15" speechTimeout="3" finishOnKey="#" action="/handle-input" method="POST" language="{stt_code}" speechModel="experimental_conversations">
        <Say voice="{voice}" language="{lang_code}" rate="0.9">...</Say>
    </Gather>
</Response>'''

def get_response(user_input: str, assistant: AmharicAIAssistant) -> Tuple[str, str]:
    """
    Get response — AI+RAG first, predefined only as emergency fallback.
    This ensures substantive questions (prices, products, etc.) always reach the AI.
    """
    if not user_input:
        return AMHARIC_RESPONSES["default"], "amharic"
    
    # ALWAYS use AI for dynamic responses (AI has the RAG knowledge base)
    try:
        ai_response = assistant.generate_response(user_input)
        if ai_response:
            # Detect response language from content
            lang = assistant.detected_language or "amharic"
            
            # Check if the response actually contains Amharic script (override if so)
            if any(ord(char) >= 0x1200 and ord(char) <= 0x137F for char in ai_response):
                lang = "amharic"
            elif any(ord(char) >= 0x0600 and ord(char) <= 0x06FF for char in ai_response):
                lang = "amharic"  # Arabic script treated as Amharic
                
            return ai_response, lang
    except Exception as e:
        logger.error(f"❌ AI response failed: {e}")
    
    # Emergency fallback: predefined responses (only if AI completely fails)
    user_input_clean = user_input.strip().lower()
    for key, response in AMHARIC_RESPONSES.items():
        if key == "default":
            continue
        if key in user_input_clean:
            return response, "amharic"
    
    return AMHARIC_RESPONSES["default"], "amharic"

# Add favicon route to prevent 404 errors
@app.get("/favicon.ico")
async def favicon():
    return Response(content="", media_type="image/x-icon")

@app.get("/")
async def root():
    """Health check"""
    return {
        "status": "online",
        "service": "Natural Amharic AI Call System",
        "agent": "Almaz - Ethiopian Customer Service",
        "tts_methods": ["Enhanced Google TTS", "OpenAI TTS", "Enhanced Twilio"],
        "groq": groq_client is not None
    }

@app.post("/incoming-call")
async def handle_incoming_call(
    request: Request,
    From: Optional[str] = Form(None),
    To: Optional[str] = Form(None),
    uuid: Optional[str] = Form(None),
    caller_id: Optional[str] = Form(None)
):
    """Handle incoming calls (SIP or Twilio) with natural Amharic voice"""
    try:
        # Normalize parameters (FreeSWITCH sends caller_id/uuid, Twilio sends From/CallSid)
        call_uuid = uuid or request.headers.get('X-Twilio-CallSid') or f"sim-{hashlib.md5(str(datetime.now()).encode()).hexdigest()[:8]}"
        caller = caller_id or From or "unknown"
        target = To or "system"
        route = route_manager.get_active_route()
        
        # logger.info(f"📞 Incoming call received | UUID: {call_uuid} | From: {caller} | Route: {route}")
        logger.info(f"📞 Incoming call received | UUID: {call_uuid} | From: {caller} | Route: {route}")
        
        # Log call start to DB
        try:
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute(
                        '''INSERT INTO call_logs (call_id, route, caller_number, start_time, status) 
                       VALUES (?, ?, ?, ?, ?)''',
                    (call_uuid, route, caller, datetime.now(), 'ringing')
                )
                conn.commit()
        except Exception as db_err:
            logger.error(f"Failed to log call start: {db_err}")
        
        welcome_text = "ሰላም፣ ጂኤም ፈርኒቸር ነው። እንዴት ልረዳዎ?"
        
        # Generate natural voice audio (Welcome is always Amharic)
        audio_url = await generate_multilingual_voice(welcome_text, "amharic")
        
        if audio_url:
            # Use full URL for Twilio - try to get actual ngrok URL
            base_url = os.getenv('BASE_URL', '')
            if not base_url or 'your-ngrok-url' in base_url:
                # Try to get from ngrok API
                try:
                    async with httpx.AsyncClient() as client:
                        ngrok_response = await client.get('http://localhost:4040/api/tunnels', timeout=2)
                        if ngrok_response.status_code == 200:
                            tunnels = ngrok_response.json()
                            if tunnels.get('tunnels'):
                                base_url = tunnels['tunnels'][0]['public_url']
                except:
                    base_url = 'https://your-ngrok-url.ngrok.io'
            
            # Retrieve session
            assistant = await session_manager.get_session(call_uuid)
            
            # Use assistant to generate welcome if needed (or just static)
            # For now, welcome is static, but we ensure session is created
            
            full_audio_url = f"{base_url}{audio_url}"
            twiml = create_enhanced_twiml_with_audio(welcome_text, full_audio_url, "amharic")
            logger.info(f"✅ Using natural Amharic audio: {audio_url}")
        else:
            # Fallback to enhanced Twilio voice
            twiml = create_enhanced_twiml_with_audio(welcome_text, lang_name="amharic")
            logger.info("✅ Using enhanced Twilio voice")
        
        return Response(content=twiml, media_type="application/xml; charset=utf-8")
        
    except Exception as e:
        logger.error(f"❌ Error in incoming call: {e}")
        
        error_twiml = '''<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Zeina" language="ar-EG" rate="0.8">ይቅርታ፣ ቴክኒካል ችግር ተፈጥሯል። እባክዎ ቆይተው ይደውሉ።</Say>
</Response>'''

        return Response(content=error_twiml, media_type="application/xml; charset=utf-8")

async def repair_amharic_transcription(text: str) -> str:
    """
    Lightweight LLM pass to repair Whisper's common Amharic phonetic mistakes.
    Uses a fast small model to minimize latency.
    """
    if not groq_client or len(text) < 3:
        return text
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",  # Fast, cheap model
            messages=[{
                "role": "system",
                "content": (
                    "You are an Amharic text repair tool. Fix phonetic spelling mistakes in Amharic text "
                    "that was produced by a speech recognition system. The text may contain English words "
                    "mixed in (code-switching is normal). Only fix obvious character substitutions. "
                    "Return ONLY the corrected text, nothing else.\n"
                    "Examples:\n"
                    "Input: 'ሶፋ 45K savings' → Output: 'ሶፋ 45,000 ብር'\n"
                    "Input: 'ወምበር' → Output: 'ወንበር'\n"
                    "Input: 'አልጋ price' → Output: 'አልጋ ዋጋ'"
                )
            }, {
                "role": "user", 
                "content": text
            }],
            max_tokens=200,
            temperature=0.0
        )
        repaired = response.choices[0].message.content.strip()
        if repaired and repaired != text:
            logger.info(f"🔧 LLM repair: '{text}' → '{repaired}'")
        return repaired or text
    except Exception as e:
        logger.error(f"⚠️ LLM repair failed: {e}")
        return text  # Fail gracefully — return original

@app.post("/handle-input")
async def handle_input(
    request: Request,
    SpeechResult: Optional[str] = Form(None),
    RecordingUrl: Optional[str] = Form(None),
    CallSid: Optional[str] = Form(None),
    AudioFile: UploadFile = File(None)
):
    """
    Handle user input (Text, Twilio Recording, or Direct Audio File)
    """
    # Identify Call ID (Twilio uses CallSid, Web uses Form param or Header)
    call_id = CallSid or request.headers.get("X-Call-ID") or "web-session"
    start_time = time.time()
    
    # Get isolated session for this call
    assistant = await session_manager.get_session(call_id)
    
    detect_lang = "amharic"
    user_input = ""

    # 1. Direct Audio File (Web Tool Universal Mode)
    if AudioFile:
        user_input, detect_lang = await assistant.transcribe_audio(AudioFile)

    # 2. Twilio/Web Text Input
    elif SpeechResult:
        user_input = SpeechResult
    
    # 3. Twilio Recording URL
    elif RecordingUrl:
        user_input = f"Voice recording received: {RecordingUrl}"
    
    else:
        # No input
        pass

    # Normalize Amharic characters right away (e.g. ሐ -> ሀ)
    if user_input:
        user_input = normalize_amharic(user_input)

    logger.info(f"📩 Received Input: {user_input}")

    if not user_input:
        # Fallback for silence or failed transcription
        retry_msg = get_polite_retry()
        logger.info(f"🔇 Empty transcription — polite retry: {retry_msg}")
        audio_url = await generate_multilingual_voice(retry_msg, "amharic")
        if audio_url:
            base_url = os.getenv('BASE_URL', '')
            if not base_url or 'your-ngrok-url' in base_url:
                try:
                    async with httpx.AsyncClient() as client:
                        ngrok_resp = await client.get('http://localhost:4040/api/tunnels', timeout=2)
                        if ngrok_resp.status_code == 200:
                            tunnels = ngrok_resp.json()
                            if tunnels.get('tunnels'):
                                base_url = tunnels['tunnels'][0]['public_url']
                except:
                    base_url = 'https://your-ngrok-url.ngrok.io'
            full_audio_url = f"{base_url}{audio_url}"
            twiml = create_enhanced_twiml_with_audio(retry_msg, full_audio_url, "amharic")
        else:
            twiml = create_enhanced_twiml_with_audio(retry_msg, lang_name="amharic")
        return Response(content=twiml, media_type="application/xml; charset=utf-8")

    # === GARBAGE DETECTION: Catch bad Whisper output before it reaches the AI ===
    if is_garbage_transcription(user_input):
        retry_msg = get_polite_retry()
        logger.info(f"🗑️ Garbage transcription intercepted — polite retry: {retry_msg}")
        audio_url = await generate_multilingual_voice(retry_msg, "amharic")
        if audio_url:
            base_url = os.getenv('BASE_URL', '')
            if not base_url or 'your-ngrok-url' in base_url:
                try:
                    async with httpx.AsyncClient() as client:
                        ngrok_resp = await client.get('http://localhost:4040/api/tunnels', timeout=2)
                        if ngrok_resp.status_code == 200:
                            tunnels = ngrok_resp.json()
                            if tunnels.get('tunnels'):
                                base_url = tunnels['tunnels'][0]['public_url']
                except:
                    base_url = 'https://your-ngrok-url.ngrok.io'
            full_audio_url = f"{base_url}{audio_url}"
            twiml = create_enhanced_twiml_with_audio(retry_msg, full_audio_url, "amharic")
        else:
            twiml = create_enhanced_twiml_with_audio(retry_msg, lang_name="amharic")
        return Response(content=twiml, media_type="application/xml; charset=utf-8")

    # === LLM POST-CORRECTION: Fix spelling mistakes before processing ===
    user_input = await repair_amharic_transcription(user_input)

    # 4. START LOGGING: Save User Input
    if call_id:
        asyncio.create_task(assistant.db.save_message(
            call_id, "user", user_input, detect_lang
        ))

    # === STAGE 7: Record user turn in call session (for dashboard) ===
    caller = request.headers.get("X-Caller-ID") or "SIP User"
    call_rec = get_call_session(call_id, caller)
    call_rec.add_user_turn(user_input)

    # Generate response and detect language
    response, lang = get_response(user_input, assistant)
    logger.info(f"✅ Generated {lang} response: {response}")

    # 5. LOGGING: Save Assistant Response
    if call_id:
        asyncio.create_task(assistant.db.save_message(
            call_id, "assistant", response, lang
        ))

    # === STAGE 7: Record AI response turn in call session ===
    call_rec.add_ai_turn(response)
    # Save transcript file in background (non-blocking)
    # NOTE: run_in_executor() already returns a Future that starts running immediately;
    # wrapping it in create_task() raises "a coroutine was expected, got <Future>".
    asyncio.get_event_loop().run_in_executor(None, call_rec.save)
    
    # Try to generate natural voice with correct language
    audio_url = await generate_multilingual_voice(response, lang, call_id=call_id) # Await the async function
    
    elapsed = time.time() - start_time
    if call_id:
        asyncio.create_task(metrics.record_response_time(call_id, elapsed))
        # Report to Dashboard (National Scale Integration)
        asyncio.create_task(dashboard_reporter.report_call_end(
            call_id, elapsed * 1000, elapsed * 1000
        ))
    
    if audio_url:
        full_audio_url = f"{str(request.base_url).rstrip('/')}{audio_url}"
        twiml = create_enhanced_twiml_with_audio(response, full_audio_url, lang)
        logger.info(f"✅ Using natural {lang} audio: {audio_url}")
    else:
        twiml = create_enhanced_twiml_with_audio(response, lang_name=lang)
        logger.info(f"✅ Using enhanced Twilio voice for {lang}")
    
    return Response(content=twiml, media_type="application/xml; charset=utf-8")


# --- Stage 4: Streaming TTS Endpoint ---

def split_into_sentences(text: str) -> list[str]:
    """
    Split AI response into natural sentences for streaming TTS.
    Handles Amharic (። ፤ ፣) and English (. ! ?) punctuation.
    """
    if not text:
        return []
    # Split on Amharic/English sentence boundaries
    import re
    # Sentence boundary pattern: Amharic ። and ፤, English . ! ?
    sentences = re.split(r'(?<=[።፤?!.])\s+|(?<=\.\.\.\s)', text)
    # Filter empties, strip whitespace
    sentences = [s.strip() for s in sentences if s.strip() and len(s.strip()) > 2]
    # If no split happened, return whole text as one sentence
    return sentences if sentences else [text]

@app.post("/stream-response")
async def stream_response(
    request: Request,
    audio_file: UploadFile = File(None),
    call_id: str = Form(None)
):
    """
    Stage 4: Streaming TTS endpoint.
    1. Transcribe audio with Whisper-1
    2. Generate GPT-4o response
    3. Split into sentences
    4. Generate TTS audio per sentence
    5. Return JSON list of audio URLs for Lua to play sentence-by-sentence
    """
    start_time = time.time()
    call_id = call_id or request.headers.get("X-Call-ID") or "stream-session"

    try:
        # === Step 1: Transcribe ===
        if not audio_file:
            return JSONResponse({"error": "No audio"}, status_code=400)

        assistant = await session_manager.get_session(call_id)
        user_text, detected_lang = await assistant.transcribe_audio(audio_file)

        if not user_text or is_garbage_transcription(user_text):
            retry_msg = get_polite_retry()
            # Return single sentence for retry
            audio_url = await generate_multilingual_voice(retry_msg, "amharic", call_id=call_id)
            return JSONResponse({
                "transcript": "",
                "response": retry_msg,
                "sentences": [{"text": retry_msg, "audio_url": audio_url}],
                "latency_stt": round(time.time() - start_time, 2)
            })

        user_text = normalize_amharic(user_text)
        user_text = await repair_amharic_transcription(user_text)
        logger.info(f"🎤 Stream STT [{detected_lang}]: {user_text}")

        # Track in call session
        caller = request.headers.get("X-Caller-ID", "SIP User")
        call_rec = get_call_session(call_id, caller)
        call_rec.add_user_turn(user_text)

        # Save to DB
        asyncio.create_task(assistant.db.save_message(call_id, "user", user_text, detected_lang))

        # === Step 2: Generate full response ===
        response_text, lang = get_response(user_text, assistant)
        logger.info(f"🤖 Stream response [{lang}]: {response_text}")

        # Track AI turn
        call_rec.add_ai_turn(response_text)
        # NOTE: run_in_executor() already returns a Future that starts running immediately;
        # wrapping it in create_task() raises "a coroutine was expected, got <Future>".
        asyncio.get_event_loop().run_in_executor(None, call_rec.save)
        asyncio.create_task(assistant.db.save_message(call_id, "assistant", response_text, lang))

        # === Step 3: Split into sentences ===
        sentences = split_into_sentences(response_text)
        logger.info(f"📝 Split into {len(sentences)} sentence(s) for streaming")

        # === Step 4: Generate TTS per sentence (parallel) ===
        async def gen_sentence_audio(sentence: str, idx: int) -> dict:
            audio_url = await generate_multilingual_voice(sentence, lang, call_id=f"{call_id}_s{idx}")
            return {"text": sentence, "audio_url": audio_url}

        sentence_tasks = [gen_sentence_audio(s, i) for i, s in enumerate(sentences)]
        sentence_results = await asyncio.gather(*sentence_tasks)

        # Filter out failed TTS
        valid_sentences = [r for r in sentence_results if r.get("audio_url")]

        elapsed = time.time() - start_time
        asyncio.create_task(metrics.record_response_time(call_id, elapsed))
        asyncio.create_task(dashboard_reporter.report_call_end(call_id, elapsed * 1000, elapsed * 1000))

        logger.info(f"⚡ Stream response ready in {elapsed:.2f}s — {len(valid_sentences)} audio chunks")

        return JSONResponse({
            "call_id": call_id,
            "transcript": user_text,
            "response": response_text,
            "language": lang,
            "sentences": valid_sentences,
            "sentence_count": len(valid_sentences),
            "latency_total": round(elapsed, 2)
        })

    except Exception as e:
        logger.error(f"❌ Stream response error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

# --- Dashboard API Endpoints ---

DASHBOARD_API_KEY = os.getenv('DASHBOARD_API_KEY', 'default-secret-key')
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def get_api_key(api_key_header: str = Security(api_key_header)):
    if api_key_header == DASHBOARD_API_KEY:
        return api_key_header
    raise HTTPException(status_code=403, detail="Could not validate credentials")

@app.get("/api/dashboard/status", dependencies=[Depends(get_api_key)])
async def get_dashboard_status():
    """Get overall system status"""
    try:
        active_route = route_manager.get_active_route()
        sip_health = await health_monitor.check_sip_health()
        
        return {
            "status": "healthy",
            "active_route": active_route,
            "sip_bridge_status": "online" if sip_health else "offline",
            "twilio_status": "online",  # Assume healthy
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Status check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/dashboard/failover", dependencies=[Depends(get_api_key)])
async def trigger_failover(
    target_route: str = Form(...),
    reason: str = Form(...),
    user: str = Form("admin")
):
    """Manually trigger failover"""
    try:
        if target_route not in ['sip_bridge', 'twilio']:
            raise HTTPException(status_code=400, detail="Invalid route")
            
        route_manager.set_active_route(target_route, reason, f"user:{user}")
        
        # Send alert
        await alert_manager.send_alert(
            subject=f"Manual Failover Triggered: Switched to {target_route}",
            message=f"User {user} triggered failover to {target_route}.\nReason: {reason}"
        )
        
        return {
            "success": True,
            "message": f"Switched to {target_route}",
            "route": target_route
        }
    except Exception as e:
        logger.error(f"Failover trigger failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard/metrics", dependencies=[Depends(get_api_key)])
async def get_metrics():
    """Get call metrics"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get today's stats
            today = datetime.now().date().isoformat()
            cursor.execute("SELECT count(*) FROM call_logs WHERE date(start_time) = ?", (today,))
            total_calls = cursor.fetchone()[0]
            
            cursor.execute("SELECT count(*) FROM call_logs WHERE date(start_time) = ? AND status = 'failed'", (today,))
            failed_calls = cursor.fetchone()[0]
            
            return {
                "period": "today",
                "total_calls": total_calls,
                "failed_calls": failed_calls,
                "success_rate": round((1 - (failed_calls/total_calls if total_calls > 0 else 0)) * 100, 1)
            }
    except Exception as e:
        logger.error(f"Metrics fetch failed: {e}")
        return {"error": str(e)}

@app.post("/api/dashboard/test-alert", dependencies=[Depends(get_api_key)])
async def test_alert(email: str = Form(...)):
    """Test email alert system"""
    try:
        await alert_manager.send_alert(
            subject="🧪 Test Alert: System Notification Test",
            message=f"This is a test alert requested for {email}. System is functioning correctly."
        )
        return {"success": True, "message": f"Test alert sent to recipients"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# --- Stage 7: Call Recordings API (for Client Dashboard) ---

@app.get("/api/calls", dependencies=[Depends(get_api_key)])
async def get_calls():
    """
    Returns list of all recorded calls with transcripts.
    Used by both dashboards (end point custom + system dashboard).
    """
    recordings_path = Path("recordings")
    recordings_path.mkdir(exist_ok=True)
    calls = []

    # Read all saved transcript files
    for txt_file in sorted(recordings_path.glob("*.txt"), reverse=True):
        try:
            call_id = txt_file.stem
            lines = txt_file.read_text(encoding="utf-8").splitlines()
            # Parse header
            caller = "Unknown"
            date_str = txt_file.stat().st_mtime
            transcript_lines = []
            in_body = False
            for line in lines:
                if line.startswith("Caller: "):
                    caller = line.replace("Caller: ", "").strip()
                elif line.startswith("Date: "):
                    try:
                        date_str = line.replace("Date: ", "").strip()
                    except: pass
                elif line.startswith("="):
                    in_body = True
                elif in_body and line.strip():
                    if line.startswith("[USER]: "):
                        transcript_lines.append({"speaker": "user", "text": line[8:].strip()})
                    elif line.startswith("[ASSISTANT]: "):
                        transcript_lines.append({"speaker": "assistant", "text": line[13:].strip()})
            size_kb = txt_file.stat().st_size // 1024
            summary = transcript_lines[-1]["text"][:120] if transcript_lines else ""
            calls.append({
                "id": call_id, "call_sid": call_id,
                "customer": caller, "agent": "Almaz (AI)",
                "type": "voice",
                "date": date_str if isinstance(date_str, str) else datetime.fromtimestamp(date_str).isoformat(),
                "timestamp": date_str if isinstance(date_str, str) else datetime.fromtimestamp(date_str).isoformat(),
                "duration": round(len(transcript_lines) * 0.5, 1),
                "transcript": transcript_lines,
                "transcript_url": f"/recordings/{call_id}.txt",
                "audio_url": None,
                "summary": summary,
                "size": f"{size_kb}KB"
            })
        except Exception as e:
            logger.warning(f"Could not parse recording {txt_file}: {e}")

    return JSONResponse(calls)

@app.get("/api/calls/{call_id}/recording")
async def get_call_recording(call_id: str):
    """Serve call transcript as downloadable text file."""
    txt_path = Path(f"recordings/{call_id}.txt")
    if txt_path.exists():
        return FileResponse(txt_path, media_type="text/plain", filename=f"transcript_{call_id}.txt")
    raise HTTPException(status_code=404, detail="Recording not found")

# --- Pull Integration Endpoints (Dashboard -> Agent) ---

@app.get("/api/agent/info")
async def get_agent_info():
    """Public endpoint for agent discovery - returns basic info"""
    return {
        "id": "amharic-ai-agent-1",
        "name": "Amharic AI Agent",
        "type": "Multilingual Support",
        "version": "2.0.0",
        "description": "Ethiopian call center AI with Amharic/English support",
        "status": "online",
        "capabilities": ["voice", "multilingual", "real-time"],
        "requiresAuth": True
    }

@app.get("/api/agent/details", dependencies=[Depends(get_api_key)])
async def get_agent_details():
    """Return detailed configuration and status"""
    return {
        "id": "amharic-ai-agent-1",
        "name": "Amharic AI Agent",
        "type": "Multilingual Support",
        "version": "2.0.0",
        "workers": 4,
        "database": {
            "path": DB_PATH,
            "size_mb": os.path.getsize(DB_PATH) / (1024 * 1024) if os.path.exists(DB_PATH) else 0
        },
        "configuration": {
            "groq_model": "llama-3.3-70b-versatile",
            "tts_primary": "Google TTS",
            "tts_fallback": "OpenAI TTS"
        }
    }

@app.get("/api/agent/conversations", dependencies=[Depends(get_api_key)])
async def get_recent_conversations(limit: int = 50):
    """Return recent conversation logs"""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM call_logs ORDER BY start_time DESC LIMIT ?",
                (limit,)
            ) as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Failed to fetch conversations: {e}")
        return []

@app.get("/api/agent/metrics", dependencies=[Depends(get_api_key)])
async def get_detailed_metrics(range: str = "day"):
    """
    Return performance metrics and trend data for a specific timeframe.
    Supported ranges: hour, day, week, month
    """
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            
            # Define time interval and format based on range
            if range == "hour":
                since = "-1 hour"
                group_by = "%H:%M"
            elif range == "day":
                since = "-24 hours"
                group_by = "%H:00"
            elif range == "week":
                since = "-7 days"
                group_by = "%Y-%m-%d"
            elif range == "month":
                since = "-30 days"
                group_by = "%Y-%m-%d"
            else:
                since = "-24 hours"
                group_by = "%H:00"

            # 1. Broad Metrics
            # automation_count: calls with no transfers. resolution: avg duration
            async with db.execute(
                """
                SELECT 
                    COUNT(*) as total_calls,
                    AVG(duration) as avg_duration,
                    SUM(CASE WHEN transfer_count = 0 THEN 1 ELSE 0 END) as automation_count
                FROM call_logs 
                WHERE start_time > datetime('now', ?)
                """, (since,)
            ) as cursor:
                row = await cursor.fetchone()
                total_calls = row["total_calls"] or 0
                avg_duration = row["avg_duration"] or 0
                automation_count = row["automation_count"] or 0
                automation_rate = (automation_count / total_calls * 100) if total_calls > 0 else 0

            # 2. Trend Data for Charts
            async with db.execute(
                f"""
                SELECT strftime('{group_by}', start_time) as time_label, 
                       COUNT(*) as call_count,
                       AVG(duration) as avg_res
                FROM call_logs 
                WHERE start_time > datetime('now', ?)
                GROUP BY time_label ORDER BY time_label ASC
                """, (since,)
            ) as cursor:
                trend_rows = await cursor.fetchall()
                trend_data = [
                    {
                        "time": row["time_label"], 
                        "calls": row["call_count"],
                        "resolution": round(row["avg_res"] / 60, 2) if row["avg_res"] else 0
                    } for row in trend_rows
                ]

            return {
                "summary": {
                    "totalCalls": total_calls,
                    "avgResolution": f"{int(avg_duration // 60)}m {int(avg_duration % 60)}s",
                    "automationRate": f"{int(automation_rate)}%",
                    "satisfaction": "4.8/5.0" # Mocked for now
                },
                "trend": trend_data
            }
    except Exception as e:
        logger.error(f"Failed to fetch metrics: {e}")
        return {"summary": {}, "trend": []}

if __name__ == "__main__":
    print("Starting Natural Amharic AI Call System...")
    print("Multiple TTS methods available:")
    print("   1. Enhanced Google Translate TTS (works immediately)")
    print("   2. OpenAI TTS (if API key provided)")
    print("   3. Enhanced Twilio voice settings")
    print("Agent: Almaz - Ethiopian Customer Service")
    print("Server: http://localhost:8001")
    print("Webhook: /incoming-call")
    print("Handler: /handle-input")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001,
        log_level="info"
    )