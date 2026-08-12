#!/usr/bin/env python3
"""Regenerate the contrast-outlined assets from the originals archive.

The treatment (PLAYBOOK §8, adopted 2026-08-12): every transparent PNG whose
text/lettering ink depends on its background carries a rim in the opposite
polarity — light ink gets a plum #362229 rim, dark ink a white rim — drawn by
dilating the image's own alpha. The rim is invisible on the intended
background and becomes the contrast border when a client inverts the surface
without touching the image (Outlook desktop dark; guide §2c).

Mechanics this script enforces:
- rim width  = max(2, round(min(w, h) * 0.045)), forced odd (MaxFilter),
  computed from the ORIGINAL canvas;
- feather    = gaussian blur 0.6 on the dilated alpha;
- canvas     = every variant in a FAMILY expands by the same margin
  (max family rim // 2 + 2 px per side) so light/dark twins keep matching
  dimensions and the rim never clips at the artwork's edge;
- after regeneration, every mj-image width attribute referencing a treated
  asset must be scaled by (new canvas width / old canvas width) so artwork
  renders at its pre-outline size — this script prints the ratios, the MJML
  edit is manual (or see the app-side enhancement in the private repo's
  docs/future-enhancements.md).

Inputs come from dist/assets/originals/ (the untouched archive, which is why
that folder is never overwritten by builds); outputs land in src/assets/.
Requires Pillow: pip install Pillow. Run from the repo root:

    python3 scripts/outline-assets.py
"""
from PIL import Image, ImageFilter, ImageOps
import os, sys

PLUM = (54, 34, 41)      # #362229 — rim for light ink
WHITE = (255, 255, 255)  # rim for dark ink

# family -> [(filename, rim color)]; families expand by a shared margin
FAMILIES = {
    'logo': [('logo-tpl_all-light-green.png', PLUM),
             ('logo-tpl_color-light-green-text.png', PLUM),
             ('logo-tpl_all-black.png', WHITE),
             ('logo-tpl_color-black-text.png', WHITE)],
    'text-arrow': [('text-and-arrow_1.png', PLUM), ('text-and-arrow_2.png', PLUM)],
    'gt-badge': [('cta-giving-tuesday_white.png', PLUM), ('cta-giving-tuesday_color.png', WHITE)],
    'podcast': [('icon-podcast.png', PLUM)],
    'state': [('state-north-carolina.png', PLUM)],
    'quotes': [('icon-quotes_black.png', WHITE), ('icon-quotes_white.png', PLUM)],
    'signature': [('staff-carrie-besnette-hauser-signature_white.png', PLUM),
                  ('staff-carrie-besnette-hauser-signature_black.png', WHITE)],
}

SRC = 'dist/assets/originals'
DST = 'src/assets'

def rim_width(im):
    w = max(2, round(min(im.size) * 0.045))
    return w + 1 if w % 2 == 0 else w

def main():
    if not os.path.isdir(SRC):
        sys.exit(f'{SRC} not found — run from the repo root')
    for fam, members in FAMILIES.items():
        ims = {f: Image.open(f'{SRC}/{f}').convert('RGBA') for f, _ in members}
        margin = max(rim_width(im) for im in ims.values()) // 2 + 2
        for f, color in members:
            orig = ims[f]
            w = rim_width(orig)
            im = ImageOps.expand(orig, border=margin, fill=(0, 0, 0, 0))
            a = im.split()[3]
            dil = a.filter(ImageFilter.MaxFilter(w)).filter(ImageFilter.GaussianBlur(0.6))
            rim = Image.new('RGBA', im.size, color + (0,))
            rim.putalpha(dil)
            Image.alpha_composite(rim, im).save(f'{DST}/{f}', optimize=True)
            print(f'{fam:11} {f:52} {orig.size} -> {im.size}  '
                  f'width ratio {im.size[0] / orig.size[0]:.5f}')

if __name__ == '__main__':
    main()
