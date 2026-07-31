import os

with open("commerce.py", "r", encoding="utf-8") as f:
    content = f.read()

# Make it Postgres compatible by wrapping the original code
# with replacements

content = content.replace("import sqlite3", "import psycopg2\nimport psycopg2.extras")

# Replace connection
old_connect = """        connection = sqlite3.connect(self.db_path, timeout=15)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA busy_timeout=10000")"""
new_connect = """        import os
        db_url = os.environ.get("DATABASE_URL")
        connection = psycopg2.connect(db_url)
        # We need a wrapper to allow db.execute() and db.commit() like sqlite3
        class DBWrapper:
            def __init__(self, conn):
                self.conn = conn
            def execute(self, query, args=None):
                cursor = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
                if args is not None:
                    cursor.execute(query, args)
                else:
                    cursor.execute(query)
                return cursor
            def commit(self):
                self.conn.commit()
            def rollback(self):
                self.conn.rollback()
            def close(self):
                self.conn.close()
        connection = DBWrapper(connection)"""
content = content.replace(old_connect, new_connect)

content = content.replace("sqlite3.Connection", "Any")
content = content.replace("sqlite3.Row", "Any")

content = content.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
content = content.replace("AUTOINCREMENT", "SERIAL")

# Replace all ? with %s
# Need to be careful not to replace ? inside regular strings
import re
# Matches ? that are used as parameters (usually next to space, commas, or parentheses)
content = re.sub(r"([=\s\(\,])\?([\s\,\)\;])", r"\1%s\2", content)
content = re.sub(r"([=\s\(\,])\?([\s\,\)\;])", r"\1%s\2", content)

# Fix lastrowid
# Find the exact lines and replace them
insert_product = """                    "INSERT INTO commerce_products (sku, name_en, name_am, category, price, stock, aliases_json, active, created_at, updated_at) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
"""
old_insert_product = """                    "INSERT INTO commerce_products (sku, name_en, name_am, category, price, stock, aliases_json, active, created_at, updated_at) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
"""
content = content.replace(old_insert_product, insert_product)

insert_order_1 = """                cursor = db.execute(
                    "INSERT INTO commerce_orders (order_number, customer_phone, customer_name, delivery_address, total, status, payment_method, notes, created_at) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
"""
old_insert_order_1 = """                cursor = db.execute(
                    "INSERT INTO commerce_orders (order_number, customer_phone, customer_name, delivery_address, total, status, payment_method, notes, created_at) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
"""
content = content.replace(old_insert_order_1, insert_order_1)

insert_order_2 = """                cursor = db.execute(
                    "INSERT INTO commerce_orders (order_number, customer_phone, customer_name, delivery_address, "
                    "location_lat, location_lng, total, subtotal, delivery_fee, status, "
                    "payment_method, notes, created_at) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s, %s, %s) RETURNING id",
"""
old_insert_order_2 = """                cursor = db.execute(
                    "INSERT INTO commerce_orders (order_number, customer_phone, customer_name, delivery_address, "
                    "location_lat, location_lng, total, subtotal, delivery_fee, status, "
                    "payment_method, notes, created_at) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s, %s, %s)",
"""
content = content.replace(old_insert_order_2, insert_order_2)

content = content.replace("product_id = cursor.lastrowid", "product_id = cursor.fetchone()[0]")
content = content.replace("order_id = int(cursor.lastrowid)", "order_id = int(cursor.fetchone()[0])")
content = content.replace("order_id = cursor.lastrowid", "order_id = cursor.fetchone()[0]")

with open("commerce.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Migration done")
