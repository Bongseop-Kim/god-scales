# Under swarm sprite QA

- Accepted HD base: left-facing low mound of many rooted arms and hands fused around one small muted-crimson core-mouth.
- Frame contract: idle 4, attack 2, hit 1, death 2; all nine frames are 896×1024 RGBA.
- Motion review: idle uses restrained alternating reaches; attack advances several front hands without moving the core; hit curls the limbs inward; death settles the connected mound flatter.
- Anatomy review: every visible hand remains rooted in the central body. No severed hand, loose finger, blood, debris, neighboring-slot fragment, or cropped limb remains.
- Extraction review: projection segmentation and the shared 96-color palette completed with `ok: true`; every frame reports `edge_pixels: 0`. The maximum chroma-adjacent count is six isolated pixels and is visually absent in transparent QA.
- Automated run inspection, atlas composition, preview generation, and curated export returned `ok: true`.
