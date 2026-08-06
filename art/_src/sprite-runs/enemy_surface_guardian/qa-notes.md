# Surface guardian sprite QA

- Accepted HD base: left-facing bronze Talos fragment with pale stone joints, an oval face shield, and one complete spear.
- Frame contract: idle 4, attack 2, hit 1, death 2; all nine frames are 896×1024 RGBA.
- Motion review: idle is a restrained guard loop; attack reads as a shield bash into a compact diagonal spear strike; hit braces in a crouch; death progresses from kneeling to a low seated collapse.
- Equipment review: shields and spears remain complete and held or directly touching the hand. No neighboring-slot fragments, debris, blood, or cropped anatomy remain.
- Fit correction: the accepted hit row was deterministically reduced to 90% and recentered before extraction so the spear tip clears the top edge without changing the pose.
- Extraction review: projection segmentation and the shared 96-color palette completed with `ok: true`; every frame reports `edge_pixels: 0`. The maximum chroma-adjacent count is three isolated pixels and is visually absent in the transparent QA.
- Automated run inspection, atlas composition, preview generation, and curated export returned `ok: true`.
