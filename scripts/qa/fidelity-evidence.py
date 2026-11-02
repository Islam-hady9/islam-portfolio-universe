"""Builds the labelled before/after evidence sheets for docs/cinematic-fidelity-v3/evidence.

Usage:
  python scripts/qa/fidelity-evidence.py <before_dir> <after_dir> <framing_dir> [out_dir]
<before_dir>/<after_dir> are outputs of scripts/qa/fidelity-v3.mjs run with identical settings
(viewport, tier, scroll anchor, hover point) against the baseline and the V3 build; <framing_dir>
holds scripts/qa/stations.mjs captures of the Ask My AI station at several viewports.
Every tile is labelled with what it shows; sheets are lossy WebP (q82) to keep the repo small.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

before, after, framing = sys.argv[1], sys.argv[2], sys.argv[3]
out = sys.argv[4] if len(sys.argv) > 4 else 'docs/cinematic-fidelity-v3/evidence'
os.makedirs(out, exist_ok=True)

try:
    FONT = ImageFont.truetype('arial.ttf', 15)
except OSError:
    FONT = ImageFont.load_default()


def tile(path, label, width=None, crop=None, scale=None):
    im = Image.open(path).convert('RGB')
    if crop:
        im = im.crop(crop)
    if scale:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    if width and im.width != width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    w = d.textlength(label, font=FONT) + 14
    d.rectangle((0, 0, w, 22), fill=(0, 0, 0))
    d.text((7, 3), label, fill=(235, 240, 240), font=FONT)
    return im


def sheet(name, rows, gap=8):
    """rows: list of lists of tiles. Rows are stacked; tiles in a row are side by side."""
    widths = [sum(t.width for t in r) + gap * (len(r) - 1) for r in rows]
    heights = [max(t.height for t in r) for r in rows]
    W, H = max(widths), sum(heights) + gap * (len(rows) - 1)
    canvas = Image.new('RGB', (W, H), (255, 255, 255))
    y = 0
    for r, h in zip(rows, heights):
        x = 0
        for t in r:
            canvas.paste(t, (x, y))
            x += t.width + gap
        y += h + gap
    path = os.path.join(out, f'{name}.webp')
    canvas.save(path, 'WEBP', quality=82, method=6)
    print(f'{name:28s} {W}x{H} {os.path.getsize(path) // 1024} KB')


B = lambda n: os.path.join(before, f'{n}.png')  # noqa: E731
A = lambda n: os.path.join(after, f'{n}.png')  # noqa: E731
WORLDS = [('tibyn', 'TIBYN'), ('movid', 'MOViD'), ('ats-matching', 'ATS'), ('lifeatlas', 'LifeAtlas')]

# 1. Project cards at rest (posters) and the projects station, 1440x900 ultra.
sheet('01-projects-station', [[tile(B('d-projects'), 'BEFORE  projects station (cards at rest)', 900)],
                              [tile(A('d-projects'), 'AFTER  projects station (cards at rest)', 900)]])
# 2. Live worlds in their cards (hovered), before row / after row.
sheet('02-card-worlds-live', [[tile(B(f'world-{s}-f0'), f'BEFORE {n}', 340) for s, n in WORLDS],
                              [tile(A(f'world-{s}-f0'), f'AFTER {n}', 340) for s, n in WORLDS]])
# 3. Motion strips: four frames 350 ms apart per world (after).
sheet('03-world-motion-strips', [[tile(A(f'world-{s}-f{i}'), f'{n} t+{i * 350} ms', 300) for i in range(4)]
                                 for s, n in WORLDS])
# 4. Case-study heroes (full-screen worlds).
sheet('04-case-study-heroes', [[tile(B(f'cs-{s}'), f'BEFORE {n}', 720) for s, n in WORLDS[:2]],
                               [tile(A(f'cs-{s}'), f'AFTER {n}', 720) for s, n in WORLDS[:2]],
                               [tile(B(f'cs-{s}'), f'BEFORE {n}', 720) for s, n in WORLDS[2:]],
                               [tile(A(f'cs-{s}'), f'AFTER {n}', 720) for s, n in WORLDS[2:]]])
# 5. Portal + figure close-up and motion strip (six frames, 300 ms apart).
sheet('05-portal-and-figure', [[tile(B('portal-f0'), 'BEFORE portal + explorer', 560),
                                tile(A('portal-f0'), 'AFTER portal + explorer', 560)],
                               [tile(A(f'portal-f{i}'), f'AFTER t+{i * 300} ms', 370) for i in range(0, 6, 2)]])
sheet('06-figure-zoom', [[tile(B('d-ask-ai'), 'BEFORE explorer (3x)', crop=(250, 470, 350, 600), scale=3),
                          tile(A('d-ask-ai'), 'AFTER explorer (3x)', crop=(250, 470, 350, 600), scale=3)]])
# 6. Ask My AI station and panel states.
sheet('07-ask-ai-station', [[tile(B('d-ask-ai'), 'BEFORE Ask My AI station', 900)],
                            [tile(A('d-ask-ai'), 'AFTER Ask My AI station', 900)]])
sheet('08-ai-panel', [[tile(B('ai-panel-ready'), 'BEFORE ready'), tile(A('ai-panel-ready'), 'AFTER ready'),
                       tile(B('ai-panel-answer'), 'BEFORE Smart answer'), tile(A('ai-panel-answer'), 'AFTER Smart answer')]])
# 7. Glass surfaces: philosophy and capability tiles at 2x.
sheet('09-glass-tiles-2x', [[tile(B('d-philosophy'), 'BEFORE philosophy tile (2x)', crop=(110, 400, 360, 650), scale=2),
                             tile(A('d-philosophy'), 'AFTER philosophy tile (2x)', crop=(110, 400, 360, 650), scale=2)],
                            [tile(B('d-capabilities'), 'BEFORE capability panel (2x)', crop=(110, 330, 430, 620), scale=2),
                             tile(A('d-capabilities'), 'AFTER capability panel (2x)', crop=(110, 330, 430, 620), scale=2)]])
sheet('10-glass-sections', [[tile(B('d-philosophy'), 'BEFORE philosophy', 720), tile(A('d-philosophy'), 'AFTER philosophy', 720)],
                            [tile(B('d-capabilities'), 'BEFORE capabilities', 720), tile(A('d-capabilities'), 'AFTER capabilities', 720)],
                            [tile(B('d-listing'), 'BEFORE projects listing', 720), tile(A('d-listing'), 'AFTER projects listing', 720)]])
# 8. Mobile (Pixel 7 emulation, balanced tier; not a physical phone).
sheet('11-mobile', [[tile(B(n), f'BEFORE {label}', 300) for n, label in
                     [('m-projects', 'projects'), ('m-ask-ai', 'Ask My AI'), ('m-cs-movid', 'MOViD case')]],
                    [tile(A(n), f'AFTER {label}', 300) for n, label in
                     [('m-projects', 'projects'), ('m-ask-ai', 'Ask My AI'), ('m-cs-movid', 'MOViD case')]]])
# 9. Portal framing across viewports (after).
F = lambda v: os.path.join(framing, v, '00-ask-ai.png')  # noqa: E731
sheet('12-portal-framing', [[tile(F('1280x800'), '1280x800 laptop', 520), tile(F('1024x768'), '1024x768 (4:3)', 520)],
                            [tile(F('768x1024'), '768x1024 tablet', 300), tile(F('390x844'), '390x844 mobile (emulated)', 230),
                             tile(F('2560x1080'), '2560x1080 ultrawide', 800)]])
