#!/usr/bin/env python3
"""Pre-generate Korean god dialogue with Qwen3-TTS."""

import argparse
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

ROOT = Path(__file__).resolve().parents[1]
MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
VOICES = {
    "zeus": ("Uncle_Fu", "노련한 저음으로 호쾌하고 제멋대로 크게 말한다."),
    "poseidon": ("Ryan", "느긋하고 리듬감 있는 뱃사람처럼 호쾌하게 되묻는다."),
    "ares": ("Eric", "허스키한 목소리로 늘 화난 듯 거칠고 짧게 말한다."),
    "athena": ("Serena", "따뜻하지만 단호하고 신중하게, 품위 있는 존댓말로 말한다."),
    "artemis": ("Sohee", "다정하지만 빈틈없는 사냥 동료처럼 친숙하고 또렷하게 말한다."),
}


def voice_key(god: str, text: str) -> str:
    value = 0x811C9DC5
    for byte in f"{god}\0{text}".encode():
        value = ((value ^ byte) * 0x01000193) & 0xFFFFFFFF
    return f"{value:08x}"


def dialogue():
    def strings(value):
        if isinstance(value, str):
            yield value
        elif isinstance(value, dict):
            for child in value.values():
                yield from strings(child)
        elif isinstance(value, list):
            for child in value:
                yield from strings(child)

    for god in json.loads((ROOT / "data/gods.json").read_text()):
        for text in strings(god["lines"]):
            yield god["id"], text


def converter() -> tuple[str, str]:
    if tool := shutil.which("ffmpeg"):
        if subprocess.run([tool, "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
            return tool, ".mp3"
    if tool := shutil.which("afconvert"):
        return tool, ".m4a"
    raise SystemExit("ffmpeg 또는 afconvert가 필요합니다.")


def encode(tool: str, wav: Path, output: Path) -> None:
    command = [tool, "-y", "-loglevel", "error", "-i", str(wav), "-codec:a", "libmp3lame", "-q:a", "4", str(output)] if output.suffix == ".mp3" else [tool, str(wav), str(output), "-f", "m4af", "-d", "aac ", "-b", "64000"]
    subprocess.run(command, check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke", action="store_true", help="신별 첫 대사 한 줄만 생성")
    args = parser.parse_args()
    tool, suffix = converter()
    output_dir = ROOT / "audio/voice"
    output_dir.mkdir(parents=True, exist_ok=True)
    lines = list(dialogue())
    if args.smoke:
        lines = [next(line for line in lines if line[0] == god) for god in VOICES]
    lines = [(god, text) for god, text in lines if not any((output_dir / f"{voice_key(god, text)}{extension}").exists() for extension in (".mp3", ".m4a"))]
    if not lines:
        print("생성할 음성이 없습니다.")
        return

    import soundfile as sf
    import torch
    from qwen_tts import Qwen3TTSModel

    model = Qwen3TTSModel.from_pretrained(MODEL, device_map="mps", dtype=torch.bfloat16, attn_implementation="sdpa")
    for start in range(0, len(lines), 8):
        batch = lines[start:start + 8]
        wavs, rate = model.generate_custom_voice(
            text=[text for _, text in batch],
            language=["Korean"] * len(batch),
            speaker=[VOICES[god][0] for god, _ in batch],
            instruct=[VOICES[god][1] for god, _ in batch],
            max_new_tokens=2048,
        )
        with tempfile.TemporaryDirectory() as temporary:
            for index, ((god, text), wav) in enumerate(zip(batch, wavs)):
                source = Path(temporary) / f"{index}.wav"
                target = output_dir / f"{voice_key(god, text)}{suffix}"
                sf.write(source, wav, rate)
                encode(tool, source, target)
        print(f"{min(start + len(batch), len(lines))}/{len(lines)}", flush=True)


if __name__ == "__main__":
    main()
