from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import time
import asyncio
import asyncpg
from typing import Optional, List
import uuid
import structlog
import json

logger = structlog.get_logger()

from embeddings import embed_text, vector_literal, embedding_backend
from qdrant_adapter import QdrantAdapter

QDRANT_ENABLED = os.getenv("QDRANT_ENABLED", "true").lower() == "true"
qdrant_client = QdrantAdapter() if QDRANT_ENABLED else None

ALLOWED_EXTENSIONS = frozenset({
    '.txt', '.pdf', '.docx', '.doc', '.csv',
    '.md', '.json', '.xlsx', '.xls', '.odt'
})
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB hard limit

app = FastAPI(title="Markova Knowledge Service")

_ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if o.strip()
] or ["http://localhost:5173", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL must be set in the environment (no default password).")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

_db_pool: asyncpg.Pool | None = None

async def init_db_pool_async():
    global _db_pool
    for attempt in range(10):
        try:
            _db_pool = await asyncpg.create_pool(
                DATABASE_URL,
                min_size=2,
                max_size=10,
                command_timeout=30,
            )
            logger.info("knowledge_service_asyncpg_pool_ready")
            return
        except Exception as e:
            logger.error("db_pool_init_failed", attempt=attempt+1, error=str(e))
            await asyncio.sleep(3)
    raise RuntimeError("Could not initialize asyncpg pool after 10 attempts")

_embedding_queue: asyncio.Queue = asyncio.Queue()

async def embedding_worker_loop():
    """Background coroutine: embed newly uploaded document chunks."""
    while True:
        try:
            job = await asyncio.wait_for(_embedding_queue.get(), timeout=30)
            chunk_id = job["chunk_id"]
            content = job["content"]
            company_id = job["company_id"]
            
            # This is blocking, but fast enough. For better async, use run_in_executor
            embedding = embed_text(content)
            
            if embedding:
                try:
                    async with _db_pool.acquire() as conn:
                        await conn.execute(
                            "UPDATE knowledge_chunks SET embedding = $1::vector WHERE id = $2",
                            vector_literal(embedding), chunk_id
                        )
                        
                    if QDRANT_ENABLED:
                        payload = {
                            "chunk_id": str(chunk_id),
                            "content": content,
                            "company_id": str(company_id)
                        }
                        await qdrant_client.ensure_collection("knowledge_chunks")
                        await qdrant_client.upsert_point("knowledge_chunks", str(uuid.uuid4()), embedding, payload)
                        
                except Exception as e:
                    logger.error("write_embedding_failed", error=str(e))
        except asyncio.TimeoutError:
            continue
        except Exception as e:
            logger.error("embedding_worker_error", error=str(e))

@app.on_event("startup")
async def startup():
    await init_db_pool_async()
    asyncio.create_task(embedding_worker_loop())

@app.on_event("shutdown")
async def shutdown():
    if qdrant_client:
        await qdrant_client.close()
    if _db_pool:
        await _db_pool.close()

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
        
    try:
        async with _db_pool.acquire() as conn:
            async with conn.transaction():
                new_source = await conn.fetchrow(
                    """INSERT INTO knowledge_sources (company_id, type, name, status, config)
                       VALUES ($1, $2, $3, 'active', $4)
                       RETURNING id, company_id, type, name, status, config, created_at""",
                    uuid.UUID(x_company_id), source.type, source.name, json.dumps(source.config or {})
                )
                
                # Create Audit Log
                await conn.execute(
                    """INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id)
                       VALUES ($1, $2, $3, $4, $5)""",
                    uuid.UUID(x_company_id), 
                    uuid.UUID(user_id) if user_id else None, 
                    "KNOWLEDGE_SOURCE_CREATED", 
                    "knowledge_source", 
                    new_source["id"]
                )
                return dict(new_source)
    except Exception as e:
        logger.error("Create source error", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/knowledge/sources")
async def list_sources(
    x_company_id: Optional[str] = Header(None),
    x_tenant_id: Optional[str] = Header(None),
):
    x_company_id = company_id_from_headers(x_company_id, x_tenant_id)
        
    try:
        async with _db_pool.acquire() as conn:
            sources = await conn.fetch(
                "SELECT id, type, name, status, config, created_at FROM knowledge_sources WHERE company_id = $1 ORDER BY name ASC",
                uuid.UUID(x_company_id)
            )
            return [dict(s) for s in sources]
    except Exception as e:
        logger.error("List sources error", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

async def _store_document(source_id: str, file: UploadFile, x_company_id: str):
    # ── Security: validate file type and size ────────────────────────────────
    raw_ext = os.path.splitext(file.filename or "")[1].lower()
    if raw_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{raw_ext}' is not allowed. Permitted: {sorted(ALLOWED_EXTENSIONS)}"
        )

    content = await file.read()  # Read once
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File size {len(content):,} bytes exceeds the 50MB limit."
        )
    # ── End security validation ──────────────────────────────────────────────

    safe_filename = os.path.basename(file.filename or "unnamed").replace("..", "").replace("/", "").replace("\\\\", "")
                      
    try:
        async with _db_pool.acquire() as conn:
            # Check source ownership
            row = await conn.fetchrow(
                "SELECT id FROM knowledge_sources WHERE id = $1 AND company_id = $2",
                uuid.UUID(source_id), uuid.UUID(x_company_id)
            )
            if not row:
                raise HTTPException(status_code=404, detail="Knowledge source not found or not owned by company")

            unique_filename = f"{source_id}_{int(time.time())}{raw_ext}"
            file_path = os.path.join(UPLOAD_DIR, unique_filename)
            with open(file_path, "wb") as f:
                f.write(content)

            async with conn.transaction():
                document = await conn.fetchrow(
                    """INSERT INTO knowledge_documents (source_id, file_name, file_path, file_size, status)
                       VALUES ($1, $2, $3, $4, 'uploaded')
                       RETURNING id, source_id, file_name, file_path, file_size, status, created_at""",
                    uuid.UUID(source_id), safe_filename, file_path, len(content)
                )
                
                try:
                    text = content.decode("utf-8", errors="ignore")
                except Exception:
                    text = ""
                
                if text.strip():
                    body = text[:24000]
                    chunk_size = 1500
                    for i in range(0, len(body), chunk_size):
                        piece = body[i : i + chunk_size].strip()
                        if not piece:
                            continue
                        chunk_row = await conn.fetchrow(
                            """INSERT INTO knowledge_chunks (document_id, content, company_id)
                               VALUES ($1, $2, $3) RETURNING id""",
                            document["id"], piece, uuid.UUID(x_company_id),
                        )
                        chunk_id = chunk_row["id"]
                        _embedding_queue.put_nowait({
                            "chunk_id": chunk_id,
                            "content": piece,
                            "company_id": x_company_id
                        })
            return dict(document)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("upload_document_error", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

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
        
    try:
        async with _db_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id FROM knowledge_sources WHERE id = $1 AND company_id = $2",
                uuid.UUID(source_id), uuid.UUID(x_company_id)
            )
            if not row:
                raise HTTPException(status_code=404, detail="Knowledge source not found or not owned by company")
                
            documents = await conn.fetch(
                "SELECT id, file_name, file_size, status, created_at FROM knowledge_documents WHERE source_id = $1 ORDER BY created_at DESC",
                uuid.UUID(source_id)
            )
            return [dict(d) for d in documents]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("List documents error", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

class SearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 5

@app.post("/api/knowledge/search")
async def search_knowledge(
    body: SearchRequest,
    x_company_id: Optional[str] = Header(None),
    x_tenant_id: Optional[str] = Header(None),
):
    x_company_id = company_id_from_headers(x_company_id, x_tenant_id)
    q = (body.query or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="query is required")
    limit = max(1, min(body.limit or 5, 20))
    qvec = vector_literal(embed_text(q))

    try:
        rows = []
        if QDRANT_ENABLED:
            try:
                qdrant_results = await qdrant_client.search("knowledge_chunks", qvec, x_company_id, limit)
                for r in qdrant_results:
                    p = r.get("payload", {})
                    rows.append({
                        "chunk_id": p.get("chunk_id"),
                        "content": p.get("content"),
                        "file_name": p.get("file_name", "Unknown"),
                        "source_id": p.get("source_id", "Unknown"),
                        "source_name": p.get("source_name", "Unknown"),
                        "score": r.get("score")
                    })
            except Exception as e:
                logger.warning(f"Qdrant search failed, falling back to pgvector: {e}")
                
        if not rows:
            async with _db_pool.acquire() as conn:
                db_rows = await conn.fetch(
                    """
                    SELECT kc.id AS chunk_id, kc.content, kd.file_name,
                           ks.id AS source_id, ks.name AS source_name,
                           (1 - (kc.embedding <=> $1::vector)) AS score
                    FROM knowledge_chunks kc
                    JOIN knowledge_documents kd ON kd.id = kc.document_id
                    JOIN knowledge_sources ks ON ks.id = kd.source_id
                    WHERE ks.company_id = $2
                      AND kc.company_id = $2
                      AND kc.embedding IS NOT NULL
                    ORDER BY kc.embedding <=> $1::vector
                    LIMIT $3
                    """,
                    qvec, uuid.UUID(x_company_id), limit
                )
                rows = [dict(r) for r in db_rows]
                
                if not rows:
                    db_rows = await conn.fetch(
                        """
                        SELECT kc.id AS chunk_id, kc.content, kd.file_name,
                               ks.id AS source_id, ks.name AS source_name,
                               NULL::float AS score
                        FROM knowledge_chunks kc
                        JOIN knowledge_documents kd ON kd.id = kc.document_id
                        JOIN knowledge_sources ks ON ks.id = kd.source_id
                        WHERE ks.company_id = $1
                          AND kc.company_id = $1
                          AND kc.content ILIKE $2
                        ORDER BY kc.created_at DESC
                        LIMIT $3
                        """,
                        uuid.UUID(x_company_id), f"%{q}%", limit
                    )
                    rows = [dict(r) for r in db_rows]
                    
        return {
            "query": q,
            "tenant_id": x_company_id,
            "backend": "qdrant" if QDRANT_ENABLED and rows and rows[0].get("score") is not None else (embedding_backend()),
            "mode": "vector" if rows and rows[0].get("score") is not None else "keyword_fallback",
            "results": rows,
            "isolation": "company_id_enforced",
        }
    except Exception as e:
        logger.error("search_error", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/health")
def health():
    return {"status": "OK", "service": "knowledge-service", "embedding_backend": embedding_backend()}
