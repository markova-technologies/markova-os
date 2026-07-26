#!/usr/bin/env python3
"""
Phase 4 — tenant isolation for knowledge vector search (Section 7.2).

Requires DATABASE_URL pointing at the Markova Postgres (with pgvector).
"""
from __future__ import annotations

import os
import sys
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "services", "knowledge-service"))


def main() -> int:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from embeddings import embed_text, vector_literal

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("DATABASE_URL is required", file=sys.stderr)
        return 2

    conn = psycopg2.connect(dsn, cursor_factory=RealDictCursor)
    cur = conn.cursor()

    a = str(uuid.uuid4())
    b = str(uuid.uuid4())
    secret = "tenant_a_unique_token_xyz"
    sa, sb = str(uuid.uuid4()), str(uuid.uuid4())
    da, dbid = str(uuid.uuid4()), str(uuid.uuid4())
    ca, cb = str(uuid.uuid4()), str(uuid.uuid4())

    try:
        cur.execute(
            "INSERT INTO companies (id, name, plan) VALUES (%s, 'IsoA', 'pro'), (%s, 'IsoB', 'pro')",
            (a, b),
        )
        cur.execute(
            """INSERT INTO knowledge_sources (id, company_id, type, name, status)
               VALUES (%s, %s, 'upload', 'A', 'active'), (%s, %s, 'upload', 'B', 'active')""",
            (sa, a, sb, b),
        )
        cur.execute(
            """INSERT INTO knowledge_documents (id, source_id, file_name, file_path, file_size, status)
               VALUES (%s, %s, 'a.txt', '/tmp/a', 10, 'uploaded'),
                      (%s, %s, 'b.txt', '/tmp/b', 10, 'uploaded')""",
            (da, sa, dbid, sb),
        )
        ea = vector_literal(embed_text(f"Company A hours: {secret}"))
        eb = vector_literal(embed_text("Company B hours: closed Sundays"))
        cur.execute(
            """INSERT INTO knowledge_chunks (id, document_id, content, company_id, embedding)
               VALUES (%s, %s, %s, %s, %s::vector), (%s, %s, %s, %s, %s::vector)""",
            (
                ca, da, f"Company A hours: {secret}", a, ea,
                cb, dbid, "Company B hours: closed Sundays", b, eb,
            ),
        )
        conn.commit()

        q = vector_literal(embed_text("hours open"))
        cur.execute(
            """
            SELECT kc.content FROM knowledge_chunks kc
            JOIN knowledge_documents kd ON kd.id = kc.document_id
            JOIN knowledge_sources ks ON ks.id = kd.source_id
            WHERE ks.company_id = %s AND kc.company_id = %s AND kc.embedding IS NOT NULL
            ORDER BY kc.embedding <=> %s::vector LIMIT 3
            """,
            (a, a, q),
        )
        rows_a = cur.fetchall()
        cur.execute(
            """
            SELECT kc.content FROM knowledge_chunks kc
            JOIN knowledge_documents kd ON kd.id = kc.document_id
            JOIN knowledge_sources ks ON ks.id = kd.source_id
            WHERE ks.company_id = %s AND kc.company_id = %s AND kc.embedding IS NOT NULL
            ORDER BY kc.embedding <=> %s::vector LIMIT 3
            """,
            (b, b, q),
        )
        rows_b = cur.fetchall()

        a_text = " ".join(r["content"] for r in rows_a)
        b_text = " ".join(r["content"] for r in rows_b)
        assert secret in a_text, f"Tenant A should retrieve its own chunk; got: {a_text!r}"
        assert secret not in b_text, f"Tenant B must NOT see Tenant A content; got: {b_text!r}"
        print("PASS: vector search tenant isolation (company_id enforced)")
        return 0
    finally:
        try:
            cur.execute("DELETE FROM companies WHERE id IN (%s, %s)", (a, b))
            conn.commit()
        except Exception:
            conn.rollback()
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
