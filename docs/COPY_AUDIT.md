# Original-copy revision

The user requested original text 1:1, gold hover outlines, a better-formatted popup and a less generic catalog/scrolling section. They explicitly selected: “Include all original text as draft content; keep checkout removed.”

## Source mapping

| Source in `revamp.html` | Current placement |
| --- | --- |
| Original hero headline and paragraph | Hero, verbatim |
| Four quality pillars | Four interactive quality tiles; replaces the generic marquee |
| All 19 catalog records | All 19 cards, draft prices and full specification tables |
| `pdp()` specification labels and values | Native HTML disclosures and enhanced popup; unknown values remain “Confirm on lot COA” |
| Record-specific components and sequence | Corresponding material specification table |
| Homepage documentation and sample COA | Documentation section, visibly marked as a sample, not a real lot report |
| Original hero example specification | Expandable example beneath sample COA |
| `PROSE.quality` | Quality & COAs, original copy |
| Institutional homepage and `PROSE.institutional` | Institutional purchasing section |
| Original order sequence and payment instructions | Draft ordering section; placeholder recipient details explicitly marked; no payment action |
| All six original FAQs | FAQ, verbatim |
| Shipping, returns, research-use, terms and original privacy drafts | Policy disclosures, verbatim |
| Original contact/support placeholders and hours | Contact draft; no active email submission link |
| Original research-use footer | Footer disclosure, verbatim |

The original cart, researcher/checkout forms, quantity selectors, payment submission and confirmation application remain removed as requested. Dynamic order amounts and IDs in explanatory payment copy are shown as `[order total]` and `[order number]`; no order is generated. UI labels for filtering, popup navigation, accessibility and draft identification are functional additions, not replacement marketing copy. `/privacy/` continues to describe actual preview behavior; the original checkout-related privacy text is clearly a separate draft in the protected page.

`read-source.mjs` parses literal source data without executing source JavaScript. Source-copy audit checked 67 original prose blocks verbatim, the hero/documentation/institutional/footer copy, and all 19 per-product field sets and prices. Local links, images, IDs and ARIA title targets passed inspection. The original source SHA-256 remains unchanged.
