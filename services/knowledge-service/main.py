from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import time
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Optional, List

app = FastAPI(title="Markova Knowledge Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/markova")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Helper function to get database connection with retries
def get_db_connection(retries=10, delay=3):
    for i in range(retries):
        try:
            conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
            return conn
        except Exception as e:
            print(f"Database connection attempt {i+1} failed. Retrying in {delay}s...")
            time.sleep(delay)
    raise Exception("Could not connect to PostgreSQL database")

# Test connection on startup
conn = get_db_connection()
conn.close()

class SourceCreate(BaseModel):
    name: str
    type: str  # upload, website, notion, sheets
    config: Optional[dict] = None

@app.post("/api/knowledge/sources")
async def create_source(source: SourceCreate, x_company_id: Optional[str] = Header(None), x_user_id: Optional[str] = Header(None)):
    if not x_company_id:
        raise HTTPException(status_code=400, detail="X-Company-ID header is required")
        
    import json
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO knowledge_sources (company_id, type, name, status, config)
                   VALUES (%s, %s, %s, 'active', %s)
                   RETURNING id, company_id, type, name, status, config, created_at""",
                (x_company_id, source.type, source.name, json.dumps(source.config or {}))
            )
            new_source = cur.fetchone()
            
            # Create Audit Log
            cur.execute(
                """INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id)
                   VALUES (%s, %s, %s, %s, %s)""",
                (x_company_id, x_user_id, "KNOWLEDGE_SOURCE_CREATED", "knowledge_source", new_source["id"])
            )
            
            conn.commit()
            return new_source
    except Exception as e:
        conn.rollback()
        print("Create source error:", e)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        conn.close()

@app.get("/api/knowledge/sources")
async def list_sources(x_company_id: Optional[str] = Header(None)):
    if not x_company_id:
        raise HTTPException(status_code=400, detail="X-Company-ID header is required")
        
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, type, name, status, config, created_at FROM knowledge_sources WHERE company_id = %s ORDER BY name ASC",
                (x_company_id,)
            )
            sources = cur.fetchall()
            return sources
    except Exception as e:
        print("List sources error:", e)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        conn.close()

@app.post("/api/knowledge/upload")
async def upload_document(
    source_id: str = Form(...),
    file: UploadFile = File(...),
    x_company_id: Optional[str] = Header(None)
):
    if not x_company_id:
        raise HTTPException(status_code=400, detail="X-Company-ID header is required")
        
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Verify source ownership
            cur.execute(
                "SELECT id FROM knowledge_sources WHERE id = %s AND company_id = %s",
                (source_id, x_company_id)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Knowledge source not found or not owned by company")
                
            # Create unique file name and save to local storage
            file_extension = os.path.splitext(file.filename)[1]
            unique_filename = f"{source_id}_{int(time.time())}{file_extension}"
            file_path = os.path.join(UPLOAD_DIR, unique_filename)
            
            # Read and save file content
            content = await file.read()
            file_size = len(content)
            with open(file_path, "wb") as f:
                f.write(content)
                
            # Insert document record in DB
            cur.execute(
                """INSERT INTO knowledge_documents (source_id, file_name, file_path, file_size, status)
                   VALUES (%s, %s, %s, %s, 'uploaded')
                   RETURNING id, source_id, file_name, file_path, file_size, status, created_at""",
                (source_id, file.filename, file_path, file_size)
            )
            document = cur.fetchone()
            
            conn.commit()
            return document
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print("Upload document error:", e)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        conn.close()

@app.get("/api/knowledge/sources/{source_id}/documents")
async def list_documents(source_id: str, x_company_id: Optional[str] = Header(None)):
    if not x_company_id:
        raise HTTPException(status_code=400, detail="X-Company-ID header is required")
        
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Verify source ownership
            cur.execute(
                "SELECT id FROM knowledge_sources WHERE id = %s AND company_id = %s",
                (source_id, x_company_id)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Knowledge source not found or not owned by company")
                
            cur.execute(
                "SELECT id, file_name, file_size, status, created_at FROM knowledge_documents WHERE source_id = %s ORDER BY created_at DESC",
                (source_id,)
            )
            documents = cur.fetchall()
            return documents
    except Exception as e:
        print("List documents error:", e)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        conn.close()

@app.get("/health")
def health():
    return {"status": "OK", "service": "knowledge-service"}
