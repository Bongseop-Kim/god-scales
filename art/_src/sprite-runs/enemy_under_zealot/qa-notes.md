# Under zealot sprite QA

- Accepted HD base: left-facing Marsyas-like horned ascetic with stylized exposed musculature, a dark hide mantle, goat legs, and no weapon.
- Frame contract: idle 4, attack 2, hit 1, death 2; all nine frames are 896×1024 RGBA.
- Motion review: idle is a tense breathing loop; attack uses two compact unarmed clawing poses; hit recoils with open hands; death progresses from kneeling to a curled grounded collapse.
- Anatomy review: horns, hands, goat legs, hooves, and mantle remain complete and attached. No detached effects, debris, blood, gore, neighboring-slot fragments, or cropped anatomy remain.
- Extraction review: projection segmentation and the shared 96-color palette completed with `ok: true`; every frame reports `edge_pixels: 0`. The maximum chroma-adjacent count is 14 isolated pixels and is visually absent in the transparent QA.
- Automated run inspection, atlas composition, preview generation, and curated export returned `ok: true`.
