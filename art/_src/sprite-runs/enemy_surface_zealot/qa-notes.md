# Surface zealot sprite QA

- Accepted HD base: left-facing Maenad with black hair, red eyes, an ivory-and-plum dress, laurel ornaments, and one complete thyrsus.
- Frame contract: idle 4, attack 2, hit 1, death 2; all nine frames are 896×1024 RGBA.
- Motion review: idle is a hunched stalking loop; attack reads as a compact downward thyrsus strike; hit recoils while keeping the staff upright; death progresses from kneeling to a low curled collapse.
- Equipment review: thyrsi, pinecone heads, and ribbons remain complete and attached or directly touching the hand. No detached effects, debris, blood, neighboring-slot fragments, or cropped anatomy remain.
- Extraction review: projection segmentation and the shared 96-color palette completed with `ok: true`; every frame reports `edge_pixels: 0`. The maximum chroma-adjacent count is 11 isolated pixels and is visually absent in the transparent QA.
- Automated run inspection, atlas composition, preview generation, and curated export returned `ok: true`.
