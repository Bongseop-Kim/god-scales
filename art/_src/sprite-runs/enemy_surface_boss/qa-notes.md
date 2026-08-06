# Surface boss sprite QA

- Accepted HD base: left-facing bronze Argus Panoptes with many body eyes, ivory drapery, and one complete eye-topped staff.
- Frame contract: idle 4, attack 2, hit 1, death 2; all nine frames are 896×1024 RGBA.
- Motion review: idle breathes subtly; attack lowers the staff into a compact diagonal strike; hit recoils through the torso; death progresses from a kneel to a seated collapse.
- Anatomy and equipment review: body eyes, limbs, drapery, and staff remain complete and connected. No neighboring-slot fragments or cropped anatomy remain.
- Extraction review: projection segmentation and the shared 96-color palette completed with `ok: true`; every frame reports `edge_pixels: 0`. The maximum chroma-adjacent count is one isolated pixel and is visually absent in transparent QA.
- Automated run inspection, atlas composition, preview generation, and curated export returned `ok: true`.
