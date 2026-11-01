"""Personal media pipeline: owner-supplied portrait + intro reel -> web derivatives + manifest.

Usage:
  npm run media:process
  python scripts/media/process-media.py [--photo <file>] [--video <file>]

Defaults read the originals from media-src/ (git-ignored). Writes:
  public/media/photo/        portrait in AVIF/WebP (4 widths) + JPEG fallback (2 widths)
  public/media/video/        intro reel: 1080p remux (no re-encode) + 720p H.264/AAC
  public/media/posters/      poster frame (AVIF/WebP/JPEG)
  public/media/thumbnails/   square face crop of the poster for compact video triggers
  src/assets/media.json      typed manifest consumed by src/lib/media.ts

Every output is written from fresh pixel buffers / with container metadata dropped, so no
EXIF, GPS, XMP or encoder tags from the originals reach the site. Creative decisions (poster
time, thumbnail crop, widths, quality) live in scripts/media/media.config.json.
Requires ffmpeg + ffprobe on PATH (libx264, aac) and Pillow with AVIF support.
"""

import argparse
import base64
import io
import json
import os
import subprocess
import sys
import tempfile

from PIL import Image, features

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONFIG = os.path.join(ROOT, 'scripts', 'media', 'media.config.json')
PUBLIC = os.path.join(ROOT, 'public')
MANIFEST = os.path.join(ROOT, 'src', 'assets', 'media.json')

# H.264 profile -> (profile_idc, constraint flags) for RFC 6381 codec strings.
AVC_PROFILES = {'Baseline': (66, 0xE0), 'Constrained Baseline': (66, 0xE0), 'Main': (77, 0x40), 'High': (100, 0x00)}


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def probe(path):
    out = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', path],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return json.loads(out)


def clean(im):
    """Fresh RGB buffer: drops EXIF/XMP/ICC and any other info carried by the original."""
    rgb = im.convert('RGB')
    return Image.frombytes('RGB', rgb.size, rgb.tobytes())


def url(*parts):
    return '/' + '/'.join(parts)


def save_variants(im, folder, stem, widths, formats, quality):
    """Writes `stem-<w>.<ext>` for each width/format. Returns {fmt: [(url, w, bytes)]}."""
    os.makedirs(os.path.join(PUBLIC, folder), exist_ok=True)
    out = {}
    for fmt in formats:
        for w in widths:
            w = min(w, im.width)
            h = round(im.height * w / im.width)
            v = im if w == im.width else im.resize((w, h), Image.LANCZOS)
            ext = {'avif': 'avif', 'webp': 'webp', 'jpeg': 'jpg'}[fmt]
            rel = f'{stem}-{w}.{ext}'
            path = os.path.join(PUBLIC, folder, rel)
            if fmt == 'avif':
                v.save(path, 'AVIF', quality=quality['avif'], speed=4)
            elif fmt == 'webp':
                v.save(path, 'WEBP', quality=quality['webp'], method=6)
            else:
                v.save(path, 'JPEG', quality=quality['jpeg'], optimize=True, progressive=True)
            out.setdefault(fmt, []).append((url('media', folder.split('/')[-1], rel), w, os.path.getsize(path)))
    return out


def srcset(entries):
    return ', '.join(f'{u} {w}w' for u, w, _ in entries)


def placeholder(im, width=24):
    """Tiny WebP data URI painted (blurred) behind the real image while it loads."""
    h = max(1, round(im.height * width / im.width))
    buf = io.BytesIO()
    im.resize((width, h), Image.LANCZOS).save(buf, 'WEBP', quality=40, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')


def process_portrait(src, cfg):
    im = clean(Image.open(src))
    q = cfg['quality']
    variants = save_variants(im, 'media/photo', 'portrait', cfg['widths'], ['avif', 'webp'], q)
    jpeg = save_variants(im, 'media/photo', 'portrait', cfg['jpegWidths'], ['jpeg'], q)['jpeg']
    files = {u: b for fmt in (variants, {'jpeg': jpeg}) for entries in fmt.values() for u, _, b in entries}
    print(f'portrait  {im.width}x{im.height}  ' + '  '.join(f'{os.path.basename(u)}={b // 1024}KB' for u, b in files.items()))
    return {
        'width': im.width,
        'height': im.height,
        'sources': [
            {'type': 'image/avif', 'srcSet': srcset(variants['avif'])},
            {'type': 'image/webp', 'srcSet': srcset(variants['webp'])},
        ],
        'fallback': {'src': jpeg[0][0], 'srcSet': srcset(jpeg)},
        'placeholder': placeholder(im),
        'bytes': files,
    }


def avc_codec(stream):
    profile = stream.get('profile')
    if profile not in AVC_PROFILES:
        raise SystemExit(f'Unsupported H.264 profile {profile!r} for the codec string')
    idc, flags = AVC_PROFILES[profile]
    return f'avc1.{idc:02x}{flags:02x}{int(stream["level"]):02x}'


def describe(path, media=None):
    info = probe(path)
    v = next(s for s in info['streams'] if s['codec_type'] == 'video')
    a = next((s for s in info['streams'] if s['codec_type'] == 'audio'), None)
    if v['codec_name'] != 'h264' or v.get('pix_fmt') != 'yuv420p' or (a and a['codec_name'] != 'aac'):
        raise SystemExit(f'{path}: expected H.264 yuv420p + AAC, got {v["codec_name"]}/{v.get("pix_fmt")}')
    codecs = avc_codec(v) + (', mp4a.40.2' if a else '')
    size = os.path.getsize(path)
    duration = float(info['format']['duration'])
    entry = {
        'src': url('media', 'video', os.path.basename(path)),
        'type': f'video/mp4; codecs="{codecs}"',
        'width': int(v['width']),
        'height': int(v['height']),
        'bytes': size,
        'kbps': round(size * 8 / duration / 1000),
    }
    if media:
        entry['media'] = media
    return entry, info


def process_video(src, cfg):
    folder = os.path.join(PUBLIC, 'media', 'video')
    os.makedirs(folder, exist_ok=True)
    info = probe(src)
    v = next(s for s in info['streams'] if s['codec_type'] == 'video')
    has_audio = any(s['codec_type'] == 'audio' for s in info['streams'])
    duration = float(info['format']['duration'])
    num, den = (int(x) for x in v['avg_frame_rate'].split('/'))
    strip = ['-map_metadata', '-1', '-map_chapters', '-1', '-fflags', '+bitexact']
    sources = []
    for var in cfg['variants']:
        out = os.path.join(folder, f'intro-reel-{var["id"]}.mp4')
        maps = ['-map', '0:v:0'] + (['-map', '0:a:0'] if has_audio else [])
        if var['mode'] == 'copy':
            # Already web-grade H.264/AAC: remux only (no generational loss), moov atom first.
            run(['ffmpeg', '-y', '-i', src, *maps, '-c', 'copy', *strip, '-movflags', '+faststart', out])
        else:
            run([
                'ffmpeg', '-y', '-i', src, *maps,
                '-vf', f'scale=-2:{var["height"]}:flags=lanczos',
                '-c:v', 'libx264', '-preset', 'slow', '-crf', str(var['crf']),
                '-profile:v', 'high', '-level:v', '3.1', '-pix_fmt', 'yuv420p',
                # aq-mode 3 favours dark flat areas (most of this reel) -> less banding.
                '-x264-params', 'aq-mode=3', '-g', str(2 * round(num / den)),
                '-flags:v', '+bitexact',
                *(['-c:a', 'aac', '-b:a', f'{var["audioKbps"]}k', '-ac', '2', '-ar', '48000', '-flags:a', '+bitexact'] if has_audio else []),
                *strip, '-movflags', '+faststart', out,
            ])
        entry, _ = describe(out, var.get('media'))
        sources.append(entry)
        print(f'video     {os.path.basename(out)}  {entry["width"]}x{entry["height"]}  {entry["bytes"] / 1e6:.2f} MB  {entry["kbps"]} kbps  {entry["type"]}')

    # Poster + thumbnail: exact frames from the source (not from a re-encoded variant). The
    # thumbnail uses its own moment so the poster's typography never lands in the tight crop.
    def grab(t):
        with tempfile.TemporaryDirectory() as tmp:
            frame = os.path.join(tmp, 'frame.png')
            run(['ffmpeg', '-y', '-ss', str(t), '-i', src, '-frames:v', '1', frame])
            return clean(Image.open(frame))

    poster = grab(cfg['posterTime'])
    q = {'avif': 58, 'webp': 78, 'jpeg': 80}
    pv = save_variants(poster, 'media/posters', 'intro-reel', cfg['posterWidths'], ['avif', 'webp'], q)
    pj = save_variants(poster, 'media/posters', 'intro-reel', cfg['posterWidths'][:1], ['jpeg'], q)['jpeg']
    x, y, w, h = cfg['thumbnail']['box']
    thumb_t = cfg['thumbnail'].get('time', cfg['posterTime'])
    thumb = (poster if thumb_t == cfg['posterTime'] else grab(thumb_t)).crop((x, y, x + w, y + h))
    tv = save_variants(thumb, 'media/thumbnails', 'intro-reel', cfg['thumbnail']['sizes'], ['avif', 'webp'], q)
    files = {u: b for group in (pv, {'jpeg': pj}, tv) for entries in group.values() for u, _, b in entries}
    print('poster    ' + '  '.join(f'{os.path.basename(u)}={b // 1024}KB' for u, b in files.items()))
    largest = pv['webp'][-1]
    return {
        'duration': round(duration, 3),
        'width': int(v['width']),
        'height': int(v['height']),
        'frameRate': round(num / den, 3),
        'hasAudio': has_audio,
        'sources': sources,
        'poster': {
            'time': cfg['posterTime'],
            'width': poster.width,
            'height': poster.height,
            'src': largest[0],
            'small': pv['webp'][0][0],
            'sources': [
                {'type': 'image/avif', 'srcSet': srcset(pv['avif'])},
                {'type': 'image/webp', 'srcSet': srcset(pv['webp'])},
            ],
            'fallback': pj[0][0],
            'placeholder': placeholder(poster, 18),
        },
        'thumbnail': {
            'time': thumb_t,
            'width': w,
            'height': h,
            'src': tv['webp'][0][0],
            'sources': [
                {'type': 'image/avif', 'srcSet': srcset(tv['avif'])},
                {'type': 'image/webp', 'srcSet': srcset(tv['webp'])},
            ],
        },
        'bytes': files,
    }


def main():
    cfg = json.load(open(CONFIG, encoding='utf-8'))
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--photo', default=os.path.join(ROOT, cfg['portrait']['defaultSource']))
    ap.add_argument('--video', default=os.path.join(ROOT, cfg['introReel']['defaultSource']))
    args = ap.parse_args()
    if not features.check('avif'):
        sys.exit('Pillow was built without AVIF support (pip install -U pillow)')
    for p in (args.photo, args.video):
        if not os.path.isfile(p):
            sys.exit(f'Missing source file: {p} (copy the originals into media-src/ or pass --photo/--video)')
    manifest = {
        '$comment': 'Generated by scripts/media/process-media.py - do not edit by hand.',
        'portrait': process_portrait(args.photo, cfg['portrait']),
        'introReel': process_video(args.video, cfg['introReel']),
    }
    with open(MANIFEST, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(manifest, f, indent=2)
        f.write('\n')
    print('manifest:', os.path.relpath(MANIFEST, ROOT))


if __name__ == '__main__':
    main()
