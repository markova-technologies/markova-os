import os
import tempfile
import unittest

import httpx

from commerce import (
    CommerceRepository,
    ConflictError,
    NotFoundError,
    StockError,
    normalize_phone,
)
from commerce_agent import CommerceAgent, _phone


class EthiopianPhoneNormalizationTests(unittest.TestCase):
    def test_accepts_spoken_amharic_digits(self):
        self.assertEqual(
            _phone("ዜሮ ዘጠኝ አንድ አንድ ሁለት ሁለት ሶስት ሶስት አራት አራት"),
            "+251911223344",
        )

    def test_accepts_spoken_amharic_two_digit_groups(self):
        self.assertEqual(
            _phone("ዜሮ ዘጠኝ አስራ አንድ ሀያ ሁለት ሰላሳ ሶስት አርባ አራት"),
            "+251911223344",
        )

    def test_rejects_incomplete_phone(self):
        self.assertEqual(normalize_phone("09112233"), "")


class CommerceRepositoryTests(unittest.TestCase):
    def setUp(self):
        handle, self.db_path = tempfile.mkstemp(suffix=".db")
        os.close(handle)
        os.remove(self.db_path)
        self.repo = CommerceRepository(self.db_path)
        self.repo.init_schema()

    def tearDown(self):
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    def _create_order(self, key="confirmation-1", quantity=2):
        product = self.repo.list_products(search="smart watch")[0]
        return self.repo.create_order(
            call_id="call-1",
            confirmation_key=key,
            customer_name="Hana Bekele",
            customer_phone="0911223344",
            delivery_address="Addis Ababa, Bole",
            items=[{"product_id": product["id"], "quantity": quantity}],
        )

    def test_seeded_catalog_and_transactional_total(self):
        self.assertGreaterEqual(len(self.repo.list_products()), 10)
        before = self.repo.list_products(search="smart watch")[0]
        order = self._create_order(quantity=2)
        after = self.repo.get_product(before["id"])

        self.assertEqual(order["total"], before["price"] * 2)
        self.assertEqual(order["items"][0]["quantity"], 2)
        self.assertEqual(after["stock"], before["stock"] - 2)
        self.assertTrue(order["order_number"].startswith("MKV-"))

    def test_confirmation_is_idempotent(self):
        first = self._create_order(key="same-confirmation", quantity=1)
        second = self._create_order(key="same-confirmation", quantity=1)

        self.assertEqual(first["order_number"], second["order_number"])
        self.assertEqual(len(self.repo.list_orders()), 1)

    def test_rejects_insufficient_stock_without_partial_order(self):
        product = self.repo.list_products(search="coffee maker")[0]
        with self.assertRaises(StockError):
            self.repo.create_order(
                call_id="stock-call",
                confirmation_key="stock-failure",
                customer_name="Test Customer",
                customer_phone="0911000000",
                delivery_address="Addis Ababa",
                items=[{"product_id": product["id"], "quantity": product["stock"] + 1}],
            )
        self.assertEqual(self.repo.list_orders(), [])
        self.assertEqual(self.repo.get_product(product["id"])["stock"], product["stock"])

    def test_phone_bound_lookup_and_status_transitions(self):
        order = self._create_order(quantity=1)
        with self.assertRaises(NotFoundError):
            self.repo.get_order(order["order_number"], "0999999999")

        confirmed = self.repo.update_order_status(order["order_number"], "confirmed")
        processing = self.repo.update_order_status(order["order_number"], "processing")
        shipped = self.repo.update_order_status(order["order_number"], "shipped")

        self.assertEqual(confirmed["status"], "confirmed")
        self.assertEqual(processing["status"], "processing")
        self.assertEqual(shipped["status_am"], "ለመላክ ወጥቷል")
        with self.assertRaises(ConflictError):
            self.repo.update_order_status(order["order_number"], "pending")


class AmharicCommerceConversationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        handle, self.db_path = tempfile.mkstemp(suffix=".db")
        os.close(handle)
        os.remove(self.db_path)
        self.repo = CommerceRepository(self.db_path)
        self.repo.init_schema()
        self.agent = CommerceAgent(self.repo, groq_client=None)

    async def asyncTearDown(self):
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    async def test_amharic_order_confirmation_and_status_lookup(self):
        call_id = "amharic-order-call"
        turns = [
            ("ሁለት ስማርት ሰዓት ልግዛ እፈልጋለሁ", "በማን ስም"),
            ("ስሜ ሀና በቀለ ነው", "ስልክ ቁጥር"),
            ("0911223344", "የሚደርስበትን"),
            ("አዲስ አበባ ቦሌ መድኃኒዓለም", "ላረጋግጥ"),
            ("አዎ አረጋግጣለሁ", "ትዕዛዝዎ ተመዝግቧል"),
        ]
        for utterance, expected in turns:
            response = await self.agent.process_turn(utterance, call_id)
            self.assertIn(expected, response)

        order = self.repo.list_orders()[0]
        self.assertEqual(order["items"][0]["quantity"], 2)
        self.assertEqual(order["total"], 11000)

        status_response = await self.agent.process_turn(
            f"የትዕዛዝ ሁኔታ {order['order_number']} 0911223344",
            "amharic-status-call",
        )
        self.assertIn(order["order_number"], status_response)
        self.assertIn("ማረጋገጫ በመጠበቅ ላይ", status_response)

    async def test_noisy_scribe_product_names_start_order_flow(self):
        phone_response = await self.agent.process_turn(
            "ስልከ መዘሰልኝ አብ",
            "noisy-phone-order",
        )
        charger_response = await self.agent.process_turn(
            "ቻንገር መገዛት ፊል ቂና",
            "noisy-charger-order",
        )
        watch_response = await self.agent.process_turn(
            "ሪልሜ ስማርትዋቅ",
            "noisy-watch-order",
        )

        self.assertIn("በማን ስም", phone_response)
        self.assertIn("በማን ስም", charger_response)
        self.assertIn("በማን ስም", watch_response)

    async def test_noisy_scribe_confirmation_creates_order(self):
        call_id = "noisy-confirmation"
        await self.agent.process_turn("ስልክ ልግዛ", call_id)
        await self.agent.process_turn("ሀና በቀለ", call_id)
        await self.agent.process_turn("0911223344", call_id)
        await self.agent.process_turn("አዲስ አበባ ቦሌ", call_id)

        response = await self.agent.process_turn("አሽ አቻ", call_id)

        self.assertIn("ትዕዛዝዎ ተመዝግቧል", response)
        self.assertEqual(len(self.repo.list_orders()), 1)

    async def test_rejection_clears_draft_without_order(self):
        call_id = "cancelled-draft"
        await self.agent.process_turn("አንድ ፓወር ባንክ ልግዛ", call_id)
        await self.agent.process_turn("ሀና", call_id)
        await self.agent.process_turn("0911223344", call_id)
        await self.agent.process_turn("አዲስ አበባ ቦሌ", call_id)
        response = await self.agent.process_turn("አይ ሰርዝ", call_id)

        self.assertIn("ሰርዤዋለሁ", response)
        self.assertIsNone(self.repo.get_draft(call_id))
        self.assertEqual(self.repo.list_orders(), [])


class CommerceApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        handle, self.db_path = tempfile.mkstemp(suffix=".db")
        os.close(handle)
        os.remove(self.db_path)
        self.repo = CommerceRepository(self.db_path)
        self.repo.init_schema()

        import main_natural_voice

        self.main = main_natural_voice
        self.original_repo = self.main.commerce_repository
        self.original_admin_key = self.main.COMMERCE_ADMIN_KEY
        self.original_voice_key = self.main.COMMERCE_VOICE_KEY
        self.main.commerce_repository = self.repo
        self.main.COMMERCE_ADMIN_KEY = "markova-demo-admin"
        self.main.COMMERCE_VOICE_KEY = "markova-demo-voice"
        transport = httpx.ASGITransport(app=self.main.app)
        self.client = httpx.AsyncClient(transport=transport, base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()
        self.main.commerce_repository = self.original_repo
        self.main.COMMERCE_ADMIN_KEY = self.original_admin_key
        self.main.COMMERCE_VOICE_KEY = self.original_voice_key
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    async def test_admin_auth_and_product_listing(self):
        denied = await self.client.get("/api/commerce/products")
        allowed = await self.client.get(
            "/api/commerce/products",
            headers={"X-Admin-Key": "markova-demo-admin"},
        )

        self.assertEqual(denied.status_code, 401)
        self.assertEqual(allowed.status_code, 200)
        self.assertGreaterEqual(len(allowed.json()["products"]), 10)

    async def test_amharic_and_transliterated_farewells(self):
        self.assertTrue(self.main.is_farewell("ቻው"))
        self.assertTrue(self.main.is_farewell("chaw"))
        self.assertTrue(self.main.is_farewell("ደህና ሁኑ"))
        self.assertFalse(self.main.is_farewell("ስልክ ልግዛ"))

    async def test_voice_create_then_admin_status_update(self):
        product = self.repo.list_products(search="power bank")[0]
        create = await self.client.post(
            "/api/commerce/voice/orders",
            headers={"X-Voice-Key": "markova-demo-voice"},
            json={
                "call_id": "api-call",
                "confirmation_key": "api-confirmation",
                "customer_name": "Abel Tesfaye",
                "customer_phone": "0911000000",
                "delivery_address": "Addis Ababa, Lideta",
                "items": [{"product_id": product["id"], "quantity": 1}],
            },
        )
        self.assertEqual(create.status_code, 201, create.text)
        order_number = create.json()["order_number"]

        update = await self.client.patch(
            f"/api/commerce/orders/{order_number}/status",
            headers={"X-Admin-Key": "markova-demo-admin"},
            json={"status": "confirmed", "note": "Demo verification"},
        )
        status = await self.client.get(
            f"/api/commerce/voice/orders/{order_number}/status",
            params={"phone": "0911000000"},
            headers={"X-Voice-Key": "markova-demo-voice"},
        )

        self.assertEqual(update.status_code, 200, update.text)
        self.assertEqual(status.status_code, 200, status.text)
        self.assertEqual(status.json()["status"], "confirmed")


if __name__ == "__main__":
    unittest.main()
