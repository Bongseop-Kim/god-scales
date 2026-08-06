# Surface pressure sprite QA

- Accepted HD base: left-facing brutal centaur taskmaster with four complete legs and one compact hide standard.
- Frame contract: idle 4, attack 2, hit 1, death 2; all nine frames are 896×1024 RGBA.
- Motion review: idle shifts weight and stamps a hoof; attack rises and drives the standard downward; hit recoils as one body; death progresses from folded legs to a low collapse.
- Anatomy and equipment review: human torso, horse body, all four legs, tail, pole, pennant, and cords remain complete. No cropped outer edge or neighboring-slot fragment remains.
- Extraction review: connected-component segmentation was selected after projection QA exposed split standard fragments; the corrected transparent contact sheet preserves every complete silhouette. The shared 96-color palette completed with `ok: true`; every frame reports `edge_pixels: 0`. The maximum chroma-adjacent count is eight isolated pixels and is visually absent in transparent QA.
- Automated run inspection, atlas composition, preview generation, and curated export returned `ok: true`.
