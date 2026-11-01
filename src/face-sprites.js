// BAND AB! – Augen, Brauen und Münder der Figuren aus den Sprite-Atlanten in avatar/ (siehe tools/prepare-face-sprites.py).
// drawFace malt sie auf die Gesichtstextur (512 × 512, wie faceSvg), thumb zeigt ein einzelnes Teil flach für den Editor.
import { assetUrl, givenAsset } from './assets.js';

const A = window.Avatar;

const SHEETS = { eyes: ['eyes-line', 'eyes-iris'], brows: ['brows'], mouths: ['mouths'] };
const sheets = {};
let loading = null;

const image = (name) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(`avatar/${name}.png fehlt`));
  img.src = assetUrl(`${name}.png`);
});

/** Lädt Bilder und Namen einmal; danach sind drawFace und thumb sofort bereit. */
export function loadFaceSprites() {
  loading ??= Promise.all(Object.entries(SHEETS).map(async ([name, layers]) => {
    const meta = givenAsset(`${name}.json`) ?? (await (await fetch(assetUrl(`${name}.json`))).json());
    const imgs = await Promise.all(layers.map(image));
    sheets[name] = { meta, imgs, w: meta.cell || meta.cellWidth, h: meta.cell || meta.cellHeight };
  }));
  return loading;
}

export const partNames = (part) => (sheets[PART_SHEET[part]] || { meta: { names: [] } }).meta.names;
const PART_SHEET = { eyes: 'eyes', brows: 'brows', mouth: 'mouths' };

// Lage auf der Gesichtstextur (512 px; die Nase sitzt bei y ≈ 266).
const EYE_X = [172, 340], EYE_Y = 186, EYE_SCALE = 1.95;
const BROW_Y = 100, BROW_SCALE = 1.9;
const MOUTH_X = 256, MOUTH_Y = 342, MOUTH_SCALE = 1;
// Eine Stufe der Feinjustierung (avatar.js, ADJUST): so viele Pixel, Prozent, Grad.
const STEP_Y = 7, STEP_GAP = 7, STEP_SIZE = 1.12, STEP_ROT = 8;

/** Lage, Größe und Drehung eines Teils aus der Figur (pre: eye, brow, mouth). */
function adjust(a, pre) {
  const o = (k) => (`${pre}${k}` in A.ADJUST ? A.offset(a, `${pre}${k}`) : 0);
  return { y: o('Y') * STEP_Y, gap: o('Gap') * STEP_GAP, k: STEP_SIZE ** o('Size'), rot: (o('Rot') * STEP_ROT * Math.PI) / 180 };
}

// Zum Einfärben: ein Hilfs-Canvas für ein einzelnes Teil.
const scratch = document.createElement('canvas');
const sg = scratch.getContext('2d');

function cell(sheet, layer, col, row, color, mode) {
  const { w, h, imgs } = sheets[sheet];
  scratch.width = w; scratch.height = h;
  sg.globalCompositeOperation = 'source-over';
  sg.drawImage(imgs[layer], col * w, row * h, w, h, 0, 0, w, h);
  if (color) {
    sg.globalCompositeOperation = mode;               // 'multiply' behält die Schattierung, 'source-in' färbt ganz
    sg.fillStyle = color; sg.fillRect(0, 0, w, h);
    if (mode === 'multiply') { sg.globalCompositeOperation = 'destination-in'; sg.drawImage(imgs[layer], col * w, row * h, w, h, 0, 0, w, h); }
  }
  return scratch;
}

/** Ein Teil mittig an (x, y) malen, um rot gedreht (Bogenmaß, im Uhrzeigersinn). */
function put(g, sheet, layer, i, side, x, y, scale, rot, color, mode) {
  const { w, h } = sheets[sheet];
  const pairs = sheet !== 'mouths';
  const col = pairs ? 2 * (i % 8) + side : i % 8, row = Math.floor(i / 8);
  g.save();
  g.translate(x, y); g.rotate(rot);
  g.drawImage(cell(sheet, layer, col, row, color, mode), -(w * scale) / 2, -(h * scale) / 2, w * scale, h * scale);
  g.restore();
}

// Paare: Seite 0 rückt nach links, Seite 1 nach rechts; gedreht wird gespiegelt (positiv = Außenseiten hoch).
function eyes(g, a, dx = 0, dy = 0, s = 1) {
  const iris = A.COLORS.eyeColor[a.eyeColor], j = adjust(a, 'eye');
  for (const side of [0, 1]) {
    const x = dx + (EYE_X[side] + (side ? j.gap : -j.gap)) * s, y = dy + (EYE_Y + j.y) * s, rot = side ? -j.rot : j.rot;
    put(g, 'eyes', 1, a.eyes, side, x, y, EYE_SCALE * j.k * s, rot, iris, 'multiply');
    put(g, 'eyes', 0, a.eyes, side, x, y, EYE_SCALE * j.k * s, rot);
  }
}
function brows(g, a, dx = 0, dy = 0, s = 1) {
  const c = A.shade(A.COLORS.hairColor[a.hairColor], 0.85), j = adjust(a, 'brow');
  for (const side of [0, 1]) {
    const x = dx + (EYE_X[side] + (side ? j.gap : -j.gap)) * s, y = dy + (BROW_Y + j.y) * s;
    put(g, 'brows', 0, a.brows, side, x, y, BROW_SCALE * j.k * s, side ? -j.rot : j.rot, c, 'source-in');
  }
}
function mouth(g, a, dx = 0, dy = 0, s = 1) {
  const j = adjust(a, 'mouth');
  put(g, 'mouths', 0, a.mouth, 0, dx + MOUTH_X * s, dy + (MOUTH_Y + j.y) * s, MOUTH_SCALE * j.k * s, j.rot);
}

/** Augen, Brauen und Mund auf die Gesichtstextur (Kontext eines 512er-Canvas). Vorher loadFaceSprites().
 *  between: was zwischen Mund und Augen kommt (Wangen und Bart aus faceSvg: ein Schnurrbart liegt über dem Mund). */
export function drawFace(g, input, between) {
  const a = A.clean(input);
  mouth(g, a);
  if (between) g.drawImage(between, 0, 0, 512, 512);
  eyes(g, a); brows(g, a);
}

/** Vorschau eines Teils (eyes, brows, mouth) mit den Farben der Figur, auf Hautfarbe; als Bild-URL. */
export function thumb(part, input, size = 136) {
  const plain = A.clean({});
  // Vorschau immer wie gezeichnet: es geht um die Form, nicht um die Feinjustierung
  const a = { ...A.clean(input), ...Object.fromEntries(Object.keys(A.ADJUST).map((k) => [k, plain[k]])) };
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = A.COLORS.skin[a.skin]; g.fillRect(0, 0, size, size);
  // Ausschnitt der Gesichtstextur, der das Teil zeigt: [Mitte x, Mitte y, Breite]
  const [cx, cy, span] = part === 'mouth' ? [MOUTH_X, MOUTH_Y, 200] : part === 'brows' ? [256, (BROW_Y + EYE_Y) / 2, 330] : [256, EYE_Y, 330];
  const s = size / span;
  const dx = size / 2 - cx * s, dy = size / 2 - cy * s;
  if (part === 'mouth') mouth(g, a, dx, dy, s);
  else { eyes(g, a, dx, dy, s); if (part === 'brows') brows(g, a, dx, dy, s); }
  return c.toDataURL('image/png');
}
