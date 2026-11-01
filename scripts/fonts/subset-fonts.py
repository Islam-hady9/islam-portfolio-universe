"""Subsets the self-hosted OFL fonts in src/assets/fonts in place (run after `npm run fonts:sync`).

Keeps Latin-1, general punctuation, arrows and the math signs the copy uses, plus only the
layout features the site needs (kerning, marks, locale forms). Drops code ligatures and
stylistic alternates the design never enables — JetBrains Mono alone shrinks by about half.
None of the three licences declares a Reserved Font Name, so subsets keep their names (OFL 1.1).

Usage: python scripts/fonts/subset-fonts.py        (requires fonttools: pip install fonttools brotli)
Idempotent: re-subsetting a subset with the same parameters is a no-op in glyph terms.
"""
import os
import sys

from fontTools import subset

FONTS = [
    'src/assets/fonts/sora-latin-wght-normal.woff2',
    'src/assets/fonts/manrope-latin-wght-normal.woff2',
    'src/assets/fonts/jetbrains-mono-latin-wght-normal.woff2',
]
UNICODES = (
    'U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,'
    'U+2010-2027,U+2030-203A,U+2044,U+20AC,U+2122,U+2190-2199,U+2212,U+2215'
)
FEATURES = 'kern,mark,mkmk,ccmp,locl'


def main() -> None:
    for path in FONTS:
        if not os.path.exists(path):
            sys.exit(f'missing {path} — run npm run fonts:sync first')
        before = os.path.getsize(path)
        subset.main([
            path,
            f'--unicodes={UNICODES}',
            f'--layout-features={FEATURES}',
            '--flavor=woff2',
            f'--output-file={path}',
        ])
        print(f'{os.path.basename(path):40s} {before:7d} -> {os.path.getsize(path):7d} bytes')


if __name__ == '__main__':
    main()
