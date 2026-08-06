# Artemis sprite QA

- Accepted HD base: adult female Artemis, left-facing, gray-blue ponytail, ivory hunting chiton, bronze bow and attached quiver, no armor, wounds, blood, or gore.
- Frame contract: idle 4, attack 2, hit 1, death 2; every frame is 896×1024 RGBA.
- Motion review: idle uses a compact bow-ready breathing loop; attack reads as draw then release; hit recoils from the left; death progresses from kneeling to a low collapse.
- Equipment review: bows, strings, hands, feet, and quivers remain complete. No loose arrows, detached effects, cropped anatomy, or neighboring-slot fragments remain.
- Extraction review: component-row pipeline with projection segmentation; all 9 frame records report `edge_pixels: 0` and `chroma_adjacent_pixels: 0`.
- Automated QA: frame manifest, run inspection, atlas composition, and preview generation all returned `ok: true`; atlas contains the expected 9 cells.
- Informational warnings accepted: source artwork is finer than the pitch detector's block estimate; attack/death silhouettes enter the configured margin zone but do not touch the cell edge. Single-frame hit correctly has no inter-frame motion measurement.
