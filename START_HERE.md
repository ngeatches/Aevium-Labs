# Principium Peptides — developer handoff

> **Update, October 13, 2026 (afternoon):** the production integrations have been implemented on top of this snapshot. Twilio Verify phone sign-in, Resend transactional email with signed delivery tracking, a fail-closed `live` mode, migrations, backups and a Render staging blueprint are in place. **Nothing is connected or deployed yet.** Start with [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the owner setup steps, and [docs/VERIFICATION.md](docs/VERIFICATION.md) for what was tested. The demo instructions below still apply unchanged; `npm test` now runs 24 tests.

Snapshot: October 13, 2026, after the combined Flower of Life account/cart control. This is a private source handoff, not a public website deployment.

## Open it in Codex

1. Extract the ZIP and open the extracted `principium-peptides` folder as the project in Codex.
2. Copy the entire contents of `HANDOFF_PROMPT.txt` into a new conversation in that project. The prompt tells Codex what exists, what must stay, and how to finish the integrations.
3. Keep this folder private. Publishing the ZIP or project root would expose the original mock-up and project documents. Only `site/` is the current static public root; the backend and its data must remain private.

The ZIP includes the actual application, backend, tests, source reference, approved image originals and web exports, font license, design guide, plans and selected current screenshots. It excludes the previous developer's `.env.local`, database, sessions, logs, dependencies, private uploads and machine-specific skill repositories. Historical documentation may point to older screenshots or local resource paths that are not in this archive. They are not runtime requirements. The old root-level mock-up entry page is omitted; the current page is `site/index.html`.

## Run the current local version

Use Node.js 24 or newer. No package installation is required for the included version.

```sh
cp .env.example .env.local
```

Open `.env.local` in the editor and set a new `PREVIEW_PASSWORD`. Keep `COMMERCE_MODE=demo`. Do not paste the password into a chat or public file. The previous preview password is intentionally not shared in the archive. This simple local configuration reader expects unquoted `KEY=value` lines.

```sh
npm run build
npm test
npm start
```

Visit [the local preview](http://127.0.0.1:4173/). Keep the server terminal running. Tests need permission to listen on local loopback ports. If 4173 is already in use, stop the other preview or set `PORT` in the shell environment; the current `.env.local` reader does not apply `PORT`.

The order database is created automatically in ignored `.data/`. It starts empty in this handoff. In the Flower of Life menu, sign in with sample customer **+12025550198** using the displayed demo code. Admin uses **+12025550199** at `/admin/`. No text messages are sent. Use **Use sample details** during checkout; all payments, shipments and emails remain simulated. An account without an order shows **Your account** until saved shipping details supply its name.

## What the owner needs to supply

- Twilio account and a Verify Service for phone verification, with server-side credentials entered privately. [Twilio Verify documentation](https://www.twilio.com/docs/verify/api).
- A transactional email provider, sender address/domain and access to its DNS settings. Resend is one possible option, not an existing integration or required choice. [Domain verification](https://resend.com/docs/dashboard/domains/introduction).
- Hosting/domain choice and durable database/file storage. The current application uses Node and SQLite and cannot run as a static HTML upload alone.
- Authorized admin phone number(s), verified Zelle recipient and support details, approved catalog/business rules and production policy decisions.
- Approved recipient numbers/addresses for any real delivery tests, followed by a deliberate launch decision.

The prompt directs Codex to prepare useful code and tests while these inputs are pending. Do not simply remove the localhost restrictions or paste credentials into the demo and assume it is live.

## Baseline and documentation

The packaged source was extracted into a separate folder, rebuilt successfully, and passed all 11 integration tests. Rebuilding reproduced the packaged files without changes. Desktop/mobile review covered the latest account/cart change, with product copy and approved images unchanged. See `docs/VERIFICATION.md` for exact evidence and limitations; rerun on the receiving machine.

`README.md` explains the implemented application. `docs/ORDER_FLOW.md` maps order states and endpoints. `docs/TECHNICAL_PLAN.md` describes infrastructure. `DESIGN.md` protects the approved appearance. `HANDOFF_PROMPT.txt` is the completion request to paste, not an instruction to activate live services merely by opening the project.

`HANDOFF_MANIFEST.sha256` in the ZIP records the packaged file hashes. It checks transfer integrity, not publisher authenticity. On macOS/Linux, run `shasum -a 256 -c HANDOFF_MANIFEST.sha256` from the extracted folder if desired.
