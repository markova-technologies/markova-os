import os
import asyncpg
import glob
import structlog

logger = structlog.get_logger()

async def run_pending_migrations(pool: asyncpg.Pool, migrations_dir: str):
    """Apply numbered SQL migration files that haven't been applied yet."""
    async with pool.acquire() as conn:
        lock_id = 99123456789
        got_lock = await conn.fetchval("SELECT pg_try_advisory_lock($1)", lock_id)
        if not got_lock:
            logger.info("migration_lock_busy", msg="Another instance is migrating. Skipping.")
            return
            
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version VARCHAR(50) PRIMARY KEY,
                    applied_at TIMESTAMP DEFAULT NOW()
                )
            """)
            applied_rows = await conn.fetch("SELECT version FROM schema_migrations")
            applied = set(r["version"] for r in applied_rows)
            
            files = sorted(glob.glob(os.path.join(migrations_dir, "*.sql")))
            for fpath in files:
                version = os.path.basename(fpath).replace(".sql", "")
                if version in applied:
                    continue
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        sql = f.read()
                    
                    async with conn.transaction():
                        await conn.execute(sql)
                        await conn.execute(
                            "INSERT INTO schema_migrations (version) VALUES ($1)", version
                        )
                    logger.info("migration_applied", version=version, file=fpath)
                except Exception as e:
                    logger.error("migration_failed", version=version, error=str(e))
                    raise e
        finally:
            await conn.execute("SELECT pg_advisory_unlock($1)", lock_id)
