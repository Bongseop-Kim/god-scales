# Athena sprite QA

- Accepted HD base: left-facing armored Athena with dark crest, bronze-and-ivory armor, round Medusa aegis, and one complete spear.
- Frame contract: idle 4, attack 2, hit 1, death 2; all nine frames are 896×1024 RGBA.
- Motion review: idle is a restrained guard loop; attack reads as shield shove into a compact diagonal spear strike; hit recoils behind the shield; death progresses from kneeling to a low collapse.
- Equipment review: shields and spears remain complete and attached or directly held. No neighboring-slot fragments, debris, blood, wounds, or cropped anatomy remain.
- Extraction review: projection segmentation and the shared 96-color palette completed with `ok: true`; every frame reports `edge_pixels: 0`. The maximum chroma-adjacent count is four isolated pixels, below the pipeline threshold and visually absent in the transparent QA.
- Automated run inspection, atlas composition, preview generation, and curated export returned `ok: true`.

