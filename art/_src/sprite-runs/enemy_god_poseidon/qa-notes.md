# Poseidon sprite QA

- Accepted HD base: left-facing elder Poseidon with white hair and beard, deep-teal robes, complete bronze trident, and one connected wall of water.
- Frame contract: idle 4, attack 2, hit 1, death 2; all nine frames are 896×1024 RGBA.
- Motion review: idle keeps a planted guard; attack becomes a readable water-wall shove while the trident stays upright; hit is a compact crouching recoil; death sinks from one knee to a grounded collapse.
- Equipment review: all three trident tines and shafts remain complete; water walls remain single connected masses. No loose droplets, weapon fragments, detached effects, or cropped anatomy remain.
- Extraction review: projection segmentation and the shared 96-color palette completed with `ok: true`; all frames report `edge_pixels: 0` and `chroma_adjacent_pixels: 0`.
- Automated run inspection, atlas composition, preview generation, and curated export returned `ok: true`.

