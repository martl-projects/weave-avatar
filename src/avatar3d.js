// BAND AB! – Kandidaten-Figuren in 3D (Mii-Stil), aus einem Avatar-Objekt (siehe avatar.js).
// Kopf, Ohren, Nase, Haare, Hüte, Brillen und ein kleiner Körper sind echte 3D-Körper; Augen, Brauen und
// Mund (Sprites, face-sprites.js), Wangen und Bart liegen als Textur auf der Vorderseite des Kopfs.
// Maße: Kopfmitte bei y = 0, Kopfradius etwa 1, Füße bei y ≈ -3.3.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadFaceSprites, drawFace } from './face-sprites.js';
import { createRig, skinGeometry, bindMesh } from './rig3d.js';
import { assetUrl, givenAsset } from './assets.js';
import { shotCache } from './shots.js';

const A = window.Avatar;
const { PI } = Math;

// Der Teil der Kopfkugel, auf dem das Gesicht liegt (wie THREE.SphereGeometry: phi um die Hochachse, theta von oben).
const PHI0 = PI / 2 - 0.8, PHIL = 1.6, TH0 = 0.3 * PI, THL = 0.5 * PI;
export const FEET = -3.775;     // Fußsohlen (figure.glb, tools/export-figure.py)

// ── Kopfformen: verformen Punkte der Kugel (gilt auch für Haare und Gesicht, damit alles anliegt)
function deform(p, shape) {
  const len = p.length() || 1;
  switch (shape) {
    case 1: p.set(p.x * 0.88, p.y * 1.15, p.z * 0.93); break;
    case 2: {
      const r = Math.cbrt(Math.abs(p.x) ** 3 + Math.abs(p.y) ** 3 + Math.abs(p.z) ** 3) || 1;
      p.multiplyScalar(len / r).multiply(new THREE.Vector3(0.9, 0.97, 0.88));
      break;
    }
    case 3: {
      const down = Math.max(0, -p.y / len);
      const k = 1 - 0.36 * down ** 1.6;
      p.set(p.x * k, p.y * 1.06, p.z * (1 - 0.1 * down));
      break;
    }
    default: p.set(p.x, p.y * 1.05, p.z * 0.97);
  }
  return p;
}
function deformGeometry(geo, shape) {
  const pos = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); deform(v, shape); pos.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  return geo;
}
/** Ein Punkt auf dem Gesicht: u, v wie die Gesichtszeichnung (0..1), r = Abstand von der Mitte. */
function facePoint(u, v, r, shape) {
  const phi = PHI0 + u * PHIL, th = TH0 + v * THL;
  return deform(new THREE.Vector3(-r * Math.cos(phi) * Math.sin(th), r * Math.cos(th), r * Math.sin(phi) * Math.sin(th)), shape);
}

const mats = new Map();
function mat(color, extra) {
  const k = color + JSON.stringify(extra || {});
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra }));
  return mats.get(k);
}
const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; return o; };

// ── Gesicht → Textur: Augen, Brauen und Mund als Sprites, Wangen und Bart als Zeichnung (avatar.js)
export function faceTexture(a) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const screen = a.head === 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const svg = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(A.faceSvg(screen ? { ...a, blush: 0, beard: 0 } : a, 512));
  });
  const ready = Promise.all([svg, loadFaceSprites().catch(() => false)]).then(([img, sprites]) => {
    const g = c.getContext('2d');
    if (screen) { g.fillStyle = A.COLORS.screenColor[a.screenColor]; g.fillRect(0, 0, 512, 512); }
    if (sprites === false) { if (img) g.drawImage(img, 0, 0, 512, 512); }
    else drawFace(g, a, img);
    if (screen) crt(g);
    tex.needsUpdate = true;
  });
  return { tex, ready };
}

/** Wie eine alte Bildröhre: feine Zeilen, zu den Ecken dunkler. */
function crt(g) {
  g.fillStyle = 'rgba(0, 0, 0, 0.07)';
  for (let y = 0; y < 512; y += 4) g.fillRect(0, y, 512, 2);
  const v = g.createRadialGradient(256, 256, 150, 256, 256, 380);
  v.addColorStop(0, 'rgba(0, 0, 0, 0)'); v.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
  g.fillStyle = v; g.fillRect(0, 0, 512, 512);
}

// ── Oberteil als Textur um den Rumpf (Vorderseite in der Mitte)
function shirtTexture(style, color, skin) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 512, 256);
  const dark = A.shade(color, 0.72);
  if (style === 1) { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(206, 0); g.lineTo(256, 46); g.lineTo(306, 0); g.lineTo(290, 0); g.lineTo(256, 28); g.lineTo(222, 0); g.fill(); g.fillStyle = dark; for (const y of [70, 120, 170]) { g.beginPath(); g.arc(256, y, 6, 0, 7); g.fill(); } }
  else if (style === 2) { g.fillStyle = dark; g.fillRect(0, 0, 512, 256); g.fillStyle = '#f4f4f4'; g.beginPath(); g.moveTo(206, 0); g.lineTo(256, 160); g.lineTo(306, 0); g.fill(); g.fillStyle = skin; g.beginPath(); g.moveTo(232, 0); g.lineTo(256, 40); g.lineTo(280, 0); g.fill(); g.strokeStyle = A.shade(color, 0.5); g.lineWidth = 6; g.beginPath(); g.moveTo(200, 0); g.lineTo(256, 170); g.lineTo(312, 0); g.stroke(); }
  else if (style === 3) { g.fillStyle = 'rgba(255,255,255,.85)'; for (const y of [60, 120, 180, 240]) g.fillRect(0, y, 512, 22); }
  if (style !== 2) { g.strokeStyle = dark; g.lineWidth = 10; g.beginPath(); g.arc(256, -20, 52, 0.15 * PI, 0.85 * PI); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function hair(a, hm, shape) {
  const g = new THREE.Group();
  const cap = (r, len, tilt, zRot = 0) => {
    const geo = new THREE.SphereGeometry(r, 48, 20, 0, 2 * PI, 0, len);
    geo.rotateX(tilt); if (zRot) geo.rotateZ(zRot);
    return mesh(deformGeometry(geo, shape), hm);
  };
  const sides = (r, t0, t1, gap) => {
    const geo = new THREE.SphereGeometry(r, 48, 20, PI / 2 + gap, 2 * PI - 2 * gap, t0, t1 - t0);
    const m = mesh(deformGeometry(geo, shape), hm); m.material = mat(hm.color.getStyle(), { side: THREE.DoubleSide }); return m;
  };
  const along = (geo, dir, dist) => { const m = mesh(geo, hm); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); m.position.copy(deform(dir.clone().multiplyScalar(dist), shape)); return m; };
  switch (a.hair) {
    case 1: g.add(cap(1.06, 0.42 * PI, -0.38)); break;
    case 2: {
      g.add(cap(1.05, 0.4 * PI, -0.4));
      for (let i = 0; i < 11; i++) {
        const th = i === 0 ? 0 : 0.42 + (i % 2) * 0.3, ph = i * 2.4;
        const dir = new THREE.Vector3(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)).normalize();
        if (dir.z > 0.35 && dir.y < 0.75) dir.z *= 0.2;
        g.add(along(new THREE.ConeGeometry(0.17, 0.5, 10), dir.normalize(), 1.12));
      }
      break;
    }
    case 3: {
      g.add(cap(1.06, 0.43 * PI, -0.36, 0.22));
      const swoop = mesh(new THREE.SphereGeometry(0.46, 24, 16), hm, -0.36, 0.66, 0.62); swoop.scale.set(1.35, 0.5, 0.75); swoop.rotation.z = 0.35; g.add(swoop);
      break;
    }
    case 4: g.add(cap(1.07, 0.42 * PI, -0.32), sides(1.1, 0.25 * PI, 0.68 * PI, 0.78)); break;
    case 5: {
      g.add(cap(1.07, 0.42 * PI, -0.35), sides(1.1, 0.25 * PI, 0.74 * PI, 0.82));
      const back = mesh(new THREE.CylinderGeometry(1.02, 0.86, 1.5, 32, 1, true, PI / 2 - 0.35, PI + 0.7), mat(hm.color.getStyle(), { side: THREE.DoubleSide }), 0, -0.8, -0.06);
      g.add(back);
      break;
    }
    case 6: {
      g.add(cap(1.06, 0.42 * PI, -0.38));
      g.add(mesh(new THREE.SphereGeometry(0.13, 12, 10), mat('#ff3fd0'), 0, 0.42, -1.02));
      const tail = mesh(new THREE.SphereGeometry(0.32, 20, 16), hm, 0, -0.18, -1.2); tail.scale.set(0.9, 1.9, 0.9); tail.rotation.x = 0.35; g.add(tail);
      break;
    }
    case 7: {
      g.add(cap(1.08, 0.45 * PI, -0.38));
      const n = 70;
      for (let i = 0; i < n; i++) {
        const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), ph = i * 2.39996;
        const dir = new THREE.Vector3(r * Math.sin(ph), y, r * Math.cos(ph));
        if (dir.y < -0.15 || (dir.z > 0.5 && dir.y < 0.55)) continue;
        const puff = mesh(new THREE.SphereGeometry(0.42, 14, 10), hm); puff.position.copy(deform(dir.multiplyScalar(1.15), shape)); g.add(puff);
      }
      break;
    }
    case 8: g.add(cap(1.06, 0.42 * PI, -0.3), mesh(new THREE.SphereGeometry(0.36, 20, 16), hm, 0, 1.14, -0.24)); break;
    case 9:
      for (let i = 0; i < 9; i++) {
        const t = -0.5 + i * 0.3;
        g.add(along(new THREE.BoxGeometry(0.15, 0.5 - Math.abs(i - 3) * 0.03, 0.24), new THREE.Vector3(0, Math.cos(t), -Math.sin(t)), 1.12));
      }
      break;
  }
  return g;
}

function glasses(a, shape) {
  const g = new THREE.Group();
  if (!a.glasses) return g;
  const frame = mat('#2a2030', { roughness: 0.35, metalness: 0.3 });
  const prop = A.COLORS.propColor[a.propColor];
  const eyes = [0.35, 0.65].map((u) => facePoint(u, 0.36, 1, shape));
  const z = Math.max(eyes[0].z, eyes[1].z) + 0.1;
  for (const e of eyes) {
    let lens;
    if (a.glasses === 1) lens = mesh(new THREE.TorusGeometry(0.21, 0.035, 8, 28), frame);
    else if (a.glasses === 2) { lens = mesh(new THREE.TorusGeometry(0.27, 0.035, 6, 4), frame); lens.rotation.z = PI / 4; lens.scale.set(1.15, 0.85, 1); }
    else if (a.glasses === 3) { lens = mesh(new THREE.CircleGeometry(0.24, 28), mat('#141018', { roughness: 0.15, metalness: 0.6 })); lens.scale.set(1.15, 0.8, 1); }
    else {
      const s = new THREE.Shape();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.12 : 0.28, t = PI / 2 + (i * PI) / 5; s[i ? 'lineTo' : 'moveTo'](r * Math.cos(t), r * Math.sin(t)); }
      lens = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }), mat(prop, { roughness: 0.3 }));
    }
    lens.position.set(e.x, e.y, z);
    g.add(lens);
    const arm = mesh(new THREE.BoxGeometry(0.035, 0.035, z), frame, Math.sign(e.x) * (Math.abs(e.x) + 0.24), e.y + 0.03, z / 2);
    g.add(arm);
  }
  g.add(mesh(new THREE.BoxGeometry(Math.abs(eyes[1].x - eyes[0].x) - 0.4, 0.035, 0.035), frame, 0, eyes[0].y + 0.04, z));
  return g;
}

function hat(a) {
  const g = new THREE.Group();
  const prop = A.COLORS.propColor[a.propColor];
  const pm = mat(prop, { roughness: 0.5 }), dark = mat(A.shade(prop, 0.75), { roughness: 0.5 });
  switch (a.hat) {
    case 1: {
      const crown = mesh(new THREE.SphereGeometry(1.12, 40, 16, 0, 2 * PI, 0, 0.46 * PI), pm); crown.rotation.x = -0.2; g.add(crown);
      const brim = mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.05, 32, 1, false, -PI / 2, PI), mat(A.shade(prop, 0.75), { roughness: 0.5, side: THREE.DoubleSide }), 0, 0.46, 0.62);
      brim.scale.z = 1.25; brim.rotation.x = 0.12; g.add(brim);
      g.add(mesh(new THREE.SphereGeometry(0.08, 10, 8), dark, 0, 1.12, -0.18));
      break;
    }
    case 2: { const band = mesh(new THREE.TorusGeometry(1.08, 0.09, 12, 48), pm, 0, 0.4, -0.02); band.rotation.x = PI / 2 - 0.3; g.add(band); break; }
    case 3: {
      const black = mat('#16161c', { roughness: 0.35 });
      const top = new THREE.Group(); top.position.set(0, 0.9, -0.05); top.rotation.x = -0.12;
      top.add(mesh(new THREE.CylinderGeometry(0.6, 0.62, 1.0, 32), black, 0, 0.5, 0), mesh(new THREE.CylinderGeometry(1.02, 1.02, 0.06, 40), black), mesh(new THREE.CylinderGeometry(0.63, 0.64, 0.18, 32), pm, 0, 0.12, 0));
      g.add(top);
      break;
    }
    case 4: {
      const gold = mat('#ffcf3a', { roughness: 0.25, metalness: 0.7, side: THREE.DoubleSide });
      const crown = new THREE.Group(); crown.position.set(0, 0.92, -0.08); crown.rotation.x = -0.15;
      crown.add(mesh(new THREE.CylinderGeometry(0.6, 0.66, 0.32, 28, 1, true), gold));
      for (let i = 0; i < 6; i++) { const t = (i / 6) * 2 * PI; crown.add(mesh(new THREE.ConeGeometry(0.1, 0.3, 10), gold, Math.sin(t) * 0.6, 0.3, Math.cos(t) * 0.6)); }
      crown.add(mesh(new THREE.SphereGeometry(0.08, 12, 10), mat(prop, { roughness: 0.2, metalness: 0.2 }), 0, 0, 0.64));
      g.add(crown);
      break;
    }
  }
  return g;
}

/** Die ganze Figur. ready: wenn das Gesicht gezeichnet ist. opts.bodyless: nur der Kopf. */
export function buildAvatar(input, opts = {}) {
  const a = A.clean(input);
  const shape = a.face;
  const skinHex = A.COLORS.skin[a.skin], hairHex = A.COLORS.hairColor[a.hairColor];
  const skin = mat(skinHex, { roughness: 0.55 }), hm = mat(hairHex, { roughness: 0.7 });
  const group = new THREE.Group();
  const head = new THREE.Group(); group.add(head);
  const face = faceTexture(a);

  // Nase, Brille, Frisur und Hut sind für die Kugel mit Radius 1 gebaut; fitFace und fitHair passen sie dem Modellkopf an.
  const fitFace = new THREE.Group(), fitHair = new THREE.Group(); head.add(fitFace, fitHair);
  // Feinjustierung wie die Gesichtsteile (face-sprites.js): eine Stufe = 7 px der 512er-Textur, 12 % Größe
  const nosePos = facePoint(0.5, 0.52 + (A.offset(a, 'noseY') * 7) / 512, 1, shape);
  const noseMat = mat(A.shade(skinHex, 0.94), { roughness: 0.55 });
  const nose = [
    () => mesh(new THREE.SphereGeometry(0.085, 14, 10), noseMat),
    () => { const n = mesh(new THREE.SphereGeometry(0.1, 14, 10), noseMat); n.scale.set(0.8, 1.35, 1); return n; },
    () => { const n = mesh(new THREE.SphereGeometry(0.16, 16, 12), noseMat); n.scale.set(1.1, 0.85, 0.8); return n; },
    () => { const n = mesh(new THREE.ConeGeometry(0.09, 0.32, 12), noseMat); n.rotation.x = PI / 2 + 0.25; return n; },
  ][a.nose]();
  nose.position.copy(nosePos).add(new THREE.Vector3(0, 0, a.nose === 3 ? 0.12 : 0.02));
  nose.scale.multiplyScalar(1.12 ** A.offset(a, 'noseSize'));
  const specs = glasses(a, shape); head.userData.glasses = specs;   // der Moderator färbt seine um
  const screen = a.head === 1;                         // ein Bildschirm statt Gesicht: keine Nase, Brille, Frisur, Hut
  if (!screen) { fitFace.add(nose, specs); fitHair.add(hat(a)); }

  // Körper mit Skelett (rig3d.js): Kopf und Hals hängen an den Knochen, damit sie mitgehen (Ragdoll)
  let body = null, rig = null;
  const neck = mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.4, 16), skin);   // Hals, steckt im Kopf
  if (!opts.bodyless) {
    body = new THREE.Group(); group.add(body);
    rig = createRig(); body.add(rig.root);
    rig.bones.chest.add(neck); neck.position.set(0, -1.1, 0).sub(new THREE.Vector3(0, -1.62, 0.1));
    group.userData.rig = rig;
  }
  // Das Modell aus figure.glb; lädt es nicht, Kugelkopf und Körper aus Grundkörpern
  const built = loadFigure().then(
    (parts) => {
      if (screen) screenHead(head, a, face.tex);
      else modelHead(head, [fitFace, fitHair], parts, shape, skin, face.tex);
      if (a.hair && !screen) {
        const name = `Hair${String(a.hair).padStart(2, '0')}`;
        head.add(shared(shapedPart(parts, name, shape), hm));
        fitHair.scale.multiply(hairBulk(parts, name));   // Hüte sitzen auf der Frisur, nicht in ihr
      }
      if (body) {
        rig.bones.head.add(head); head.position.copy(rig.ends.head.position);   // Kopfmitte bleibt, wo sie war
        modelBody(body, parts, a, skinHex, skin, rig);
      }
    },
    () => {
      if (screen) screenHead(head, a, face.tex);
      else sphereHead(head, shape, skin, face.tex);
      if (!screen) fitHair.add(hair({ ...a, hair: a.hair ? ((a.hair - 1) % 9) + 1 : 0 }, hm, shape));   // die gebauten Frisuren 1–9
      if (body) {                                       // ohne Modell kein Skelett
        body.remove(rig.root); group.userData.rig = rig = null;
        group.add(neck); neck.position.set(0, -1.1, 0);
        primitiveBody(body, a, skinHex, skin);
      }
    },
  );
  return { group, head, get rig() { return rig; }, ready: Promise.all([face.ready, built]) };
}

const faceMaterial = (map) => new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const shared = (geo, m) => { const o = mesh(geo, m); o.userData.shared = true; return o; };   // geteilte Form: nicht wegwerfen

// ── Figur aus avatar/figure.glb (tools/export-figure.py aus art/BaseBody.blend), schon in Figuren-Maßen:
// Head (mit Ohren) und Face (Schicht für die Gesichtstextur), RigBody (Arme, Beine), RigShirt, Trouser, Shoe (T-Pose, Skelett: rig3d.js),
// Hair01 … Hair16 (die Frisuren, schon auf dem Kopf; Frisur 0 ist eine Glatze).
// Einmal geladen; alle Figuren teilen die Formen.
let figureParts = null;
export function loadFigure() {
  const bytes = givenAsset('figure.glb');
  const loader = new GLTFLoader();
  figureParts ??= (bytes ? loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '') : loader.loadAsync(assetUrl('figure.glb'))).then((gltf) => {
    const parts = {};
    gltf.scene.traverse((o) => { if (o.isMesh) parts[o.name] = o.geometry; });
    if (!['Head', 'Face', 'RigBody', 'RigShirt', 'Trouser', 'Shoe'].every((k) => parts[k])) throw new Error('figure.glb: Teile fehlen');
    return parts;
  });
  return figureParts;
}

// Der Modellkopf gegenüber der Kugel mit Kopfform 0 (1 × 1.05 × 0.97): Breite, Höhe, Tiefe des Gesichts (Nase, Brille);
// Frisur und Hut 6 % weiter, denn oben und hinten ist der Kopf eckiger als die Kugel (sonst schaut er durchs Haar).
const MODEL_FIT = new THREE.Vector3(0.9, 1.03, 0.97);
const HAIR_FIT = MODEL_FIT.clone().multiplyScalar(1.06);
const KUGEL0 = new THREE.Vector3(1, 1.05, 0.97);
// Kopf, Gesichtsschicht und Frisuren je Kopfform: wie bei der Kugel verformt, Form 0 ist das Modell wie gezeichnet.
const modelShapes = new Map();
function shapedPart(parts, name, shape) {
  const k = `${name}/${shape}`;
  if (!modelShapes.has(k)) {
    const geo = parts[name].clone(), pos = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).divide(KUGEL0); deform(v, shape); pos.setXYZ(i, v.x, v.y, v.z); }
    geo.computeVertexNormals();
    modelShapes.set(k, geo);
  }
  return modelShapes.get(k);
}

// Wie weit eine Frisur über die erste (die knappste) hinausreicht: rundherum in Höhe des Stirnbands (75 %-Wert,
// damit Zöpfe und Stacheln nicht zählen) und oben in der Mitte. Damit werden Hüte größer bzw. höher gesetzt;
// 4 % Luft für alle, damit auch die knappste nicht durch eine Mütze schaut.
const bulks = new Map();
function hairBulk(parts, name) {
  if (!bulks.has(name)) {
    const measure = (geo) => {
      const pos = geo.attributes.position, round = [];
      let top = 0;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (y > 0.4 && y < 0.8) round.push(Math.hypot(x, z));
        if (Math.abs(x) < 0.4 && Math.abs(z) < 0.4) top = Math.max(top, y);
      }
      round.sort((p, q) => p - q);
      return { round: round[Math.floor(round.length * 0.75)] || 1, top: top || 1 };
    };
    const ref = measure(parts.Hair01), m = measure(parts[name]);
    const k = (v) => 1.04 * Math.min(1.4, Math.max(1, v));
    bulks.set(name, new THREE.Vector3(k(m.round / ref.round), k(m.top / ref.top), k(m.round / ref.round)));
  }
  return bulks.get(name);
}

function modelHead(head, [fitFace, fitHair], parts, shape, skin, tex) {
  tex.flipY = false; tex.needsUpdate = true;          // glTF-UVs: v = 0 ist oben
  head.add(shared(shapedPart(parts, 'Head', shape), skin));
  const face = shared(shapedPart(parts, 'Face', shape), faceMaterial(tex)); face.castShadow = false; head.add(face);
  head.userData.face = face;                           // zum Tauschen der Gesichtstextur (Moderator: sprechen, blinzeln)
  fitFace.scale.copy(MODEL_FIT); fitHair.scale.copy(HAIR_FIT);
}

function modelBody(g, parts, a, skinHex, skin, rig) {
  const map = shirtTexture(a.shirt, A.COLORS.shirtColor[a.shirtColor], skinHex);
  map.flipY = false;                                   // glTF-UVs: v = 0 ist oben (Kragen)
  g.add(
    bindMesh(rig, skinGeometry(parts.RigBody, { neck: true }), skin),
    bindMesh(rig, skinGeometry(parts.RigShirt), new THREE.MeshStandardMaterial({ map, roughness: 0.65 })),
    bindMesh(rig, skinGeometry(parts.Trouser), mat('#2b2b3d')),
    bindMesh(rig, skinGeometry(parts.Shoe), mat('#16161c', { roughness: 0.4 })),
  );
}

/**
 * Ein Bildschirm als Kopf (Agenten, Sessions): 0 ein Monitor, 1 ein Röhrenfernseher mit Antennen, 2 ein Tablet; das
 * Gesicht leuchtet auf dem Bildschirm (die Sprites der Menschen, auf seiner Farbe).
 */
function screenHead(head, a, tex) {
  const frame = mat(A.COLORS.frameColor[a.frameColor], { roughness: 0.4, metalness: 0.15 });
  const dark = mat(A.shade(A.COLORS.frameColor[a.frameColor], 0.7), { roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.25 });
  const [w, h, d, sw, sh] = [[2.3, 1.95, 0.55, 1.95, 1.6], [2.2, 2.0, 1.25, 1.7, 1.5], [1.75, 2.25, 0.16, 1.55, 2.0]][a.screen];
  const box = mesh(new THREE.BoxGeometry(w, h, d), frame, 0, 0.1, -d / 2 + 0.3);
  head.add(box);
  // Gewölbt wie eine Bildröhre (der Fernseher am meisten): die Mitte kommt nach vorn.
  const curve = [0.12, 0.22, 0.04][a.screen];
  const geo = new THREE.PlaneGeometry(sw, sh, 24, 24), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) / (sw / 2), y = pos.getY(i) / (sh / 2); pos.setZ(i, curve * (1 - (x * x + y * y) / 2)); }
  geo.computeVertexNormals();
  const glassMesh = new THREE.Mesh(geo, glass); glassMesh.position.set(0, 0.1, 0.3); head.add(glassMesh);
  head.userData.face = glassMesh;
  if (a.screen === 0) head.add(mesh(new THREE.BoxGeometry(w * 0.3, 0.09, 0.1), dark, 0, -h / 2 + 0.03, 0.31));                 // Leiste unten
  if (a.screen === 1) {                                                                                                       // Antennen
    for (const s of [-1, 1]) { const ant = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8), dark, s * 0.35, h / 2 + 0.45, -0.3); ant.rotation.z = -s * 0.5; head.add(ant); head.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), frame, s * 0.57, h / 2 + 0.85, -0.3)); }
    head.add(mesh(new THREE.SphereGeometry(0.08, 10, 8), dark, w / 2 - 0.25, -h / 2 + 0.3, 0.33));                           // ein Knopf
  }
  if (a.screen === 2) head.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), dark, 0, h / 2 - 0.08, 0.1));                     // Kamera
}

/** Der Kugelkopf (falls figure.glb nicht lädt). */
function sphereHead(head, shape, skin, tex) {
  head.add(mesh(deformGeometry(new THREE.SphereGeometry(1, 64, 40), shape), skin));
  const faceGeo = deformGeometry(new THREE.SphereGeometry(1.006, 48, 32, PHI0, PHIL, TH0, THL), shape);
  const face = new THREE.Mesh(faceGeo, faceMaterial(tex)); head.add(face);
  head.userData.face = face;
  for (const s of [-1, 1]) {
    const at = deform(new THREE.Vector3(s, -0.05, 0), shape);
    const ear = mesh(new THREE.SphereGeometry(0.22, 16, 12), skin, at.x + s * 0.04, at.y, at.z - 0.02); ear.scale.set(0.55, 1, 0.8); head.add(ear);
  }
}

/** Der Körper aus Grundkörpern (falls figure.glb nicht lädt). */
function primitiveBody(g, a, skinHex, skin) {
  const shirt = A.COLORS.shirtColor[a.shirtColor];
  const torsoMat = new THREE.MeshStandardMaterial({ map: shirtTexture(a.shirt, shirt, skinHex), roughness: 0.65 });
  const sleeve = mat(a.shirt === 2 ? A.shade(shirt, 0.72) : shirt, { roughness: 0.65 });
  g.add(mesh(new THREE.CylinderGeometry(0.5, 0.66, 1.1, 32, 1, false, PI), torsoMat, 0, -1.8, 0));
  const shoulders = mesh(new THREE.SphereGeometry(0.5, 32, 12, 0, 2 * PI, 0, PI / 2), sleeve, 0, -1.25, 0); shoulders.scale.y = 0.35; g.add(shoulders);
  for (const s of [-1, 1]) {
    const arm = mesh(new THREE.CapsuleGeometry(0.13, 0.72, 6, 12), sleeve, s * 0.66, -1.72, 0); arm.rotation.z = s * 0.2; g.add(arm);
    g.add(mesh(new THREE.SphereGeometry(0.15, 14, 10), skin, s * 0.78, -2.25, 0.02));
    g.add(mesh(new THREE.CapsuleGeometry(0.18, 0.6, 6, 12), mat('#2b2b3d'), s * 0.24, -2.68, 0));
    const shoe = mesh(new THREE.SphereGeometry(0.2, 14, 10), mat('#16161c', { roughness: 0.4 }), s * 0.25, -3.12, 0.08); shoe.scale.set(1, 0.6, 1.4); g.add(shoe);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.66, 0.5, 0.25, 32), mat('#2b2b3d'), 0, -2.42, 0));
  // von den Schultern (-1.25) bis zu den Füßen auf FEET strecken
  const k = (FEET + 1.25) / (-3.3 + 1.25);
  g.scale.y = k; g.position.y = -1.25 * (1 - k);
}

// ── Kleine Bilder (Listen, Kopfzeile): einmal gerendert, dann gemerkt
let shot = null;
const shots = shotCache();
function snapshotRenderer() {
  if (shot) return shot;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(256, 256, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x664466, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(2, 3, 5); scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  shot = { renderer, scene, camera };
  return shot;
}
let queue = Promise.resolve();
/** Die Figur als Bildadresse: head (Kopf mit Frisur und Hut), face (nah ans Gesicht, für kleine Bilder) oder bust (bis zur Brust). */
export function snapshot(input, kind = 'head') {
  const k = kind + ':' + A.key(input);
  if (shots.get(k)) return shots.get(k);
  const p = queue.then(async () => {
    const { renderer, scene, camera } = snapshotRenderer();
    const { group, ready } = buildAvatar(input, { bodyless: kind !== 'bust' });
    await ready;
    group.rotation.y = kind === 'face' ? -0.1 : -0.18;
    scene.add(group);
    if (kind === 'bust') { camera.position.set(0, -0.3, 8.4); camera.lookAt(0, -0.55, 0); }
    else {
      // Mittig, wie der Kopf wirklich ist (Frisur, Hut, Drehung): seine Umrisse, nicht seine Mitte.
      const box = new THREE.Box3().setFromObject(group), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
      group.position.x = -c.x;
      const fit = (h, w) => (Math.max(h, w) / 2 / Math.tan(PI / 12)) * 1.08;
      // face: vom Kinn bis über die Brauen, so breit wie der Kopf; head: alles mit Frisur und Hut
      const top = kind === 'face' && A.clean(input).head !== 1 ? Math.min(box.max.y, 0.95) : box.max.y, y = (box.min.y + top) / 2;   // ein Bildschirm: ganz
      camera.position.set(0, y, c.z + fit(top - box.min.y, s.x));
      camera.lookAt(0, y, c.z);
    }
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(group);
    group.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); });
    return url;
  });
  queue = p.catch(() => {}); // ein Fehler hält die anderen nicht auf
  shots.set(k, p);
  return p;
}

/** Eine drehbare Figur in einem Element (der Editor). */
export function mountViewer(el) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x553355, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.3); sun.position.set(3, 4, 6); scene.add(sun);
  const rim = new THREE.DirectionalLight(0xff3fd0, 1.2); rim.position.set(-4, 2, -4); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  // Zoom: 0 die ganze Figur, 1 nah am Gesicht (Mausrad, oder zoom() von außen: ein Editor beim Gesicht); weich dahin.
  const far = { z: 13.5, y: -0.6, look: -0.8 }, near = { z: 5.2, y: 0.1, look: 0.05 };
  let zoom = 0, zoomTo = 0;
  const place = () => {
    const k = zoom * zoom * (3 - 2 * zoom);
    // So nah, dass der Kopf mit Frisur (gut 2,6 breit) auch in eine schmale, hohe Ansicht passt.
    const nearZ = Math.max(near.z, 1.3 / (Math.tan(PI / 12) * camera.aspect));
    camera.position.set(0, far.y + (near.y - far.y) * k, far.z + (nearZ - far.z) * k);
    camera.lookAt(0, far.look + (near.look - far.look) * k, 0);
  };
  place();
  const holder = new THREE.Group(); scene.add(holder);
  let current = null, yaw = 0, drag = null, lastInput = 0, raf = 0, hop = 0;
  const size = () => { const w = el.clientWidth || 300, h = el.clientHeight || 300; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); place(); };
  new ResizeObserver(size).observe(el); size();
  el.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, yaw }; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => { if (drag) { yaw = drag.yaw + (e.clientX - drag.x) * 0.012; lastInput = performance.now(); } });
  el.addEventListener('pointerup', () => { drag = null; });
  // Das Rad zoomt hier, statt die Seite zu scrollen.
  el.addEventListener('wheel', (e) => { e.preventDefault(); zoomTo = Math.min(1, Math.max(0, zoomTo - e.deltaY * 0.0015)); lastInput = performance.now(); }, { passive: false });
  const loop = (t) => {
    raf = requestAnimationFrame(loop);
    if (!drag && t - lastInput > 2500) yaw += (Math.sin(t / 1400) * 0.35 - yaw) * 0.03;
    if (Math.abs(zoomTo - zoom) > 0.001) { zoom += (zoomTo - zoom) * 0.15; place(); }
    holder.rotation.y = yaw;
    const h = Math.max(0, 1 - (t - hop) / 350);
    holder.position.y = Math.sin(h * PI) * 0.25;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);
  return {
    set(a, bounce) {
      const next = buildAvatar(a);
      next.ready.then(() => {
        if (current) { holder.remove(current); current.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); }); }
        current = next.group; holder.add(current);
        if (bounce) hop = performance.now();
        renderer.render(scene, camera);
      });
    },
    /** Näher heran (1: das Gesicht) oder zurück (0: die ganze Figur), weich. */
    zoom(k) { zoomTo = Math.min(1, Math.max(0, k)); },
    dispose() { cancelAnimationFrame(raf); renderer.dispose(); el.replaceChildren(); },
  };
}

window.Avatar3D = { snapshot, buildAvatar, mountViewer, FEET };
window.dispatchEvent(new Event('avatar3d'));
