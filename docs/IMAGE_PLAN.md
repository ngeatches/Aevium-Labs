# Image direction and completed assets

Updated October 10, 2026. The user approved the centered, labeled vial format and expanded the image scope to every listing in the original HTML. All 19 listings now have their own generated image, produced with separate sequential image-tool requests.

## Approved visual direction

One centered complete glass vial per square image, balanced margins, consistent scale, gold cap, warm ivory label, soft studio light and natural contact shadows. Backgrounds use warm ivory with subtle sage tones. The website uses this same light palette; the earlier charcoal hero concepts are archived references only.

Labels use the supplied Principium proof as the visual reference: ornate gold wordmark and geometric emblem, gold bands, readable product name, and a package-amount panel. The original label artwork stays unchanged. The website header/footer/gate reuse the approved ornate `brand-refined.webp`, restored at the user’s request on October 12. This retains the earlier flat bronze-gold cleanup rather than the original glowy raster finish. Both raster logo files remain unchanged. The browser icon is a gold Flower of Life circle drawn as SVG; `design/brand-restored.md` documents the current treatment. Space Grotesk stays in use for page typography. Exact names and amounts are mapped in `design/product-labels.json`, including separate Ipamorelin/TB-500 strengths, paired blend amounts and NAD+ 1000 mg. Do not copy the reference proof's FOXO4 name, purity badges, batch details or expiry claims onto these products.

## Delivered files

- `design/products/<id>.png`: 19 original generated images.
- `design/image-manifest.json`: each prompt, reference image, tool output and local destination.
- `site/assets/images/products/<id>-640.webp` and `-1024.webp`: 38 optimized, responsive exports.
- `design/image-exports.json`: measured dimensions and weights; all product exports total about 1.5 MiB, largest below 60 KiB.
- `site/assets/images/brand.webp`: unchanged original logo extracted from the source HTML, preserved as a reference.
- `design/brand-refined.png`, `design/brand-refined.md`: transparent wordmark cleanup and exact edit prompt, made with the built-in image tool.
- `site/assets/images/brand-refined.webp`: 800 × 361 transparent website export, about 83 KiB.
- `design/hero-concept-v1.*` and `hero-concept-v2.*`: preserved earlier concepts and notes.
- `design/references/principium-label-reference.png`: user-supplied packaging reference.

The hero uses three square product photographs stacked on the right, initially BPC-157, Retatrutide and GHK-Cu. They crossfade through the existing 19-product family, with captions and product destinations updated together. On phones the three squares form a row. Rotation pauses during interaction and respects the local pause control and shared motion setting. The earlier approach section and geometric motif were removed when the user requested original copy. There is no need for additional generic laboratory photography or a fabricated facility image. Social sharing artwork is not included in this private, noindex preview.

## Future production

Use the installed imagegen skill and built-in image tool. Inspect references, preserve full-resolution originals and prompts, and export optimized files into `site/`. Keep each product centered and match its source name/amount. Treat the visuals as packaging concepts until the client confirms real packaging. Generated imagery must not imply verified test results or facilities.

To regenerate WebP exports, run `SHARP_MODULE=/absolute/path/to/sharp/index.cjs node scripts/optimize-images.mjs` with an available Sharp module. This optional asset tool is not a website runtime dependency. Cards use responsive sources, explicit dimensions and lazy loading; the hero is prioritized.
