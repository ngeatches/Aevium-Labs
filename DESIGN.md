# Principium Peptides design guide

Current direction: October 13, 2026. Read this alongside `README.md` before visual work. This records the user's current preferences; historical directions in `docs/SITE_PLAN.md` do not override it.

## Intent

A simple, modern informational catalog. Product photography carries the page; typography, spacing and interactions make the original material easy to browse. Keep the interface quiet, with subtle motion and a restrained gold accent.

## Preserve

- Original wording from `revamp.html`, including all 19 names, package amounts and specifications. Prices, claims, ordering information and policies remain explicitly unverified draft content. The newly authorized order flow is a local demo only.
- All approved product photographs and their embedded labels. Do not regenerate or relabel them during layout work.
- The approved ornate gold logo (`brand-refined.webp`) in the hero, footer and password gate, plus the gold Flower of Life circle favicon. Keep Space Grotesk on the rest of the page. Bold uppercase styling uses CSS; dosage units and source strings retain their original case.
- The hero omits “Original content · Draft review” and its descriptive notice, as requested. Do not reinsert that block during later polish.
- Semantic HTML, plain CSS and small progressive JavaScript enhancements. No UI framework or animation dependency is needed.

## Checkout surfaces

Phone sign-in, shipping fields, policy acknowledgments and payment steps use the existing quiet panels and gold/charcoal controls. Put the order number and status first, followed by four progress steps, items/total and the action appropriate to the current state. Keep private address, timeline, policy record and email previews in disclosures. The admin page shows review/fulfillment/shipped counts and readable forms. Preserve edited forms during automatic refresh. Local-only labels belong to the transaction flow; do not add another hero notice.

## Visual system

| Element | Rule |
| --- | --- |
| Canvas | Off-white `#fafafa`; white panels only where useful |
| Text | Charcoal `#202124`; secondary text `#737578`; rules `#e6e6e6` |
| Accent | Gold `#a7894d` for hover/focus outlines; existing gold logo artwork and `#aa812b` for the favicon |
| Display type | Self-hosted Space Grotesk, primarily weight 700; uppercase main headings and product names |
| Body type | System sans-serif for long source text and specification tables |
| Numeric content | Tabular numerals for dosage, price and product-position comparisons |
| Spacing | Content width capped at 1200px; responsive outer gutters; consistent row/column gaps |
| Surfaces | Flat neutral hero tiles and modest corner radii; a restrained gold glow is reserved for the requested price hover |

The implemented values and breakpoints live in `site/assets/css/styles.css`. Do not add competing visual overrides or restore earlier serif page typography, dark backgrounds, pill filters, ornamental panels or extra marketing copy.

## Hero tiles

Keep the opening stage at least one dynamic viewport tall so no catalog heading or listings peek into the initial screen. Use native scrolling and the existing Browse anchor to reveal the catalog; do not gate it behind JavaScript. Keep account access in the bottom-left Flower of Life control; omit the separate top-right login. Reuse the customer demo phone-code flow and its clear local-only notice. Preserve focus restoration, responsive sizing and existing motion preferences.

Follow the supplied screenshot's layout, keeping Principium's own copy and photographs: one large headline/description tile across the upper left, a large catalog action at bottom left, a “How we test” action beside it, and three equally sized square photographs stacked at the right. The testing action opens a separate dialog containing the original quality overview and methods. Its anchor remains a fallback to the existing Quality section without JavaScript.

Omit the top navigation bar, including its mobile menu, from both pages; keep footer links and the privacy back link. Let the logo fill the left half of the primary tile. Use a smaller headline in its right half and place the description immediately beneath it; let action labels fill their tiles without clipping. Place the existing ornate wordmark over the Flower of Life circle, to the left of the main headline. Omit “Laboratory research materials.” Preserve explicit action-label breaks: BROWSE / THE CATALOG and HOW / WE / TEST, including on phones. Use a neutral white primary tile, quiet gold catalog tile and light gray-green testing tile. Do not add a video or copy the reference site's content. On phones, put the text first, the two actions next, then a row of three photos.

Crossfade the three photographs together every 3 seconds. Each tile cycles through the existing catalog, with its image, caption, accessible name and destination kept in sync. Pause during hover/focus or any open dialog, when offscreen or hidden, and with reduced/paused motion. Provide an explicit pause control. Avoid changing the product beneath a pointer or keyboard focus.

## Catalog and interactions

- Align the catalog heading and original description in the left column; put search at the top-right and the category trigger immediately below it, aligned to the right edge. On phones, stack the introduction above a full-width search and right-aligned category trigger. Preserve all source wording.
- Use a simple icon/text category trigger instead of a bordered select tile. Open a centered Categories dialog with full-width text rows, right-aligned counts and a subtle gold selected state. Selecting a row applies immediately and closes; keep search and reset synchronized. The dialog must fit short phone screens with an independently scrolling list and always-visible close control.
- Three columns on wide screens, two on tablets and one on phones. Center each complete vial within its square photograph.
- Place the compound name first and dose underneath, with the price beside the name. Keep name/dose at 22px; use 18px price and 13px per-vial text. Keep every original amount, name and price intact.
- On image hover or keyboard focus, reveal a pale-gold price background with a fine gold edge and soft glow. Retain dark, readable price text. Place Specifications and a compact Add to cart control in one row below the details; align Add to cart to the right under the price. Reveal this row on card hover/focus and show it continuously on phone/touch layouts. Do not overlay another Specifications label on the photo or use a full-width cart button. Clicking or pressing Enter/Space opens the specification dialog; without JavaScript, the native disclosure reveals the inline table.
- Use a fine gold outline around the card on hover, with a stronger outline for keyboard focus. Avoid a second competing focus ring inside the card.
- Keep product dialogs readable, with a stable image, full original table and previous/next controls. Put the compound name at the top and a smaller price at the upper right. Omit the standalone category label; keep the original classification in the specification table. Use black 13px labels and 14px values with generous row spacing. Left/right arrow keys cycle through all 19 products and wrap at either end, irrespective of the catalog filter. Animate text and rows with a brief staggered upward fade; never interpolate or scramble scientific values or prices. Fit the existing image to a proportioned frame without letterbox bands; use a square image on phones. Keep a 72px footer with cart at bottom-left and navigation at the right. Desktop copy scrolls separately; on phones, the content grid scrolls above the fixed footer. Reset both scroll containers on product changes.
- Keep motion subtle: short scroll entrances, 2px card lift, gentle image scaling. Preserve both the footer motion toggle and system reduced-motion support. Content must remain readable when scripting or animation is unavailable.
- Verify responsive layout, keyboard access, loaded images and the changed interaction before reporting completion. Record observed results in `docs/VERIFICATION.md`.

## Local demo commerce

Use a compact Flower of Life account/cart control at the lower left. Show just the icon when the cart is empty; reveal a separate direct-cart count/total button beside it only when items exist. Clicking the icon opens a small white menu above it: Log in when signed out, or the saved customer name, cart, orders and sign-out when signed in. Use Your account until an order supplies a name. Do not introduce another name-collection form. Successful phone verification reopens this menu. Provide equivalent controls inside product/testing popups; the testing popup’s top control opens its menu downward to stay in frame. Keep the left-side drawer for cart and sample shipping details. Use compact text-style card actions with a subtle gold cart hover treatment, without changing product imagery or source information. In catalog cards on fine-pointer desktop layouts, reveal them only on hover, keyboard focus or Added feedback using a short fade/rise. Reserve their space to avoid layout movement. Keep them visible on touch/phone layouts and in the specification dialog. Keep order/admin forms quiet and readable; use short explicit demo labels around simulated actions. Status cards, shipping details and download controls use the same typography and neutral palette. Do not put implementation details in the hero.

## Password entrance

Use a pure-white background and no enclosing card, descriptive text or visible field label. Fade in the gold Flower of Life, then the ornate logo over its center, then a single floating password field with an inline arrow submit control. Keep a programmatic input label and button name. The emblem settles to a subtle 20% opacity behind the wordmark.

The entrance starts at 120ms, the logo at 850ms and the field at 1650ms; the final field settles by 2300ms. Keyboard focus skips the sequence rather than waiting. System reduced motion displays the final state immediately. Login errors remain readable, receive focus and do not replay the entrance. Keep server-side access protection and the public privacy route intact.

After successful entry, glide the same emblem/wordmark from the login position to the hero over 1.45 seconds. Reveal the surrounding panel and content slowly in sequence, completing by about 2.45 seconds. Any navigation gesture, focus, key, pointer or resize should finish immediately. Respect reduced motion, avoid replaying on refresh and never depend on animation for authentication or content access. Catalog and individual information panels use a 16px/700ms scroll reveal with an 80ms row stagger.

## Design resources used

The October 6 resource bundle is indexed in `SKILLS.md`; it contains local repository snapshots, not runtime dependencies.

- **Taste Skill — Minimalist UI:** restrained surfaces, deliberate spacing, a limited palette and quiet motion. Its serif and texture suggestions are intentionally omitted because the user requested bold modern sans-serif and less visual noise.
- **Taste Skill — Redesign Existing Projects:** inspect the existing implementation, diagnose specific weaknesses, and make small changes using the current stack. Do not apply generic copy rewrites or replace approved imagery.
- **Vercel Web Interface Guidelines:** semantic controls, visible focus, reduced motion, tabular numerals, stable media dimensions and contained dialog scrolling. Review the current upstream checklist when using that skill; user instructions control copy and capitalization.
- **Awesome DESIGN.md — Apple and Nike references:** use whitespace, a strong typographic hierarchy and photography-led product presentation as structural references. Principium keeps its own identity, colors, font, photographs and wording; do not import another brand's identity or commerce patterns.

The broader design-taste and image-to-code skills remain available for suitable future tasks. They are not an instruction to recreate approved assets or start a new concept on every revision. Plugins should solve an actual design need; the current local refinement requires no external upload or hosted-site migration.
