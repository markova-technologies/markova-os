"""Transactional commerce storage for the Amharic voice-agent demo."""

from __future__ import annotations

import json
import os
import re
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional


ORDER_STATUSES = (
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
)

STATUS_TRANSITIONS = {
    "pending": {"confirmed", "cancelled"},
    "confirmed": {"processing", "cancelled"},
    "processing": {"shipped", "cancelled"},
    "shipped": {"delivered"},
    "delivered": set(),
    "cancelled": set(),
}

STATUS_AMHARIC = {
    "pending": "ማረጋገጫ በመጠበቅ ላይ",
    "confirmed": "ተረጋግጧል",
    "processing": "በዝግጅት ላይ",
    "shipped": "ለመላክ ወጥቷል",
    "delivered": "ደርሷል",
    "cancelled": "ተሰርዟል",
}

SEED_PRODUCTS = [
    {
        "sku": "MKV-PHONE-A15",
        "name_en": "Galaxy A15 Smartphone",
        "name_am": "ጋላክሲ A15 ስማርት ስልክ",
        "category": "electronics",
        "price": 18000,
        "stock": 12,
        "aliases": ["phone", "smartphone", "mobile", "ስልክ", "ሞባይል", "ስማርት ስልክ", "a15", "ጋላክሲ", "ስልካ", "ሞባይሌ", "ሞባይሌን", "ስልኬ", "ፎን", "ጋላክሴ", "ሳምሰንግ"],
    },
    {
        "sku": "MKV-EARBUDS-01",
        "name_en": "Wireless Earbuds",
        "name_am": "ገመድ አልባ የጆሮ ማዳመጫ",
        "category": "electronics",
        "price": 2500,
        "stock": 30,
        "aliases": ["earbuds", "earphone", "headphone", "የጆሮ ማዳመጫ", "ኢርበድ", "ገመድ አልባ", "ጆሮ", "ጆሮ ማዳመጫ", "ኢርፓድ", "airpod", "airpods", "ሄድፎን"],
    },
    {
        "sku": "MKV-POWER-20K",
        "name_en": "20,000mAh Power Bank",
        "name_am": "20,000 ሚሊአምፕ ፓወር ባንክ",
        "category": "electronics",
        "price": 2200,
        "stock": 25,
        "aliases": ["power bank", "powerbank", "charger", "ፓወር ባንክ", "ቻርጀር"],
    },
    {
        "sku": "MKV-WATCH-S2",
        "name_en": "S2 Smart Watch",
        "name_am": "S2 ስማርት ሰዓት",
        "category": "electronics",
        "price": 5500,
        "stock": 15,
        "aliases": ["smart watch", "smartwatch", "watch", "ስማርት ሰዓት", "ሰዓት", "ሶዓት", "ሳዓት", "ወደብ ሰዓት", "ዝናብ ሰዓት"],
    },
    {
        "sku": "MKV-SHOE-RUN",
        "name_en": "Everyday Running Shoes",
        "name_am": "የሩጫ ስፖርት ጫማ",
        "category": "fashion",
        "price": 3500,
        "stock": 20,
        "aliases": ["shoe", "shoes", "sneaker", "sneakers", "ጫማ", "ስፖርት ጫማ", "የሩጫ ጫማ"],
    },
    {
        "sku": "MKV-BAG-URBAN",
        "name_en": "Urban Laptop Backpack",
        "name_am": "የላፕቶፕ ቦርሳ",
        "category": "fashion",
        "price": 2800,
        "stock": 18,
        "aliases": ["bag", "backpack", "laptop bag", "ቦርሳ", "የላፕቶፕ ቦርሳ", "ቦርሳው"],
    },
    {
        "sku": "MKV-COFFEE-01",
        "name_en": "Electric Coffee Maker",
        "name_am": "ኤሌክትሪክ ቡና ማፍያ",
        "category": "home",
        "price": 4500,
        "stock": 10,
        "aliases": ["coffee maker", "coffee machine", "ቡና ማፍያ", "ቡና", "ማፍያ"],
    },
    {
        "sku": "MKV-BLENDER-02",
        "name_en": "Two-Speed Blender",
        "name_am": "ባለሁለት ፍጥነት ብሌንደር",
        "category": "home",
        "price": 3200,
        "stock": 14,
        "aliases": ["blender", "mixer", "ብሌንደር", "ማደባለቂያ"],
    },
    {
        "sku": "MKV-STAND-LAP",
        "name_en": "Adjustable Laptop Stand",
        "name_am": "ተስተካካይ የላፕቶፕ ማስቀመጫ",
        "category": "office",
        "price": 1900,
        "stock": 22,
        "aliases": ["laptop stand", "stand", "ላፕቶፕ ማስቀመጫ", "ማስቀመጫ"],
    },
    {
        "sku": "MKV-TSHIRT-COT",
        "name_en": "Cotton T-Shirt",
        "name_am": "የጥጥ ቲሸርት",
        "category": "fashion",
        "price": 1200,
        "stock": 40,
        "aliases": ["t-shirt", "tshirt", "shirt", "ቲሸርት", "ሸሚዝ", "የጥጥ ቲሸርት"],
    },
]

# Voice matching also consults the seed aliases so an operator editing a product
# in the dashboard cannot accidentally drop a spoken name the agent relies on.
_SEED_ALIASES_BY_SKU = {
    product["sku"]: tuple(product.get("aliases", ())) for product in SEED_PRODUCTS
}


class CommerceError(Exception):
    """Base domain error."""


class NotFoundError(CommerceError):
    pass


class ValidationError(CommerceError):
    pass


class StockError(CommerceError):
    pass


class ConflictError(CommerceError):
    pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_phone(phone: Optional[str]) -> str:
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("2519") and len(digits) == 12:
        return f"+{digits}"
    if digits.startswith("09") and len(digits) == 10:
        return f"+251{digits[1:]}"
    if digits.startswith("9") and len(digits) == 9:
        return f"+251{digits}"
    return ""


class CommerceRepository:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or os.getenv("DB_PATH", "system.db")
        self._match_index: Dict[int, tuple] = {}
        self._match_index_signature: Optional[tuple] = None

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.db_path, timeout=15)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA busy_timeout=10000")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def init_schema(self) -> None:
        with self._connect() as db:
            db.executescript(
                """
                CREATE TABLE IF NOT EXISTS commerce_products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sku TEXT NOT NULL UNIQUE,
                    name_en TEXT NOT NULL,
                    name_am TEXT NOT NULL,
                    category TEXT NOT NULL,
                    price INTEGER NOT NULL CHECK(price >= 0),
                    stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
                    aliases_json TEXT NOT NULL DEFAULT '[]',
                    active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS commerce_order_drafts (
                    call_id TEXT PRIMARY KEY,
                    intent TEXT NOT NULL DEFAULT 'order',
                    data_json TEXT NOT NULL DEFAULT '{}',
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS commerce_orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_number TEXT NOT NULL UNIQUE,
                    call_id TEXT,
                    confirmation_key TEXT NOT NULL UNIQUE,
                    customer_name TEXT NOT NULL,
                    customer_phone TEXT NOT NULL,
                    delivery_address TEXT NOT NULL,
                    note TEXT,
                    payment_method TEXT NOT NULL DEFAULT 'cash_on_delivery',
                    subtotal INTEGER NOT NULL,
                    total INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    source TEXT NOT NULL DEFAULT 'voice',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS commerce_order_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    sku TEXT NOT NULL,
                    product_name_en TEXT NOT NULL,
                    product_name_am TEXT NOT NULL,
                    unit_price INTEGER NOT NULL,
                    quantity INTEGER NOT NULL CHECK(quantity > 0),
                    line_total INTEGER NOT NULL,
                    FOREIGN KEY(order_id) REFERENCES commerce_orders(id) ON DELETE CASCADE,
                    FOREIGN KEY(product_id) REFERENCES commerce_products(id)
                );

                CREATE TABLE IF NOT EXISTS commerce_order_status_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER NOT NULL,
                    old_status TEXT,
                    new_status TEXT NOT NULL,
                    note TEXT,
                    changed_by TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(order_id) REFERENCES commerce_orders(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_commerce_orders_phone
                    ON commerce_orders(customer_phone);
                CREATE INDEX IF NOT EXISTS idx_commerce_orders_status
                    ON commerce_orders(status);
                """
            )
            count = db.execute("SELECT COUNT(*) FROM commerce_products").fetchone()[0]
            if count == 0:
                now = _now()
                db.executemany(
                    """
                    INSERT INTO commerce_products
                    (sku, name_en, name_am, category, price, stock, aliases_json, active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                    """,
                    [
                        (
                            product["sku"],
                            product["name_en"],
                            product["name_am"],
                            product["category"],
                            product["price"],
                            product["stock"],
                            json.dumps(product["aliases"], ensure_ascii=False),
                            now,
                            now,
                        )
                        for product in SEED_PRODUCTS
                    ],
                )

    @staticmethod
    def _product(row: sqlite3.Row) -> Dict[str, Any]:
        item = dict(row)
        item["aliases"] = json.loads(item.pop("aliases_json", "[]"))
        item["active"] = bool(item["active"])
        return item

    def list_products(
        self,
        search: Optional[str] = None,
        active_only: bool = True,
    ) -> List[Dict[str, Any]]:
        query = "SELECT * FROM commerce_products WHERE 1=1"
        params: List[Any] = []
        if active_only:
            query += " AND active = 1"
        if search:
            token = f"%{search.strip().lower()}%"
            query += (
                " AND (LOWER(sku) LIKE ? OR LOWER(name_en) LIKE ? "
                "OR name_am LIKE ? OR LOWER(aliases_json) LIKE ?)"
            )
            params.extend([token, token, token, token])
        query += " ORDER BY category, name_en"
        with self._connect() as db:
            return [self._product(row) for row in db.execute(query, params).fetchall()]

    def get_product(self, product_id: int) -> Dict[str, Any]:
        with self._connect() as db:
            row = db.execute(
                "SELECT * FROM commerce_products WHERE id = ?", (product_id,)
            ).fetchone()
        if not row:
            raise NotFoundError("Product not found")
        return self._product(row)

    def find_product(self, text: str) -> Optional[Dict[str, Any]]:
        normalized = text.casefold().strip()
        # Scribe is accurate at sentence level but commonly changes one Amharic
        # syllable in short product names over 8 kHz telephone audio.
        observed_voice_variants = {
            "ስልከ": "ስልክ",
            "ስልኪ": "ስልክ",
            "ስልኬ": "ስልክ",
            "ስልክን": "ስልክ",
            "ቻንገር": "ቻርጀር",
            "ቻንጀር": "ቻርጀር",
            "ስማርትዋች": "ስማርት ሰዓት",
            "ስማርትዋቅ": "ስማርት ሰዓት",
            "ስማርት ዋች": "ስማርት ሰዓት",
        }
        for heard, canonical in observed_voice_variants.items():
            normalized = normalized.replace(heard, canonical)

        products = self.list_products()
        candidates_by_product = self._match_candidates(products)

        best: Optional[Dict[str, Any]] = None
        best_length = 0
        for product in products:
            for candidate in candidates_by_product[product["id"]]:
                if len(candidate) > best_length and candidate in normalized:
                    best = product
                    best_length = len(candidate)
        if best:
            return best

        words = re.findall(r"[\w\u1200-\u137f]+", normalized)
        windows = {
            " ".join(words[start:end])
            for start in range(len(words))
            for end in range(start + 1, min(len(words), start + 4) + 1)
        }
        best_score = 0.0
        for product in products:
            for candidate in candidates_by_product[product["id"]]:
                is_amharic = any("\u1200" <= char <= "\u137f" for char in candidate)
                if len(candidate) < (3 if is_amharic else 4):
                    continue
                threshold = 0.78 if len(candidate) <= 5 else 0.65
                for window in windows:
                    # A similarity ratio cannot exceed 2*min(len)/sum(len), so
                    # length alone rules out most pairs before paying for the
                    # quadratic comparison. This prunes without changing which
                    # product wins.
                    ceiling = 2 * min(len(candidate), len(window)) / (
                        len(candidate) + len(window)
                    )
                    if ceiling < threshold or ceiling <= best_score:
                        continue
                    matcher = SequenceMatcher(None, candidate, window)
                    if matcher.quick_ratio() < max(threshold, best_score):
                        continue
                    score = matcher.ratio()
                    if score >= threshold and score > best_score:
                        best = product
                        best_score = score
        return best

    def _match_candidates(self, products: List[Dict[str, Any]]) -> Dict[int, tuple]:
        """Return each product's normalized match strings, rebuilt only on change.

        Voice matching runs on every conversational turn, so the alias lists and
        their case folding are prepared once per catalog revision rather than
        reassembled from the seed data on each lookup.
        """
        signature = tuple(
            (
                product["id"],
                product["sku"],
                product["name_en"],
                product["name_am"],
                tuple(product["aliases"]),
            )
            for product in products
        )
        if self._match_index_signature == signature:
            return self._match_index

        index: Dict[int, tuple] = {}
        for product in products:
            unique: List[str] = []
            for candidate in (
                product["sku"],
                product["name_en"],
                product["name_am"],
                *product["aliases"],
                *_SEED_ALIASES_BY_SKU.get(product["sku"], ()),
            ):
                normalized_candidate = str(candidate).casefold().strip()
                if normalized_candidate and normalized_candidate not in unique:
                    unique.append(normalized_candidate)
            index[product["id"]] = tuple(unique)

        self._match_index = index
        self._match_index_signature = signature
        return index

    def upsert_product(self, data: Dict[str, Any], product_id: Optional[int] = None) -> Dict[str, Any]:
        required = ("sku", "name_en", "name_am", "category", "price", "stock")
        if product_id is None and any(data.get(field) in (None, "") for field in required):
            raise ValidationError("Missing required product fields")
        if "price" in data and int(data["price"]) < 0:
            raise ValidationError("Price cannot be negative")
        if "stock" in data and int(data["stock"]) < 0:
            raise ValidationError("Stock cannot be negative")

        now = _now()
        with self._connect() as db:
            if product_id is None:
                cursor = db.execute(
                    """
                    INSERT INTO commerce_products
                    (sku, name_en, name_am, category, price, stock, aliases_json, active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        data["sku"],
                        data["name_en"],
                        data["name_am"],
                        data["category"],
                        int(data["price"]),
                        int(data["stock"]),
                        json.dumps(data.get("aliases", []), ensure_ascii=False),
                        int(data.get("active", True)),
                        now,
                        now,
                    ),
                )
                product_id = cursor.lastrowid
            else:
                existing = self.get_product(product_id)
                merged = {**existing, **data}
                db.execute(
                    """
                    UPDATE commerce_products SET
                        sku=?, name_en=?, name_am=?, category=?, price=?, stock=?,
                        aliases_json=?, active=?, updated_at=?
                    WHERE id=?
                    """,
                    (
                        merged["sku"],
                        merged["name_en"],
                        merged["name_am"],
                        merged["category"],
                        int(merged["price"]),
                        int(merged["stock"]),
                        json.dumps(merged.get("aliases", []), ensure_ascii=False),
                        int(merged.get("active", True)),
                        now,
                        product_id,
                    ),
                )
        return self.get_product(int(product_id))

    def get_draft(self, call_id: str) -> Optional[Dict[str, Any]]:
        with self._connect() as db:
            row = db.execute(
                "SELECT intent, data_json, updated_at FROM commerce_order_drafts WHERE call_id=?",
                (call_id,),
            ).fetchone()
        if not row:
            return None
        return {
            "call_id": call_id,
            "intent": row["intent"],
            "data": json.loads(row["data_json"]),
            "updated_at": row["updated_at"],
        }

    def save_draft(self, call_id: str, intent: str, data: Dict[str, Any]) -> Dict[str, Any]:
        now = _now()
        with self._connect() as db:
            db.execute(
                """
                INSERT INTO commerce_order_drafts(call_id, intent, data_json, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(call_id) DO UPDATE SET
                    intent=excluded.intent,
                    data_json=excluded.data_json,
                    updated_at=excluded.updated_at
                """,
                (call_id, intent, json.dumps(data, ensure_ascii=False), now),
            )
        return {"call_id": call_id, "intent": intent, "data": data, "updated_at": now}

    def clear_draft(self, call_id: str) -> None:
        with self._connect() as db:
            db.execute("DELETE FROM commerce_order_drafts WHERE call_id=?", (call_id,))

    @staticmethod
    def _order_number(order_id: int) -> str:
        date = datetime.now(timezone.utc).strftime("%Y%m%d")
        return f"MKV-{date}-{order_id:04d}"

    def create_order(
        self,
        *,
        call_id: str,
        confirmation_key: str,
        customer_name: str,
        customer_phone: str,
        delivery_address: str,
        items: Iterable[Dict[str, Any]],
        note: Optional[str] = None,
        source: str = "voice",
    ) -> Dict[str, Any]:
        phone = normalize_phone(customer_phone)
        item_list = list(items)
        if not customer_name.strip() or not phone or not delivery_address.strip():
            raise ValidationError("Name, phone, and delivery address are required")
        if not item_list:
            raise ValidationError("Order requires at least one item")

        with self._connect() as db:
            db.execute("BEGIN IMMEDIATE")
            existing = db.execute(
                "SELECT order_number FROM commerce_orders WHERE confirmation_key=?",
                (confirmation_key,),
            ).fetchone()
            if existing:
                db.commit()
                return self.get_order(existing["order_number"])

            prepared = []
            total = 0
            for requested in item_list:
                product = db.execute(
                    "SELECT * FROM commerce_products WHERE id=? AND active=1",
                    (int(requested["product_id"]),),
                ).fetchone()
                if not product:
                    raise NotFoundError("A selected product is unavailable")
                quantity = int(requested.get("quantity", 1))
                if quantity < 1:
                    raise ValidationError("Quantity must be at least one")
                if product["stock"] < quantity:
                    raise StockError(
                        f"Only {product['stock']} units of {product['name_en']} remain"
                    )
                line_total = product["price"] * quantity
                total += line_total
                prepared.append((product, quantity, line_total))

            now = _now()
            temporary_number = f"TMP-{secrets.token_hex(8)}"
            cursor = db.execute(
                """
                INSERT INTO commerce_orders
                (order_number, call_id, confirmation_key, customer_name, customer_phone,
                 delivery_address, note, subtotal, total, status, source, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
                """,
                (
                    temporary_number,
                    call_id,
                    confirmation_key,
                    customer_name.strip(),
                    phone,
                    delivery_address.strip(),
                    note,
                    total,
                    total,
                    source,
                    now,
                    now,
                ),
            )
            order_id = int(cursor.lastrowid)
            order_number = self._order_number(order_id)
            db.execute(
                "UPDATE commerce_orders SET order_number=? WHERE id=?",
                (order_number, order_id),
            )
            for product, quantity, line_total in prepared:
                db.execute(
                    """
                    INSERT INTO commerce_order_items
                    (order_id, product_id, sku, product_name_en, product_name_am,
                     unit_price, quantity, line_total)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        order_id,
                        product["id"],
                        product["sku"],
                        product["name_en"],
                        product["name_am"],
                        product["price"],
                        quantity,
                        line_total,
                    ),
                )
                db.execute(
                    "UPDATE commerce_products SET stock=stock-?, updated_at=? WHERE id=?",
                    (quantity, now, product["id"]),
                )
            db.execute(
                """
                INSERT INTO commerce_order_status_events
                (order_id, old_status, new_status, note, changed_by, created_at)
                VALUES (?, NULL, 'pending', ?, 'voice-agent', ?)
                """,
                (order_id, "Cash-on-delivery order created", now),
            )
            db.commit()
        self.clear_draft(call_id)
        return self.get_order(order_number)

    def _hydrate_order(self, db: sqlite3.Connection, row: sqlite3.Row) -> Dict[str, Any]:
        order = dict(row)
        order["status_am"] = STATUS_AMHARIC[order["status"]]
        order["items"] = [
            dict(item)
            for item in db.execute(
                "SELECT * FROM commerce_order_items WHERE order_id=? ORDER BY id",
                (order["id"],),
            ).fetchall()
        ]
        order["status_events"] = [
            dict(event)
            for event in db.execute(
                """
                SELECT old_status, new_status, note, changed_by, created_at
                FROM commerce_order_status_events WHERE order_id=? ORDER BY id
                """,
                (order["id"],),
            ).fetchall()
        ]
        return order

    def get_order(
        self,
        order_number: str,
        customer_phone: Optional[str] = None,
    ) -> Dict[str, Any]:
        query = "SELECT * FROM commerce_orders WHERE UPPER(order_number)=UPPER(?)"
        params: List[Any] = [order_number.strip()]
        if customer_phone:
            query += " AND customer_phone=?"
            params.append(normalize_phone(customer_phone))
        with self._connect() as db:
            row = db.execute(query, params).fetchone()
            if not row:
                raise NotFoundError("Order not found")
            return self._hydrate_order(db, row)

    def list_orders(
        self,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        query = "SELECT * FROM commerce_orders WHERE 1=1"
        params: List[Any] = []
        if status:
            if status not in ORDER_STATUSES:
                raise ValidationError("Invalid order status")
            query += " AND status=?"
            params.append(status)
        if search:
            token = f"%{search.strip()}%"
            query += (
                " AND (order_number LIKE ? OR customer_name LIKE ? "
                "OR customer_phone LIKE ? OR delivery_address LIKE ?)"
            )
            params.extend([token, token, token, token])
        query += " ORDER BY id DESC LIMIT ?"
        params.append(max(1, min(int(limit), 500)))
        with self._connect() as db:
            rows = db.execute(query, params).fetchall()
            return [self._hydrate_order(db, row) for row in rows]

    def update_order_status(
        self,
        order_number: str,
        new_status: str,
        *,
        note: Optional[str] = None,
        changed_by: str = "admin",
    ) -> Dict[str, Any]:
        if new_status not in ORDER_STATUSES:
            raise ValidationError("Invalid order status")
        with self._connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute(
                "SELECT id, status FROM commerce_orders WHERE UPPER(order_number)=UPPER(?)",
                (order_number,),
            ).fetchone()
            if not row:
                raise NotFoundError("Order not found")
            old_status = row["status"]
            if new_status == old_status:
                db.commit()
                return self.get_order(order_number)
            if new_status not in STATUS_TRANSITIONS[old_status]:
                raise ConflictError(f"Cannot move order from {old_status} to {new_status}")
            now = _now()
            db.execute(
                "UPDATE commerce_orders SET status=?, updated_at=? WHERE id=?",
                (new_status, now, row["id"]),
            )
            db.execute(
                """
                INSERT INTO commerce_order_status_events
                (order_id, old_status, new_status, note, changed_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (row["id"], old_status, new_status, note, changed_by, now),
            )
            db.commit()
        return self.get_order(order_number)

    def metrics(self) -> Dict[str, Any]:
        today = datetime.now(timezone.utc).date().isoformat()
        with self._connect() as db:
            row = db.execute(
                """
                SELECT
                    COUNT(*) AS total_orders,
                    COALESCE(SUM(total), 0) AS gross_sales,
                    SUM(CASE WHEN substr(created_at, 1, 10)=? THEN 1 ELSE 0 END) AS orders_today,
                    COALESCE(SUM(CASE WHEN substr(created_at, 1, 10)=? THEN total ELSE 0 END), 0) AS sales_today
                FROM commerce_orders
                """,
                (today, today),
            ).fetchone()
            by_status = {
                status_row["status"]: status_row["count"]
                for status_row in db.execute(
                    "SELECT status, COUNT(*) AS count FROM commerce_orders GROUP BY status"
                ).fetchall()
            }
            low_stock = db.execute(
                "SELECT COUNT(*) FROM commerce_products WHERE active=1 AND stock <= 5"
            ).fetchone()[0]
        return {
            **dict(row),
            "by_status": {status: by_status.get(status, 0) for status in ORDER_STATUSES},
            "low_stock_products": low_stock,
            "currency": "ETB",
        }


commerce_repository = CommerceRepository()
