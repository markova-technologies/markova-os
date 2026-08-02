from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import time
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Optional, List

from embeddings import embed_text, vector_literal, embedding_backend

app = FastAPI(title="Markova Knowledge Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL must be set in the environment (no default password).")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Helper function to get database connection with retries
def get_db_connection(retries=10, delay=3):
    for i in range(retries):
        try:
            conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
            return conn
        except Exception as e:
            print(f"Database connection attempt {i+1} failed: {e}")
            print(f"Retrying in {delay}s...")
            time.sleep(delay)
    raise Exception("Could not connect to PostgreSQL database")

# Test connection on startup
conn = get_db_connection()
conn.close()

class SourceCreate(BaseModel):
    name: str
    type: str  # upload, website, notion, sheets
    config: Optional[dict] = None

def company_id_from_headers(
    x_company_id: Optional[str] = None,
    x_tenant_id: Optional[str] = None,
) -> str:
    cid = x_company_id or x_tenant_id
    if not cid:
        raise HTTPException(status_code=400, detail="X-Company-ID or X-Tenant-ID header is required")
    return cid


def audit_user_id(x_user_id: Optional[str]) -> Optional[str]:
    """API-key auth uses synthetic user ids like 'api-key-auth' — do not insert as UUID."""
    if not x_user_id:
        return None
    import re
    if re.fullmatch(
        r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
        x_user_id,
        flags=re.I,
    ):
        return x_user_id
    return None


@app.post("/api/knowledge/sources")
async def create_source(
    source: SourceCreate,
    x_company_id: Optional[str] = Header(None),
    x_tenant_id: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None),
):
    x_company_id = company_id_from_headers(x_company_id, x_tenant_id)
    user_id = audit_user_id(x_user_id)
        
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
                (x_company_id, user_id, "KNOWLEDGE_SOURCE_CREATED", "knowledge_source", new_source["id"])
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
async def list_sources(
    x_company_id: Optional[str] = Header(None),
    x_tenant_id: Optional[str] = Header(None),
):
    x_company_id = company_id_from_headers(x_company_id, x_tenant_id)
        
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

async def _store_document(source_id: str, file: UploadFile, x_company_id: str):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM knowledge_sources WHERE id = %s AND company_id = %s",
                (source_id, x_company_id)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Knowledge source not found or not owned by company")

            file_extension = os.path.splitext(file.filename or "")[1]
            unique_filename = f"{source_id}_{int(time.time())}{file_extension}"
            file_path = os.path.join(UPLOAD_DIR, unique_filename)
            content = await file.read()
            with open(file_path, "wb") as f:
                f.write(content)

            cur.execute(
                """INSERT INTO knowledge_documents (source_id, file_name, file_path, file_size, status)
                   VALUES (%s, %s, %s, %s, 'uploaded')
                   RETURNING id, source_id, file_name, file_path, file_size, status, created_at""",
                (source_id, file.filename, file_path, len(content))
            )
            document = cur.fetchone()
            # Index plain-text chunks for tenant-scoped search (Phase 2 keyword)
            try:
                text = content.decode("utf-8", errors="ignore")
            except Exception:
                text = ""
            if text.strip():
                # Chunk ~1.5k chars for better retrieval; embed each chunk
                body = text[:24000]
                chunk_size = 1500
                for i in range(0, len(body), chunk_size):
                    piece = body[i : i + chunk_size].strip()
                    if not piece:
                        continue
                    emb = embed_text(piece)
                    cur.execute(
                        """INSERT INTO knowledge_chunks (document_id, content, company_id, embedding)
                           VALUES (%s, %s, %s, %s::vector)""",
                        (document["id"], piece, x_company_id, vector_literal(emb)),
                    )
            conn.commit()
            return document
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        print("Upload document error:", e)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        conn.close()


@app.post("/api/knowledge/upload")
async def upload_document(
    source_id: str = Form(...),
    file: UploadFile = File(...),
    x_company_id: Optional[str] = Header(None),
    x_tenant_id: Optional[str] = Header(None),
):
    return await _store_document(source_id, file, company_id_from_headers(x_company_id, x_tenant_id))


@app.post("/api/knowledge/sources/{source_id}/documents")
async def upload_document_for_source(
    source_id: str,
    file: UploadFile = File(...),
    x_company_id: Optional[str] = Header(None),
    x_tenant_id: Optional[str] = Header(None),
):
    return await _store_document(source_id, file, company_id_from_headers(x_company_id, x_tenant_id))

@app.get("/api/knowledge/sources/{source_id}/documents")
async def list_documents(
    source_id: str,
    x_company_id: Optional[str] = Header(None),
    x_tenant_id: Optional[str] = Header(None),
):
    x_company_id = company_id_from_headers(x_company_id, x_tenant_id)
        
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
    except HTTPException:
        raise
    except Exception as e:
        print("List documents error:", e)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        conn.close()


class SearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 5


@app.post("/api/knowledge/search")
async def search_knowledge(
    body: SearchRequest,
    x_company_id: Optional[str] = Header(None),
    x_tenant_id: Optional[str] = Header(None),
):
    """
    Tenant-scoped vector search (pgvector cosine distance).
    Hard company_id filter on every path — never search across companies.
    """
    x_company_id = company_id_from_headers(x_company_id, x_tenant_id)
    q = (body.query or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="query is required")
    limit = max(1, min(body.limit or 5, 20))
    qvec = vector_literal(embed_text(q))

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Vector path for embedded chunks
            cur.execute(
                """
                SELECT kc.id AS chunk_id, kc.content, kd.file_name,
                       ks.id AS source_id, ks.name AS source_name,
                       (1 - (kc.embedding <=> %s::vector)) AS score
                FROM knowledge_chunks kc
                JOIN knowledge_documents kd ON kd.id = kc.document_id
                JOIN knowledge_sources ks ON ks.id = kd.source_id
                WHERE ks.company_id = %s
                  AND kc.company_id = %s
                  AND kc.embedding IS NOT NULL
                ORDER BY kc.embedding <=> %s::vector
                LIMIT %s
                """,
                (qvec, x_company_id, x_company_id, qvec, limit),
            )
            rows = cur.fetchall()
            # Fallback: keyword for legacy chunks without embeddings
            if not rows:
                cur.execute(
                    """
                    SELECT kc.id AS chunk_id, kc.content, kd.file_name,
                           ks.id AS source_id, ks.name AS source_name,
                           NULL::float AS score
                    FROM knowledge_chunks kc
                    JOIN knowledge_documents kd ON kd.id = kc.document_id
                    JOIN knowledge_sources ks ON ks.id = kd.source_id
                    WHERE ks.company_id = %s
                      AND kc.company_id = %s
                      AND kc.content ILIKE %s
                    ORDER BY kc.created_at DESC
                    LIMIT %s
                    """,
                    (x_company_id, x_company_id, f"%{q}%", limit),
                )
                rows = cur.fetchall()
            return {
                "query": q,
                "tenant_id": x_company_id,
                "backend": embedding_backend(),
                "mode": "vector" if rows and rows[0].get("score") is not None else "keyword_fallback",
                "results": rows,
                "isolation": "company_id_enforced",
            }
    except Exception as e:
        print("Search error:", e)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        conn.close()


@app.get("/health")
def health():
    return {"status": "OK", "service": "knowledge-service", "embedding_backend": embedding_backend()}
