# surface_lightning_afterglow idle QA

- Verdict: PASS after manual contact-sheet inspection.
- Output contract: 4 looping idle frames at 4 fps; each frame is 896x1024 RGBA.
- Motion: afterglow intensity pulse.
- Extraction: component-row, projection segmentation, YCbCr chroma removal, 32-color repalette.
- Logical height: 128; chosen to preserve readable subject scale without clipping.
- Structural checks: 4/4 frames present, edge pixels 0, chroma-adjacent pixels 0.
