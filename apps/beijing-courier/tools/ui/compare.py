#!/usr/bin/env python3
"""生成「参考截图 vs 我们的截图」上下对照图。

用法：
    cd apps/beijing-courier
    python3 tools/ui/compare.py

输入：
    docs/messenger-reference/*.png        （原站参考截图）
    screenshots/ui/*.png                  （tools/ui/shot.mjs 生成）
    screenshots/ui/reference-outfit.png    （若存在：原站换装屏参考，2× 截图）
输出：
    screenshots/ui/compare-*.png          （上：参考，下：我们）
"""

from pathlib import Path

from PIL import Image, ImageDraw

APP = Path(__file__).resolve().parents[2]
REF = APP / "docs" / "messenger-reference"
OURS = APP / "screenshots" / "ui"

PAIRS = [
    ("compare-intro.png", REF / "01-intro-title.png", OURS / "01-intro.png"),
    ("compare-loading.png", REF / "02-dialogue.png", OURS / "02-loading.png"),
    ("compare-dialogue.png", REF / "04-gameplay.png", OURS / "03-dialogue.png"),
    ("compare-checklist.png", OURS / "reference-checklist.png", OURS / "04-checklist.png"),
    ("compare-outfit.png", OURS / "reference-outfit.png", OURS / "05-outfit.png"),
]

LABEL_H = 34


def label(text: str, width: int) -> Image.Image:
    bar = Image.new("RGB", (width, LABEL_H), (37, 48, 55))
    draw = ImageDraw.Draw(bar)
    draw.text((12, 9), text, fill=(237, 242, 228))
    return bar


def load(path: Path, size=(1440, 900)) -> Image.Image:
    image = Image.open(path).convert("RGB")
    if image.size != size:
        image = image.resize(size, Image.LANCZOS)
    return image


def build(out_name: str, ref_path: Path, our_path: Path) -> bool:
    if not ref_path.exists() or not our_path.exists():
        print(f"跳过 {out_name}（缺少 {ref_path if not ref_path.exists() else our_path}）")
        return False
    w, h = 1440, 900
    canvas = Image.new("RGB", (w, h * 2 + LABEL_H * 2), (15, 15, 15))
    canvas.paste(label(f"REFERENCE  {ref_path.name}", w), (0, 0))
    canvas.paste(load(ref_path), (0, LABEL_H))
    canvas.paste(label(f"OURS  {our_path.name}", w), (0, LABEL_H + h))
    canvas.paste(load(our_path), (0, LABEL_H * 2 + h))
    target = OURS / out_name
    canvas.save(target)
    print("✓", target.relative_to(APP))
    return True


def main() -> None:
    OURS.mkdir(parents=True, exist_ok=True)
    created = 0
    for name, ref, ours in PAIRS:
        created += 1 if build(name, ref, ours) else 0
    if created == 0:
        raise SystemExit("没有生成任何对照图，请先跑 tools/ui/shot.mjs")


if __name__ == "__main__":
    main()
