# Surface support sprite QA

- Accepted HD base: left-facing airborne Nike herald with two complete feathered wings and one shortened bronze trumpet.
- Frame contract: idle 4, attack 2, hit 1, death 2; all nine frames are 896×1024 RGBA.
- Motion review: idle hovers with restrained wing flex; attack raises and sounds the trumpet; hit recoils in the air; death progresses from a lowered hover to a kneeling landing.
- Anatomy and equipment review: wings, feathers, limbs, ribbons, and trumpet remain complete and connected. No detached feather, horizontal overlong prop, neighboring-slot fragment, or cropped anatomy remains.
- Extraction review: projection segmentation and the shared 96-color palette completed with `ok: true`; every frame reports `edge_pixels: 0`. The maximum chroma-adjacent count is three isolated pixels and is visually absent in transparent QA.
- Automated run inspection, atlas composition, preview generation, and curated export returned `ok: true`.
