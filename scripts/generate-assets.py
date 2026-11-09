#!/usr/bin/env python3
"""Generate PWA icons and synthetic meter images for the OCR test. Not patient data."""

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


def meter(path: Path, lines: list[tuple[str, int, int]]) -> None:
    img = Image.new("RGB", (1000, 860), "white")
    draw = ImageDraw.Draw(img)
    draw.rectangle([40, 40, 960, 820], outline=INK, width=6)
    y = 90
    for text, size, gap in lines:
        font = ImageFont.truetype(BOLD if size >= 60 else REG, size)
        draw.text((90, y), text, font=font, fill="black")
        y += gap
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)


def main() -> None:
    save_icons()
    fix = ROOT / "src" / "ocr" / "fixtures"
    meter(
        fix / "glucose-meter.png",
        [
            ("126", 200, 230),
            ("mg/dL", 72, 140),
            ("2026-11-09   07:42", 42, 90),
            ("MEM 04", 42, 80),
        ],
    )
    meter(
        fix / "bp-monitor.png",
        [
            ("SYS 148", 92, 130),
            ("DIA 92", 92, 130),
            ("PUL 76", 92, 150),
            ("2026-11-09  08:15", 40, 80),
            ("MEM 03", 40, 70),
        ],
    )
    print("Wrote icons and OCR fixtures")


if __name__ == "__main__":
    main()
