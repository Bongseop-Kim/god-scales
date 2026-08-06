# Surface attrition sprite QA

- Accepted HD base: left-facing exhausted heavy infantryman wearing an attached bear pelt and carrying one complete spear.
- Frame contract: idle 4, attack 2, hit 1, death 2; all nine frames are 896×1024 RGBA.
- Motion review: idle sags under fatigue; attack shifts from guard to a compact diagonal thrust; hit folds forward; death progresses from a kneel to a seated collapse.
- Anatomy and equipment review: limbs, armor, bear hood, hide tail, and spear remain complete and connected. No neighboring-slot fragments or cropped anatomy remain.
- Extraction review: projection segmentation and the shared 96-color palette completed with `ok: true`; every frame reports `edge_pixels: 0`. The maximum chroma-adjacent count is three isolated pixels and is visually absent in transparent QA.
- Automated run inspection, atlas composition, preview generation, and curated export returned `ok: true`.
