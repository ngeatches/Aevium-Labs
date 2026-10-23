# Principium Peptides website brief

Create a simple, modern, minimal informational website around the approved Principium Peptides product photography. The October 12 minimal revision supersedes the earlier ornamental, serif, sage-and-gold direction. Prioritize a clear reading order, comfortable spacing and fewer visible controls.

## Visual direction

Use an off-white background, charcoal text, bold, uppercase Space Grotesk headings with system sans-serif body copy and simple rounded controls. Use the approved ornate gold Principium Peptides logo and a gold Flower of Life circle favicon. Keep the bold modern font on the rest of the page. Preserve all 19 centered product photographs unchanged, including their label artwork. Omit the hero’s “Original content · Draft review” notice and its accompanying sentence, as requested. Use restrained gold on the catalog action and the price hover badge, with a fine outline and soft glow. Avoid slogans, scrolling banners, extra badges and repeated information.

Begin directly with the hero, without the top navigation bar or mobile menu. Let the logo fill the left half of the main panel. Put a smaller black headline on the right with the original description directly beneath it. Keep the large action typography without clipping. Use the supplied tile-layout reference for the first screen: a large original-headline/description panel, a large catalog action at bottom left, a separate “How we test” action opening the original quality copy, and three square product photographs stacked on the right. Place the ornate logo over the Flower of Life circle beside the main headline and remove its “Laboratory research materials” eyebrow. Break the action labels into “BROWSE / THE CATALOG” and “HOW / WE / TEST.” Crossfade the photographs every 3 seconds, keeping their names, amounts and destinations synchronized; use a row of three photographs on phones. Follow with a straightforward catalog: image, uppercase compound name, original dosage underneath, and a smaller price/per-vial label at the right. Show a Specifications cue on image hover/focus and open the complete popup on click or keyboard activation. Keep that cue visible on touch screens and keep native inline details working without JavaScript. Use one search field and one category menu. Put the longer quality, institutional, FAQ, ordering, policy and contact text into native expandable sections. Product popups should begin with the compound name and price, without the standalone category label, and retain the complete original specification information.

Motion should be subtle: short entrance fades, tiny card lifts and smooth hover transitions. Honor system reduced-motion preferences, provide a pause control and keep content readable without JavaScript.

## Content and scope

- Preserve `revamp.html` as the source reference. Copy all original catalog/specification, price, quality, documentation, institutional, FAQ, contact, ordering/payment and policy text verbatim as draft content.
- Keep placeholders, claims, contact information, prices and sample reports clearly identified as unverified. Preserve the separate preview privacy notice, which describes the site's actual behavior.
- October 12 scope expansion: implement a local demo cart, customer phone accounts, name/email/address/phone form, order numbers and payment instructions, simulated Zelle reporting, separate phone-code admin entry, exact-amount approval, shipping, proof/order confirmation and automatically queued email previews. Keep all live payments, SMS, email and shipping disconnected. Require versioned research-use and data-policy acknowledgments. No analytics or tracking. See `docs/ORDER_FLOW.md`.
- Preserve all approved product images and their exact names/amounts. No new imagery is needed for this revision. Do not invent product facts, lab evidence, certifications or testimonials.
- Keep server-side shared-password preview access. Store its secret only in ignored local configuration or host secrets, never in delivered assets.
- LabTrifecta remains a design reference only; do not copy its identity, content, photos or business details.

## Implementation and delivery

Use semantic HTML, plain CSS and minimal vanilla JavaScript. Put replacement pages and assets under `site/`; never serve the original mock-up, project documents or secret configuration. Use native details elements so the original copy and specifications remain available without JavaScript. Direct section links must open collapsed content.

Check desktop and mobile layouts, keyboard navigation, category/search behavior, dialogs, links and images. Verify server-side denial and successful entry whenever protection changes. Keep `README.md`, `docs/SITE_PLAN.md` and `docs/VERIFICATION.md` accurate about what is implemented and tested. Provide the working local preview; public deployment requires a chosen host and confirmed business content.
