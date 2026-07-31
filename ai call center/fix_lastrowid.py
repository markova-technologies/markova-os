import re

with open("commerce.py", "r", encoding="utf-8") as f:
    content = f.read()

# Fix 1: Product insertion
# Replace INSERT into commerce_products with RETURNING id
content = re.sub(
    r"(INSERT INTO commerce_products.*?VALUES \(.*?\) )", 
    r"\1 RETURNING id", 
    content, flags=re.DOTALL
)
# Update lastrowid extraction
content = content.replace("product_id = cursor.lastrowid", "product_id = cursor.fetchone()[0]")

# Fix 2: Order insertion
content = re.sub(
    r"(INSERT INTO commerce_orders.*?VALUES \(.*?\) )", 
    r"\1 RETURNING id", 
    content, flags=re.DOTALL
)
content = content.replace("order_id = int(cursor.lastrowid)", "order_id = int(cursor.fetchone()[0])")
content = content.replace("order_id = cursor.lastrowid", "order_id = cursor.fetchone()[0]")

# Save back
with open("commerce.py", "w", encoding="utf-8") as f:
    f.write(content)

print("lastrowid fixes applied.")
