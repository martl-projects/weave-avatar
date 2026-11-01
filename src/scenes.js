// Szenen: eine Figur in einer Pose, mit Dingen um sich herum ("ich hatte eine Idee": die Figur zeigt nach oben, über
// ihr leuchtet eine Glühbirne). Eine Szene ist nur ihr Name; wer sie zeigt, baut sie aus der Figur selbst. So bleibt sie
// klein (ein Wort an einem Beitrag) und zeigt immer die aktuelle Figur ihres Menschen.
//
// Eine Szene: id (fest, für immer), label (englisch, für Auswahllisten), pose(rig) stellt Arme und Kopf (rig3d.js),
// face: was sie am Gesicht ändert (Mund, Augen), props(at): die Dinge, in Figuren-Maßen (Kopfmitte 0, Füße bei FEET).
// at: Lagen nach der Pose: Hände (handL, handR), Füße, Kopfmitte (head) und Hüfte (hips), schon in Figuren-Maßen.
// Dinge: eine Glühbirne, Konfetti, ein Paket, Lupe und Marienkäfer, Tasse, Herz, Schraubenschlüssel, Bücher, ein Laptop,
// ein Gamepad, ein Hocker, Mond und Sterne, Tiere (Katze, Hund, Vogel) und Pixel-Bilder aus Würfeln (Herz, Stern, Alien, Münze).
import * as THREE from 'three';
import { buildAvatar, FEET } from './avatar3d.js';
import { aimArm } from './rig3d.js';

const A = window.Avatar;
const { PI } = Math;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const mats = new Map();
function mat(color, extra) {
  const k = color + JSON.stringify(extra || {});
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra }));
  return mats.get(k);
}
const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };
const glow = (color, k = 0.9) => mat(color, { emissive: color, emissiveIntensity: k, roughness: 0.3 });

// Arme: Richtung des Oberarms und des Unterarms im Raum der Brust (+x rechts im Bild, +y oben, +z nach vorn).
const arm = (rig, side, upper, fore) => aimArm(rig, side, upper, fore);
const mirror = (v) => V(-v.x, v.y, v.z);
const both = (rig, upper, fore) => { arm(rig, 'R', upper, fore); arm(rig, 'L', mirror(upper), mirror(fore)); };
const tilt = (rig, x, z = 0, y = 0) => rig.bones.head.rotation.set(x, y, z);

// ── Die Dinge
function bulb() {
  const g = new THREE.Group();
  const glass = mesh(new THREE.SphereGeometry(0.42, 28, 20), glow('#ffd23f', 1.1)); glass.scale.y = 1.08; g.add(glass);
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.3, 20), mat('#a3a8ae', { metalness: 0.6, roughness: 0.3 }), 0, -0.5, 0));
  for (const y of [-0.43, -0.5, -0.57]) g.add(mesh(new THREE.TorusGeometry(0.215, 0.025, 6, 20), mat('#7d8288', { metalness: 0.6 }), 0, y, 0).rotateX(PI / 2));
  // Strahlen rundherum
  for (let i = 0; i < 7; i++) {
    const t = -PI / 2 - 0.15 + ((i + 0.5) / 7) * (PI + 0.3) - PI / 2;
    const ray = mesh(new THREE.BoxGeometry(0.07, 0.3, 0.07), glow('#ffd23f', 0.8), Math.cos(t + PI) * 0.75, -Math.sin(t + PI) * 0.75 + 0.05, 0);
    ray.rotation.z = t + PI / 2;
    g.add(ray);
  }
  return g;
}

function questionMark() {
  const g = new THREE.Group(), m = glow('#3ab7ff', 0.6);
  const hook = mesh(new THREE.TorusGeometry(0.32, 0.1, 12, 32, 1.45 * PI), m, 0, 0.35, 0); hook.rotation.z = -0.7 * PI; g.add(hook);
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.32, 12), m, 0, -0.1, 0));
  g.add(mesh(new THREE.SphereGeometry(0.12, 14, 10), m, 0, -0.5, 0));
  return g;
}

function thought() {
  const g = new THREE.Group(), m = mat('#f4f4f4', { roughness: 0.8 });
  g.add(mesh(new THREE.SphereGeometry(0.1, 12, 10), m, 0, 0, 0), mesh(new THREE.SphereGeometry(0.17, 14, 10), m, 0.28, 0.36, 0));
  const cloud = new THREE.Group(); cloud.position.set(0.75, 1.05, 0);
  for (const [x, y, r] of [[-0.3, 0, 0.32], [0.05, 0.12, 0.4], [0.4, 0, 0.32], [0.05, -0.12, 0.3]]) cloud.add(mesh(new THREE.SphereGeometry(r, 18, 14), m, x, y, 0));
  g.add(cloud);
  return g;
}

function confetti() {
  const g = new THREE.Group(), colors = ['#ff3d6e', '#3ab7ff', '#ffd23f', '#3ddc84', '#9b5cff', '#ff8a3d'];
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 26; i++) {
    const t = r() * 2 * PI, d = 1.4 + r() * 1.2;
    const bit = mesh(new THREE.BoxGeometry(0.16, 0.08, 0.02), mat(colors[i % colors.length], { roughness: 0.6, side: THREE.DoubleSide }), Math.cos(t) * d, 0.6 + Math.sin(t) * d * 0.75, (r() - 0.5) * 1.2);
    bit.rotation.set(r() * PI, r() * PI, r() * PI);
    g.add(bit);
  }
  return g;
}

function parcel() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.1, 0.8, 0.8), mat('#c8945a', { roughness: 0.85 })));
  g.add(mesh(new THREE.BoxGeometry(0.2, 0.81, 0.81), mat('#e8d3a8', { roughness: 0.7 })));
  g.add(mesh(new THREE.BoxGeometry(1.11, 0.12, 0.81), mat('#e8d3a8', { roughness: 0.7 })));
  // ein Häkchen vorn: geliefert
  const tick = new THREE.Group(); tick.position.set(0.32, 0.12, 0.41);
  const a = mesh(new THREE.BoxGeometry(0.08, 0.2, 0.02), glow('#3ddc84', 0.5), -0.06, -0.04, 0); a.rotation.z = 0.7;
  const b = mesh(new THREE.BoxGeometry(0.08, 0.36, 0.02), glow('#3ddc84', 0.5), 0.07, 0.04, 0); b.rotation.z = -0.6;
  tick.add(a, b); g.add(tick);
  return g;
}

function magnifier() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.TorusGeometry(0.34, 0.06, 12, 32), mat('#2a2030', { metalness: 0.4, roughness: 0.35 })));
  g.add(mesh(new THREE.CircleGeometry(0.33, 28), mat('#bfe9ff', { transparent: true, opacity: 0.35, roughness: 0.05 })));
  const handle = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.6, 12), mat('#8f5c2c'), 0, -0.62, 0); g.add(handle);
  return g;
}

function ladybug() {
  const g = new THREE.Group();
  const shell = mesh(new THREE.SphereGeometry(0.26, 20, 12, 0, 2 * PI, 0, PI / 2), mat('#e3262f', { roughness: 0.35 })); g.add(shell);
  g.add(mesh(new THREE.SphereGeometry(0.12, 14, 10), mat('#16161c'), 0, 0.02, 0.24));
  for (const [x, z] of [[0.11, 0.05], [-0.11, 0.05], [0.09, -0.12], [-0.09, -0.12]]) g.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), mat('#16161c'), x, 0.2, z));
  g.add(mesh(new THREE.BoxGeometry(0.01, 0.02, 0.5), mat('#16161c'), 0, 0.26, -0.02));
  return g;
}

function mug() {
  const g = new THREE.Group(), white = mat('#f4f4f4', { roughness: 0.4 });
  g.add(mesh(new THREE.CylinderGeometry(0.24, 0.21, 0.5, 24), white));
  g.add(mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 24), mat('#5a3620'), 0, 0.23, 0));
  const ear = mesh(new THREE.TorusGeometry(0.13, 0.04, 8, 16, PI), white, 0.24, 0, 0); ear.rotation.z = -PI / 2; g.add(ear);
  for (const [x, y] of [[-0.06, 0.45], [0.06, 0.65], [-0.04, 0.85]]) g.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), mat('#ffffff', { transparent: true, opacity: 0.55 }), x, y, 0));
  return g;
}

function heart(color = '#ff3d6e') {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.15, -0.3, -0.6, -0.05, -0.6, 0.2);
  s.bezierCurveTo(-0.6, 0.45, -0.35, 0.6, -0.2, 0.55);
  s.bezierCurveTo(-0.08, 0.52, 0, 0.42, 0, 0.32);
  s.bezierCurveTo(0, 0.42, 0.08, 0.52, 0.2, 0.55);
  s.bezierCurveTo(0.35, 0.6, 0.6, 0.45, 0.6, 0.2);
  s.bezierCurveTo(0.6, -0.05, 0.15, -0.3, 0, -0.5);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 4, curveSegments: 16 });
  geo.center();
  return mesh(geo, glow(color, 0.45));
}

function gear(color = '#a3a8ae') {
  const g = new THREE.Group(), steel = mat(color, { metalness: 0.6, roughness: 0.35 });
  const ring = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.14, 28), steel); ring.rotation.x = PI / 2; g.add(ring);
  for (let i = 0; i < 8; i++) { const t = (i / 8) * 2 * PI; const tooth = mesh(new THREE.BoxGeometry(0.16, 0.16, 0.14), steel, Math.cos(t) * 0.38, Math.sin(t) * 0.38, 0); tooth.rotation.z = t; g.add(tooth); }
  const hole = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.16, 20), mat('#2a2a3a')); hole.rotation.x = PI / 2; g.add(hole);
  return g;
}

function wrench() {
  const g = new THREE.Group(), steel = mat('#a3a8ae', { metalness: 0.7, roughness: 0.3 });
  g.add(mesh(new THREE.BoxGeometry(0.12, 0.8, 0.06), steel));
  const jaw = mesh(new THREE.TorusGeometry(0.15, 0.06, 8, 16, 1.5 * PI), steel, 0, 0.5, 0); jaw.rotation.z = -0.25 * PI; g.add(jaw);
  return g;
}

// ── Bücher, Rechner, Tiere, Pixel

function book(color = '#c4122f', open = false) {
  const g = new THREE.Group(), cover = mat(color, { roughness: 0.7 }), paper = mat('#f7f1e1', { roughness: 0.9 });
  if (!open) {
    g.add(mesh(new THREE.BoxGeometry(0.9, 0.18, 0.62), cover));
    g.add(mesh(new THREE.BoxGeometry(0.84, 0.14, 0.6), paper, 0.03, 0, 0));
    return g;
  }
  // aufgeschlagen: zwei Hälften, leicht zueinander geneigt, mit Seiten und ein paar Zeilen
  for (const s of [-1, 1]) {
    const half = new THREE.Group(); half.rotation.z = s * -0.18;
    half.add(mesh(new THREE.BoxGeometry(0.5, 0.03, 0.66), cover, s * 0.25, 0, 0));
    half.add(mesh(new THREE.BoxGeometry(0.46, 0.05, 0.62), paper, s * 0.24, 0.035, 0));
    for (let i = 0; i < 5; i++) half.add(mesh(new THREE.BoxGeometry(0.3, 0.005, 0.03), mat('#8a8a9a'), s * 0.24, 0.062, -0.2 + i * 0.1));
    g.add(half);
  }
  return g;
}

function bookStack() {
  const g = new THREE.Group(), colors = ['#3c8eea', '#c4122f', '#3ddc84', '#ffd23f'];
  colors.forEach((c, i) => { const b = book(c); b.position.y = i * 0.19; b.rotation.y = (i % 2 ? 0.12 : -0.1) * (i + 1) * 0.6; b.scale.set(1.25, 1, 1.15); g.add(b); });
  return g;
}

/** Ein Laptop, aufgeklappt: Code auf dem Bildschirm, das Weave-Zeichen auf dem Deckel. */
function laptop() {
  const g = new THREE.Group(), body = mat('#c9ccd3', { metalness: 0.5, roughness: 0.35 });
  g.add(mesh(new THREE.BoxGeometry(1.1, 0.06, 0.75), body));
  g.add(mesh(new THREE.BoxGeometry(0.95, 0.01, 0.42), mat('#2a2a3a'), 0, 0.035, 0.06));
  const lid = new THREE.Group(); lid.position.set(0, 0.03, -0.37); lid.rotation.x = -0.32; g.add(lid);
  lid.add(mesh(new THREE.BoxGeometry(1.1, 0.72, 0.04), body, 0, 0.36, 0));
  lid.add(mesh(new THREE.PlaneGeometry(1.0, 0.62), mat('#10131c', { emissive: '#10131c' }), 0, 0.37, 0.022));
  const code = ['#3ddc84', '#3ab7ff', '#ff8a3d', '#ffd23f', '#3ab7ff', '#9b5cff'];
  code.forEach((c, i) => lid.add(mesh(new THREE.PlaneGeometry(0.18 + ((i * 37) % 5) * 0.08, 0.035), glow(c, 0.8), -0.32 + ((i * 3) % 4) * 0.05 + (0.18 + ((i * 37) % 5) * 0.08) / 2 - 0.09, 0.6 - i * 0.075, 0.023)));
  // hinten: das Weave-Zeichen (zwei Fäden senkrecht, einer waagerecht)
  for (const [x, c] of [[-0.12, '#000080'], [0.12, '#008080']]) lid.add(mesh(new THREE.BoxGeometry(0.08, 0.42, 0.01), mat(c), x, 0.36, -0.025));
  lid.add(mesh(new THREE.BoxGeometry(0.42, 0.08, 0.01), mat('#c00000'), 0, 0.42, -0.03));
  return g;
}

function gamepad() {
  const g = new THREE.Group(), shell = mat('#2a2a3a', { roughness: 0.4 });
  const pad = mesh(new THREE.CapsuleGeometry(0.16, 0.45, 6, 16), shell); pad.rotation.z = PI / 2; g.add(pad);
  for (const s of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.17, 16, 12), shell, s * 0.3, -0.08, 0));
  g.add(mesh(new THREE.BoxGeometry(0.14, 0.04, 0.03), mat('#a3a8ae'), -0.22, 0.02, 0.15), mesh(new THREE.BoxGeometry(0.04, 0.14, 0.03), mat('#a3a8ae'), -0.22, 0.02, 0.15));
  [['#ff3d6e', 0.27, 0.06], ['#3ddc84', 0.2, -0.01], ['#3ab7ff', 0.34, -0.01], ['#ffd23f', 0.27, -0.08]].forEach(([c, x, y]) => g.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), glow(c, 0.4), x, y + 0.04, 0.15)));
  return g;
}

function stool(height) {
  const g = new THREE.Group(), wood = mat('#8f5c2c', { roughness: 0.7 });
  g.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 28), wood, 0, height - 0.05, 0));
  for (let i = 0; i < 3; i++) { const t = (i / 3) * 2 * PI; const leg = mesh(new THREE.CylinderGeometry(0.05, 0.06, height - 0.1, 8), wood, Math.sin(t) * 0.38, (height - 0.1) / 2, Math.cos(t) * 0.38); g.add(leg); }
  return g;
}

/** Eine sitzende Katze (Blick nach vorn). */
function cat(color = '#ff8a3d') {
  const g = new THREE.Group(), fur = mat(color, { roughness: 0.8 }), dark = mat(A.shade(color, 0.7), { roughness: 0.8 });
  const body = mesh(new THREE.SphereGeometry(0.34, 20, 16), fur, 0, 0.3, 0); body.scale.set(1, 1.15, 0.95); g.add(body);
  g.add(mesh(new THREE.SphereGeometry(0.27, 20, 16), fur, 0, 0.78, 0.06));
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.09, 0.18, 10), fur, s * 0.15, 1.0, 0.04); ear.rotation.z = -s * 0.25; g.add(ear);
    g.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), mat('#1b1b22'), s * 0.1, 0.82, 0.3));
    g.add(mesh(new THREE.SphereGeometry(0.08, 12, 10), fur, s * 0.13, 0.04, 0.24));   // Pfoten
    g.add(mesh(new THREE.BoxGeometry(0.16, 0.008, 0.008), dark, s * 0.17, 0.74, 0.3).rotateZ(s * 0.15));
  }
  g.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), mat('#ff7a9a'), 0, 0.76, 0.33));
  const tail = mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 20, PI * 1.1), dark, 0.05, 0.08, -0.05); tail.rotation.set(PI / 2, 0, -0.3); g.add(tail);
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.BoxGeometry(0.04, 0.2, 0.02), dark, -0.12 + i * 0.12, 0.42, 0.31));   // Streifen
  return g;
}

/** Ein stehender Hund, nach rechts im Bild, wedelnd. */
function dog(color = '#c8945a') {
  const g = new THREE.Group(), fur = mat(color, { roughness: 0.8 }), dark = mat(A.shade(color, 0.6), { roughness: 0.8 });
  const body = mesh(new THREE.SphereGeometry(0.36, 20, 16), fur, 0, 0.62, 0); body.scale.set(1.5, 0.95, 0.95); g.add(body);
  for (const [x, z] of [[-0.35, 0.18], [-0.35, -0.18], [0.35, 0.18], [0.35, -0.18]]) g.add(mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.45, 10), fur, x, 0.23, z));
  const head = new THREE.Group(); head.position.set(-0.62, 0.98, 0.05); g.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.27, 20, 16), fur));
  const snout = mesh(new THREE.SphereGeometry(0.15, 14, 12), mat(A.shade(color, 1.15)), -0.2, -0.07, 0.08); snout.scale.set(1.2, 0.8, 1); head.add(snout);
  head.add(mesh(new THREE.SphereGeometry(0.055, 10, 8), mat('#1b1b22'), -0.36, -0.03, 0.1));
  for (const s of [-1, 1]) {
    head.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), mat('#1b1b22'), -0.12, 0.08, s * 0.17 + 0.06));
    const ear = mesh(new THREE.SphereGeometry(0.12, 12, 10), dark, 0.05, 0.02, s * 0.25); ear.scale.set(0.6, 1.4, 0.4); ear.rotation.x = s * 0.3; head.add(ear);
  }
  const tongue = mesh(new THREE.SphereGeometry(0.06, 10, 8), mat('#ff6b8a'), -0.28, -0.2, 0.08); tongue.scale.set(1, 0.4, 1); head.add(tongue);
  const tail = mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.4, 8), dark, 0.62, 0.9, 0); tail.rotation.z = -0.6; g.add(tail);
  g.add(mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 20), mat('#c4122f'), -0.42, 0.82, 0.05).rotateY(PI / 2).rotateX(0.4));   // Halsband
  return g;
}

/** Ein kleiner runder Vogel. */
function bird(color = '#3ab7ff') {
  const g = new THREE.Group(), feather = mat(color, { roughness: 0.6 });
  const body = mesh(new THREE.SphereGeometry(0.18, 16, 12), feather); body.scale.set(1.15, 1, 1); g.add(body);
  g.add(mesh(new THREE.SphereGeometry(0.12, 14, 10), mat('#f4f4f4'), 0.02, -0.04, 0.12));
  g.add(mesh(new THREE.SphereGeometry(0.12, 14, 10), feather, 0, 0.17, 0.04));
  const beak = mesh(new THREE.ConeGeometry(0.04, 0.1, 8), mat('#ff8a3d'), 0, 0.15, 0.17); beak.rotation.x = PI / 2; g.add(beak);
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.SphereGeometry(0.022, 8, 6), mat('#1b1b22'), s * 0.06, 0.2, 0.13));
    const wing = mesh(new THREE.SphereGeometry(0.1, 12, 8), mat(A.shade(color, 0.75)), s * 0.17, 0.01, -0.02); wing.scale.set(0.35, 0.9, 1.1); wing.rotation.z = s * 0.4; g.add(wing);
  }
  const tail = mesh(new THREE.BoxGeometry(0.12, 0.02, 0.16), mat(A.shade(color, 0.75)), 0, -0.02, -0.22); tail.rotation.x = 0.4; g.add(tail);
  return g;
}

// Pixel-Bilder als Würfel (wie Weaves kleine Sprites): X = Farbe 1, o = Farbe 2, . = leer.
const PIXELS = {
  heart: ['.XX.XX.', 'XoXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
  star: ['...X...', '...X...', 'XXXXXXX', '.XXXXX.', '..XXX..', '.XX.XX.', 'X.....X'],
  alien: ['..X...X..', '...XXX...', '..XXXXX..', '.XX.X.XX.', 'XXXXXXXXX', 'X.XXXXX.X', 'X.X...X.X', '...X.X...'],
  coin: ['.XXX.', 'XooXX', 'XoXXX', 'XoXXX', '.XXX.'],
};
function pixels(name, color, second = '#ffffff', size = 0.12) {
  const g = new THREE.Group(), rows = PIXELS[name], cube = new THREE.BoxGeometry(size, size, size);
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === '.') return;
    g.add(mesh(cube, glow(c === 'o' ? second : color, 0.35), (x - (row.length - 1) / 2) * size, ((rows.length - 1) / 2 - y) * size, 0));
  }));
  return g;
}

function moon() {
  const g = new THREE.Group();
  const c = mesh(new THREE.TorusGeometry(0.3, 0.13, 12, 28, PI * 1.15), glow('#ffe9a0', 0.9)); c.rotation.z = PI * 0.55; g.add(c);
  for (const [x, y, s] of [[0.7, 0.25, 1], [-0.6, -0.15, 0.7], [0.35, -0.55, 0.8], [1.1, -0.4, 0.6]]) {
    const star = mesh(new THREE.OctahedronGeometry(0.08 * s), glow('#ffffff', 1)); star.position.set(x, y, 0); g.add(star);
  }
  return g;
}

// Sitzen: Oberschenkel waagerecht nach vorn, Unterschenkel hängen; die Hüfte so tief, dass die Füße am Boden bleiben.
const SEAT = -3.1;    // Oberkante der Sitzfläche: unter den waagerechten Oberschenkeln
function sit(rig) {
  for (const s of ['L', 'R']) { rig.bones['thigh' + s].rotation.set(-PI / 2, 0, s === 'L' ? 0.08 : -0.08); rig.bones['shin' + s].rotation.set(PI / 2, 0, 0); }
  rig.root.position.y -= 0.5;
}

/** Die Szenen. Ihre ids bleiben für immer; neue kommen hinten dazu. */
export const SCENES = [
  {
    id: 'idea', label: 'I had an idea',
    pose(rig) { arm(rig, 'R', V(0.85, 0.95, 0.2), V(0.25, 1, 0.1)); tilt(rig, -0.12, 0.08); },
    face: { mouth: 3, brows: 5 },
    props: (at) => [place(bulb(), at.head, 1.05, 1.25, 0.3, (o) => { o.scale.setScalar(0.75); o.rotation.z = -0.3; })],   // schräg über dem Kopf, frei: nichts verdeckt sie, sie steckt in nichts
  },
  {
    id: 'celebrate', label: 'We did it',
    pose(rig) { both(rig, V(1, 0.75, 0.1), V(0.55, 1, 0)); tilt(rig, -0.15); },
    face: { mouth: 2, eyes: 8, brows: 5 },
    props: (at) => [place(confetti(), at.head, 0, -0.15, 0)],
  },
  {
    id: 'shipped', label: 'Shipped',
    pose(rig) { both(rig, V(0.2, -0.55, 0.85), V(-0.15, 0.25, 1)); },
    face: { mouth: 4, brows: 25 },
    props: (at) => [place(parcel(), mid(at.handL, at.handR), 0, -0.05, 0.2)],
  },
  {
    id: 'bug', label: 'Found a bug',
    pose(rig) { arm(rig, 'R', V(0.45, -0.75, 0.5), V(0.35, -0.55, 0.75)); arm(rig, 'L', V(-0.3, -0.85, 0.3), V(0.1, -0.5, 0.8)); tilt(rig, 0.38, -0.12, -0.25); },
    face: { mouth: 15, brows: 5, eyes: 23 },
    props: (at) => [hold(magnifier(), 'handR', 0.8, 0, 0, (o) => { o.rotation.set(0, 0, -PI / 2); }), place(ladybug(), V(1.05, FEET, 0.55), 0, 0, 0, (o) => { o.rotation.y = -0.9; o.scale.setScalar(1.3); })],
  },
  {
    id: 'question', label: 'I have a question',
    pose(rig) { arm(rig, 'R', V(0.75, 0.55, 0.1), V(-0.55, 0.75, 0.1)); tilt(rig, 0, -0.18); },
    face: { mouth: 13, brows: 12 },
    props: (at) => [place(questionMark(), at.head, -1.3, 0.95, 0.2, (o) => { o.rotation.z = 0.2; })],
  },
  {
    id: 'thinking', label: 'Thinking it over',
    pose(rig) { arm(rig, 'R', V(0.35, -0.75, 0.5), V(-0.35, 0.85, 0.45)); arm(rig, 'L', V(-0.25, -0.8, 0.5), V(0.55, 0.1, 0.8)); tilt(rig, -0.1, 0.12); },
    face: { mouth: 24, brows: 10 },
    props: (at) => [place(thought(), at.head, 0.85, 0.3, 0)],
  },
  {
    id: 'hello', label: 'Hello',
    pose(rig) { arm(rig, 'R', V(1, 0.3, 0.15), V(0.3, 1, 0.1)); tilt(rig, 0, -0.1); },
    face: { mouth: 1, brows: 0 },
    props: () => [],
  },
  {
    id: 'coffee', label: 'Coffee break',
    pose(rig) { arm(rig, 'R', V(0.3, -0.85, 0.35), V(-0.2, 0.45, 1)); },
    face: { mouth: 6, brows: 0 },
    props: (at) => [place(mug(), at.handR, 0, 0.18, 0.1)],
  },
  {
    id: 'thanks', label: 'Thank you',
    pose(rig) { both(rig, V(0.3, -0.5, 0.8), V(-0.35, 0.5, 0.8)); },
    face: { mouth: 1, eyes: 8, brows: 0 },
    props: (at) => [place(heart(), mid(at.handL, at.handR), 0, -0.2, 0.5, (o) => { o.scale.setScalar(0.85); })],
  },
  {
    id: 'fixing', label: 'Fixing it',
    pose(rig) { arm(rig, 'R', V(0.6, 0.1, 0.8), V(0.1, 0.9, 0.5)); tilt(rig, 0.1); },
    face: { mouth: 25, brows: 25 },
    props: (at) => [place(wrench(), at.handR, 0, 0.35, 0.05, (o) => { o.rotation.z = -0.35; }), place(gear(), at.head, -1.35, 0.55, 0, (o) => { o.rotation.z = 0.2; }), place(gear('#ffd23f'), at.head, -1.0, 1.05, -0.1, (o) => { o.scale.setScalar(0.6); o.rotation.z = 0.5; })],
  },
  {
    id: 'coding', label: 'Coding', turn: -0.75,
    pose(rig) { sit(rig); both(rig, V(0.3, -0.75, 0.6), V(-0.1, -0.2, 1)); tilt(rig, 0.22); },
    face: { mouth: 0 },
    // Der Deckel zeigt zur Kamera: das Weave-Zeichen hinten drauf.
    props: (at) => [stool(SEAT - FEET).translateY(FEET).translateZ(-0.15), place(laptop(), at.hips, 0, -0.02, 0.62, (o) => { o.rotation.y = PI; })],
  },
  {
    id: 'late-night', label: 'Late night', turn: -0.75,
    pose(rig) { sit(rig); both(rig, V(0.3, -0.75, 0.6), V(-0.1, -0.2, 1)); tilt(rig, 0.18, 0.1); },
    face: { mouth: 30, eyes: 7, brows: 14 },
    props: (at) => [stool(SEAT - FEET).translateY(FEET).translateZ(-0.15), place(laptop(), at.hips, 0, -0.02, 0.62, (o) => { o.rotation.y = PI; }), place(moon(), at.head, 1.5, 1.35, 0.2, (o) => { o.scale.setScalar(1.5); o.rotation.y = 0.75; }), place(mug(), V(0.95, FEET + 0.25, 0.5), 0, 0, 0)],
  },
  {
    id: 'bookworm', label: 'Reading', turn: -0.65,
    pose(rig) { sit(rig); both(rig, V(0.3, -0.6, 0.75), V(-0.25, 0.55, 0.8)); tilt(rig, 0.3); },
    face: { mouth: 6, brows: 0 },
    props: (at) => [place(bookStack(), V(0, FEET + 0.09, -0.1), 0, 0, 0), place(book('#3c8eea', true), mid(at.handL, at.handR), 0, 0.1, 0.12, (o) => { o.rotation.x = -1.05; })],
  },
  {
    id: 'cozy', label: 'Cozy', turn: -0.6,
    pose(rig) { sit(rig); arm(rig, 'R', V(0.6, -0.75, 0.3), V(0.45, 0.25, 1)); arm(rig, 'L', V(-0.25, -0.7, 0.6), V(0.6, -0.2, 0.8)); tilt(rig, 0.2, -0.05); },
    face: { mouth: 1, eyes: 8, brows: 0 },
    props: (at) => [stool(SEAT - FEET).translateY(FEET).translateZ(-0.15), place(cat(), at.hips, -0.05, -0.05, 0.42, (o) => { o.scale.setScalar(0.8); }), place(mug(), at.handR, 0, 0.18, 0.1)],
  },
  {
    id: 'good-dog', label: 'Good dog',
    pose(rig) { arm(rig, 'R', V(0.55, -0.85, 0.2), V(0.45, -0.8, 0.45)); tilt(rig, 0.3, -0.15, -0.3); },
    face: { mouth: 2, brows: 0 },
    props: () => [place(dog(), V(1.5, FEET, 0.55), 0, 0, 0, (o) => { o.rotation.y = 0.25; })],
  },
  {
    id: 'bird-friend', label: 'Bird friends',
    pose(rig) { arm(rig, 'L', V(-0.9, 0.35, 0.3), V(-0.35, 0.9, 0.3)); tilt(rig, -0.1, 0.18); },
    face: { mouth: 1, brows: 5 },
    props: (at) => [place(bird('#3ab7ff'), at.handL, 0, 0.3, 0, (o) => { o.rotation.y = 0.6; o.scale.setScalar(1.7); }), place(bird('#ffd23f'), at.head, 0.05, 1.45, 0.1, (o) => { o.rotation.y = -0.4; o.scale.setScalar(1.6); })],
  },
  {
    id: 'gaming', label: 'Game night',
    pose(rig) { both(rig, V(0.25, -0.7, 0.6), V(-0.35, 0.25, 1)); tilt(rig, 0.1); },
    face: { mouth: 4, brows: 25 },
    props: (at) => [place(gamepad(), mid(at.handL, at.handR), 0, 0.05, 0.12, (o) => { o.rotation.x = -0.5; }), place(pixels('alien', '#3ddc84'), at.head, -1.45, 0.55, 0, (o) => { o.rotation.z = 0.15; }), place(pixels('heart', '#ff3d6e'), at.head, 1.35, 0.15, 0, (o) => { o.scale.setScalar(0.8); o.rotation.z = -0.15; })],
  },
  {
    id: 'level-up', label: 'Level up',
    pose(rig) { both(rig, V(1, 0.75, 0.1), V(0.55, 1, 0)); tilt(rig, -0.15); },
    face: { mouth: 2, eyes: 9, brows: 5 },
    props: (at) => [
      place(pixels('star', '#ffd23f'), at.head, 0, 1.5, 0),
      ...[[-1.6, 0.3], [1.55, 0.55], [-1.25, -0.8], [1.3, -0.55]].map(([x, y]) => place(pixels('coin', '#ffcf3a', '#fff3b0', 0.09), at.head, x, y, 0, (o) => { o.rotation.y = x * 0.2; })),
    ],
  },
];
export const sceneOf = (id) => SCENES.find((s) => s.id === id);

const mid = (a, b) => a.clone().add(b).multiplyScalar(0.5);

/** Ein weicher Schatten unter der Figur (und ihren Dingen am Boden): von der Mitte nach außen heller. */
let shadowMap = null;
function shadow() {
  if (!shadowMap) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(20,10,30,0.32)'); grad.addColorStop(0.6, 'rgba(20,10,30,0.14)'); grad.addColorStop(1, 'rgba(20,10,30,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    shadowMap = new THREE.CanvasTexture(c);
  }
  const o = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5), new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false }));
  o.rotation.x = -PI / 2; o.position.set(0.15, FEET + 0.005, 0.15); o.renderOrder = -1;
  return o;
}
function place(o, at, x, y, z, more) { o.position.copy(at).add(V(x, y, z)); if (more) more(o); return o; }
/** In der Hand (oder an einem anderen Ende des Skeletts): geht mit dem Arm mit; x läuft längs des Unterarms. */
function hold(o, end, x, y, z, more) { o.position.set(x, y, z); o.userData.hold = end; if (more) more(o); return o; }

/** Die Figur in einer Szene, mit ihren Dingen; ready, wenn sie gezeichnet werden kann. */
export function buildScene(input, id) {
  const scene = sceneOf(id);
  const a = scene ? { ...A.clean(input), ...scene.face } : input;
  const built = buildAvatar(a);
  const group = new THREE.Group(); group.add(built.group);
  const ready = built.ready.then(() => {
    const rig = built.rig;
    if (!scene || !rig) return;                         // ohne Modell kein Skelett: die Figur ohne Pose
    rig.rest();
    scene.pose(rig);
    built.group.updateMatrixWorld(true);
    const at = Object.fromEntries(Object.entries({ ...rig.ends, hips: rig.root }).map(([k, o]) => [k, built.group.worldToLocal(o.getWorldPosition(new THREE.Vector3()))]));
    for (const p of scene.props(at)) (p.userData.hold ? rig.ends[p.userData.hold] : group).add(p);
    group.add(shadow());
    group.userData.head = at.head;                      // für den nahen Ausschnitt
  });
  return { group, ready };
}

// ── Als Bild: einmal gerendert, dann gemerkt (wie snapshot in avatar3d.js)
let shot = null;
const shots = new Map();
function sceneRenderer() {
  if (shot) return shot;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x664466, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(2, 3, 5); scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  shot = { renderer, scene, camera };
  return shot;
}
let queue = Promise.resolve();
/**
 * Eine Szene als Bildadresse (PNG, size × size, durchsichtiger Hintergrund): die ganze Figur mit ihren Dingen (full),
 * oder nah, Kopf und Oberkörper mit dem, was um sie ist (close: für kleine Bilder, wo das Gesicht sonst verschwindet).
 */
export function sceneSnapshot(input, id, size = 256, frame = 'full') {
  const k = `${id}:${size}:${frame}:${A.key(input)}`;
  if (shots.has(k)) return shots.get(k);
  const p = queue.then(async () => {
    const { renderer, scene, camera } = sceneRenderer();
    renderer.setSize(size, size, false);
    const { group, ready } = buildScene(input, id);
    await ready;
    group.rotation.y = sceneOf(id)?.turn ?? -0.22;   // schräg: Sitzende von der Seite
    scene.add(group);
    const head = group.userData.head?.y ?? 0;
    if (frame === 'close') { camera.position.set(0, head - 0.25, 7); camera.lookAt(0, head - 0.3, 0); }
    else { camera.position.set(0, -0.95, 11.8); camera.lookAt(0, -1, 0); }
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(group);
    group.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); });
    return url;
  });
  queue = p.catch(() => {});
  shots.set(k, p);
  return p;
}

// ── Gruppenfoto: alle zusammen, vorn eine Reihe, dahinter (eine Stufe höher) die nächste, jede Figur in ihrer Pose
// und mit einem Lächeln. Die Reihenfolge der Figuren bestimmt, wer wo steht; dieselbe Gruppe gibt dasselbe Foto.
const PHOTO_POSES = [
  (rig) => arm(rig, 'R', V(1, 0.3, 0.15), V(0.3, 1, 0.1)),                                // winken
  (rig) => both(rig, V(0.7, -0.65, -0.15), V(-0.65, -0.25, 0.35)),                         // Hände in die Hüften
  (rig) => both(rig, V(1, 0.7, 0.1), V(0.5, 1, 0)),                                        // jubeln
  () => {},                                                                                // einfach dastehen
  (rig) => { arm(rig, 'L', V(-1, 0.3, 0.15), V(-0.3, 1, 0.1)); tilt(rig, 0, 0.12); },      // links winken
  (rig) => both(rig, V(0.3, -0.6, 0.75), V(-0.45, 0.2, 0.85)),                             // Hände vor dem Bauch
];
const SMILES = [{ mouth: 1, brows: 0 }, { mouth: 2, brows: 5 }, { mouth: 5, brows: 0 }, { mouth: 3, brows: 5 }, { mouth: 6, brows: 0 }];
export const GROUP_PHOTO_MAX = 12;

/** Ein Banner auf zwei Stangen, mit Text (der Name der Gruppe), so breit wie die Gruppe. */
function banner(text, width, color = '#3c8eea', drop = 5) {   // drop: von der Mitte bis zum Boden
  const g = new THREE.Group();
  const c = document.createElement('canvas'); c.width = 1024; c.height = 192;
  const x = c.getContext('2d');
  x.fillStyle = color; x.fillRect(0, 0, 1024, 192);
  x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(0, 12, 1024, 6); x.fillRect(0, 174, 1024, 6);
  let px = 120;
  x.font = `800 ${px}px "Segoe UI", system-ui, sans-serif`;
  while (x.measureText(text).width > 940 && px > 40) { px -= 6; x.font = `800 ${px}px "Segoe UI", system-ui, sans-serif`; }
  x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(0,0,0,.25)'; x.shadowOffsetY = 4; x.shadowBlur = 6;
  x.fillText(text, 512, 100);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const h = width * (192 / 1024);
  // leicht gewellt, wie Stoff
  const geo = new THREE.PlaneGeometry(width, h, 24, 1), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / width) * PI * 3) * 0.08);
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide })));
  const wood = mat('#8f5c2c', { roughness: 0.7 });
  for (const s of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, drop + h / 2, 10), wood, s * (width / 2 + 0.05), (h / 2 - drop) / 2, -0.02));
  return g;
}

/**
 * Ein Gruppenfoto als Bildadresse (PNG, width × height, durchsichtig): bis zu zwölf Figuren, in Reihen; mit
 * opts.banner hält die Gruppe ein Banner mit diesem Text hinter sich hoch (opts.color: seine Farbe).
 */
export function groupSnapshot(inputs, width = 512, height = 288, opts = {}) {
  const people = inputs.slice(0, GROUP_PHOTO_MAX);
  const k = `group:${width}x${height}:${opts.banner ?? ''}:${opts.color ?? ''}:${people.map((a) => A.key(a)).join('|')}`;
  if (shots.has(k)) return shots.get(k);
  const p = queue.then(async () => {
    const { renderer, scene, camera } = sceneRenderer();
    renderer.setSize(width, height, false);
    const photo = new THREE.Group();
    // Bis vier in einer Reihe, bis acht in zwei, sonst drei; vorn die meisten. Jede Reihe dahinter steht eine Stufe
    // höher und auf Lücke, damit man alle Köpfe sieht.
    const rows = people.length <= 4 ? 1 : people.length <= 8 ? 2 : 3;
    const counts = Array.from({ length: rows }, (_, r) => Math.ceil((people.length - r) / rows));
    const spots = [];
    counts.forEach((n, row) => {
      for (let j = 0; j < n; j++) spots.push({ x: (j - (n - 1) / 2) * 1.75 + (row % 2 && n === counts[0] ? 0.875 : 0), z: -row * 1.3, y: row * 1.55 });
    });
    const built = people.map((a, i) => buildAvatar({ ...A.clean(a), ...SMILES[i % SMILES.length] }));
    await Promise.all(built.map((b) => b.ready));
    built.forEach((b, i) => {
      const at = spots[i];
      if (b.rig) { b.rig.rest(); PHOTO_POSES[i % PHOTO_POSES.length](b.rig); }
      b.group.position.set(at.x, at.y, at.z);
      b.group.rotation.y = -at.x * 0.07;                 // ein wenig zur Mitte gedreht
      const s = shadow(); s.position.set(at.x, FEET + at.y + 0.005, at.z + 0.1); s.scale.setScalar(0.85);
      photo.add(b.group, s);
    });
    if (opts.banner) {
      // hinter der hinteren Reihe, über den Köpfen; so breit wie die Gruppe (mindestens für einen kurzen Namen)
      const xs = spots.map((s) => s.x), wide = Math.max(3.6, Math.max(...xs) - Math.min(...xs) + 2.2);
      const y = 2.0 + (rows - 1) * 1.55;
      const b = banner(String(opts.banner).slice(0, 40), wide, opts.color, y - FEET);
      b.position.set((Math.max(...xs) + Math.min(...xs)) / 2, y, Math.min(...spots.map((s) => s.z)) - 0.9);
      photo.add(b);
    }
    scene.add(photo);
    // Alle im Bild: ihre Umrisse, so groß wie es das Format erlaubt, ein wenig von oben (die hintere Reihe sieht man).
    const box = new THREE.Box3().setFromObject(photo), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const t = Math.tan(PI / 12), aspect = width / height;
    const d = Math.max(s.y / 2 / t, s.x / 2 / (t * aspect)) * 1.06 + s.z / 2;
    camera.aspect = aspect; camera.updateProjectionMatrix();
    camera.position.set(c.x, c.y + 1.2 + (rows - 1) * 0.5, c.z + d); camera.lookAt(c.x, c.y, c.z);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(photo);
    camera.aspect = 1; camera.updateProjectionMatrix();
    photo.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); });
    return url;
  });
  queue = p.catch(() => {});
  shots.set(k, p);
  return p;
}
