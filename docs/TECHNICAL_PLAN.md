# Technical implementation

Updated October 12, 2026. The current scope is a password-protected catalog plus a local-only customer-account, order/admin and automatic email-preview demonstration. The user explicitly approved the scope expansion and chose local testing instead of live services.

## Stack

Semantic HTML, plain CSS and vanilla JavaScript; Node.js 24+ for the local server and built-in `node:sqlite`. No runtime package dependencies. `scripts/build.mjs` generates `/`, `/research-use/`, `/privacy/`, `/orders/` and `/admin/`. Source content comes from `scripts/read-source.mjs`, which reads literal data without executing `revamp.html`.

Only `site/` is a static public root. Server modules, original mock-up, design sources, docs, secret configuration and the private SQLite database remain outside it. Product photographs are unchanged. Shared logo markup lives in `scripts/brand.mjs`.

## Password gate

`PREVIEW_PASSWORD` is read from server environment or ignored `.env.local`, compared server-side using a constant-time digest comparison. The signed random HttpOnly/SameSite=Strict preview token lasts eight hours. Logout revokes it; restart invalidates sessions. Failed login attempts are throttled. Private/no-store and noindex headers remain enabled.

The research-use and privacy routes, common styling/scripts, brand assets, self-hosted font/license and robots file are intentionally public. Catalog, order/admin pages, all API routes and direct product images require entry. No original mock-up or project file is served.

## Order service

See `ORDER_FLOW.md` for routes, states and restrictions. The API uses authoritative integer-cent prices extracted server-side from the original draft. SQLite stores immutable order-line snapshots, entered sample shipping details, state history and optional proof bytes. A persisted phone-keyed customer account controls ownership through an eight-hour HttpOnly session; a separate one-hour admin session controls administrative actions. Cross-owner access returns 404.

`COMMERCE_MODE=demo` is the default and only enabled mode. Startup rejects public binding or a public origin; requests also require a loopback socket and localhost Host. Proxied hosts are rejected. `off` disables the API. There is no live provider connection, payment webhook, email sender or shipping integration; automatic emails are captured in a durable local outbox.

Same-origin JSON writes, bounded request/upload sizes, quantity validation, duplicate-order idempotency, state-transition checks and simulated login throttles protect the local flow. OTP challenges expire after five minutes, allow five attempts, and bind to a preview session. Admin sessions expire after one hour and never persist across restart. The on-screen code is deliberately a local demonstration, not proof of phone ownership.

Customer/admin roles use separate codes and cookies bound to the shared preview. Old browser-owned records remain admin-only; no automatic identity migration occurs. Orders snapshot all required contact fields and versioned policy statements. Admin approval requires the exact amount and a bank verification reference.

Order creation, approval/correction and shipment atomically enqueue a unique email event. A local worker prepares previews, backs off on failure and resumes pending work after restart; admin can retry failed records. Both customer and administrator message views enforce authorization. `mail.mjs` contains text/HTML templates and a capture-only transport; no real message is sent. See `ORDER_FLOW.md` for the live activation boundary.

## Frontend and privacy

Original source text and specification tables are included in HTML and native disclosures. JavaScript adds search, filters, accessible dialogs, keyboard navigation and motion. Commerce needs JavaScript. Cart local storage contains product IDs/quantities; storage events synchronize tabs. Separate local values hold an order retry key and an order-update signal. The privacy notice describes cart storage, sample form data, cookies, SQLite retention and administrator visibility.

Native modal dialogs contain focus, support Escape and preserve a visible cart entry point. Opening the cart closes another popup so top-layer controls remain usable. Hero animation pauses while dialogs are open. The original password entrance needs no JavaScript; keyboard focus, reduced motion and error states skip its fade sequence. The optional `entry.js` enhancement records only logo geometry and a timestamp on native form submission. The next document consumes that short-lived session-storage value. Successful landing-page entry uses transform/opacity animations and a temporary white veil; failed login, stale state, reduced motion or unsupported animation falls back to the normal page. All interaction/resizing completes the entrance immediately, and a 4.5-second fail-safe prevents hidden content. Hero rotation starts after the entrance.

## Verification and deployment

`npm run build` generates the five pages. `npm test` runs password-gate and order API integration tests. Browser verification covers the full user story from cart to admin review to customer shipping/proof, plus responsive layout and popup interactions. Actual results and limits are in `VERIFICATION.md`.

The demo is not publicly deployed. The existing server's HTTPS/Public Origin support applies only with commerce disabled; demo UI should also be removed for an informational public release. A live order system is a separate implementation with verified business data, production authentication, hosting/storage/retention choices and a revised privacy notice.

## Production path — October 13, 2026

Scope expanded by the owner's handoff prompt: implement real authentication, transactional email and deployment while keeping the demo isolated. Implemented and tested with fakes; not yet connected or deployed.

- **Configuration** (`scripts/commerce/config.mjs`): `COMMERCE_MODE=demo|off|live`; live requires `DEPLOY_ENV`, an https `PUBLIC_ORIGIN`, an absolute persistent `DATA_DIR` outside `site/`, Twilio and Resend settings, `ADMIN_PHONES`, delivery allowlists or an explicit launch, and approved business/catalog JSON. Startup refuses to run otherwise and names what is missing. Demo still refuses public binding.
- **Storage** (`db.mjs`): numbered migrations with a `schema_migrations` table; migration 1 adopts handoff-era databases unchanged. WAL, `busy_timeout`, foreign keys. Separate files per environment. Verified online backups via the SQLite backup API; automatic pre-start (before migrations) and daily backups; boot-time restore swap.
- **Authentication** (`auth.mjs`, `verify-providers.mjs`): pluggable provider (demo, automated test, Twilio Verify over HTTPS with API-key Basic auth and timeouts). Persisted hashed challenges/sessions/throttles; admin allowlist checked on every request; audited admin-mediated phone change; sign out everywhere.
- **Email** (`mail.mjs`, `email-providers.mjs`): leased outbox claims, provider message IDs, `Idempotency-Key` per message event, retry/backoff classification, 23-hour uncertainty guard, Svix-signed webhooks with timestamp tolerance, event dedupe and rank-ordered application, early-event reconciliation, local suppression list, test-recipient allowlist.
- **Server** (`server.mjs`, `startup.mjs`): `ACCESS_GATE=password|public`, host allowlist (421), trusted-proxy client address, signed webhook route ahead of the gate, `/healthz`, live HTML from `site-live/`, graceful SIGTERM, error logging without personal data.
- **Pages** (`build.mjs`, `markup.mjs`, `pages.mjs`): demo output byte-identical; live variant derived by asserted replacements (prices, availability, ordering/payment, policies, contact, footer) and live privacy/research-use policies describing Twilio, Resend and the host. `commerce.js` switches wording by `/api/shop` mode, adds shipping/tax lines, cursor "Load more", provider delivery states and the phone-change form, using existing classes.
- **Hosting**: Docker image (Node 24 slim) with a Node entrypoint that takes ownership of the disk and drops to uid 1000; `render.yaml` staging blueprint (single instance, 1 GB disk, health check, manual deploys). See `DEPLOYMENT.md`.
