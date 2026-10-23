# Staging and production deployment

Prepared October 13, 2026. **Nothing here has been deployed or connected to a real account.** Every step marked *Owner* requires the owner's accounts, billing, domain access or approval. Live delivery stays restricted to approved test recipients until the owner deliberately launches.

## Modes at a glance

| | Demo (local) | Staging | Production |
| --- | --- | --- | --- |
| `COMMERCE_MODE` | `demo` | `live` | `live` |
| `DEPLOY_ENV` | — | `staging` | `production` |
| Where | `127.0.0.1` only | Render web service + disk | Separate Render web service + disk |
| Access | Shared password | Shared password (`ACCESS_GATE=password`, enforced) | Password until launch, then `public` |
| Sign-in codes | Shown on screen | Twilio Verify SMS | Twilio Verify SMS |
| Email | Captured locally | Resend | Resend |
| Recipients | Sample data | `DELIVERY_MODE=test`: allowlisted phones/emails only | `test` until `DELIVERY_MODE=open` + `LAUNCH_APPROVED=yes` |
| Prices / business details | Unverified draft (`revamp.html`) | `config/catalog.json`, `config/business.json` (approved) | Same, approved |
| Database | `.data/demo-orders.sqlite` | `/var/data/principium-staging.sqlite` | `/var/data/principium-production.sqlite` |

Live mode **fails closed**: `npm start` refuses to run if any required setting, approval flag or generated live page is missing, and lists the setting *names* (never values). Run `npm run check-config` to see what is still missing.

## Architecture (smallest practical)

One always-on Node 24 process serves pages, the API, the signed email webhook and the email worker. SQLite lives on a persistent disk (WAL mode). Proof files are stored inside the database. The email outbox is durable: rows are claimed with a two-minute lease, so a crash or redeploy resumes work and retries with the same provider idempotency key. Sessions, sign-in challenges and throttles are stored in the database and survive restarts.

Constraints that follow from this design:
- **Run exactly one instance per environment.** SQLite on one disk has one writer; do not enable autoscaling or add instances.
- Expect a short interruption during deploys (Render stops the old instance before attaching the disk to the new one).
- The worker uses an in-process timer. That is acceptable only because the service is always on; never deploy this to a serverless or scale-to-zero host.
- Daily backups also run in-process, and a verified backup is taken at every start *before* migrations run.

Why Render: it runs the Dockerfile unchanged, provides HTTPS certificates, custom domains, secret environment variables, persistent disks with snapshots, health checks and one-click rollback. Fly.io (machine + volume) or a small VPS (Docker + Caddy) also work with the same image. Change `TRUST_PROXY_HOPS` to match the proxy in front.

## 1. Owner: accounts and decisions

1. **Domain:** pick the store domain and a staging subdomain (e.g. `staging.example.com`). You need access to its DNS settings.
2. **Business content:** copy `config/business.example.json` → `config/business.json` and `config/catalog.example.json` → `config/catalog.json`. Fill every field with verified values: business name, support email, the **verified Zelle recipient and enrolled email/phone**, countries served, flat shipping fee (cents), the tax statement (automatic tax calculation is not implemented; `tax.mode` must be `not_collected` with an approved statement), shipping/refund/terms policy text, retention statement, policy version. Confirm each of the 19 prices and availability flags. Set `approved.by`/`approved.date`, `zelle.verified: true` and `policiesApproved: true` only after you (and counsel, if used) have reviewed them. Review the generated `/privacy/` and `/research-use/` pages in staging before approving.
3. **Admin phone numbers:** the only numbers that can ever reach the order desk (`ADMIN_PHONES`).
4. **Test recipients:** one or two phone numbers and email addresses you control for staging tests.

## 2. Owner: Twilio Verify (phone sign-in)

1. Create or open a Twilio account and upgrade it from trial (trial accounts can only text verified numbers).
2. Console → **Verify → Services → Create**. Name it e.g. "Principium Staging". Enable the **SMS** channel only; leave the code length at 6. Fraud Guard is on by default for SMS; keep it on.
3. Console → **Messaging/Verify Geo permissions:** allow only **United States** and **Canada** (the app only accepts +1 numbers).
4. Console → Account → **API keys & tokens → Create API key** (Standard). Save the SID (`SK…`) and secret once.
5. Enter in the Render dashboard (not chat, not git): `TWILIO_ACCOUNT_SID` (AC…), `TWILIO_API_KEY_SID` (SK…), `TWILIO_API_KEY_SECRET`, `TWILIO_VERIFY_SERVICE_SID` (VA…).
6. Use a separate Verify service (and preferably a separate API key) for production.

App-side safeguards already implemented: +1 normalization and validation, 30-second resend cooldown, 5 codes per number per hour, 10 code requests per IP per hour, global `SMS_DAILY_LIMIT`, 5 attempts per challenge, 10-minute expiry, challenge bound to the requesting browser (and preview session on staging), 8-second provider timeouts, and admin requests for non-admin numbers never trigger an SMS.

## 3. Owner: Resend (transactional email)

1. Create a Resend account. **Domains → Add domain**, preferably a sending subdomain (e.g. `send.example.com`). Add the DNS records it shows (SPF/MX and DKIM) at your DNS provider and wait for **Verified**. Adding a DMARC record (`_dmarc`, start with `p=none`) is recommended.
2. In the domain settings, **turn off open and click tracking** (the privacy policy states there is no tracking).
3. **API keys → Create** a key with *sending access* limited to that domain → `RESEND_API_KEY`.
4. **Webhooks → Add endpoint:** `https://<staging domain>/api/webhooks/resend`, events `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed` (and `email.suppressed` if offered). Copy its signing secret → `RESEND_WEBHOOK_SECRET` (`whsec_…`).
5. `MAIL_FROM` = `Principium Peptides <orders@send.example.com>` (must use the verified domain); `MAIL_REPLY_TO` = your support inbox.
6. Use a separate API key and webhook for production.

Behaviour: every send carries an `Idempotency-Key` (`principium-<env>:<order>:<event>`), so a retry after a timeout or crash cannot send twice within Resend's 24-hour window. A message is shown as **Accepted** when Resend takes it and only becomes **Delivered** when a signed `email.delivered` event arrives. Events are verified (HMAC, 5-minute timestamp tolerance), stored once per `svix-id`, applied in rank order (a late `sent` never overrides `delivered`), and held until the send result is recorded if they arrive early. Permanent bounces and complaints add the address to a local suppression list. If a message's outcome is still uncertain after 23 hours it becomes **Needs review** instead of resending blindly.

## 4. Deploy staging on Render

1. Put this project in a **private** Git repository (GitHub/GitLab). Commit `config/business.json` and `config/catalog.json` (not secret). Never commit `.env.local`, `.data/` or `site-live/`.
2. Render → **New → Blueprint**, select the repo. Review `render.yaml` (Starter plan, 1 GB disk at `/var/data`, `virginia` region, single instance, health check `/healthz`, auto-deploy off). Apply.
3. Enter every `sync: false` variable in the service's **Environment** page: `PUBLIC_ORIGIN` (`https://staging.example.com`), a new strong `PREVIEW_PASSWORD`, `ADMIN_PHONES`, `TEST_PHONE_ALLOWLIST` (must include the admin numbers), `TEST_EMAIL_ALLOWLIST`, the Twilio and Resend values above, `MAIL_FROM`, `MAIL_REPLY_TO`.
4. **Settings → Custom domains:** add `staging.example.com`; create the CNAME it shows at your DNS provider. Render issues the HTTPS certificate.
5. Deploy manually. The log should show `Principium ready: https://staging.example.com (live/staging · delivery test · gate password)`. If it lists missing items instead, fix them and redeploy.

## 5. Owner-approved staging test (real messages, allowlisted only)

With the owner present and using only allowlisted phone/email:
1. Enter the preview password → Flower of Life → Log in with an allowlisted phone → receive the SMS → sign in.
2. Add items → checkout with an allowlisted email → confirm the order email arrives and shows **Delivered** in Admin → Automatic emails.
3. Report payment; sign into `/admin/` with an admin phone; approve with the exact amount and a test reference; record a test shipment; confirm both emails arrive.
4. Confirm a non-allowlisted phone is refused, and a non-admin number on `/admin/` receives no text.
5. Record results in `docs/VERIFICATION.md`.

No real money should move during staging. Use the Zelle details only after the owner confirms them.

## 6. Production

Create a second service (duplicate the staging block in `render.yaml` as `principium-production` or create it in the dashboard from the same repo) with: `DEPLOY_ENV=production`, its own disk, its own domain/`PUBLIC_ORIGIN`, production Twilio Verify service/key, production Resend key/webhook, a raised `SMS_DAILY_LIMIT` if needed, and initially `ACCESS_GATE=password` and `DELIVERY_MODE=test`. Repeat the section 5 test.

**Launch (owner decision only):** set `ACCESS_GATE=public`, `DELIVERY_MODE=open`, `LAUNCH_APPROVED=yes` (and `ALLOW_INDEXING=yes` if search engines should index the store), then redeploy. Startup refuses `open` delivery without `LAUNCH_APPROVED=yes`, and refuses `public` access outside production.

## Migrations

Schema changes live in `scripts/commerce/db.mjs` as numbered, append-only migrations recorded in `schema_migrations`. They run automatically at startup inside a transaction, **after** a verified pre-start backup. A database whose schema is newer than the running code refuses to start (protects against rolling code back over migrated data). To add a change: append a new migration with the next id; never edit a released one; add a test.

## Backups

- Automatic: `pre-start-*` (each boot, keep 10) and `daily-*` (every 24 h while running, keep 14) in `$DATA_DIR/backups`, each a single self-contained file verified with `PRAGMA integrity_check`.
- Manual: Render Shell → `npm run backup` (keeps 30 `manual-*`).
- Disk snapshots: Render snapshots persistent disks automatically; check the current schedule and retention in the dashboard.
- **Off-site copy (owner decision):** backups on the same disk do not protect against losing the disk or the account. Periodically download one (Render Shell/SSH → `scp`), or approve an object-storage bucket (e.g. S3, Cloudflare R2) for automated uploads; that integration is not built yet.

## Restore from a backup

1. Render Shell: `ls /var/data/backups` and pick a file.
2. `cp /var/data/backups/<file>.sqlite /var/data/principium-<env>.sqlite.restore`
3. Restart the service (dashboard → Manual Deploy → *Restart*). At boot the restore file is integrity-checked, the current database is backed up as `replaced-by-restore-*`, and the restore file is swapped in. A failed check stops startup without changing anything (delete the `.restore` file to boot normally).

Local demo: stop the server, then use `node scripts/backup.mjs <source> <target>` or move `.data/` aside.

## Rollback

- **Code only, no new migration:** Render → Deploys → *Rollback* to the previous deploy.
- **Release included a migration:** the older code will refuse the newer schema. Restore the `pre-start-*` backup taken when the newer release first booted (it matches the old schema) using the restore procedure, then roll back. Orders created after that backup would be lost, so first export them (Admin view or `npm run backup`) and reconcile by hand.

## HTTPS, proxy and origin handling

Render terminates TLS and forwards to the container on `PORT` (10000). With `PUBLIC_ORIGIN` set, cookies are `Secure`, HSTS is sent, the `Host` header must match the origin (others get 421, except `/healthz`), and every write must carry that exact `Origin`. `TRUST_PROXY_HOPS=1` makes throttles use the client address from Render's `X-Forwarded-For`; set it to match your proxy chain if you add e.g. Cloudflare.

## Private files and data

Proof files and order data are served only through authorized API routes (owning customer or admin session); nothing under `$DATA_DIR` is web-accessible. Logs contain error classes/messages only — never codes, tokens, message bodies or customer details.

## Account recovery and phone changes

Customers sign in only with their phone. If they lose that number, they contact support; an admin verifies identity outside the site (order number, email address, shipping address) and uses **Change account phone** on one of the customer's orders in `/admin/`. This moves the account (and all orders) to the new number, ends every existing session for it, and records who did it, when and why (`customer_phone_changes`). Customers can also sign out on all devices (`POST /api/customer/auth/logout-all`). Email-based self-recovery is intentionally not offered, so an email compromise cannot take over an account. Admin access is revoked by removing a number from `ADMIN_PHONES` and redeploying; existing admin sessions stop working immediately.

## Local rehearsal of live mode (no accounts needed)

```sh
BUSINESS_CONFIG=path/to/business.json CATALOG_CONFIG=path/to/catalog.json npm run build
BUSINESS_CONFIG=path/to/business.json CATALOG_CONFIG=path/to/catalog.json npm run rehearse
```

Open http://127.0.0.1:4174/. It uses fake providers: codes and email summaries print in the terminal; nothing is sent.
