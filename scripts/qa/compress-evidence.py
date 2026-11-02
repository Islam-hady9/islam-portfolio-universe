"""Converts PNG evidence screenshots (written by tests/e2e/visual.spec.ts) to WebP for the repo.

Usage: python scripts/qa/compress-evidence.py [dir=docs/evidence/screenshots]
Full-page captures are kept at full resolution (lossy q80); PNG originals are removed.
"""
import os
import sys
from PIL import Image

root = sys.argv[1] if len(sys.argv) > 1 else 'docs/evidence/screenshots'
before = after = 0
for name in sorted(os.listdir(root)):
    if not name.endswith('.png'):
        continue
    src = os.path.join(root, name)
    dst = os.path.join(root, name[:-4] + '.webp')
    im = Image.open(src).convert('RGB')
    # WebP's maximum dimension is 16383 px.
    if im.height > 16383:
        im = im.resize((round(im.width * 16383 / im.height), 16383), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=80, method=6)
    before += os.path.getsize(src)
    after += os.path.getsize(dst)
    os.remove(src)
print(f'{before // 1024} KB PNG -> {after // 1024} KB WebP')
