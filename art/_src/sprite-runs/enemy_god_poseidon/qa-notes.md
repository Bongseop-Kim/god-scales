# Poseidon sprite QA

- Accepted HD base: left-facing elder Poseidon with white hair and beard, deep-teal robes, complete bronze trident, and one low ankle-high water ribbon attached to his feet.
- Frame contract: idle 4, attack 2, hit 1, death 2; all nine frames are 896×1024 RGBA.
- Motion review: idle keeps a planted guard; attack becomes a readable water-wall shove while the trident stays upright; hit is a compact crouching recoil; death sinks from one knee to a grounded collapse.
- Equipment review: all three trident tines and shafts remain complete; water stays below the ankles and attached to the feet. No tall water wall, loose droplets, weapon fragments, detached effects, or cropped anatomy remain.
- Extraction review: projection segmentation and the shared 96-color palette completed with `ok: true`; all frames report `edge_pixels: 0` and `chroma_adjacent_pixels: 0`.
- Automated run inspection, atlas composition, preview generation, and curated export returned `ok: true`.
