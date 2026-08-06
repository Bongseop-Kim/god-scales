# Surface applier sprite QA

- Accepted HD base: left-facing blind curse priestess in ivory, charcoal, and gold robes with one adjacent bronze brazier.
- Frame contract: idle 4, attack 2, hit 1, death 2; all nine frames are 896×1024 RGBA.
- Motion review: idle gestures beside attached smoke; attack reaches over the brazier; hit recoils at the chest; death progresses from kneeling to a covered collapse.
- Anatomy and equipment review: robes, hands, brazier, and live-state smoke remain complete; the smoke stops in both death frames as required. No duplicate brazier, detached smoke cloud, or neighboring-slot fragment remains.
- Extraction review: projection segmentation and the shared 96-color palette completed with `ok: true`; every frame reports `edge_pixels: 0` and `chroma_adjacent_pixels: 0`.
- Automated run inspection, atlas composition, preview generation, and curated export returned `ok: true`.
