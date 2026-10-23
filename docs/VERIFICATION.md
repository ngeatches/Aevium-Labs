# Verification record

## Portable developer handoff — October 13, 2026

- Added `START_HERE.md` and `HANDOFF_PROMPT.txt` covering current behavior, approved design, implementation map, Twilio Verify, transactional email, production hosting/storage, manual payment review and remaining owner decisions. No live integration or UI behavior changed in this handoff.
- Packaged an allowlisted source ZIP with the complete application, original reference, approved product originals/web exports, documentation and selected current screenshots. Excluded local configuration secrets, the private database/proof records, logs, dependency folders and machine-specific skill repositories. Checked packaged text against the current preview secret without printing it; no occurrence was found.
- Extracted the archive to a fresh temporary folder. `npm run build` succeeds there and reproduces the packaged files byte-for-byte. All 11 integration tests pass in that extracted copy, including loopback API, ownership, admin separation, outbox persistence and preview protection. ZIP CRC and SHA-256 file-manifest checks pass. No external service was contacted by these tests.
- Output: `dist/Principium-Peptides-handoff-2026-10-13.zip`. The recipient supplies a fresh ignored local password and starts with an empty demo database. This is a source handoff, not an externally hosted deployment.

## Combined account and cart control — October 13, 2026

- Removed the homepage’s separate top-right login. An empty cart now leaves only the bottom-left Flower of Life icon. Its menu opens above it with Log in; successful phone verification reopens the menu with the saved customer name, cart, orders and sign-out. Adding an item reveals the separate cart count/total button; removing the final item hides it again.
- Verified the full interaction with fictional customer +12025550198: the existing account returned Demo Research Lab from its latest order. Adding one Retatrutide vial showed 1 / $109.00 in the control and menu. The product popup’s account menu fit above its bottom-left footer; Escape closed only that menu and preserved the product dialog. Its cart button opened the drawer with the correct item/total, and Order reused the session to show the shipping form. No order was submitted. Removed the temporary item afterward.
- Verified the shared menu on Your orders, including the saved name, sign-out and phone-login popup. Escape restores icon focus. Outside interaction closes the menu. The customer name is returned only for the current account; accounts without orders receive null and display Your account. No new contact collection or external service was added.
- Mobile review at 320×600: the 260px menu fits between x10.8 and x270.8 with no horizontal overflow. Desktop review at 1076px also has equal document/client widths. No failed loaded images or browser warnings/errors were observed. Temporary viewport overrides were reset, and the homepage is left open with an empty cart, signed out, showing the Log in menu.
- Build, client/server syntax checks and all 11 integration tests pass, including expanded assertions for own-account names, signed-out absence and another customer’s null name. Static checks confirm all 19 complete product-card HTML blocks and all 42 recorded source/image hashes are unchanged. All five generated pages have unique IDs, valid ARIA references and existing local assets. The local server was restarted for the profile response change; shared-password entry succeeds.
- Evidence: `design/preview/account-dock-empty.png`, `account-dock-signed-in.png`, `account-dock-with-items.png`, `account-dock-mobile.png` and `account-dock-final.png`. No live SMS, email, payment or shipment occurred.

## Catalog header alignment — October 13, 2026

- Grouped the original heading and description on the left; search aligns with the heading at top-right, and the category trigger sits beneath it. At 1076px desktop width the heading and search share the same top position, while the description starts 12px below the heading. On a 336×800 phone viewport, heading/description, full-width search and right-aligned filter stack without horizontal overflow.
- Search for Ipamorelin returned three materials; selecting Blends narrowed this to the matching paired compound. Tab moves from search to the category trigger, Enter opens/selects a category, and selection restores focus. Cleared search and restored All (19) after checking. Browse the catalog still reaches the catalog header.
- Build passes. Every page text node, all 19 complete product cards and all 42 recorded source/image hashes match the preceding version. IDs and ARIA references are valid. Only markup grouping and styles changed; no backend or client behavior was rewritten, so integration tests were not repeated.
- Evidence: `design/preview/catalog-header-desktop.png` and `catalog-header-mobile.png`. Temporary viewport overrides were reset and the catalog preview remains open.

## Category popup — October 13, 2026

- Replaced the catalog select tile with a compact filter icon, active category name and count. A centered native Categories dialog shows All plus ten original categories, counts and a gold selected row. Selection closes the dialog and restores trigger focus; reopening focuses the current selection. Escape also closes and restores focus.
- Browser checks exercised all ten categories and All: counts are 1, 3, 3, 2, 3, 1, 3, 1, 1, 1 and 19 respectively in the original category order. Blends plus the search term Ipamorelin returned only the matching CJC-1295 / Ipamorelin blend. An unmatched search showed the empty state; Reset restored All, cleared the query and showed all 19 products. Mouse selection and Enter activation were both verified.
- At the 320×600 phone viewport, the popup measured 288×568 with 16px gutters and no horizontal document overflow. The category list scrolls inside the dialog; Coenzymes can be selected and is focused on reopening, while the close control stays visible above it. Desktop presentation was reviewed at 1076px wide.
- Build and client syntax checks pass. All 19 full product-card HTML blocks and 42 recorded original/source-image hashes are unchanged. Generated-page IDs and ARIA targets are valid. No backend or commerce changes; the integration suite was not rerun for this presentation-only refinement.
- Evidence: `design/preview/category-popup-desktop.png` and `category-popup-mobile.png`. Temporary viewport overrides were reset after review. The existing catalog preview is left with the category popup open for inspection.

## Opening screen and homepage phone login — October 13, 2026

- The hero stage is at least `100dvh`; catalog content remains in the document and is reached by native scrolling or Browse the catalog. At actual 1076×1007 desktop and 374×800 phone viewports, its top was at the viewport bottom (1007.2px and 800px) with zero horizontal document overflow. Browse moved the catalog to the 24px scroll offset; phone Page Down brought its heading into view at 73.8px.
- Added a top-right Log in control and centered responsive dialog using the existing customer phone endpoints. Requested the displayed local code for fictional +12025550198; an incorrect code showed the inline mismatch error, and the correct code closed the popup, restored trigger focus and changed its label to Your account. View your orders opened the existing shipped sample order without creating a new order. Signing out restored the phone form and Log in label.
- Checked phone form sizing at 374px: the dialog is 342px wide with matching content width and 16px gutters. Change phone number returns to the phone step and focuses the field. Tab advances from the phone field to code request; Escape restores focus to Log in. No failed loaded images or warnings/errors were observed in the final browser review. No live SMS, email, payment or shipping service was used.
- `npm run build`, client syntax checks and all **11 integration tests** pass. The initial restricted test invocation could not open loopback listeners; the authorized loopback run passed. All 42 recorded original-source/image hashes and all 19 complete catalog cards match the previous build. Generated-page IDs and ARIA targets are valid. Original copy, photographs, prices and specifications were not changed.
- Evidence: `design/preview/home-first-screen.png`, `home-phone-login.png` and `home-phone-login-mobile.png`. Temporary viewport overrides were reset; the homepage is left open with the customer signed out and cart unchanged at zero. Shared-password access and separate admin authentication remain intact.

## Product popup framing and bottom cart — October 13, 2026

- Fitted the existing product photograph to the desktop image pane without empty bands. Bounded popup proportions preserve the complete vial; phone layouts use a square image frame. Moved the cart to a reserved 72px footer at bottom-left, with product navigation on the right. The footer remains visible while specifications scroll.
- `npm run build` and client JavaScript syntax checks pass. All 42 recorded source/image hashes and all 19 complete catalog cards match the pre-change backup. Landing-page content before the product dialog is unchanged; IDs and ARIA references remain valid. No backend changes or additional dependencies; server integration tests were not rerun for this presentation change.
- Browser review at actual 1152px desktop and 312px phone document widths found no horizontal overflow. The phone photograph fills its 292px square frame. On both layouts, scrolling to the final specification leaves the cart fixed in the footer without overlapping the navigation controls.
- Right Arrow advances Tesamorelin to Sermorelin (03 / 19); Previous returns to Tesamorelin (02 / 19). Product changes reset the phone content scroll. Clicking the footer cart opens the existing empty cart drawer. Escape closes product details and restores focus to the initiating Specifications button. Fixed and verified reopening a previously scrolled popup returns both content containers to scroll position zero.
- No failed loaded images or browser warnings/errors were observed. Product artwork and original text are unchanged. Evidence: `design/preview/popup-frame-desktop.png` and `design/preview/popup-frame-mobile.png`.

## Compact product actions — October 13, 2026

- Replaced the full-width Add to cart bar with a compact right-aligned control beneath the price. Specifications sits alongside it on the left. Removed the duplicated image-overlay label. The shared row reveals on desktop hover/focus/Added feedback and remains visible on phone/touch layouts. Dialog Add to cart is unchanged.
- `npm run build` and client syntax checks pass. Static comparisons confirm all 42 source/image hashes, all 19 card metadata sets and complete specification tables are unchanged. Every card has one Specifications/cart pair; generated-page IDs and ARIA targets are valid. No backend/access-control changes were made, so the existing integration suite was not rerun for this presentation change.
- In the browser, filtered to Blends and pressed Enter on the new GHK-Cu / BPC-157 / TB-500 Blend Specifications button. It opened the correct 70 mg / $109 product and full original table. Escape restored focus to that control. Tab moved to Add to cart; Enter added exactly one vial, updated the count to 1 and total to $109 without opening specifications. Removed that test item afterward; the cart returned to zero.
- Normal desktop document width/scroll width both measured 849px. Hidden action rows had opacity 0; the keyboard-focused card had opacity 1. At the settled 312px phone document width, width and scroll width match; the action row has equal 268px client/scroll widths and both controls are visible. A 2px negative button margin was removed during review. No failed loaded images or browser warnings/errors were observed.
- Native image disclosure and no-JavaScript fallback remain in the HTML; the scripted action row is hidden by the existing noscript stylesheet. This fallback and reduced-motion rules were inspected in source, not tested by changing browser settings.
- Verified screenshot: `design/preview/compact-actions-mobile.png`. Used the tab screenshot surface after the browser's other screenshot surface produced a scaled/cropped viewport capture. Temporary viewport overrides were reset. The existing preview tab is left on the example blend with its compact controls visible.

## Customer phone accounts and automatic email workflow — October 12, 2026

- Built the requested local-only customer phone account, contact/shipping collection, order-number/payment instructions, customer payment report, admin amount/reference verification, fulfillment and automatic email-preview flow. Added separate versioned research-use/data policies. Existing catalog appearance, photographs, card copy and specification markup remain unchanged.
- `npm run build`, syntax checks for customer JS/auth/mail/order service, and all **11 integration tests** pass. The first sandboxed test run could not bind loopback listeners (`EPERM`); the permitted local-listener run passed. No production or external-service tests ran.
- Tests cover authoritative integer-cent pricing, validation, duplicate creation, customer/admin role separation, owner isolation, policy/version and phone matching, code expiry/attempts/one-use/preview binding, invalid transitions, exact admin receipt amount/reference, protected proof and email reads, transactionally queued/deduplicated email events, preparation failure/retry, exhausted retry/admin recovery, and persisted accounts/orders/outbox across restart. Gate tests include direct-asset denial, public policy access, token revocation/expiry, origin checks, throttling and Secure cookies in separate HTTPS gate mode.
- Browser story: used fictional customer +12025550198 and sample details to create **PP-86D62D657917**, Retatrutide 30 mg × 1, **$109.00**. The page showed its order number, exact total, non-payable sample Zelle recipient and numbered instructions. A simulated customer payment report appeared in the administrator review queue.
- Signed into the separate fictional admin +12025550199. Recorded $109.00 and sample bank reference, approved, then supplied Demo carrier / DEMO-TRACK-002 / DEMO-SHIP-002. Shipment moved the customer order to Shipped and automatically prepared the third email update. The admin outbox showed recipient `demo@example.test`, attempt 1, **Captured locally · Not sent**, and the correct order/items/amount/address/tracking in the message. Creation and approval previews were also present. No SMS, email, bank transfer or parcel dispatch occurred.
- Signed out of admin and customer, then signed into the same customer phone again. The new order and shipment returned; the earlier browser-owned legacy order stayed admin-only. Customer email previews were visible only for its own order. No new proof upload was needed for this story; the existing proof UI and protected upload/download API are covered by the prior browser record and current integration test.
- Responsive inspection: order/email content fits at actual 300px and 375px document widths; research-use and data-policy pages fit at 375px; normal customer page width/scroll width both 835px. With the mobile cart open, document width/scroll width both 387px, cart 375px and form/acknowledgment fieldset 335px, with no horizontal overflow. Policy links open the correct pages. Tab advances from name to phone; Escape closes the drawer and restores the cart trigger. No failed loaded images or browser warnings/errors were observed. Unloaded lazy images were not counted as failures.
- SHA-256 comparison confirms all **42 original source/image files** match the saved baseline. Catalog card/specification generation is identical to the pre-change build and still produces all 19 cards. All five generated pages pass unique-ID, ARIA-reference, internal-link and local-asset checks.
- Evidence: `design/checkout-payment-preview.png`, `design/checkout-admin-email-preview.png`, `design/checkout-mobile.png`, `design/checkout-complete-preview.png`. Final browser is on Your orders with the sample shipment visible; viewport overrides are reset and admin is signed out. Server remains at `http://127.0.0.1:4173/`.
- Limits: phone ownership and delivery are simulated; no real bank, SMS, email or carrier connection is configured. Research statements record declared intent rather than verifying qualifications/end use. Live hosting, provider integration and verified business/payment data remain outside the explicitly approved local scope.

## Larger hero and removal of top navigation — October 12, 2026

- Removed the shared top navigation bar, its mobile menu and corresponding JavaScript. Retained the skip link, footer navigation and privacy back link. Reduced section scroll offsets to match the absence of a sticky header.
- Enlarged the hero logo/headline and action labels. At the 1140px desktop document width, catalog/testing labels compute to approximately 60px/51px and fit their 206px-tall tiles. Line breaks remain BROWSE / THE CATALOG and HOW / WE / TEST. Responsive typography preserves the larger treatment without horizontal overflow.
- Build and client syntax checks pass. SHA-256 comparisons confirm the original HTML, all image assets and server source are unchanged. The complete main content, dialogs and footers of both generated pages match the previous revision exactly; the header is absent from both pages.
- Browser document client/scroll widths match at 1140px, 768px, 375px and 320px. Hero panels and action tiles have matching client/scroll dimensions. At 375px the hero logo is 93px wide and headline is approximately 27px. No failed images or browser warnings/errors were observed.
- Keyboard checks: How we test opens its dialog, Escape closes it, and Browse the catalog reaches `#collection`. The footer privacy link opens the policy page; its back link returns home. Privacy fits the 375px phone width without its former header.
- Screenshots: `design/preview/expanded-hero-desktop.jpg` and `expanded-hero-mobile.jpg`. A fresh tab resolved a stale screenshot viewport on the older tab. The finished homepage is left open with viewport overrides reset. Access-control code is unchanged; its earlier integration tests were not rerun for this presentation change.

## Hero logo, explicit button lines and faster rotation — October 12, 2026

- Removed the hero eyebrow “Laboratory research materials.” Composed the existing ornate wordmark over the existing Flower of Life SVG beside the headline using CSS; no artwork or product photograph was modified. Buttons now retain the requested two-line BROWSE / THE CATALOG and three-line HOW / WE / TEST layouts.
- Build and client syntax checks pass. SHA-256 comparisons confirm all image assets, `revamp.html` and `server.mjs` are unchanged. All 19 catalog articles, product/testing dialogs, footer and privacy HTML match the previous revision.
- Browser checks at actual document widths 1140px, 768px and 375px found equal document client/scroll widths. Explicit action lines remain intact at each width; the logo remains to the left of the headline. The tablet hero panel has equal 522px client/scroll widths. Phone action text fits without overflow.
- Rotation is configured for 3000ms, retaining the 800ms crossfade and existing pause rules. Automatic product changes and crossfade transitions were observed in the browser. Keyboard activation still opens How we test, Escape closes it, and the catalog action navigates to `#collection`. No failed images or browser warnings/errors were reported.
- Screenshots: `design/preview/hero-logo-desktop.jpg` and `hero-logo-mobile.jpg`. The homepage preview is left open, motion enabled and temporary viewport overrides reset. Access-control code did not change and its tests were not rerun for this visual refinement.

## Tiled hero, gold pricing and name-first cards — October 12, 2026

- Built the reference-inspired hero: original headline and description in the large left panel, large catalog and testing action tiles beneath it, and three square product photographs at the right. On phones the photographs form a row beneath the actions.
- `npm run build` and the client JavaScript syntax check pass. Static comparisons confirm unchanged original HTML, image assets, all 19 product field sets, complete specification tables and footer source prose. The privacy page and server source are byte-for-byte unchanged. Both generated pages pass local-asset, unique-ID and ARIA-target checks. Access-control tests were not rerun for this presentation-only revision; the earlier server results remain recorded below.
- Actual desktop document client/scroll widths both equal 1140px, tablet widths both 768px and phone widths both 375px. Hero panels fit without horizontal overflow; tablet image tiles are 160px square and phone tiles are 105px square. The three visible blend cards measure 331px on desktop and 335px on phone with matching scroll widths.
- Catalog names precede their dosages. Desktop price and per-vial text compute to 18px and 13px. Actual image hover produces the gold price background `rgb(242, 229, 193)`, gold outline and soft 20px glow, alongside the Specifications cue. Original price and dosage values are unchanged.
- The product dialog omits the standalone category node; name and price align at the top. A paired-dose blend fits the phone dialog at equal 355px client/scroll widths. Right Arrow still advances through the full catalog while filtered to Blends, and Escape returns focus to the product trigger.
- Hero images automatically changed with matching captions, source paths and product targets. Three temporary outgoing images were observed crossfading at matching opacity and marked `aria-hidden`; no clones remained after settling. Local pause held the same products across multiple subsequent checks. A rotated CJC-1295 with DAC tile opened the corresponding 10 mg popup. Shared Pause motion disables and pauses the rotation control; no images failed to load and no browser warnings/errors were reported.
- “How we test” opens the existing quality copy in a native dialog by keyboard. Desktop and phone dialog widths match their scroll widths (748px and 355px). The underlying Quality disclosure stays closed, and Escape restores focus to the testing action. Reduced-motion and no-JavaScript fallbacks were reviewed in source; operating-system preferences were not changed.
- Captures: `design/preview/tiled-hero-desktop.jpg`, `tiled-hero-tablet.jpg`, `tiled-hero-mobile.jpg`, `gold-pricing-desktop.jpg`, `name-first-popup-desktop.jpg`, `name-first-popup-mobile.jpg`, `testing-popup-desktop.jpg` and `testing-popup-mobile.jpg`.
- Final preview is on the homepage with all 19 materials, motion and image rotation enabled, and temporary viewport overrides reset.

## White entrance, pricing hover and specification navigation — October 12, 2026

- Rebuilt the login template as a pure-white entrance with an overlapping Flower of Life and ornate logo, followed by one floating password field and inline submit arrow. Removed the surrounding heading, descriptions, card and visible policy/research links from the gate only. The public privacy route and homepage privacy links remain.
- `npm run build`, server/client JavaScript syntax checks and all four existing server integration tests pass. The local preview server was restarted. A deliberately incorrect password produces the existing accessible error; the error state skips animations. Correct entry using Enter succeeds. Keyboard focus during the entrance cancels its animation and immediately reveals the form.
- Browser inspection observed the initial emblem/logo/form at opacity 0 and the settled state at 0.2/1/1. Computed start delays are 120ms, 850ms and 1650ms; durations are 1600ms, 900ms and 650ms respectively. The body is white. The initial form does not autofocus; the error state does. Phone gate client/scroll widths both equal 387px, with a 16px input. The 375px page layout also fits after login.
- Catalog dosage, compound name, price and per-vial label all compute to 22px. Default price text is black. The image was observed in actual `:hover` state; after its transition, the price background is black, its text is white and the Specifications cue has opacity 1. Keyboard focus uses the same treatment.
- The dialog price appears above the title at the right. Specification labels/values compute to black with 13px/14px fonts. During entry, successive rows were observed at decreasing opacity and increasing Y offsets; final source values remain unchanged. Paused motion shows all rows immediately at opacity 1 with no transform, including after keyboard navigation.
- Right-arrow traversal checked each of the 19 positions, product names, amounts and prices, wrapping from 19 back to 1. Left from 1 wraps to 19. While filtered to three Blends, navigating from product 13 advances to Semax at 14/19, confirming traversal uses the complete catalog. Escape closes the dialog and returns focus to the triggering product image. Existing previous/next buttons share this same navigation function.
- Desktop document client/scroll widths both equal 1140px; all three visible blend cards have equal client/scroll widths of 331px. Phone page widths both equal 375px, cards both 335px, and the longest-name blend dialog both 355px. Mobile specification labels and values retain their 13px/14px sizes. No failed images or browser warnings/errors were reported.
- Before/after comparisons confirm all original source material and image assets are byte-for-byte unchanged, along with the privacy HTML. Landing HTML changes are limited to dialog header order and shortcut metadata; all catalog/specification copy is intact. Both generated pages pass local-asset, unique-ID and ARIA-target checks. Server access-control logic below the login template is unchanged.
- Screenshots: `design/preview/entrance-desktop.jpg`, `entrance-mobile.jpg`, `pricing-hover-desktop.jpg`, `specifications-desktop.jpg` and `specifications-mobile.jpg`. Motion was resumed, the catalog reset to all 19, and preview access locked to show the new entrance. Temporary viewport overrides were reset.
- System reduced-motion CSS/JS support was reviewed; the shared in-page pause path was exercised rather than changing operating-system preferences. No cross-browser or assistive-technology certification is claimed.

## Restored ornate logo and Flower of Life favicon — October 12, 2026

- Restored the unchanged approved `brand-refined.webp` in the header, footer and password gate. Replaced the P favicon with a gold Flower of Life SVG and a shared versioned icon link on landing, privacy and login pages. Removed only the hero's “Original content · Draft review” block and its descriptive sentence.
- Build and server/brand-module syntax checks pass. All four existing server integration tests pass. The initial sandboxed test run was blocked from binding loopback ports; the run with loopback permission passed. The local preview server was restarted to load the shared brand markup.
- Generated HTML comparison against the pre-change backup confirms that only the logo markup, favicon link and requested notice changed. Hashes confirm `revamp.html`, both raster logos and all 38 product WebPs are unchanged. The SVG parses and contains nineteen pattern circles plus its outer boundary.
- Browser password entry succeeds. The login logo loads at 184px wide. Landing logo loads at 154px on desktop and 132px on phone, fitting within the existing header. Desktop document client/scroll widths both equal 1140px; phone widths both equal 375px. Space Grotesk remains the computed heading font, and both requested notice lines are absent.
- Mobile menu opens and links to privacy. Privacy fits at 375px with the restored logo and versioned favicon link; activating the home logo with Enter returns to the landing page. The SVG loads directly in the browser and its gold circle pattern was visually inspected. No image failures or browser warnings/errors were reported.
- Captures: `design/preview/restored-logo-desktop.jpg` and `restored-logo-mobile.jpg`. The preview is left on the homepage with temporary viewport overrides reset. This is local browser verification, not a cross-browser favicon certification.

## Design-resource review — October 12, 2026

- Located the October 6 repository bundle and the four prepared skills installed under `~/.claude/skills/`. Read Minimalist UI, Redesign Existing Projects and Web Design Guidelines, including the current upstream interface checklist. Recorded the selected resources, snapshot commits and intentional user-preference overrides in `SKILLS.md` and `DESIGN.md`.
- Applied only two CSS refinements: tabular numerals for catalog/dialog amounts, prices and product position; scroll containment on the outer dialog, which is the scrolling container on phones. No new dependencies or page content were added.
- Before/after SHA-256 comparison confirms `revamp.html`, the generated landing page and all 38 product WebPs are unchanged. All 15 local resource/skill links in `SKILLS.md` resolve. The CSS diff is limited to the two refinements above.
- Browser inspection confirms tabular numeral styles on product amounts and dialog numeric fields. At a 375px phone viewport the page width is 375px; the open dialog has equal client/scroll widths of 340px and computed `overscroll-behavior-y: contain`. Actual platform rubber-band/scroll-chaining behavior was not separately simulated.
- The Blends filter returns three materials. Enter opens the paired-dose blend dialog; Escape closes it and returns focus to the originating image. Inspected images report no failed loads. A fresh desktop preview has equal document client/scroll widths of 1012px and no reported browser warnings/errors.
- Screenshot sizing on the existing review tab was inconsistent, so a fresh tab was used for the final catalog capture: `design/preview/resource-review-catalog.jpg`. Viewport overrides were reset after review. Access-control code and JavaScript were not changed; the earlier integration-test results below were not rerun for these CSS-only edits.

## Modern wordmark and product cards — October 12, 2026

Story: a visitor enters the protected preview, sees the new wordmark and bold headings, reads the larger dosage first, then activates a product image to open the unchanged specification sheet.

- `npm run build` and syntax checks pass. All four server integration tests pass, including new assertions that the self-hosted font and favicon load publicly while product images remain protected. The local server was restarted; browser password entry succeeds.
- Source audit confirms all 19 product field sets/prices, exact specification tables, nine original prose sections, quality pillars, hero/specification, documentation/COA, institutional copy, ordering/payment drafts and footer remain intact. SHA-256 checks confirm the original HTML and all 38 product WebPs are unchanged. Capitalization is CSS only.
- Both pages pass local-link/asset/srcset, font preload, unique-ID, ARIA-target and anchor checks. No checkout forms were introduced.
- Browser layout checks at 1140 and 375 CSS pixels show no horizontal page overflow. The updated privacy page also fits at 375. Wordmarks use Space Grotesk; the 49,256-byte WOFF2 font and original SIL license are served locally.
- Blends returns three materials. Image click and keyboard Enter open the paired-amount blend popup with the correct name and `5 mg / 5 mg`. Next material updates the content. Escape closes and returns focus to the image control. Mobile menu opens, navigates and closes.
- Focus reveals the Specifications overlay on desktop (computed opacity 1); the desktop hover selector uses the same presentation. On the phone layout it remains visible without hover. Dosage is 27px on desktop and 29px on mobile. The mobile dialog's scroll and client widths both equal 355px.
- Reviewed paused motion and focus styles; only one gold outline surrounds the focused card. The original inline native details remain in HTML as the no-JavaScript fallback; this fallback was reviewed in source, not in a browser with scripting disabled.
- Inspected images show no failed loads and the review tab reports no browser warnings/errors. Screenshots: `design/preview/bold-desktop.jpg`, `bold-catalog.jpg`, `bold-mobile.jpg`, and `bold-mobile-catalog.jpg`.
- Preview capture sizing on an older tab was inconsistent; a fresh tab produced complete, correctly sized screenshots. No operating-system motion preference or cross-browser certification is claimed.


## Minimal revision — October 12, 2026

- Build and JavaScript syntax checks pass. Static source audit confirms all 19 product field sets/prices, nine original prose sections, four quality pillars, hero copy/specification, documentation, sample COA, institutional copy, ordering steps, payment draft and source footer remain present. The payment draft matches the previous version verbatim.
- SHA-256 checks confirm `revamp.html`, both wordmark exports and all 38 product WebPs are unchanged. Both generated pages pass local-link/asset/srcset, unique-ID, ARIA-target and anchor checks. The only forms are the existing logout controls.
- Desktop homepage at 1140 CSS pixels and phone at 375 have no horizontal document overflow. Privacy also fits at 768. The mobile long-name blend dialog has equal scroll/client widths of 355 pixels.
- The new category select returns all ten original category counts correctly, plus All = 19. CAS search returns BPC-157; an unmatched search displays the empty state and reset restores 19.
- Header Quality and FAQ links open their native panels. The nested COA FAQ opens its answer. Reloading a direct documentation link expands Quality and places the target below the sticky header. The product dialog's COA link closes the dialog, expands Contact and focuses its heading.
- Keyboard Enter opens the longest blend specification sheet. Previous/next updates the material; Escape restores focus to the original trigger. Mobile menu opens, navigates to Catalog and closes.
- Pause motion sets root scroll behavior to auto and suppresses card transforms. The focused card's gold outline is `rgb(167, 137, 77)`. Resume works. System reduced-motion CSS and the JS media-query listener remain implemented; the operating-system preference was not changed for this review.
- Browser console reports no warnings or errors; inspected images show no failed loads. No new runtime dependencies, external fonts or tracking were added.
- Saved current screenshots: `design/preview/minimal-desktop.jpg`, `minimal-mobile.jpg`, `minimal-popup.jpg`, and `minimal-popup-mobile.jpg`.
- Server-side protection is unchanged by this revision. Earlier gate integration-test results below are historical; this pass focused on the changed layout and navigation.

The following records describe earlier iterations and their checks. This is a local in-app-browser review, not a cross-browser certification or verification of business/product claims.

## Subtle motion — October 12, 2026

- `node --check site/assets/js/main.js` passes. SHA-256 comparison confirms landing/privacy HTML, original `revamp.html`, both wordmarks and all 38 product WebPs are byte-for-byte unchanged.
- Browser scroll inspection captured the second product row during its stagger: first card opacity 0.323 / translate 10.834px, following cards at opacity 0 / translate 16px. They settle to full opacity with no retained translate.
- Pause motion during scrolling immediately removes active reveal effects; all inspected cards, tiles and headings have opacity 1 / translate none, and root scroll behavior becomes auto. Resume restores eased hover transitions.
- Computed durations: cards 0.4s border/outline and 0.55s shadow/transform; product image 0.9s; button movement 0.45s.
- Blends filter returns 3 results. Mobile BPC search returns 3, clearing restores 19. Keyboard Enter opens the long blend popup; Escape closes and restores visible focus.
- Phone viewport at 375 CSS pixels has equal scroll/client widths. The system reduced-motion media query and its JS change listener are retained and reviewed; the shared pause path was exercised in the browser rather than changing the operating-system preference.
- No browser console warnings or errors. Captured `design/preview/motion-catalog.jpg`; temporary viewport overrides were reset and motion is enabled in the final preview.
- HTML remains readable without JavaScript; scroll effects do not add hidden base styles. Server-side protection was not changed in this motion-only revision.

## Visual refinement — October 12, 2026

Story: a visitor enters the protected local preview, sees the clear wordmark and consistent typography, browses the source catalog, and opens readable product specifications across screen sizes.

- Build and both JavaScript syntax checks pass. All four existing server integration tests pass. Tests required loopback networking outside the default filesystem sandbox; the first restricted attempt failed with EPERM before testing the app.
- Source audit confirms all 19 names, amounts, specifications and prices, all nine source prose sections, hero, documentation, sample COA, institutional copy and source footer are preserved. Original `revamp.html` SHA-256 remains unchanged. Both generated pages pass local asset, ID, ARIA target, anchor and no-checkout-form checks.
- Browser password entry succeeded. The new transparent logo loaded on the unauthenticated gate and on the authenticated website. Gate and privacy now use the same shared stylesheet.
- Reviewed desktop at 1140 CSS pixels, tablet at 768 and phone at 375. No horizontal page overflow at these widths. Privacy also fits at tablet size.
- Verified catalog navigation, three-result Blends filter, CAS search, empty state/reset, mobile menu, keyboard Enter opening, Escape closing with restored trigger focus, and previous/next product navigation.
- Long four-component product name wraps in both desktop and mobile dialogs. Mobile dialog has equal scroll/client widths (354 pixels); complete vial is visible. The popup remains fully opaque when motion is paused.
- Gold filter outline is `rgb(148, 112, 41)`; controls use a 2px corner radius. Keyboard-focused product cards retain the gold outline.
- The inspected browser tab reports no console warnings or errors. No external font or analytics service was added.
- Screenshots: `design/preview/refined-desktop.jpg`, `refined-mobile.jpg`, `refined-popup.jpg`, and `refined-popup-mobile.jpg`.

This is an in-app-browser review, not a cross-browser certification or verification of draft business/product claims. The updated Node server runs locally on port 4173.

## Latest original-copy revision — October 10, 2026

Story: the protected preview reads original source content at build time, renders all 19 products and draft text, then opens a complete, source-matched specification sheet from each product card.

- Build and JavaScript syntax checks pass. All four existing password-gate integration tests pass after the copy revision.
- Source audit: 67 original prose blocks match verbatim, alongside hero/documentation/institutional/footer copy and all 19 per-product field sets/prices. Original HTML unchanged. Local links, asset paths, IDs and ARIA targets pass; no checkout forms exist. See `COPY_AUDIT.md`.
- All ten original category filters and All return their source counts. CAS search finds BPC-157; empty search/reset work.
- Desktop popup checked for Retatrutide and the longest four-component blend. All original fields, missing-value notices and draft pricing appear. Retatrutide also includes its source `Sequence: See COA` field.
- Previous/next updates image, title, amount, price and specification table. Escape restores focus to the triggering product. Enter opens the popup.
- Gold outlines verified on the hovered/clicked filter and focused product card (computed color `rgb(164, 125, 40)`).
- A paused-animation bug that made new dialogs invisible was found and fixed. Dialog opacity now remains 1 with motion paused.
- Mobile catalog and long-name blend popup fit without horizontal overflow. Mobile menu/FAQ navigation and the original privacy draft disclosure work. Desktop and mobile screenshots are saved as `revised-*.jpg` in `design/preview/`.
- No warnings or errors recorded in the new preview tab's console.
- The local server was restarted independently so the preview can remain available after the chat turn.

The earlier verification below applies to the preceding layout and records historical checks; its three-group filters and earlier copy have since been replaced.

Completed October 10, 2026 against the local Node preview. This is a local implementation review, not a public deployment or a certification of product claims.

## Checks passed

- `npm run build`: generates landing and privacy pages with all 19 source-matched listings.
- `npm test`: four integration tests pass. They cover denial/successful entry, protected direct product images, public privacy access, exclusion of original/configuration files, path traversal, invalid/non-ASCII/tampered/expired/revoked tokens, cross-origin rejection, failed-entry throttling/recovery and Secure cookies for HTTPS mode.
- `node --check server.mjs` and `node --check site/assets/js/main.js`: pass.
- Static HTML audit: two pages, 19 exact names/amounts, 38 responsive exports, no missing local links/assets/anchors/ARIA title targets, no duplicate IDs and no external dependencies in page links/scripts/images.
- Preview secret is absent from delivered HTML/CSS/JS/text. Original `revamp.html` SHA-256 remains `1fdf86f2e70e3b072057818421e647c1a30352239cf11d42b518ec2c4c7bfb41`.

## Browser flows verified

- Correct password opens the page; incorrect password produces inline feedback.
- “Lock preview” returns to the gate. Privacy is still accessible without a session, and returning to the homepage requires entry again.
- Hero selector changes the image, name, amount and destination together.
- Filter counts: all 19, peptides 15, blends 3, coenzymes 1. Searching Ipamorelin returns three entries. An unmatched search shows the empty state; reset restores all 19.
- The blend dialog displays both 5 mg amounts. NAD+ displays 1000 mg in the mobile dialog. Enter opens material details; Escape closes and restores focus to the originating summary.
- FAQ disclosure opens its matching answer. Pause motion sets the pressed state and resume control.
- Mobile menu opens, navigates and closes. Privacy layout and navigation work on the phone viewport.
- Responsive observations at actual CSS widths 288, 375, 768, 1140 and 1440 found no horizontal document overflow. Inspected desktop, tablet, phone, catalog, dialog, FAQ and privacy views. A wide-screen hero sizing issue found during review was corrected and rechecked.
- Visible/lazy-loaded images inspected during interaction showed no failed loads. All asset paths were also checked on disk. Generated label images were reviewed individually during production.

Screenshots are saved under `design/preview/`. They are review artifacts outside the served root. Browser viewport overrides are removed after testing.

## Limits and launch dependencies

No external performance score, assistive-technology audit, multi-browser matrix or production host test is claimed. Reduced-motion CSS/JS support is implemented; the separate UI pause control was tested. Hosting is not yet selected. Confirm business contact, final product/packaging facts and the host's information-handling practices before public launch; update the privacy page accordingly. Deployment must preserve server-side protection and HTTPS if the preview remains private.

## Local order demo and split hero — October 12, 2026

The user explicitly expanded the scope to ordering/admin and confirmed **local demo for now**. Story verified: add products → cart total → sample shipping details → customer payment report → simulated phone-code admin entry → approval → shipment/proof → customer downloads. No actual SMS, bank payment, email or shipment occurred.

- `npm run build` and JavaScript syntax checks pass. All **8 integration tests** pass: four existing preview-access tests plus four commerce tests covering authoritative prices, malformed/invalid quantities, duplicate retries, same-origin/local-only checks, order ownership, independent admin access, state transitions, protected proof upload/download, code expiry/attempt limits/session binding and SQLite persistence across restart. Loopback tests required the permitted networking escalation after the restricted environment initially denied listening.
- Browser demonstration created one sample order containing two Retatrutide 30 mg vials plus one Tesamorelin 10 mg vial, totaling **$307.00** from draft catalog prices. Quantity changes and counters synchronized to a second tab. Submission cleared both carts.
- The customer reported a simulated payment. Admin used the displayed demo phone code, approved the report, and supplied a fictitious carrier/tracking/reference plus a JPEG proof file. The customer page displayed Shipped and both download controls. Downloaded proof bytes matched the uploaded image. The downloaded HTML order confirmation contained the correct items/total and the explicit LOCAL DEMO notice.
- Keyboard Enter opened product specifications. Add to cart inside the popup updated the count. Opening its cart closed the specification popup, retained the body scroll lock, and showed one active dialog. Escape closed the cart and restored focus to the visible cart launcher. The testing popup retained a visible cart control without overlapping its heading.
- Reviewed desktop at **1140 CSS pixels** and phone at **375**; checked the landing page down to **320**. Page scroll width equaled client width. The large logo fills the left half of the hero panel with smaller headline and description on the right. Mobile cart, customer shipment details and download buttons fit. The testing dialog had equal scroll/client widths at 320. This is an in-app-browser review, not a cross-browser/device laboratory.
- All four generated HTML pages pass duplicate-ID, ARIA-reference and local-asset checks. A first asset audit treated the favicon query string as part of the filename; correcting the audit to check URL paths passed without changing site assets. All **42** recorded source/brand/product asset SHA-256 values match the pre-change backup. The 19 full specification tables and source catalog attributes match exactly.
- Privacy and project documentation now describe local storage, sample form data, private SQLite retention, ownership/admin cookies and simulated communication. No secret, mock-up or database was added to the public asset directory. No external font, analytics, service account or public deployment was added.
- Browser console review reported no warnings/errors during the completed order flow. The preview was restarted with the final validation fix; the password gate rejected the old session and successful entry was rechecked. Existing sample records persist; admin is signed out.

Evidence: `design/preview/order-hero-desktop.jpg`, `order-hero-mobile.jpg`, `cart-desktop.jpg`, `cart-mobile.jpg`, `admin-payment-review.jpg`, `demo-order-shipped.jpg`, and `demo-order-mobile.jpg`. The sample order remains available for review in the local database. Runtime: Node 24.13.0; its built-in SQLite currently prints an experimental-feature notice.

## Hover cart controls and login-to-hero motion — October 12, 2026

- Desktop card controls have opacity 0 / pointer-events none at rest and opacity 1 on hover. Keyboard Tab from the image summary reaches and reveals Add to cart. Measured card height remained 544.27px before/after reveal, so controls do not shift neighboring content. Product-dialog buttons remain visible.
- Native password submission remains server authenticated. On successful entry, the transient animated logo began at the exact recorded login bounds (x580, y378.5, 280px square at the tested 1440px viewport), with hero heading opacity 0. Completion removed the overlay, restored the real hero logo and showed the heading at opacity 1. The movement lasts 1450ms; the stagger finishes at approximately 2440ms.
- Wrong-password entry returned its accessible error with no hero overlay. Successful phone entry created the transition; keyboard focus immediately finished it and removed the overlay. An ordinary reload did not replay the entrance. Reduced-motion branches and the 4.5-second fail-safe were reviewed in code; no operating-system preference was changed for this pass.
- At 375 CSS pixels the page had equal client/scroll widths and cart buttons stayed visible. Desktop preview at its restored 832px viewport also had no horizontal overflow, with the hovered card's button visible and its neighbor hidden.
- Catalog and individual information panels now use 16px/700ms scroll entrances and 80ms row staggering. Existing pause/reduced-motion handling remains shared with other motion; scrolling is native and never blocked by the login entrance.
- Build and JavaScript syntax checks pass. All 8 server/commerce integration tests pass, including unauthenticated access to the harmless entrance script and continued denial of protected images/data. All 42 recorded source/image hashes and all 19 specification tables match the pre-change reference. No new package or external service was added. Browser console review found no warnings/errors.
- Updated current privacy text to disclose the short-lived session-storage logo geometry/timestamp. It contains no password or token, is consumed on the next page load, and is not an access-control mechanism.
- Evidence: `design/preview/login-to-hero-motion.jpg` captures the starting logo before the hero reveal; `cart-hover-reveal.jpg` shows the selected hover control beside a quiet neighboring card; `motion-mobile-hero.jpg` records the phone layout. Temporary viewport overrides were reset.

## Production path (phone auth, transactional email, deployment) — October 13, 2026

Receiving-machine baseline first: the handoff ZIP was extracted, `npm run build` reproduced every packaged file byte-for-byte, and all **11** original tests passed on Node 24.21.0. A new preview password was set in ignored `.env.local`.

**Automated: 24/24 tests pass** (`npm test`): the 11 original tests, unchanged, plus 13 in `tests/live.test.mjs`. Every provider in those tests is fake; no SMS, email or network request leaves the process. They cover:
- Phone: +1 normalization; Twilio-style flow never returns the code; single use; 10-minute expiry; 5-attempt lockout; browser binding; customer challenge cannot create an admin session; 30 s resend cooldown; per-number hourly limit with `Retry-After`; test-allowlist refusal; provider timeout and terminal errors issue no session.
- Admin: non-admin numbers get the same response, no SMS and no session; a verified customer is not an admin; removing a number from the allowlist revokes an existing admin session.
- Orders: configured prices only (client price ignored), unavailable product 409, shipping fee, served-country check, live policy version, cross-origin write 403, duplicate submission returns the same order; customers cannot see the verifying admin's phone or bank reference.
- Email: provider IDs; idempotency keys `principium-<env>:<order>:<event>`; accepted ≠ delivered; test-allowlist suppression without contacting the provider; timeout retry reuses the key; **crash mid-send** (server closed while the provider call hangs) → restarted worker resends with the same key after the lease; permanent rejection → failed → admin retry uses a fresh key round; accepted messages cannot be retried.
- Webhooks: missing, wrong-secret and stale signatures rejected; duplicate event IDs ignored; a late `sent` does not downgrade `delivered`; an event that arrives before the send result is applied afterwards; a permanent bounce suppresses later sends; unknown message IDs accepted and stored.
- Sessions survive restart; sign-out-everywhere revokes other sessions; admin phone change requires confirmation, revokes sessions, moves orders and leaves the old number with a fresh empty account.
- Cursor pagination returns all 26 test orders exactly once; server-side status filter and counts; invalid filter/cursor 400.
- Staging gate blocks the API and pages while `/healthz` and the signed webhook stay reachable; the production host allowlist returns 421 for other hosts.
- Configuration fails closed with setting names (not values); public access outside production, open delivery without `LAUNCH_APPROVED`, admins missing from the test allowlist, and unapproved catalog/business/Zelle content are all refused.
- Twilio and Resend adapters send the expected URLs, form/JSON bodies, Basic/Bearer authorization and `Idempotency-Key` (fake fetch), and classify 404/20404, 60203, 409 variants, 422 and 5xx correctly; the Svix signature check accepts the right signature and rejects a modified body.
- Migrations adopt a handoff-era database (order and email rows intact, `shipping_fee` 0), refuse a newer schema, and backups pass `integrity_check`.

**Startup and operations (manual, fake credentials, no network):**
- `npm run check-config` reported a complete staging configuration, then named `RESEND_API_KEY` when it was blanked.
- Real live startup booted twice on loopback: `/healthz` 200, wrong Host 421, correct Host → password gate (303). The second boot took a verified `pre-start` backup.
- `deploy/entrypoint.mjs` run as root took ownership of `DATA_DIR`, dropped to uid 1000 and created the database as `-rw------- 1000 1000`. (While developing this, running as root exposed a misleading "not valid JSON" message for an unreadable config file; that now reports the file-system error code instead.)
- Restore: a valid `.restore` file was integrity-checked and swapped in at boot after backing up the replaced database. A corrupt one stopped startup with no change.
- Backups are single self-contained files (journal mode switched to DELETE after copy).
- The Docker image was **not** built: there is no Docker daemon in this environment. The image steps (build, entrypoint, start) were run directly instead.

**Browser (headless Chromium via Playwright; desktop 1440×900 and phone 375×812):**
- Demo, complete story at both sizes: password entry → Flower of Life menu → Log in → on-screen demo code → menu reopens signed in → add two products → checkout with sample details and acknowledgments → order → payment report → admin demo code → exact-amount approval → shipment → "Captured locally" email statuses → customer sees Shipped. 24/24 checks, no horizontal overflow, no broken eager images, **no console warnings or errors**.
- Live rehearsal (`npm run rehearse`; fake providers, rehearsal-only config with a clearly fake Zelle recipient): same story. Code notice reads "We texted a code to +1 ••• ••• 0102" with no digits shown; unavailable product shows a disabled control; single served country prefilled; checkout shows $15.00 shipping, total and tax statement; no "demo/sample/simulated" wording on the orders page; admin emails show "Accepted by email provider". 30/30 checks, no console warnings or errors.
- Keyboard (live): Enter on the Flower of Life opens the menu; Escape closes it and returns focus; the login dialog opens from the menu, Escape closes it and focus returns to the Flower of Life. Live privacy page names Twilio, Resend and the host; "Lock preview" and the footer Admin link are absent in public mode.
- Screenshots: `design/preview/2026-10-13-production-path/`.

**Design preservation:** `git diff` against the extracted handoff shows no change to `revamp.html`, `design/` originals, any image, font or CSS file, or any generated demo HTML page. The only change under `site/` is `assets/js/commerce.js`: mode-aware wording, shipping/tax lines, "Load more", delivery states and the admin phone-change disclosure, all using existing classes. Live pages come from the same templates with asserted text replacements, and the build fails if an expected fragment is missing or demo wording remains.

**Not verified (needs owner accounts or a deployed host):** real Twilio SMS delivery and error payloads; real Resend sending, domain verification and webhook delivery; Render build/disk permissions, health checks, TLS and `X-Forwarded-For` behaviour; deliverability; no assistive-technology or multi-browser audit. The provider adapters follow the documented APIs, but the official pages could not be opened from this session; recheck them during the first owner-approved staging test.
