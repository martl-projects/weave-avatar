# Weave avatar – the agents' robot texture (src/avatar/agent.png), painted in the people's style: flat, matte, few colours.
# Every texel of Rob13's UV unwrap gets a colour by what it is (its face's strongest bone and where on the robot it sits, from
# tools/dump-agent-faces.py); the original texture's panel lines and creases stay as light shading on top.
#   RGB: the colours; alpha: where the robot's own colour (frameColor) tints them (255) and where they stay (0).
# usage: python tools/paint-agent.py <faces.json> <original albedo.png>
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'avatar', 'agent.png')
W = 1024
FACES, ALBEDO = sys.argv[1:3]

TINT = (255, 255, 255, 255)   # the shell: white, tinted by the robot's colour
GRAPHITE = (52, 52, 63, 0)    # joints, neck, tyres (like the people's trousers and shoes)
CREAM = (246, 240, 228, 0)    # hands, belly plate, ear rims (like gloves)
BEZEL = (35, 35, 44, 0)       # around the screen
LED = (255, 210, 63, 0)       # the slot on the chest

F = json.load(open(FACES))
GROUPS = sorted({f['g'] for f in F})
gid = {g: i for i, g in enumerate(GROUPS)}

# Every texel's spot on the robot: its face, and where on the face (interpolated from the corners)
face = np.full((W, W), -1, np.int32)
pos = np.zeros((W, W, 3), np.float32)
for fi, f in enumerate(F):
    uv = np.array(f['uv']) * W
    uv[:, 1] = W - uv[:, 1]
    P = np.array(f['p'], np.float32)
    for k in range(1, len(uv) - 1):
        t = uv[[0, k, k + 1]]
        x0, y0 = np.floor(t.min(0)).astype(int) - 1
        x1, y1 = np.ceil(t.max(0)).astype(int) + 1
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W), min(y1, W)
        if x1 <= x0 or y1 <= y0: continue
        ys, xs = np.mgrid[y0:y1, x0:x1] + 0.5
        (ax, ay), (bx, by), (cx, cy) = t
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-9: continue
        l1 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den
        l2 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den
        l3 = 1 - l1 - l2
        inside = (l1 >= -0.02) & (l2 >= -0.02) & (l3 >= -0.02)
        sub = face[y0:y1, x0:x1]
        sub[inside] = fi
        pos[y0:y1, x0:x1][inside] = (l1[..., None] * P[0] + l2[..., None] * P[k] + l3[..., None] * P[k + 1])[inside]

m = face >= 0
g = np.where(m, np.array([gid[f['g']] for f in F])[face], -1)
N = np.array([f['n'] for f in F], np.float32)[face]
x, y, z = pos[..., 0], pos[..., 1], pos[..., 2]
is_ = lambda *names: np.isin(g, [gid[n] for n in names if n in gid])
starts = lambda prefix: np.isin(g, [i for n, i in gid.items() if n.startswith(prefix)])
px = np.zeros((W, W, 4), np.float32)
px[m] = TINT


def put(mask, colour): px[mask & m] = colour


def centre(name):
    cs = np.array([f['c'] for f in F if f['g'] == name])
    return cs.mean(0), cs


# Head: the screen's frame, a rounded rectangle a little bigger than the glass, on the front
put(is_('head') & (y < -0.12) & ((x / 0.44) ** 4 + ((z - 1.112) / 0.305) ** 4 < 1), BEZEL)
# Ears like headphones: tinted cap, graphite ring, cream rim
for e in ('ear_L', 'ear_R'):
    c, cs = centre(e)
    R = np.hypot(cs[:, 1] - c[1], cs[:, 2] - c[2]).max()
    r = np.hypot(y - c[1], z - c[2]) / R
    put(is_(e) & (r >= 0.4), GRAPHITE); put(is_(e) & (r >= 0.7), CREAM)
put(is_('neck', 'wheelBar_L', 'wheelBar_R'), GRAPHITE)
# Chest: a cream oval plate with the slot in it lit up
put(is_('hip') & (y < -0.08) & ((x / 0.15) ** 2 + ((z - 0.475) / 0.2) ** 2 < 1), CREAM)
put(is_('hip') & (y < -0.08) & ((x / 0.062) ** 2 + ((z - 0.475) / 0.122) ** 2 < 1), LED)
# Arms: graphite shoulder balls, tinted sleeves, cream hands
put(starts('arm_') & (np.abs(x) < 0.29), GRAPHITE)
put(starts('hand_') | starts('F_'), CREAM)
# Wheels: graphite tyres, tinted hubs
for w in ('wheel_L', 'wheel_R'):
    c, cs = centre(w)
    R = np.hypot(cs[:, 1] - c[1], cs[:, 2] - c[2]).max()
    hub = (np.abs(N[..., 0]) > 0.6) & (np.hypot(y - c[1], z - c[2]) < 0.45 * R)
    put(is_(w), GRAPHITE); put(is_(w) & hub, TINT)

# Bleed the islands outwards (no seams where the mip maps reach past them)
for _ in range(8):
    grown, gm = px.copy(), m.copy()
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        sp, sm = np.roll(px, (dy, dx), (0, 1)), np.roll(m, (dy, dx), (0, 1))
        take = sm & ~gm
        grown[take] = sp[take]; gm |= take
    px, m = grown, gm

# The original's details (panel lines, creases) as gentle shading: its brightness against its blurred brightness
alb = Image.open(ALBEDO).convert('L').resize((W, W), Image.LANCZOS)
L = np.array(alb).astype(np.float32) / 255
Lb = np.array(alb.filter(ImageFilter.GaussianBlur(10))).astype(np.float32) / 255
detail = np.where(Lb > 0.12, np.clip(L / np.maximum(Lb, 1e-3), 0.72, 1.06), 1.0)
detail = 1 - (1 - detail) * 0.8
px[..., :3] = np.clip(px[..., :3] * detail[..., None], 0, 255)
Image.fromarray(px.astype(np.uint8), 'RGBA').save(OUT, optimize=True)
print('wrote', OUT, os.path.getsize(OUT))
