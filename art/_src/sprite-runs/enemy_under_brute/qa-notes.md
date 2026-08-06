# Under brute sprite QA

- Accepted HD base: left-facing gray crouched brute with an oversized primary jaw, closed belly maw, long attached arms, complete clawed hands and feet, rib cage, and short back spines.
- Frame contract: idle 4, attack 2, hit 1, death 2; all nine frames are 896×1024 RGBA.
- Motion review: idle alternates jaw tension; attack is a compact close bite; hit folds the arms inward; death progresses from a crouched buckle to a low curled collapse.
- Anatomy review: both hands, both feet, head, belly, and spines remain complete and attached. No saliva, blood, detached finger, extra limb, neighboring-slot fragment, or cropped anatomy remains.
- Extraction correction: the accepted death row was deterministically reduced to 98% and recentered with Lanczos filtering to prevent a false 4× pixel-pitch detection; re-extraction then used the intended 1× pitch for all four states.
- Extraction review: projection segmentation and the shared 96-color palette completed with `ok: true`; every frame reports `edge_pixels: 0` and `chroma_adjacent_pixels: 0`.
- Automated run inspection, atlas composition, preview generation, and curated export returned `ok: true`.
