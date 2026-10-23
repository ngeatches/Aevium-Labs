# Site plan and source audit

## Current refinement — combined account and cart control, October 13, 2026

Removed the separate top-right login. The lower-left Flower of Life appears alone for an empty cart and opens an anchored account menu. Signed-out visitors get Log in; signed-in customers see their saved name, cart, orders and sign-out. A cart count/total button appears beside the icon only when items exist. The name comes from the signed-in customer’s latest order, with Your account as the new-account fallback. Reused the existing simulated phone flow across all generated pages and product/testing dialogs. Original product copy and photographs stay unchanged. This supersedes the earlier top-right login placement.

## Current refinement — catalog header alignment, October 13, 2026

The catalog header now has two columns: Research materials with its original description underneath on the left, and search with the category popup trigger beneath on the right. On phones, the introduction comes first, followed by full-width search and the right-aligned filter. Existing counts, source notice, category popup, search behavior and product content are preserved.

## Current refinement — category popup, October 13, 2026

Replaced the small native category dropdown with a compact icon/text control and a centered Categories popup. The popup preserves All plus all ten source categories and their counts. Selecting a category immediately filters the cards and closes the dialog, updates the trigger and restores its focus. Search remains combined with category selection, and Reset clears both. A highlighted row identifies the active category. The original select remains a fallback for browsers without native dialog support. No catalog content or imagery changed.

## Current refinement — opening screen and phone login, October 13, 2026

Wrapped the existing hero in a minimum-viewport-height stage so the catalog begins below the opening screen. Native scrolling and Browse the catalog still reach the original collection. Added a top-right Log in control with a compact phone-code popup that reuses the existing local customer authentication endpoints. Successful entry returns to the homepage and changes the control to Your account, with orders and sign-out options. No original copy, product artwork or backend authentication rules changed; SMS remains disconnected.

## Current refinement — popup image frame and bottom cart, October 13, 2026

Product popups now use a bounded desktop aspect ratio with cover-fit imagery instead of a tall letterboxed container. Phones use the original square photograph. A dedicated 72px footer places the Flower of Life cart at bottom-left and previous/next navigation on the right. The content scrolls independently above this footer; changing products resets both desktop copy and phone content scroll positions. No product artwork, catalog text, values or order behavior changed.

## Current refinement — compact product actions, October 13, 2026

Removed the full-width Add to cart bar and the floating Specifications label over each photo. A compact action row now places Specifications on the left and Add to cart at the right beneath the price. Both reveal on hover/keyboard focus on desktop and remain visible on phone/touch layouts. The new Specifications button uses the existing product-dialog handler; photo activation and native no-JavaScript specifications remain. Product images, name/dose/price and full tables are unchanged.

## Current scope — customer accounts and checkout infrastructure, October 12, 2026

The user authorized collecting name/email/address/phone, phone login, order numbers, clear Zelle instructions, customer payment reporting, admin verification/fulfillment and automatic shipment email. They explicitly selected local build/testing. Customers now sign in with sample phone codes and recover orders by account; admin identity is separate. Versioned research-use/data acknowledgments accompany checkout. Automatic text/HTML emails use a durable private outbox and are captured locally for review. No SMS/email/payment/shipping provider is connected. Original hero, product imagery and source content remain unchanged. See `ORDER_FLOW.md` and `CHECKOUT_REFERENCE.md`. This supersedes the earlier browser-cookie ownership and no-customer-account scope.

## Current refinement — hover controls and login continuity, October 12, 2026

Desktop catalog Add to cart controls now reveal on hover/focus with no layout movement; touch/phone and product-dialog controls stay visible. The existing centered login brand glides into the hero following successful native server authentication, then the hero content appears in a slow stagger. Scroll reveals are 16px/700ms with an 80ms stagger. Interaction skips the entrance immediately, reduced motion bypasses it, and normal reloads do not replay it. Original images, source text and local order behavior remain unchanged.

## Current scope — local order demo and split hero, October 12, 2026

The logo fills the left half of the main hero panel; a smaller black headline and original description share its right half. All product images and source catalog text remain unchanged. Add-to-cart controls, a persistent left-side Flower of Life cart with cross-tab counts/totals, customer demo orders and a separate admin phone-code simulation are implemented. The user explicitly selected local demo: Zelle reporting, approval, shipping and downloadable proof are simulated. No SMS, payment, email or physical dispatch occurs. See `ORDER_FLOW.md` and `TECHNICAL_PLAN.md`. This scope supersedes earlier no-commerce directions below.

## Current refinement — larger hero, no top navigation, October 12, 2026

Removed the shared top navigation bar and mobile menu. The landing page begins with the hero; footer navigation and the privacy page’s back link remain. The hero logo and heading are larger. Catalog action typography scales with its container width, while the three-line testing label scales with tile height. Both retain the user’s fixed line breaks, with responsive adjustments for phones. Source copy, product photography, rotation and dialogs are unchanged.

## Current refinement — hero brand and labels, October 12, 2026

The original ornate logo overlaps the existing gold Flower of Life circle to the left of the hero headline. “Laboratory research materials” is removed. The catalog action uses two fixed lines (BROWSE / THE CATALOG); testing uses three (HOW / WE / TEST). The existing header logo, original description and product photographs remain. Rotation is shortened to 3 seconds with the same pause behavior.

## Current revision — hero tiles and gold pricing, October 12, 2026

The latest user reference sets the hero geometry: a large original-headline/description tile at upper left, a large Browse the catalog action below left, How we test beside it, and three square product photos stacked to the right. The testing action opens a separate popup containing the original quality overview and methods. On phones the photos form a three-column row below the actions. Photographs crossfade every 3 seconds, with pause behavior for user interaction, motion settings, hidden/offscreen state and open dialogs.

Catalog names now precede dosage. Price/per-vial type is reduced to 18px/13px, and the image-hover price treatment is pale gold with a soft glow. Product dialogs omit the standalone category label and place the compound name and smaller price at the top. Original specification classification, images, text, arrow navigation and login entrance remain intact. This revision supersedes conflicting card and hero directions below.

## Current interaction pass — October 12, 2026

The login screen is now a white field with a sequential Flower of Life, overlapping ornate logo, and floating password input. Only the inline submit arrow and an error when needed accompany the field. Accessible names remain; keyboard focus skips the entrance and reduced motion presents the final state immediately.

Catalog dose, compound name, price and per-vial text share a black 22px scale. Image hover/focus turns the price into a black badge with white text and reveals Specifications. The full modal places price above the title at the upper right, uses black table text at 13–14px with larger row spacing, and gently reveals its text upward in a stagger. Values are never animated through invented intermediate numbers. ArrowLeft/ArrowRight cycle and wrap through all 19 products, including outside the active catalog filter. Motion pause/reduced-motion behavior remains supported. Product images and source information are unchanged.

## Current correction — restored ornate logo, October 12, 2026

The user requested the existing ornate gold Principium Peptides logo in place of the live-text website wordmark, while keeping the modern font on the rest of the page. The header, footer and gate reuse the unchanged `brand-refined.webp`. The browser tab uses a gold Flower of Life circle SVG instead of the P monogram. The hero’s “Original content · Draft review” block and its accompanying descriptive sentence are removed. Other source content, product photographs and interactions are unchanged. This correction supersedes the wordmark recommendation below.

## Current direction — bold wordmark and dosage-first cards, October 12, 2026

The user requested a cleaner modern logo, a bold font with uppercase lettering, and a simpler product layout. The website now uses a live-text uppercase Principium Peptides wordmark in Space Grotesk, with a small spaced gold descriptor. The same wordmark appears in the header, footer and password gate; a simple P favicon accompanies it. The font is self-hosted with its license. Existing raster logos and all product photographs remain unchanged.

Main headings and product names are visually uppercase using CSS; source text and dosage units remain intact. Cards present the larger dosage first, followed by the product name, with the draft price alongside the dosage. The product image is the native summary control: hover/focus reveals a Specifications cue, and click/Enter/Space opens the enhanced dialog. Touch devices and phone layouts show the cue continuously. Without JavaScript the same control expands the original inline specification table. No content or product imagery was rewritten.

## Previous minimal direction — October 12, 2026

The user rejected the decorative styling and requested a simple, modern, minimal site. This direction supersedes the visual and structural recommendations recorded below.

The current page uses off-white, charcoal and one system sans-serif family. The approved logo and all 19 product photographs are unchanged. Gold appears only in existing branding and restrained hover/focus outlines. Ornamental hero framing, decorative icons, category pills, extra card labels and the oversized footer wordmark have been removed.

Reading order: compact header; original hero headline and description beside one product image; catalog with search, a native category menu and simple cards; six expandable sections for original quality/documentation, institutional, FAQ, ordering, policies and contact content; compact footer. All original source copy and draft prices remain present. The ordering/payment copy is text only; there is no checkout.

Scroll entrances are now an 8px fade/rise over 450ms, with row staggers capped at 80ms. Cards lift 2px and images zoom 2.5%; buttons lift 1px. The pause control lives in the footer. Native disclosures keep the longer copy accessible without JavaScript; enhanced section links expand their target and ancestors. Product dialogs, privacy and the password entry use the same neutral styling.

## Historical iterations

## Subtle motion — October 12, 2026

The user approved the visual direction and requested subtle scroll animations and smoother product-card/button hovers without changing any text or images. Sections and cards now reveal once on entry with a 650ms fade and 16px rise; grouped entries stagger by 60ms, capped at 180ms. Card lift/shadow transitions take 550ms, product zoom is a restrained 3% over 900ms, and button movement takes 450ms. The existing gold hover/focus outline remains.

A native IntersectionObserver and Web Animations API provide progressive motion. There are no hidden base styles or new dependencies. Scroll entrances animate `translate` independently from hover `transform`, preventing the two effects from fighting. Pausing cancels active animations immediately; system reduced-motion preferences use the same cancellation path. Keyboard focus skips/cancels a reveal so controls are immediately visible. Filtered results use the same entrance behavior. Original HTML and all image assets are byte-for-byte unchanged.

## Visual refinement — October 12, 2026

The user requested clearer logo text and a consistent aesthetic for fonts, buttons and surrounding components. The website now uses serif display type, warm ivory, antique bronze-gold, quiet sage panels, fine rules and rectangular controls. The hero uses a framed centered product photograph; category controls, cards, quality icons, product sheets, privacy and password entry share this visual language. Gold hover/focus outlines and motion controls remain. The logo glow was removed with the built-in image tool; original lettering and flourishes remain recognizable, and the original asset is preserved. No product photos or source draft wording changed.

The style sheet was consolidated to remove superseded styles. Headings use a local Baskerville/Palatino/Georgia stack and body text uses Avenir Next/Segoe UI/Arial, with no external font request or new runtime dependency.

## Latest revision — original copy restored

The user requested 1:1 source copy and explicitly approved all original prices, ordering/payment text and policy text as **draft content**, with checkout removed. `scripts/read-source.mjs` extracts source literals at build time. The hero, four quality pillars, all 19 product specifications, documentation, institutional information, FAQ, contact and policies now use original wording. Prices, claims and contact details remain unverified and visibly identified as drafts. The separate preview privacy page remains accurate to this site's actual behavior.

The generic marquee, “Small vials / Big questions,” “Curiosity deserves clarity,” and other added marketing sections have been removed. Gold hover/focus outlines appear around cards and controls. The compact catalog exposes all ten original categories. Product popups have a structured full specification table, fixed artwork, scrollable desktop text and previous/next navigation.

The earlier design notes below record the previous iteration and source audit; this latest revision supersedes conflicting recommendations.

Current implementation: October 10, 2026. All 19 materials appear with individual centered photography. The completed palette is warm ivory, sage and restrained gold. Search, category filters, product dialogs, hero switching, hover effects, scroll reveals, motion controls, native FAQs and a mobile menu are implemented. The local preview includes a privacy page and server-side password protection. The initial audit below remains useful background.

Inspected October 10, 2026. Findings about the local mock-up come from its source; they are not a completed browser or accessibility audit.

## Starting point

The only original project file is `revamp.html` (591,104 bytes). It contains inline styles and JavaScript, a 19-entry material catalog, hash-based page routing, a cart, checkout forms, Zelle payment instructions, and draft policy pages.

Its visual tokens use charcoal backgrounds, gold accents, Cinzel headings, and IBM Plex body text. Three image elements repeat the same embedded logo. Product visuals are generated from a shared SVG vial function rather than separate product photography.

| Existing element | Recommended treatment |
| --- | --- |
| Client name and logo | Retain provisionally; obtain the approved identity files before final imagery. |
| Researcher checkbox gate | Replace with the requested shared-password preview approach; do not equate checkboxes with identity verification. |
| Dense hero specification sheet | Move relevant verified details lower; use one clear message and prominent imagery in the hero. |
| Four quality pillars | Shorten and retain only claims supported by client evidence. |
| Product grid | Convert to an informational catalog of all 19 listings with consistent imagery; remove prices and purchase controls. |
| Sample COA with a conformity stamp | Replace with a factual explanation or actual client-supplied report; do not present a sample as evidence. |
| Cart, checkout, Zelle, order endpoint | Exclude from the new site. |
| Checkout drafts saved in localStorage | Exclude; the new site has no visitor-data forms. |
| Contact details and response promises | Confirm before publication; source comments mark contact details as placeholders. |
| Existing privacy text | Rewrite to match the informational site; it currently describes checkout data collection. |

## Reference observations

[LabTrifecta's homepage](https://www.labtrifecta.com/) was inspected in the browser and via page-text retrieval. Its hero uses large vial imagery, oversized typography, a light background, and a clear primary action. The page develops the offering through product imagery, quality explanations, documentation, and FAQ content. These are useful structural cues.

Our design interpretation: increase image scale, simplify the first screen, and create a clear progression from offering to supporting evidence. Keep Principium's own visual identity. The reference's commerce, protocol content, and claims are not automatically appropriate for this site.

## Implemented information order

| Section | Visitor question | Content and interaction |
| --- | --- | --- |
| Header | Where can I go? | Logo; anchors to materials, quality, about, and FAQ. |
| Hero | What is this company? | Clear headline, two short supporting sentences, original product composition. Primary action: “Explore research materials” linking down the page. Secondary: “Quality & documentation.” |
| Animated editorial strip | What is the tone? | Curiosity, clarity and possibility; no unsupported quality claims. |
| All 19 materials | What does it offer? | Individually illustrated cards, package amounts, live search, three category filters, and accessible detail dialogs. |
| Quality and documentation | How can I evaluate the materials? | Plain-language explanation, verified methods, and actual report links if supplied. |
| About | Who is behind the company? | Brief client-provided background and one distinct supporting image if useful. |
| FAQ | What else should I know? | Four to six questions about the offering, documentation, and intended research audience. No clinical instructions. |
| Footer | Where are the policies and contact details? | Privacy link, concise research-use statement, copyright, confirmed contact link if available. |

The primary action works without a form or an external destination. A mail link can be added when the client confirms the address; communication through email happens outside the landing page.

## Layout direction

- Use warm ivory backgrounds, sage panels, deep green text and restrained gold. The user explicitly moved away from the dark background.
- Give the hero a strong image and concise copy. Keep text live rather than baked into an image.
- Use a readable body font, limited display typography, a consistent spacing scale, and comfortable line lengths.
- On phones, keep the headline and primary action early, stack sections naturally, and avoid horizontal product carousels unless clearly useful.
- Keep essential content available without animation or JavaScript. Use native FAQ disclosure elements where appropriate.

## Client inputs needed before final publication

Confirm the client name and approved logo; featured materials and packaging; evidence for any quality statements; actual reports; contact destination; and business details needed for the privacy page. These are content dependencies, not blockers for a local layout draft. Do not invent missing facts.

## Production path — October 13, 2026

Scope from the handoff prompt: keep the approved design and demo; implement real phone authentication (Twilio Verify), transactional email (Resend) and a deployment (Render + persistent disk); prepare everything for review without activating live services. Implemented: fail-closed `live` mode with staging/production separation, verified business/catalog configuration, generated `site-live/` pages, persistent sessions and throttles, migrations, backups/restore, pagination, admin-mediated phone change, signed delivery webhooks and a staging blueprint. Pending the owner: accounts, domain/DNS, approved content and prices, admin/test numbers, the admin payment-alert decision, off-site backup storage and the launch decision. See `docs/DEPLOYMENT.md` and `docs/VERIFICATION.md`.
