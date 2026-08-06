# Under attrition sprite QA

- Accepted HD base: left-facing fused armored revenant with three stacked skull faces, corroded pale armor, black burial cloth, two main arms, and two grounded legs.
- Frame contract: idle 4, attack 2, hit 1, death 2; all nine frames are 896×1024 RGBA.
- Motion review: idle is a slow connected sway; attack uses a compact two-hand grab; hit bends the fused body backward; death progresses from kneeling to a low seated slump.
- Identity review: all stacked faces, armor, cloth, hands, and legs remain part of one body. No loose skull, detached plate, liquid, blood, debris, neighboring-slot fragment, or crop remains.
- Extraction review: projection segmentation and the shared 96-color palette completed with `ok: true`; every frame reports `edge_pixels: 0`. The maximum chroma-adjacent count is two isolated pixels and is visually absent in transparent QA.
- Automated run inspection, atlas composition, preview generation, and curated export returned `ok: true`.
