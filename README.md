# Principium Peptides

**Status (October 13, 2026):** the local demo is unchanged and still the default. A real production path now exists in code — Twilio Verify phone sign-in, Resend transactional email with signed delivery tracking, persistent sessions/throttles, migrations, backups and a Render deployment — but it has **not** been connected to any account or deployed. It stays fail-closed until the owner supplies credentials, approved business/catalog configuration and a launch decision. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

A private local website and order-workflow demonstration built from the supplied `revamp.html`. The original mock-up, all 19 approved product photographs, names, amounts and specification tables are preserved. Original prices, claims, contact details and policies remain unverified draft content.

The opening section fills at least one viewport, keeping the catalog below the first screen until visitors scroll or choose Browse the catalog. The hero places the ornate Principium Peptides logo and Flower of Life across the left half of its main panel. A smaller black headline sits on the right, with its original description immediately underneath. The catalog and testing action tiles retain their requested line breaks; three product images rotate every three seconds. The off-white, charcoal and restrained gold design uses self-hosted Space Grotesk headings and system body text.

## Run locally

For the transferable project snapshot and completion prompt, start with [START_HERE.md](START_HERE.md) and [HANDOFF_PROMPT.txt](HANDOFF_PROMPT.txt). The handoff excludes local secrets and demo records; its recipient must set a new preview password.

Requires **Node.js 24 or newer**, including its built-in SQLite module. No package installation is needed.

```sh
npm run build
npm start
npm test
```

Open [the preview](http://127.0.0.1:4173/). The requested shared password is already configured in ignored `.env.local`. On another computer, copy `.env.example` to `.env.local` and set `PREVIEW_PASSWORD`. Never put this secret in `site/` or a public repository.

`npm run build` regenerates the catalog, research-use, privacy, customer-orders and admin HTML. CSS/JS edits only require reloading the browser. Server/module changes require restarting `npm start`. Node 24 may print an experimental SQLite warning.

## Local checkout workflow

The user expanded the scope on October 12 to include customer phone accounts and automatic order emails, and confirmed **build and test locally first**. The existing appearance and approved images stay unchanged.

1. Add materials from the cards or specification popups. The left-side Flower of Life cart synchronizes quantities, count and totals across tabs on the same origin.
2. Select **Order**, then request a sign-in code for the prefilled fictional customer number, **+12025550198**. Enter the code displayed on screen. No SMS is sent. Other sample customer numbers from +12025550100 through +12025550198 create separate demo accounts.
   You can choose **Email** instead and enter any fabricated address (for example `researcher@example.test`); the code is shown on screen and nothing is sent. After the code, a new account fills out a one-time profile — first name, optional last name, date of birth (21 or older, checked on the server) and role (Academic researcher, Lab / institutional researcher, Clinical professional or Graduate / PhD student). Ordering is refused until the profile is complete; returning customers are not asked again. Email accounts give a phone number for shipping updates at checkout.
3. Choose **Use sample details**, review the name/email/address/phone fields, and check the research-use and data-policy acknowledgments. Place the demo order to receive its order number, draft total and payment steps. The sample Zelle recipient cannot receive funds; do not send money.
4. On [Your orders](http://127.0.0.1:4173/orders/), report a simulated payment. The order enters the administrator's review queue. Reporting payment does not verify bank receipt.
5. On [Admin](http://127.0.0.1:4173/admin/), request the displayed demo code for **+12025550199**. Review the order, enter its exact total and a sample bank verification reference, then approve. Alternatively, return the report with a correction note.
6. Following approval, enter carrier, tracking number, fulfillment reference, optional note and optional PDF/PNG/JPEG proof file (up to 4 MB). **Confirm shipment & queue email** records the shipment and automatically queues its email preview.
   The order desk also has a **Customers** list: everyone who has placed an order (name, email, phone, role, date of birth, order numbers, total ordered and paid, ship-to city). A customer appears as soon as their order number is created. **Download spreadsheet (CSV)** exports it for Excel, Numbers or Google Sheets (admin sign-in required; formula-like values are neutralized). All of this lives in the SQLite database (`.data/demo-orders.sqlite` locally; the persistent disk in production).
7. Customers see shipment details, downloadable proof/order confirmation and captured email previews. Admin can inspect recipients, preparation status and retry failed previews in **Automatic email previews**. Sign out and sign in with the same customer phone to recover that account's orders.

The bottom-left Flower of Life combines account and cart access across the site. With an empty cart, only the icon is visible. Clicking it opens a small menu above it with **Log in**; the centered phone popup uses the same sample phone/code flow. Successful verification reopens the menu with the customer’s saved name, **Your cart**, **Your orders** and sign-out. The name comes from their latest order; accounts without an order show **Your account**. Adding items reveals a separate cart count/total beside the icon that opens the cart directly. Equivalent controls remain available inside product/testing popups. Escape closes the menu or login popup and restores icon focus. Codes remain local simulations; no SMS is sent. The original catalog remains accessible through native scrolling and anchor links.

Order creation, payment approval/return and shipment each queue a text/HTML email automatically in a private SQLite outbox. An order change and its email are committed together. A local worker captures the preview, retries failed preparation up to five attempts, and resumes pending messages after restart. Event keys prevent duplicate queued updates. **Captured locally** never means delivered.

There are no live orders, bank transfers, SMS/email deliveries, shipping purchases, analytics or third-party embeds. Demo phone codes appear on screen and do not establish real phone ownership. Use fabricated contact details only. Customer sign-in never grants admin access; the shared preview gate remains separate from both.

`COMMERCE_MODE` defaults to `demo`, which requires localhost binding and requests. `off` disables the API, but generated controls remain and should be removed before an informational public release. `live` is the production path (below); it cannot be reached by adding credentials to the demo. See [the complete order flow](docs/ORDER_FLOW.md) and [reference research](docs/CHECKOUT_REFERENCE.md).

## Modes: demo, staging, production

| Mode | Purpose | What is real |
| --- | --- | --- |
| `demo` (default) | Local review on 127.0.0.1 | Nothing: on-screen codes, captured emails, draft prices, sample Zelle recipient |
| `live` + `DEPLOY_ENV=staging` | Password-protected rehearsal on the host | Twilio SMS codes and Resend emails, **only to allowlisted test numbers/addresses** (`DELIVERY_MODE=test`) |
| `live` + `DEPLOY_ENV=production` | The store | Same providers; public access and unrestricted delivery only after `ACCESS_GATE=public`, `DELIVERY_MODE=open` and `LAUNCH_APPROVED=yes` |

Live mode reads approved prices/availability from `config/catalog.json` and business, Zelle, shipping, tax-statement and policy content from `config/business.json` (templates in `config/*.example.json`). `npm run build` then also generates `site-live/` — the same approved design with verified prices, payment instructions, policies and contact details, and without demo labels. `npm run check-config` lists anything missing by name. `npm run rehearse` runs live mode locally with fake providers (codes print in the terminal; nothing is sent).

Commands: `npm run build`, `npm test` (24 integration tests; all providers faked), `npm start`, `npm run check-config`, `npm run backup`, `npm run rehearse`.

## Data and access

Browser local storage contains cart identifiers/quantities, an order retry key and anonymous update signals. Customer accounts, sample contact details, order snapshots/history, policy versions/acknowledgments, payment reviews, shipping, proof files and email previews persist in ignored `.data/demo-orders.sqlite`, outside the website root. Database files are created with private permissions. To begin a fresh demo without discarding records, stop the server, move `.data/` to a private backup, then restart.

`pp_customer` is an eight-hour HttpOnly customer session (SameSite=Lax so emailed order links arrive signed in; writes still require a matching Origin). `pp_admin` is a separate one-hour HttpOnly admin session (SameSite=Strict). `pp_flow` binds a sign-in code to the browser that requested it. Sessions, challenges and throttles are stored hashed in SQLite. With the password gate on (demo, staging) sessions are also bound to the preview session, so a demo restart (new preview signing key) still signs everyone out. Single-use codes expire after five minutes in the demo (ten with Twilio), allow five attempts, and have request/verification rate limits. Signing in again with the same phone restores its orders. The former `pp_order_browser` cookie no longer authorizes orders; existing orders from that earlier version remain admin-only and are preserved.

The eight-hour shared preview gate protects catalog/order/admin pages, APIs and direct product images. The research-use/privacy pages and shared styling, scripts, font and brand assets are intentionally available before entry. **Lock preview** revokes its signed HttpOnly token. API writes require same-origin requests. Customer order, proof and email access is restricted to the signed-in account; administrative routes check a separate admin session.

The research-use policy records declared intent, age, handling qualifications and data-policy acknowledgment with a version/time. It does not independently certify qualifications, product quality or end use. Both policies describe this local implementation, not a live business service.

## Interface details

The catalog header places Research materials and its original description on the left, with search at the top-right and the category control directly beneath it. On phones the heading/description precede the full-width search, with the filter right-aligned below. The compact category control opens a centered popup containing All and all ten original categories with their full-catalog counts. Selecting a row immediately filters the cards and closes the popup; its current label/count update alongside the results. Search combines with the selected category. The selected row has a restrained gold highlight, and Escape/close returns focus to the trigger. The original select remains a fallback if native dialogs are unavailable.

Cards show compound name, dose underneath and smaller price at the upper right. Specifications and a compact Add to cart control share one row below the product details, with Add to cart aligned under the price. The former full-width cart button and image-overlay Specifications label are removed. On desktop, the row fades upward while its card is hovered, keyboard-focused or briefly showing Added feedback; its space is reserved to prevent layout jumps. Phone and touch layouts keep both controls visible. Clicking the image or using Specifications opens the original table; Enter/Space is supported. Left/right arrows cycle through all 19 products, even with a catalog filter active. Search, category selection and six expandable source-information sections remain available. The testing tile opens the original quality text separately. Product popups fit the existing photograph edge-to-edge in a proportioned frame, with a square image on phones. A fixed popup footer keeps the cart at bottom-left and product navigation at the right while specifications scroll.

After a successful preview login, the centered brand glides into its hero position over 1.45 seconds; the heading, description, actions and images reveal in sequence, finishing at about 2.45 seconds. Ordinary refreshes do not replay it. Scroll, touch, pointer, keyboard, focus or resize activity immediately completes the entrance. Reduced-motion users enter directly. Only temporary logo geometry and a timestamp are passed through session storage; authentication remains on the server.

Catalog rows and information sections rise 16px and fade over 700ms as they enter on scroll, with an 80ms row stagger. Subtle entrance and hover motion respects system reduced motion and the footer pause control. Hero rotation pauses during hover/focus, when a popup is open, when offscreen or hidden, and when motion is paused. Original catalog and disclosures remain readable without JavaScript; ordering requires JavaScript.

## Project map

| Path | Purpose |
| --- | --- |
| `site/` | Website HTML, scripts, styles, fonts and approved images; the only static public root |
| `scripts/build.mjs` | Generates landing, research-use, privacy, orders and admin pages |
| `scripts/brand.mjs` | Shared ornate logo and Flower of Life favicon |
| `scripts/read-source.mjs` | Extracts original literal content without executing the mock-up |
| `scripts/commerce/markup.mjs` | Cart, orders and admin page markup |
| `scripts/commerce/service.mjs` | Local order API, SQLite storage, payment review and fulfillment |
| `scripts/commerce/auth.mjs` | Customer phone-or-email and admin phone authentication, persisted sessions/throttles, admin allowlist, phone change |
| `scripts/commerce/verify-providers.mjs` | Demo, automated-test and Twilio Verify sign-in providers |
| `scripts/commerce/email-providers.mjs` | Local capture, Resend transport and webhook signature verification |
| `scripts/commerce/config.mjs`, `startup.mjs` | Mode configuration, fail-closed validation and server startup |
| `scripts/commerce/db.mjs` | SQLite opening, numbered migrations and verified backups |
| `config/` | Templates for approved business and catalog configuration |
| `site-live/` | Generated live pages (ignored; built only from approved configuration) |
| `Dockerfile`, `deploy/`, `render.yaml` | Container image, privilege-dropping entrypoint and Render staging blueprint |
| `scripts/backup.mjs`, `check-config.mjs`, `rehearse-live.mjs` | Backups, configuration check, live rehearsal with fakes |
| `scripts/commerce/mail.mjs` | Demo/live templates, durable leased outbox, delivery states, webhook event application, suppression |
| `scripts/commerce/policy.mjs`, `pages.mjs` | Versioned research acknowledgments and data/research policy pages |
| `site/assets/js/commerce.js` | Cart, order creation, payment reporting and admin interactions |
| `site/assets/js/main.js` | Catalog, dialogs and scroll motion |
| `site/assets/js/entry.js` | Optional login-to-hero animation; no authentication logic |
| `server.mjs` | Shared-password gate, static serving and local API routing |
| `tests/` | Access-control and order-workflow integration tests |
| `.data/` | Ignored private local demo records; never serve or publish |
| `design/` | Image originals, generation records and verification screenshots |
| `DESIGN.md`, `SKILLS.md` | Current design system and selected design resources |
| `docs/` | Site/technical plans, order flow and actual verification results |
| `revamp.html` | Preserved source reference; never served |

## Deployment status

Not deployed. The production path is implemented and tested with fakes (see `docs/VERIFICATION.md`), and a Render staging blueprint is prepared for review. Before any real order: the owner supplies Twilio and Resend accounts, a domain and DNS access, approved `config/business.json`/`config/catalog.json` (verified Zelle recipient, prices, shipping/tax/refund/retention decisions and policies), admin and test numbers, then runs the staging test in `docs/DEPLOYMENT.md` and makes an explicit launch decision. Original quality claims, the sample COA and the hero's testing statements remain unverified source content; replace or remove them with evidence before public launch. Do not publish project documents, the source mock-up, `.env*`, `config/` or `.data/` as website assets. LabTrifecta and the installed design resources were references only.
