"""Deterministic Amharic commerce orchestration with LLM slot extraction."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any, Dict, Optional

from commerce import (
    CommerceError,
    CommerceRepository,
    NotFoundError,
    StockError,
    commerce_repository,
    normalize_phone,
)


logger = logging.getLogger(__name__)

ORDER_WORDS = (
    "order",
    "buy",
    "purchase",
    "add to cart",
    "want to get",
    "ትዕዛዝ",
    "ማዘዝ",
    "ልዘዝ",
    "ልግዛ",
    "መግዛት",
    "እፈልጋለሁ",
    "ወደ ጋሪ",
)
STATUS_WORDS = (
    "order status",
    "track order",
    "where is my order",
    "status",
    "ትዕዛዜ",
    "የትዕዛዝ ሁኔታ",
    "ትዕዛዙ የት",
    "ደረሰ",
    "ሁኔታ",
)
CONFIRM_WORDS = (
    "yes",
    "confirm",
    "correct",
    "proceed",
    "አዎ",
    "እሺ",
    "ትክክል",
    "አረጋግጣለሁ",
    "አረጋግጥ",
    "እሽ",
    "ይሽ",
    "እስህ",
    "አሺ",
    "አሽ",
    "አቻ",
    "ይሁን",
    "ቀጥል",
)
REJECT_WORDS = (
    "no",
    "cancel",
    "wrong",
    "አይ",
    "አይደለም",
    "ሰርዝ",
    "አቁም",
    "አልፈልግም",
)
AMHARIC_NUMBERS = {
    "አንድ": 1,
    "ሁለት": 2,
    "ሶስት": 3,
    "ሦስት": 3,
    "አራት": 4,
    "አምስት": 5,
    "ስድስት": 6,
    "ሰባት": 7,
    "ስምንት": 8,
    "ዘጠኝ": 9,
    "አስር": 10,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
}

_PHONE_ONES = {
    "ዜሮ": 0,
    "ዝሮ": 0,
    "አንድ": 1,
    "ሁለት": 2,
    "ሶስት": 3,
    "ሦስት": 3,
    "አራት": 4,
    "አምስት": 5,
    "ስድስት": 6,
    "ሰባት": 7,
    "ስምንት": 8,
    "ዘጠኝ": 9,
    "zero": 0,
    "oh": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
}
_PHONE_TEENS = {
    "አስር": 10,
    "አስራ አንድ": 11,
    "አስራ ሁለት": 12,
    "አስራ ሶስት": 13,
    "አስራ ሦስት": 13,
    "አስራ አራት": 14,
    "አስራ አምስት": 15,
    "አስራ ስድስት": 16,
    "አስራ ሰባት": 17,
    "አስራ ስምንት": 18,
    "አስራ ዘጠኝ": 19,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
}
_PHONE_TENS = {
    "ሀያ": 20,
    "ሃያ": 20,
    "ሰላሳ": 30,
    "አርባ": 40,
    "ሃምሳ": 50,
    "ሀምሳ": 50,
    "ስልሳ": 60,
    "ሰባ": 70,
    "ሰማንያ": 80,
    "ዘጠና": 90,
    "twenty": 20,
    "thirty": 30,
    "forty": 40,
    "fifty": 50,
    "sixty": 60,
    "seventy": 70,
    "eighty": 80,
    "ninety": 90,
}
SPOKEN_PHONE_NUMBERS: Dict[str, int] = {**_PHONE_ONES, **_PHONE_TEENS}
for tens_word, tens_value in _PHONE_TENS.items():
    SPOKEN_PHONE_NUMBERS[tens_word] = tens_value
    for one_word, one_value in _PHONE_ONES.items():
        if one_value:
            SPOKEN_PHONE_NUMBERS[f"{tens_word} {one_word}"] = tens_value + one_value

ETHIOPIC_DIGITS = str.maketrans("፩፪፫፬፭፮፯፰፱0", "1234567890")


def _contains(text: str, words: tuple[str, ...]) -> bool:
    lowered = text.casefold()
    return any(word.casefold() in lowered for word in words)


def _quantity(text: str) -> Optional[int]:
    match = re.search(r"(?<![\d,])([1-9]|10)(?![\d,])", text)
    if match:
        return int(match.group(1))
    lowered = text.casefold()
    for word, value in AMHARIC_NUMBERS.items():
        if word.casefold() in lowered:
            return value
    return None


def _phone(text: str) -> Optional[str]:
    candidates = re.findall(r"(?:\+?251[\s-]?)?0?9(?:[\s-]?\d){8}", text)
    if candidates:
        normalized = normalize_phone(candidates[0])
        if normalized:
            return normalized

    normalized_text = text.translate(ETHIOPIC_DIGITS).casefold().replace("-", " ")
    alternatives = sorted(SPOKEN_PHONE_NUMBERS, key=len, reverse=True)
    token_pattern = re.compile(
        r"\d+|" + "|".join(re.escape(word) for word in alternatives),
        re.IGNORECASE,
    )
    chunks = []
    for match in token_pattern.finditer(normalized_text):
        token = match.group(0).casefold()
        if token.isdigit():
            chunks.append(token)
        else:
            value = SPOKEN_PHONE_NUMBERS[token]
            chunks.append(f"{value:02d}" if value >= 10 else str(value))
    if chunks:
        normalized = normalize_phone("".join(chunks))
        if normalized:
            return normalized
    return None


def _order_reference(text: str) -> Optional[str]:
    full = re.search(r"MKV[\s-]*(\d{8})[\s-]*(\d{1,6})", text, re.IGNORECASE)
    if full:
        return f"MKV-{full.group(1)}-{int(full.group(2)):04d}"
    compact = re.search(r"\b(\d{4})\b", text)
    return compact.group(1) if compact and _contains(text, STATUS_WORDS) else None


class CommerceAgent:
    def __init__(
        self,
        repository: CommerceRepository = commerce_repository,
        groq_client: Any = None,
    ):
        self.repository = repository
        self.groq_client = groq_client

    def set_groq_client(self, client: Any) -> None:
        self.groq_client = client

    @staticmethod
    def _automatic_voice_phone(call_id: str, caller_phone: Optional[str]) -> str:
        caller_digits = re.sub(r"\D", "", caller_phone or "")
        if caller_digits and len(caller_digits) <= 8:
            suffix = caller_digits.zfill(8)
        else:
            import hashlib

            suffix = str(int(hashlib.sha256(call_id.encode()).hexdigest()[:8], 16))[-8:]
            suffix = suffix.zfill(8)
        return f"+2519{suffix}"

    def _fallback_extract(
        self,
        text: str,
        draft: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        data = (draft or {}).get("data", {})
        product = self.repository.find_product(text)
        intent = "other"
        if (draft or {}).get("intent") == "status" or _contains(text, STATUS_WORDS):
            intent = "status"
        elif draft or _contains(text, ORDER_WORDS) or (product and "ዋጋ" not in text):
            intent = "order"

        extracted: Dict[str, Any] = {
            "intent": intent,
            "product_id": product["id"] if product else None,
            "quantity": _quantity(text),
            "customer_name": None,
            "phone": _phone(text),
            "address": None,
            "note": None,
            "order_number": _order_reference(text),
            "confirm": _contains(text, CONFIRM_WORDS),
            "reject": _contains(text, REJECT_WORDS),
        }

        if draft and intent == "order":
            if data.get("items") and not data.get("customer_name") and not extracted["phone"]:
                extracted["customer_name"] = text.strip()
            elif data.get("customer_name") and not data.get("phone"):
                extracted["phone"] = _phone(text)
            elif data.get("phone") and not data.get("address"):
                extracted["address"] = text.strip()
        elif draft and intent == "status":
            if data.get("order_number") and not data.get("phone"):
                extracted["phone"] = _phone(text)
        return extracted

    async def _extract(
        self,
        text: str,
        draft: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        fallback = self._fallback_extract(text, draft)
        if not self.groq_client:
            return fallback
        if not draft and fallback["intent"] == "other":
            return fallback

        products = [
            {
                "id": product["id"],
                "sku": product["sku"],
                "name_en": product["name_en"],
                "name_am": product["name_am"],
                "aliases": product["aliases"],
            }
            for product in await asyncio.to_thread(self.repository.list_products)
        ]
        prompt = {
            "task": (
                "Extract e-commerce intent and slots from noisy Amharic/English phone text. "
                "Never invent a value. Return JSON only."
            ),
            "allowed_intents": ["order", "status", "other"],
            "fields": {
                "intent": "order, status, or other",
                "product_id": "integer from catalog or null",
                "quantity": "integer 1-10 or null",
                "customer_name": "string or null",
                "phone": (
                    "complete Ethiopian mobile number normalized as +2519XXXXXXXX, or null. "
                    "Convert Amharic/English spoken digits and two-digit groups; never return "
                    "an incomplete number"
                ),
                "address": "string or null",
                "note": "string or null",
                "order_number": "string or null",
                "confirm": "boolean",
                "reject": "boolean",
            },
            "current_draft": draft,
            "catalog": products,
            "utterance": text,
        }
        try:
            response = await asyncio.to_thread(
                self.groq_client.chat.completions.create,
                model="llama-3.1-8b-instant",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You extract structured fields for an Ethiopian voice-commerce "
                            "state machine. Preserve Amharic names and addresses exactly."
                        ),
                    },
                    {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
                ],
                response_format={"type": "json_object"},
                temperature=0,
                max_tokens=220,
            )
            parsed = json.loads(response.choices[0].message.content)
            merged = {
                **fallback,
                **{key: value for key, value in parsed.items() if value is not None},
            }
            rule_phone = fallback.get("phone")
            # A valid phone must be present in the utterance. Do not let the
            # extraction model invent one and accidentally skip the phone step.
            merged["phone"] = rule_phone or None
            merged["confirm"] = fallback["confirm"] or bool(parsed.get("confirm"))
            merged["reject"] = fallback["reject"] or bool(parsed.get("reject"))
            return merged
        except Exception as exc:
            logger.warning("Commerce slot extraction fell back to rules: %s", exc)
            return fallback

    @staticmethod
    def _cart_summary(data: Dict[str, Any], repository: CommerceRepository) -> str:
        parts = []
        total = 0
        for item in data.get("items", []):
            product = repository.get_product(int(item["product_id"]))
            quantity = int(item["quantity"])
            total += product["price"] * quantity
            parts.append(f"{product['name_am']} {quantity}")
        return f"{'፣ '.join(parts)}፣ ጠቅላላ {total:,} ብር"

    @staticmethod
    def _confirmation_key(call_id: str, data: Dict[str, Any]) -> str:
        payload = json.dumps(data, ensure_ascii=False, sort_keys=True)
        import hashlib

        return hashlib.sha256(f"{call_id}:{payload}".encode("utf-8")).hexdigest()

    async def _process_status(
        self,
        call_id: str,
        caller_phone: Optional[str],
        draft: Optional[Dict[str, Any]],
        extracted: Dict[str, Any],
    ) -> str:
        data = dict((draft or {}).get("data", {}))
        if extracted.get("order_number"):
            data["order_number"] = str(extracted["order_number"]).upper()
        if extracted.get("phone"):
            data["phone"] = normalize_phone(extracted["phone"])
            data.pop("_phone_requests", None)
        elif caller_phone and not data.get("phone"):
            normalized_caller = normalize_phone(caller_phone)
            if normalized_caller.startswith("+251") and len(normalized_caller) == 13:
                data["phone"] = normalized_caller

        await asyncio.to_thread(self.repository.save_draft, call_id, "status", data)
        if not data.get("order_number"):
            return "እሺ፣ የትዕዛዝ ቁጥርዎን ይንገሩኝ።"

        reference = data["order_number"]
        try:
            if re.fullmatch(r"\d{4}", reference):
                candidates = await asyncio.to_thread(
                    self.repository.list_orders, None, reference, 20
                )
                order = next(
                    (
                        candidate
                        for candidate in candidates
                        if candidate["order_number"].endswith(reference)
                        and (
                            not data.get("phone")
                            or candidate["customer_phone"] == data["phone"]
                        )
                    ),
                    None,
                )
                if not order:
                    raise NotFoundError("Order not found")
            else:
                order = await asyncio.to_thread(
                    self.repository.get_order, reference, data.get("phone")
                )
        except NotFoundError:
            return "በዚህ ትዕዛዝ ቁጥርና ስልክ የተመዘገበ ትዕዛዝ አላገኘሁም። እንደገና ያረጋግጡ።"

        await asyncio.to_thread(self.repository.clear_draft, call_id)
        return (
            f"ትዕዛዝ {order['order_number']} {order['status_am']}። "
            f"ጠቅላላ ዋጋው {order['total']:,} ብር ነው።"
        )

    async def _process_order(
        self,
        call_id: str,
        caller_phone: Optional[str],
        draft: Optional[Dict[str, Any]],
        extracted: Dict[str, Any],
    ) -> str:
        data = dict((draft or {}).get("data", {}))
        data.setdefault("items", [])

        if extracted.get("reject") and data.get("awaiting_confirmation"):
            await asyncio.to_thread(self.repository.clear_draft, call_id)
            return "እሺ፣ ትዕዛዙን ሰርዤዋለሁ። ሌላ ነገር ልርዳዎ?"

        # The caller is answering a direct yes/no question. Confirmation must
        # win over noisy product extraction; otherwise a distorted "እሺ" can
        # accidentally add another catalog item instead of saving the order.
        if data.get("awaiting_confirmation") and extracted.get("confirm"):
            try:
                order = await asyncio.to_thread(
                    self.repository.create_order,
                    call_id=call_id,
                    confirmation_key=self._confirmation_key(call_id, data),
                    customer_name=data["customer_name"],
                    customer_phone=data["phone"],
                    delivery_address=data["address"],
                    items=data["items"],
                    note=data.get("note"),
                )
            except StockError as exc:
                return f"ይቅርታ፣ በቂ እቃ የለም። {exc}"
            await asyncio.to_thread(self.repository.clear_draft, call_id)
            return (
                f"ትዕዛዝዎ ተመዝግቧል። ቁጥሩ {order['order_number']}፣ "
                f"ክፍያው {order['total']:,} ብር በዕቃ መረከቢያ ጊዜ ነው።"
            )

        product_id = extracted.get("product_id")
        if product_id:
            product = await asyncio.to_thread(self.repository.get_product, int(product_id))
            quantity = max(1, min(int(extracted.get("quantity") or 1), 10))
            if quantity > product["stock"]:
                return f"ይቅርታ፣ {product['name_am']} በክምችት {product['stock']} ብቻ አለ።"
            existing = next(
                (item for item in data["items"] if item["product_id"] == product["id"]),
                None,
            )
            if existing:
                existing["quantity"] = quantity
            else:
                data["items"].append({"product_id": product["id"], "quantity": quantity})
            data["awaiting_confirmation"] = False

        for source_key, target_key in (
            ("customer_name", "customer_name"),
            ("phone", "phone"),
            ("address", "address"),
            ("note", "note"),
        ):
            value = extracted.get(source_key)
            if value:
                if target_key == "phone":
                    normalized = normalize_phone(value)
                    if normalized:
                        data[target_key] = normalized
                        data.pop("_phone_requests", None)
                else:
                    data[target_key] = str(value).strip()

        if caller_phone and not data.get("phone"):
            normalized_caller = normalize_phone(caller_phone)
            if normalized_caller.startswith("+251") and len(normalized_caller) == 13:
                data["phone"] = normalized_caller
        if not data.get("phone"):
            data["phone"] = self._automatic_voice_phone(call_id, caller_phone)
            data["_phone_automatic"] = True

        if not data["items"]:
            await asyncio.to_thread(self.repository.save_draft, call_id, "order", data)
            products = await asyncio.to_thread(self.repository.list_products)
            examples = "፣ ".join(product["name_am"] for product in products[:3])
            return f"እሺ፣ ምን ማዘዝ ይፈልጋሉ? ለምሳሌ {examples} አሉን።"
        if not data.get("customer_name"):
            await asyncio.to_thread(self.repository.save_draft, call_id, "order", data)
            return "ትዕዛዙን በማን ስም ልመዝግብ?"
        if not data.get("address"):
            await asyncio.to_thread(self.repository.save_draft, call_id, "order", data)
            return "ትዕዛዙ የሚደርስበትን ከተማ፣ ክፍለ ከተማና አካባቢ ይንገሩኝ።"

        data["awaiting_confirmation"] = True
        await asyncio.to_thread(self.repository.save_draft, call_id, "order", data)
        summary = await asyncio.to_thread(self._cart_summary, data, self.repository)
        return (
            f"ማጠቃለያ፣ {summary}፣ ወደ {data['address']} ይላካል። "
            "በዕቃ መረከቢያ ጊዜ ለመክፈል ትዕዛዙን ላረጋግጥ?"
        )

    async def process_turn(
        self,
        text: str,
        call_id: str,
        caller_phone: Optional[str] = None,
    ) -> Optional[str]:
        draft = await asyncio.to_thread(self.repository.get_draft, call_id)
        extracted = await self._extract(text, draft)
        intent = extracted.get("intent", "other")
        if draft:
            intent = draft["intent"]
        if intent == "other":
            return None
        try:
            if intent == "status":
                return await self._process_status(
                    call_id, caller_phone, draft, extracted
                )
            return await self._process_order(call_id, caller_phone, draft, extracted)
        except CommerceError as exc:
            logger.warning("Commerce action rejected for %s: %s", call_id, exc)
            return f"ይቅርታ፣ ትዕዛዙን ማስኬድ አልቻልኩም። {exc}"


commerce_agent = CommerceAgent()
