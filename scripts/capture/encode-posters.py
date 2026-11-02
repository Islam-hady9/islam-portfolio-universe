"""Crops/encodes captured posters to WebP and writes src/assets/posters.json.

Usage: python scripts/capture/encode-posters.py   (after scripts/capture/posters.mjs)
"""
import json
import os
from PIL import Image

SRC = '.evidence-tmp/posters'
DST = 'public/images/posters'
MANIFEST = 'src/assets/posters.json'
MAX_W = {'hero': 1100, 'universe': 1100, 'journey': 1600, 'portal': 900, 'horizon': 1600, 'deep-space': 1400}

os.makedirs(DST, exist_ok=True)
crops = json.load(open(os.path.join(SRC, 'crops.json')))
manifest = {}
for name in sorted(os.listdir(SRC)):
    if not name.endswith('.png'):
        continue
    key = name[:-4]
    im = Image.open(os.path.join(SRC, name)).convert('RGB')
    if key in crops:
        c = crops[key]
        w, h = im.size
        im = im.crop((int(c['left'] * w), int(c['top'] * h), int(c['right'] * w), int(c['bottom'] * h)))
    limit = MAX_W.get(key, 720 if key.startswith('project-') else 1600)
    if im.width > limit:
        im = im.resize((limit, round(im.height * limit / im.width)), Image.LANCZOS)
    out = os.path.join(DST, f'{key}.webp')
    im.save(out, 'WEBP', quality=78, method=6)
    entry = {'src': f'/images/posters/{key}.webp', 'width': im.width, 'height': im.height}
    # Smaller variants for phones (srcset), so mobile never downloads the desktop poster.
    variants = []
    for vw in (480, 800):
        if im.width > vw * 1.15:
            v = im.resize((vw, round(im.height * vw / im.width)), Image.LANCZOS)
            vout = os.path.join(DST, f'{key}-{vw}.webp')
            # Phone-sized variants sit on the mobile LCP path: slightly lower quality, ~20% fewer bytes.
            v.save(vout, 'WEBP', quality=66, method=6)
            variants.append(f'/images/posters/{key}-{vw}.webp {vw}w')
    if variants:
        entry['srcSet'] = ', '.join(variants + [f"/images/posters/{key}.webp {im.width}w"])
    manifest[key] = entry
    print(f'{key:16s} {im.width}x{im.height} {os.path.getsize(out) // 1024} KB  variants={len(variants)}')

with open(MANIFEST, 'w', newline='\n') as f:
    json.dump(manifest, f, indent=2)
    f.write('\n')
print('manifest:', MANIFEST)
