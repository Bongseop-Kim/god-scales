# Under pressure sprite QA

- Accepted HD base: left-facing skeletal Erinys with serpent hair, two ragged wings, two arms, two complete thorn whips, a charcoal robe, and muted red eyes.
- Frame contract: idle 4, attack 2, hit 1, death 2; all nine frames are 896×1024 RGBA.
- Motion review: idle is a restrained airborne hover; attack snaps both whips downward; hit tucks the wings into recoil; death progresses from lost lift to a low grounded collapse.
- Anatomy and equipment review: wings, serpent hair, hands, feet, handles, and both whips remain connected or directly touching the hands. No detached snake, whip fragment, blood, debris, neighboring-slot fragment, or crop remains.
- Extraction review: projection segmentation and the shared 96-color palette completed with `ok: true`; every frame reports `edge_pixels: 0` and `chroma_adjacent_pixels: 0`.
- Automated run inspection, atlas composition, preview generation, and curated export returned `ok: true`.
