# Base44 Prompt: Markova Shop Amharic Admin

Copy everything inside the prompt block into Base44.

## Build prompt

```text
Build a polished, production-style, responsive e-commerce ADMIN application named
"Markova Shop Admin" (ማርኮቫ ሾፕ አስተዳደር). This is not a customer storefront. It is the
merchant operations dashboard for orders created by an Amharic AI phone agent.

IMPORTANT ARCHITECTURE
- The Markova FastAPI service is the ONLY source of truth for products and orders.
- Do not create Base44 Product, Cart, Order, Customer, or Inventory entities.
- Do not store or duplicate commerce records in Base44's database.
- Build Base44 backend functions that proxy requests to the Markova API.
- Never expose API keys in browser code, page source, localStorage, or query strings.
- Require Base44 authentication for every page.

BACKEND SECRETS
Use these Base44 server-side secrets:
- MARKOVA_API_URL (example: https://markova-ai-backend.onrender.com)
- MARKOVA_ADMIN_API_KEY

Create a shared backend helper that:
1. removes any trailing slash from MARKOVA_API_URL;
2. calls only the /api/commerce routes listed below;
3. sends "X-Admin-Key: <MARKOVA_ADMIN_API_KEY>";
4. sends and accepts JSON;
5. enforces a reasonable timeout;
6. returns a normalized error containing HTTP status and the API detail message;
7. never logs the secret.

Create separate authenticated Base44 backend functions:
- getCommerceMetrics()
  GET /api/commerce/metrics
- listOrders({ status, search, limit })
  GET /api/commerce/orders?status=&search=&limit=
- getOrder({ orderNumber })
  GET /api/commerce/orders/{orderNumber}
- updateOrderStatus({ orderNumber, status, note })
  PATCH /api/commerce/orders/{orderNumber}/status
  JSON: { "status": status, "note": note, "changed_by": authenticated user's email }
- listProducts({ search, includeInactive })
  GET /api/commerce/products?search=&include_inactive=
- createProduct(product)
  POST /api/commerce/products
- updateProduct({ productId, changes })
  PUT /api/commerce/products/{productId}

Never build a generic open proxy. Validate function inputs and permit only the methods and
paths above. Only authenticated Base44 users may invoke these functions.

VISUAL DIRECTION
- Amharic-first interface using readable Ethiopic typography and excellent spacing.
- Keep technical values such as SKU and order number in Latin characters.
- Use a clean light admin theme: warm white surfaces, dark navy text, emerald primary
  actions, amber warnings, and red only for destructive/cancel states.
- Professional, modern, data-rich, and visually calm; avoid gradients, oversized hero
  sections, glassmorphism, excessive rounded cards, and decorative illustrations.
- Desktop sidebar and compact mobile navigation.
- Responsive tables must become usable cards/drawers on small screens.
- Format money as Ethiopian birr: "18,000 ብር".
- Format dates in Africa/Addis_Ababa timezone.

GLOBAL NAVIGATION
- ዳሽቦርድ (Dashboard)
- ትዕዛዞች (Orders)
- ምርቶች (Products)
- ቅንብሮች (Settings / connection health)

STATUS LABELS
Keep API status codes in English but display:
- pending = ማረጋገጫ በመጠበቅ ላይ
- confirmed = ተረጋግጧል
- processing = በዝግጅት ላይ
- shipped = ለመላክ ወጥቷል
- delivered = ደርሷል
- cancelled = ተሰርዟል

Allowed status transitions:
- pending -> confirmed or cancelled
- confirmed -> processing or cancelled
- processing -> shipped or cancelled
- shipped -> delivered
- delivered and cancelled are terminal
Disable invalid actions in the UI instead of waiting for an API error.

DASHBOARD PAGE
- Header: "የማርኮቫ ሾፕ አጠቃላይ እይታ".
- KPI cards from getCommerceMetrics:
  * የዛሬ ትዕዛዞች
  * የዛሬ ሽያጭ
  * ጠቅላላ ትዕዛዞች
  * ጠቅላላ ሽያጭ
  * ክምችታቸው ያነሰ ምርቶች
- Show an order-status distribution with accessible colors and Amharic labels.
- Show the 8 newest orders with order number, customer, total, status, source, and time.
- A prominent connection-health indicator must distinguish loading, connected,
  unauthorized, unavailable, and empty states.
- Refresh metrics and recent orders every 5 seconds while the page is visible.
- Include a manual "አድስ" refresh button and last-updated timestamp.

ORDERS PAGE
- Search by order number, customer name, phone, or delivery address.
- Filter tabs/dropdown for every status plus "ሁሉም".
- Table columns:
  የትዕዛዝ ቁጥር, ደንበኛ, ስልክ, ጠቅላላ, ሁኔታ, ምንጭ, ቀን, ድርጊት.
- Show source "voice" as an "ከAI ጥሪ" badge.
- Clicking a row opens a detail drawer or page containing:
  * customer name and normalized phone;
  * full delivery address and note;
  * cash-on-delivery payment label;
  * item list with Amharic/English name, SKU, quantity, unit price, and line total;
  * subtotal and total;
  * chronological status timeline showing actor, note, and timestamp;
  * valid next-status buttons.
- Status update requires a confirmation dialog and optional Amharic note.
- Optimistically disable duplicate clicks, but refresh the order from the API after success.
- Display API validation/conflict messages clearly in Amharic-friendly error alerts.
- Poll the active list every 5 seconds so a newly confirmed phone order appears quickly.

PRODUCTS PAGE
- Search by SKU, English name, Amharic name, category, or alias.
- Product grid/table showing SKU, Amharic name, English name, category, price, stock,
  active state, and edit action.
- Visually flag stock <= 5 and out-of-stock products.
- Add/edit form fields:
  sku, name_en, name_am, category, price, stock, aliases, active.
- Validate non-negative integer price and stock and require both names, SKU, and category.
- Aliases are an editable list used by the Amharic voice agent for product matching.
- Updating stock or price must immediately refresh the list.

SETTINGS PAGE
- Do not display secret values.
- Show the configured API host only.
- Add a "ግንኙነት ፈትሽ" action that invokes getCommerceMetrics.
- Explain that orders are created by callers dialing extension 8888.
- Include a small demo checklist:
  1. 8888 ይደውሉ
  2. ምርትና ብዛት ይምረጡ
  3. ስም፣ ስልክና አድራሻ ይስጡ
  4. የጥሬ ገንዘብ ትዕዛዙን ያረጋግጡ
  5. ትዕዛዙን በዚህ ዳሽቦርድ ይመልከቱ

DATA SHAPES
Products response:
{ "products": [{
  "id": 1, "sku": "MKV-PHONE-A15",
  "name_en": "Galaxy A15 Smartphone", "name_am": "ጋላክሲ A15 ስማርት ስልክ",
  "category": "electronics", "price": 18000, "stock": 12,
  "aliases": ["phone", "ስልክ"], "active": true,
  "created_at": "...", "updated_at": "..."
}]}

Orders response:
{ "orders": [{
  "id": 1, "order_number": "MKV-20260726-0001", "call_id": "...",
  "customer_name": "...", "customer_phone": "+251911223344",
  "delivery_address": "...", "note": null,
  "payment_method": "cash_on_delivery", "subtotal": 18000, "total": 18000,
  "status": "pending", "status_am": "ማረጋገጫ በመጠበቅ ላይ",
  "source": "voice", "created_at": "...", "updated_at": "...",
  "items": [{
    "sku": "MKV-PHONE-A15", "product_name_en": "Galaxy A15 Smartphone",
    "product_name_am": "ጋላክሲ A15 ስማርት ስልክ",
    "unit_price": 18000, "quantity": 1, "line_total": 18000
  }],
  "status_events": [{
    "old_status": null, "new_status": "pending",
    "note": "Cash-on-delivery order created", "changed_by": "voice-agent",
    "created_at": "..."
  }]
}]}

QUALITY REQUIREMENTS
- No mock commerce data after API connectivity succeeds.
- During initial loading use skeletons, not fake order rows.
- Provide explicit empty states in Amharic.
- Add accessible labels, keyboard navigation, visible focus, and sufficient contrast.
- Avoid stale requests and memory leaks when polling; stop intervals when pages unmount.
- Do not silently swallow API failures.
- The finished app should make a live 8888 phone order visibly appear without reloading.
```

## Base44 setup

1. Start a new Base44 app and paste the prompt above.
2. Enable Backend Functions when Base44 requests it.
3. Open the Base44 project secrets/environment settings and add:
   - `MARKOVA_API_URL=https://markova-ai-backend.onrender.com`
   - `MARKOVA_ADMIN_API_KEY=<the same strong value configured on Render>`
4. In the Render service environment, set:
   - `MARKOVA_ADMIN_API_KEY` to the same value.
   - `MARKOVA_VOICE_API_KEY` to a different strong value.
5. Redeploy the FastAPI backend and deploy the Base44 app.
6. Sign in to Base44, open **ቅንብሮች**, and run **ግንኙነት ፈትሽ**.
7. Confirm that the Products page shows the seeded Markova Shop catalog.
8. Dial `8888`, complete and confirm a cash-on-delivery order, then verify that it appears
   on the Orders page within five seconds.
9. Change the order to `confirmed`, then `processing`, then `shipped`.
10. Call `8888` again and ask for the order status using the order number and the same phone.

## Security note

The commerce APIs intentionally return `503` until their keys are configured. Always use
different, randomly generated admin and voice keys and never place either key in browser code.
