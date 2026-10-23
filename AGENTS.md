# Project guidance

This project is an informational landing page for the client named Principium Peptides in the original mock-up. Read `README.md` and the relevant planning file before changing that part of the site.

- Preserve `revamp.html` as the source reference. Put replacement website files under `site/`.
- Default to semantic HTML, plain CSS, and minimal vanilla JavaScript. Keep content readable without JavaScript.
- Scope expanded by the user October 12 (local demo) and October 13 (real phone authentication, transactional email and deployment). Read `docs/ORDER_FLOW.md` and `docs/DEPLOYMENT.md`. Keep the demo isolated and default. Live mode uses Twilio Verify and Resend only with the owner's configured accounts; never send live messages from automated tests (use the fakes in `tests/live.test.mjs`), never enable `DELIVERY_MODE=open` or `ACCESS_GATE=public` without the owner's explicit launch decision, and never ask for secrets in chat. Payments stay manual Zelle with admin verification; shipping stays manual. Keep analytics and tracking excluded. Use fabricated contact details when testing.
- Live prices and business details come only from approved `config/catalog.json` / `config/business.json`; do not promote draft content into them. Schema changes are append-only migrations in `scripts/commerce/db.mjs`.
- Treat mock-up prices, contact information, product specifications, quality claims, and policies as unverified. Do not promote placeholders to facts.
- Use LabTrifecta for design reference only. Do not copy its branding, images, text, certifications, or business details.
- Follow `docs/IMAGE_PLAN.md` for imagery. Preserve established brand assets unless their redesign is requested. Generated imagery must not imply verified lab facilities or fabricated test evidence.
- Keep the preview secret in ignored local configuration or the host's secret settings. Never publish it, its verifier, project documents, or the original mock-up as website assets. A JavaScript password overlay is not access control.
- Deploy only the website directory and any explicitly required host-side configuration. Verify protection for direct URLs and assets when enabled.
- Use `SKILLS.md` as a workflow map, not an instruction to activate every skill. Read a selected skill's actual instructions before using it.
- For visual changes, read `DESIGN.md` and consult the October 6 design-resource map in `SKILLS.md`. Apply relevant guidance within the user's current minimal direction and copy/image constraints.
- Verify responsive layout, keyboard access, links, and images for UI work; verify server-side denial and successful entry for access-control work. Do not report planned checks as passed.
- Keep the README accurate about implemented features and real commands. Do not add a dependency or elaborate workflow without a concrete need.
