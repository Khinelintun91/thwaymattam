#!/usr/bin/env python3
"""Generate PWA icons. Not patient data."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BOLD = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"
TEAL = (14, 92, 86)
PAPER = (244, 250, 248)
INK = (20, 36, 33)


def icon(size: int, maskable: bool) -> Image.Image:
    img = Image.new("RGB", (size, size), TEAL)
    draw = ImageDraw.Draw(img)
    inset = int(size * (0.22 if maskable else 0.14))
    draw.rounded_rectangle(
        [inset, inset, size - inset, size - inset],
        radius=int(size * 0.12),
        fill=PAPER,
    )
    pad = int(size * (0.34 if maskable else 0.30))
    y = size // 2
    width = max(4, size // 28)
    points = [
        (pad, y),
        (pad + int(size * 0.12), y),
        (pad + int(size * 0.18), y - int(size * 0.12)),
        (pad + int(size * 0.28), y + int(size * 0.14)),
        (pad + int(size * 0.36), y - int(size * 0.04)),
        (size - pad, y - int(size * 0.04)),
    ]
    draw.line(points, fill=TEAL, width=width, joint="curve")
    return img


def save_icons() -> None:
    out = ROOT / "public" / "icons"
    out.mkdir(parents=True, exist_ok=True)
    icon(192, False).save(out / "icon-192.png")
    icon(512, False).save(out / "icon-512.png")
    icon(512, True).save(out / "icon-maskable-512.png")
    icon(180, False).save(out / "apple-touch-icon.png")


def main() -> None:
    save_icons()
    print("Wrote icons")


if __name__ == "__main__":
    main()
