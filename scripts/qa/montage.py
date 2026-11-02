"""Builds labelled WebP contact sheets for docs/evidence from QA captures.

Usage:
  python scripts/qa/montage.py <out.webp> <cols> <tile_width> <image> [<image> ...]
Each tile is labelled with its file stem. Example:
  python scripts/qa/montage.py docs/evidence/live-3d/stations-desktop-ultra.webp 3 720 .evidence-tmp/stations-desktop/*.png
"""
import pathlib
import sys

from PIL import Image, ImageDraw


def main() -> None:
    if len(sys.argv) < 5:
        print(__doc__)
        sys.exit(2)
    out, cols, tile_w = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    paths = [pathlib.Path(p) for p in sys.argv[4:]]
    first = Image.open(paths[0])
    tile_h = round(first.height * tile_w / first.width)
    gap = 8
    rows = -(-len(paths) // cols)
    sheet = Image.new('RGB', (cols * tile_w + (cols + 1) * gap, rows * tile_h + (rows + 1) * gap), (18, 18, 20))
    draw = ImageDraw.Draw(sheet)
    for i, p in enumerate(paths):
        im = Image.open(p).convert('RGB').resize((tile_w, tile_h), Image.LANCZOS)
        x = gap + (i % cols) * (tile_w + gap)
        y = gap + (i // cols) * (tile_h + gap)
        sheet.paste(im, (x, y))
        label = p.stem
        draw.rectangle((x, y, x + 8 + 7 * len(label), y + 18), fill=(0, 0, 0))
        draw.text((x + 4, y + 3), label, fill=(235, 235, 235))
    pathlib.Path(out).parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, 'WEBP', quality=80, method=6)
    print(f'{out}: {sheet.width}x{sheet.height}, {pathlib.Path(out).stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
