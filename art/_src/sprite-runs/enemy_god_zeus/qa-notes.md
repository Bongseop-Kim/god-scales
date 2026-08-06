# Zeus sprite QA

- Accepted HD base: left-facing elder Zeus with white hair and beard, ivory drapery, dark teal cloak, and one held lightning javelin.
- Frame contract: idle 4, attack 2, hit 1, death 2; all nine frames are 896×1024 RGBA.
- Motion review: idle is a restrained raised-javelin loop; attack winds up then strikes low; hit recoils while retaining the weapon; death progresses from kneeling to a grounded collapse.
- Equipment review: the lightning javelin remains held or directly touching the hand. No detached lightning, fragments, blood, wounds, or cropped anatomy appear.
- Extraction review: projection segmentation and the shared 96-color palette completed with `ok: true`; all frames report `edge_pixels: 0` and `chroma_adjacent_pixels: 0`.
- Automated run inspection, atlas composition, preview generation, and curated export returned `ok: true`.

