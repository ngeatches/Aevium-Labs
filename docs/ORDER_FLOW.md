# Local checkout and fulfillment

Approved October 12, 2026: the user requested customer phone login, name/email/address/phone collection, order numbers, payment instructions, customer payment reporting, administrator receipt verification, fulfillment and automatic customer emails. The user explicitly chose **build and test locally first**. No real provider is connected.

## Review sequence

Customers can sign in before adding items through the bottom-left **Flower of Life** icon. With an empty cart, the icon appears alone and opens a small menu with **Log in**. Successful simulated phone verification reopens it with the customer’s saved name, cart access, orders and sign-out. The name is read only from that account’s latest order; new accounts show **Your account** until a name is available. When items exist, the count and total appear beside the icon and open the cart directly. The shared menu/login popup works on all generated pages and within product/testing popups. This uses the same customer session as checkout and the orders page; it does not grant admin access or send SMS.

1. Add catalog materials to the left-side cart; choose Order.
2. Request an on-screen code for sample customer +12025550198 and verify. Use sample contact details.
3. Acknowledge all four versioned statements: age 21+, research-only purpose, qualified handling and data-policy review. Order creation is rejected without the current version and all acknowledgments.
4. Receive a unique PP-prefixed order number, server-calculated draft total and payment steps. The sample Zelle address uses `.example.test`, is unverified and is not payable.
5. Report simulated payment with an optional reference. The order immediately enters the admin queue; a customer assertion never approves it.
6. Sign into `/admin/` with fictional admin +12025550199 and its on-screen code. Review customer details and policy acknowledgment. Record the exact order amount and a bank verification reference before approval, or return the report with a correction note.
7. Record carrier, tracking, fulfillment reference, optional note and optional proof. Shipment and its queued email commit together. The customer can view details and download the proof and demo order confirmation.
8. Inspect the automatically captured order/payment/shipment emails in the customer order or admin outbox. Sign out/in with the same sample phone to recover orders.

States: `awaiting_payment` → `payment_reported` → `approved` → `shipped`. Returning a report goes back to `awaiting_payment`. Invalid transitions are rejected. Every transition has a dated event. Completed shipment data cannot be overwritten through the API. Payment review is explicitly a manual administrator record; no bank integration verifies receipt.

## Routes

All API routes require shared preview access and a localhost request. Writes require the matching Origin and JSON.

| Endpoint | Access / purpose |
| --- | --- |
| `GET /api/shop` | Catalog, session state, sample phone numbers, policy and payment configuration |
| `POST /api/customer/auth/start`, `verify`, `logout` | Separate customer phone-code flow |
| `POST /api/admin/auth/start`, `verify`, `logout` | Separate administrator phone-code flow |
| `GET/POST /api/orders` | Signed-in customer's orders / create order |
| `GET /api/orders/:id` | Owning customer only |
| `POST /api/orders/:id/payment` | Owning customer's payment report |
| `GET /api/orders/:id/proof`, `emails` | Owning customer's evidence / email previews |
| `GET /api/admin/orders` | Admin-only order list, including preserved legacy orders |
| `POST /api/admin/orders/:id/approve` | Confirm review with exact integer-cent amount and reference |
| `POST /api/admin/orders/:id/reject` | Return report for correction with a note |
| `POST /api/admin/orders/:id/ship` | Record shipment and optional evidence; enqueue email |
| `GET /api/admin/orders/:id/proof`, `emails` | Admin-only evidence / email previews |
| `GET /api/admin/emails` | Most recent 100 email previews, recipients, attempt counts and statuses |
| `POST /api/admin/emails/:id/retry` | Requeue only a failed preview |

The UI refreshes visible orders periodically and on focus/cross-tab updates, while preserving focused/edited forms and open details. Refresh buttons explicitly retrieve current records. Lists return the most recent 100 orders; production pagination is not implemented.

## Identity and storage

- Private `.data/demo-orders.sqlite` persists `customers`, `orders`, `proofs` and `email_outbox`; it is ignored and outside `site/`. Stop the server and move `.data/` to a private backup to begin a fresh demo.
- Each customer account is keyed by a sample phone (+12025550100–+12025550198). Admin uses only +12025550199. The code is displayed locally, never texted. These are simulated identities, not proof of real phone ownership.
- `pp_customer` lasts eight hours; `pp_admin` lasts one hour. Both are HttpOnly, SameSite=Strict and bound to the shared preview token. Challenges are role/phone/preview-bound, hashed, five-minute, single-use and limited to five attempts. Request/verification limits also apply. A customer code cannot establish an admin session.
- Restart invalidates in-memory sessions and challenges. Accounts remain, so signing in again restores associated orders. Customer endpoints always enforce ownership, even when the same browser also has an admin cookie.
- The old `pp_order_browser` cookie is not used. Existing browser-owned records are preserved for admin review and are not reassigned based on unverified contact details.
- Order creation snapshots the catalog lines, contact fields, policy version/time/statements and payment instructions. Name, email, phone, street, city, region, postal code and country are required. Phone must match the signed-in account.
- Prices come from the server's original draft catalog in integer cents. Orders allow 1–19 unique lines, 1–99 vials per line and at most 500 vials. Client prices are ignored. Duplicate owner/submission keys return the original order and do not enqueue a second email.
- Proof files are at most 4 MB, with PDF/PNG/JPEG signature checks and attachment-only delivery. Cross-account reads/downloads return 404. Customer/admin API access is checked before returning private records.
- Local storage contains only cart IDs/quantities, retry keys and anonymous update signals, never entered contact fields or session tokens. Signing out/clearing cookies does not delete stored orders.

## Automatic email preparation

Creation, approval, correction request and shipment each enqueue text and HTML templates in the same SQLite transaction as the corresponding change. The unique event key deduplicates messages. A one-second background worker captures pending messages locally; startup resumes pending work. Failed preparation backs off exponentially up to five attempts, then exposes an admin Retry action. No live email transport exists; statuses are `pending`, `preview` and `failed`, never sent/delivered.

The templates include the correct customer email as recipient, order number, item/quantity/total summary and the relevant payment instructions or shipment details. Shipment messages refer customers back to phone sign-in for private proof/confirmation access. Proof is not attached to email. The message is visibly marked local demo. Admin can inspect recipient, body, status and attempt count; customers can inspect their own message bodies.

## Policies and reference

`/research-use/` and `/privacy/` are public before entry and linked at checkout. Acknowledgments capture the customer's stated intent; they cannot independently establish qualifications, test quality or actual use. Existing source business claims remain draft. The new policies describe actual local collection, visibility, storage, retention and communication behavior. See [reference research](CHECKOUT_REFERENCE.md).

## Live activation boundary

*Superseded October 13 by the production path below; kept for history.* No live mode or credentials switch exists. A live implementation needs verified prices, business/Zelle details and admin phones; real SMS authentication and recovery; a verified email sender, delivery events and provider idempotency; HTTPS, production throttling, persistent storage/backups, retention/deletion handling and an updated privacy notice. Bank receipt still needs independent verification. Shipment labels/carrier booking remain separate. Do not expose demo codes or sample-recipient checkout publicly.

Implementation references: [Node SQLite](https://nodejs.org/api/sqlite.html), [Twilio Verify creation](https://www.twilio.com/docs/verify/api/verification) and [verification checks](https://www.twilio.com/docs/verify/api/verification-check). No Twilio library or external service is installed.

## Production path — October 13, 2026

The same order flow, states and endpoints run in `COMMERCE_MODE=live` (staging/production) with real providers. Demo behaviour is unchanged. Nothing has been connected to a real account yet; see [DEPLOYMENT.md](DEPLOYMENT.md).

**What changes in live mode**
- Customers can instead sign in by email: the server generates a 6-digit code, stores only its hash and sends it once through Resend (subject and body contain only the code and expiry). Addresses outside `TEST_EMAIL_ALLOWLIST` are refused while `DELIVERY_MODE=test`; a 30-second resend cooldown, per-address hourly limit and daily cap apply. Admin sign-in stays phone-only. After either sign-in, a new account must save its profile (first name, optional last name, date of birth with a server-side 21+ check, role, terms acceptance with the policy version) before `/api/orders` accepts an order. Schema migration 5 makes `customers.phone` optional and adds `email` and the profile columns.
- Sign-in uses Twilio Verify SMS. The code is never returned to the browser. Numbers are normalized to +1 E.164. Customer numbers outside `TEST_PHONE_ALLOWLIST` are refused while `DELIVERY_MODE=test`. Admin sessions are issued only to `ADMIN_PHONES`; any other number on the admin form gets an identical response, no SMS and a challenge that cannot verify. Removing a number from `ADMIN_PHONES` ends its sessions immediately.
- Challenges (10 minutes, 5 attempts, browser-bound via `pp_flow`, preview-bound when gated), sessions (hashed, revocable) and throttles persist in SQLite. Throttles: 30 s resend cooldown, 5 codes/number/hour, 10 code requests/IP/hour, 12 verifications/IP/15 min, 10/number/hour, global daily SMS cap.
- Prices and availability come only from approved `config/catalog.json`; unavailable products return 409. A configured flat shipping fee is added server-side and stored per order (`shipping_fee`). Shipping country must be in the configured list. The policy version comes from `config/business.json`.
- Payment instructions carry the verified Zelle recipient. Payment reporting and admin approval are unchanged: reporting never marks an order paid; approval still requires the exact amount and a bank reference.
- Emails use live templates (business name, verified Zelle details, absolute links to `/orders/#<order>`, support contact; no demo labels). Admin email alerts on payment reports are **not** implemented pending the owner's decision.

**Additional routes**

| Endpoint | Access / purpose |
| --- | --- |
| `POST /api/customer/auth/logout-all` | Customer: end every session for the account |
| `GET /api/orders?limit=&cursor=` | Customer orders, cursor-paginated (default 50, max 100) |
| `GET /api/admin/orders?status=&limit=&cursor=` | Admin list with server-side status filter, counts per status, cursor pagination (default 50, max 200) |
| `GET /api/admin/emails?limit=&cursor=` | Admin outbox with provider ID, last event and delivery time, cursor-paginated |
| `POST /api/admin/customers/phone` | Admin-mediated phone change for the account owning `orderId`; requires `confirmed` and a verification note; revokes that account's sessions; audited |
| `POST /api/webhooks/resend` | Public, Svix-signature-authenticated delivery events (live only) |
| `GET /healthz` | Host health check (database reachable) |

**Email delivery states:** `pending` → `sending` (two-minute lease) → `accepted` (Resend returned an ID) → `sent` / `delayed` / `delivered`, or `bounced` / `complained` / `failed` / `suppressed`. `suppressed` also covers recipients outside the test allowlist and addresses suppressed after a permanent bounce or complaint; nothing is sent. `needs_review` marks an uncertain outcome beyond the provider's 24-hour idempotency window or a key conflict. Admin can retry `failed` and `needs_review`; a definite provider rejection or reviewed message gets a fresh idempotency key round, while a retry after timeouts keeps the original key so it cannot duplicate. Demo keeps `pending` / `preview` / `failed`.
