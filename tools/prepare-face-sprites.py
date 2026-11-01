# BAND AB! – Gesichts-Sprites für die Figuren aus den Bögen in art/ vorbereiten.
# Jeder Bogen: 32 Teile in 4 Reihen zu 8, Beschriftung darunter. Jedes Teil wird einzeln ausgeschnitten
# und kommt in einen Atlas mit derselben Anordnung wie auf dem Bogen; Größen bleiben wie gezeichnet.
#   Augen und Brauen sind Paare: Zelle (2·(i % 8) + Seite, i // 8), Seite 0 = links im Bild, 1 = rechts.
#     Jede Hälfte sitzt mittig auf der Mittellinie ihrer Reihe.
#   Münder sind einzeln: Zelle (i % 8, i // 8), jeder Mund mittig in seiner Zelle.
#
#   art/eyes-sheet.webp   → src/avatar/eyes-line.png  Umriss, Augenweiß, Pupille, Glanz – so wie sie sind
#                           src/avatar/eyes-iris.png  nur die (blaue) Iris als Grauwert, zum Einfärben mit der Augenfarbe
#   art/brows-sheet.webp  → src/avatar/brows.png      die Brauen als weiße Maske, zum Einfärben mit der Haarfarbe
#   art/mouths-sheet.webp → src/avatar/mouths.png     die Münder in ihren eigenen Farben
#   dazu je eine .json mit Zellgröße, Anordnung und Namen.
#
# usage: python tools/prepare-face-sprites.py   (braucht Pillow und NumPy; nur zum Vorbereiten, nicht zum Spielen)
import json
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'avatar')
IRIS_REF = np.array([0, 80, 210], float)   # typisches Iris-Blau auf dem Augen-Bogen


def eye_layers(px):
    """Ein Auge (RGBA, float) in Linien-Ebene und Iris-Ebene zerlegen."""
    rgb, a = px[..., :3], px[..., 3]
    # Wie blau ist das Pixel? Navy-Pupillen und -Umrisse bleiben fast 0, die Iris ist 1.
    w = np.clip((rgb[..., 2] - (rgb[..., 0] + rgb[..., 1]) / 2 - 60) / 80, 0, 1)
    # Manche Pupillen sind dunkelblau statt schwarz: was dunkel ist, bleibt Pupille, nicht Iris.
    w *= np.clip((rgb[..., 2] - 110) / 50, 0, 1)
    line = np.zeros_like(px)
    rest = (rgb - w[..., None] * IRIS_REF) / np.maximum(1 - w[..., None], 1e-3)   # was ohne die Iris übrig bleibt
    line[..., :3] = np.clip(rest, 0, 255)
    line[..., 3] = a * (1 - w)
    iris = np.zeros_like(px)
    iris[..., :3] = (np.clip(rgb[..., 2] / IRIS_REF[2], 0, 1) * 255)[..., None]  # Schattierung der Iris bleibt erhalten
    iris[..., 3] = a * w
    return {'line': line, 'iris': iris}


def brow_layers(px):
    """Eine Braue: schwarz auf transparent → weiße Maske (Deckkraft = wie dunkel)."""
    rgb, a = px[..., :3], px[..., 3]
    mask = np.zeros_like(px)
    mask[..., :3] = 255
    mask[..., 3] = a * np.clip(1 - rgb.mean(-1) / 160, 0, 1)   # heller Rand fällt weg
    return {'': mask}


def as_is(px):
    return {'': px.copy()}


SHEETS = [
    {
        'src': 'eyes-sheet.webp', 'name': 'eyes', 'layers': eye_layers, 'cell': (104, 104), 'pairs': True,
        'rows': [(80, 185, 132), (325, 420, 372), (565, 675, 619), (800, 905, 854)],   # Band oben, unten, Mittellinie
        'names': [
            'Klassisch rund', 'Breit oval', 'Hoch oval', 'Mandel', 'Schmal', 'Hängend', 'Aufwärts', 'Schläfrig',
            'Glücklich', 'Lachend', 'Spitz', 'Katze', 'Hundeblick', 'Fuchs', 'Anime-Glanz', 'Punkte',
            'Bohnen', 'Knöpfe', 'Eckig', 'Raute', 'Wütend', 'Besorgt', 'Gelangweilt', 'Überrascht',
            'Selbstsicher', 'Verschmitzt', 'Retro-Cartoon', 'Retro-Anime', 'Elegant', 'Kawaii', 'Zusammengekniffen', 'Wellig',
        ],
    },
    {
        'src': 'brows-sheet.webp', 'name': 'brows', 'layers': brow_layers, 'cell': (104, 104), 'pairs': True,
        'rows': [(200, 266, 233), (393, 464, 428), (600, 666, 633), (800, 880, 840)],
        'names': [
            'Sanfter Bogen', 'Gerade', 'Dick gerade', 'Dünn gerade', 'Leichter Bogen', 'Hoher Bogen', 'Flacher Bogen', 'Rund',
            'Kurz', 'Lang', 'Schräg', 'Grimmig', 'Besorgt', 'Traurig', 'Müde', 'Spitz',
            'Sanfte Spitze', 'S-Kurve', 'Spitz zulaufend', 'Klotzig', 'Buschig', 'Elegant dünn', 'Kawaii', 'Retro-Komma',
            'Verschmitzt', 'Selbstsicher', 'Hängende Enden', 'Hochgezogene Enden', 'Held', 'Winzig', 'Wellig', 'Fuchs',
        ],
    },
    {
        # Einzelteile; was näher als 20 px beieinander liegt, gehört zusammen (Nr. 30: Mund mit Rotwerden-Strichen).
        'src': 'mouths-sheet.webp', 'name': 'mouths', 'layers': as_is, 'cell': (160, 128), 'pairs': False, 'merge': 20,
        'rows': [(172, 272, None), (369, 488, None), (578, 708, None), (816, 914, None)],   # ohne Mittellinie: jeder Mund mittig
        'names': [
            'Neutral', 'Sanftes Lächeln', 'Breites Lachen', 'Offenes Lächeln', 'Grinsen', 'Zahnlächeln', 'Kleines Lächeln', 'Schmunzeln',
            'Flach', 'Ernst', 'Stirnrunzeln', 'Tief betrübt', 'Traurig', 'Schmollen', 'Offen oval', 'Kleines O',
            'Weit offen', 'Rufen', 'Zunge raus', 'Frech mit Zunge', 'Katzenmund', 'Wellig', 'Kringel', 'Punkt',
            'Schief', 'Verschmitzt', 'Vampir', 'Herz', 'Kussmund', 'Verlegen', 'Schläfrig', 'Chibi',
        ],
    },
]


def blobs(alpha, want, merge=0):
    """Spalten-Bereiche mit Inhalt, von links nach rechts. Lücken unter `merge` px werden geschlossen.
    Berühren sich zwei Teile (ein Bereich gut doppelt so breit wie üblich), wird an der dünnsten Stelle
    in seiner Mitte getrennt."""
    ink = alpha > 20
    cols = list(ink.any(0)) + [False]
    out, start = [], None
    for x, v in enumerate(cols):
        if v and start is None:
            start = x
        if not v and start is not None:
            if out and start - out[-1][1] < merge:
                out[-1] = (out[-1][0], x)
            else:
                out.append((start, x))
            start = None
    typical = np.median([x1 - x0 for x0, x1 in out])
    while len(out) < want:
        i = max(range(len(out)), key=lambda i: out[i][1] - out[i][0])
        x0, x1 = out[i]
        if x1 - x0 < 1.6 * typical:
            break
        lo, hi = x0 + (x1 - x0) * 3 // 10, x0 + (x1 - x0) * 7 // 10
        cut = lo + int(np.argmin(ink[:, lo:hi].sum(0)))
        out[i:i + 1] = [(x0, cut), (cut + 1, x1)]
    return out


def prepare(cfg):
    sheet = np.array(Image.open(os.path.join(ROOT, 'art', cfg['src'])).convert('RGBA')).astype(float)
    cw, ch = cfg['cell']
    per_row = 16 if cfg['pairs'] else 8
    atlases = {}
    for r, (y0, y1, mid) in enumerate(cfg['rows']):
        found = blobs(sheet[y0:y1, :, 3], per_row, cfg.get('merge', 0))
        if len(found) != per_row:
            raise SystemExit(f"{cfg['src']}, Reihe {r + 1}: {len(found)} statt {per_row} Teile gefunden")
        for c, (x0, x1) in enumerate(found):
            # nur dieses Teil: seine Zeilen innerhalb des Bands, keine Beschriftung, keine Nachbarn
            ys = np.nonzero((sheet[y0:y1, x0:x1, 3] > 20).any(1))[0]
            t, b = y0 + ys[0] - 2, y0 + ys[-1] + 3
            cy = mid if mid is not None else (t + b) // 2
            sx, sy = (x0 + x1) // 2 - cw // 2, cy - ch // 2
            if t < sy or b > sy + ch or x0 < sx or x1 > sx + cw:
                raise SystemExit(f"{cfg['src']}: Teil {r * 8 + c // (2 if cfg['pairs'] else 1) + 1} passt nicht in {cw} × {ch} px")
            crop = np.zeros((ch, cw, 4))
            crop[t - sy:b - sy, x0 - sx:x1 - sx] = sheet[t:b, x0:x1]
            for suffix, layer in cfg['layers'](crop).items():
                layer[layer[..., 3] < 1] = 0                 # unsichtbare Pixel ganz leeren: kleinere PNGs
                atlas = atlases.setdefault(suffix, np.zeros((4 * ch, per_row * cw, 4)))
                atlas[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw] = layer
    name = cfg['name']
    for suffix, atlas in atlases.items():
        file = f'{name}-{suffix}.png' if suffix else f'{name}.png'
        Image.fromarray(np.round(atlas).astype(np.uint8), 'RGBA').save(os.path.join(OUT, file), optimize=True)
    meta = {'cell': cw, 'columns': per_row, 'rows': 4, 'count': len(cfg['names'])} if cw == ch else \
        {'cellWidth': cw, 'cellHeight': ch, 'columns': per_row, 'rows': 4, 'count': len(cfg['names'])}
    meta['cellOf'] = 'Paar i, Seite s (0 links, 1 rechts): Spalte 2·(i % 8) + s, Reihe i // 8' if cfg['pairs'] else \
        'Mund i: Spalte i % 8, Reihe i // 8'
    meta['names'] = cfg['names']
    with open(os.path.join(OUT, f'{name}.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f"{cfg['src']}: {len(cfg['names'])} -> src/avatar/{name}*")


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for cfg in SHEETS:
        prepare(cfg)
