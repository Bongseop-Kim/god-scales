# Under boss sprite QA

- Accepted HD base: left-facing three-headed Cerberus with charcoal hide, red eyes, ivory fangs, heavy paws, and one complete shoulder chain.
- Frame contract: idle 4, attack 2, hit 1, death 2; all nine frames are 896×1024 RGBA.
- Motion review: idle alternates restrained snarls; attack compresses into a short three-head lunge; hit recoils as one body; death progresses from buckling forelegs to a low connected collapse.
- Anatomy and equipment review: all three heads, four paws, tail, and chain remain connected. No detached links, duplicate heads, saliva, blood, debris, neighboring-slot fragments, or cropped anatomy remain.
- Extraction review: projection segmentation and the shared 96-color palette completed with `ok: true`; every frame reports `edge_pixels: 0`. The maximum chroma-adjacent count is four isolated pixels and is visually absent in transparent QA.
- Automated run inspection, atlas composition, preview generation, and curated export returned `ok: true`.
