// Szenen: eine Figur in einer Pose, mit Dingen um sich herum ("ich hatte eine Idee": die Figur zeigt nach oben, über
// ihr leuchtet eine Glühbirne). Eine Szene ist nur ihr Name; wer sie zeigt, baut sie aus der Figur selbst. So bleibt sie
// klein (ein Wort an einem Beitrag) und zeigt immer die aktuelle Figur ihres Menschen.
//
// Eine Szene: id (fest, für immer), label (englisch, für Auswahllisten), pose(rig) stellt Arme und Kopf (rig3d.js),
// face: was sie am Gesicht ändert (Mund, Augen), props(at): die Dinge, in Figuren-Maßen (Kopfmitte 0, Füße bei FEET).
// at: Lagen nach der Pose: Hände (handL, handR) und Kopfmitte (head), schon in Figuren-Maßen.
import * as THREE from 'three';
import { buildAvatar } from './avatar3d.js';
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
const tilt = (rig, x, z = 0) => rig.bones.head.rotation.set(x, 0, z);

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

function wrench() {
  const g = new THREE.Group(), steel = mat('#a3a8ae', { metalness: 0.7, roughness: 0.3 });
  g.add(mesh(new THREE.BoxGeometry(0.12, 0.8, 0.06), steel));
  const jaw = mesh(new THREE.TorusGeometry(0.15, 0.06, 8, 16, 1.5 * PI), steel, 0, 0.5, 0); jaw.rotation.z = -0.25 * PI; g.add(jaw);
  return g;
}

/** Die Szenen. Ihre ids bleiben für immer; neue kommen hinten dazu. */
export const SCENES = [
  {
    id: 'idea', label: 'I had an idea',
    pose(rig) { arm(rig, 'R', V(0.45, 1, 0.15), V(0.05, 1, 0.1)); tilt(rig, -0.12); },
    face: { mouth: 3 },
    props: (at) => [place(bulb(), at.head, 0.15, 2.05, 0.1)],
  },
  {
    id: 'celebrate', label: 'We did it',
    pose(rig) { both(rig, V(0.75, 0.85, 0.1), V(0.35, 1, 0.1)); tilt(rig, -0.15); },
    face: { mouth: 2, eyes: 8 },
    props: (at) => [place(confetti(), at.head, 0, 0, 0)],
  },
  {
    id: 'shipped', label: 'Shipped',
    pose(rig) { both(rig, V(0.2, -0.55, 0.85), V(-0.15, 0.25, 1)); },
    face: { mouth: 4 },
    props: (at) => [place(parcel(), mid(at.handL, at.handR), 0, 0.3, 0.15)],
  },
  {
    id: 'bug', label: 'Found a bug',
    pose(rig) { arm(rig, 'R', V(0.4, -0.4, 0.85), V(-0.1, 0.5, 1)); tilt(rig, 0.25, 0.08); },
    face: { mouth: 15 },
    props: (at) => [place(magnifier(), at.handR, 0, 0.55, 0.1), place(ladybug(), at.head, -1.55, -2.1, 0.9, (o) => { o.rotation.set(0.5, 0.6, 0); })],
  },
  {
    id: 'question', label: 'I have a question',
    pose(rig) { arm(rig, 'R', V(0.75, 0.55, 0.1), V(-0.55, 0.75, 0.1)); tilt(rig, 0, -0.18); },
    face: { mouth: 13 },
    props: (at) => [place(questionMark(), at.head, -1.25, 1.25, 0.2, (o) => { o.rotation.z = 0.2; })],
  },
  {
    id: 'thinking', label: 'Thinking it over',
    pose(rig) { arm(rig, 'R', V(0.35, -0.75, 0.5), V(-0.35, 0.85, 0.45)); arm(rig, 'L', V(-0.25, -0.8, 0.5), V(0.55, 0.1, 0.8)); tilt(rig, -0.1, 0.12); },
    face: { mouth: 24 },
    props: (at) => [place(thought(), at.head, 0.95, 1.05, 0)],
  },
  {
    id: 'hello', label: 'Hello',
    pose(rig) { arm(rig, 'R', V(0.85, 0.55, 0.1), V(0.15, 1, 0.05)); tilt(rig, 0, -0.1); },
    face: { mouth: 1 },
    props: () => [],
  },
  {
    id: 'coffee', label: 'Coffee break',
    pose(rig) { arm(rig, 'R', V(0.3, -0.85, 0.35), V(-0.2, 0.45, 1)); },
    face: { mouth: 6 },
    props: (at) => [place(mug(), at.handR, 0, 0.18, 0.1)],
  },
  {
    id: 'thanks', label: 'Thank you',
    pose(rig) { both(rig, V(0.3, -0.5, 0.8), V(-0.35, 0.5, 0.8)); },
    face: { mouth: 1, eyes: 8 },
    props: (at) => [place(heart(), mid(at.handL, at.handR), 0, 0.75, 0.25)],
  },
  {
    id: 'fixing', label: 'Fixing it',
    pose(rig) { arm(rig, 'R', V(0.6, 0.1, 0.8), V(0.1, 0.9, 0.5)); tilt(rig, 0.1); },
    face: { mouth: 25 },
    props: (at) => [place(wrench(), at.handR, 0, 0.35, 0.05, (o) => { o.rotation.z = -0.35; })],
  },
];
export const sceneOf = (id) => SCENES.find((s) => s.id === id);

const mid = (a, b) => a.clone().add(b).multiplyScalar(0.5);
function place(o, at, x, y, z, more) { o.position.copy(at).add(V(x, y, z)); if (more) more(o); return o; }

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
    const at = Object.fromEntries(Object.entries(rig.ends).map(([k, o]) => [k, built.group.worldToLocal(o.getWorldPosition(new THREE.Vector3()))]));
    for (const p of scene.props(at)) group.add(p);
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
/** Eine Szene als Bildadresse (PNG, size × size, durchsichtiger Hintergrund): die ganze Figur mit ihren Dingen. */
export function sceneSnapshot(input, id, size = 256) {
  const k = `${id}:${size}:${A.key(input)}`;
  if (shots.has(k)) return shots.get(k);
  const p = queue.then(async () => {
    const { renderer, scene, camera } = sceneRenderer();
    renderer.setSize(size, size, false);
    const { group, ready } = buildScene(input, id);
    await ready;
    group.rotation.y = -0.22;
    scene.add(group);
    camera.position.set(0, -0.55, 13.2); camera.lookAt(0, -0.6, 0);
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
