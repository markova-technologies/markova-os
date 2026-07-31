import asyncio
import os
import sys

from database import db
from commerce import commerce_repository

async def init_all():
    print("Initializing system.db (PostgreSQL)...")
    await db.init_schema()
    print("Initializing commerce.db (PostgreSQL)...")
    commerce_repository.init_db()
    
    # Just to confirm commerce works
    products = commerce_repository.search_products("")
    print(f"Found {len(products)} products in commerce DB.")
    print("Database initialization complete.")

if __name__ == "__main__":
    asyncio.run(init_all())
