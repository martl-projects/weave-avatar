// BAND AB! – Skelett für die Figuren aus figure.glb (Kandidaten und Moderator).
// Die Formen RigBody, RigShirt, Trouser und Shoe stehen in der T-Pose; hier bekommen sie Knochen und Gewichte, aus den
// Lagen der Punkte gerechnet (gemessen an art/BaseBody.blend). Ein Skelett pro Figur, die Formen teilen alle.
// Maße wie alle Figuren: Kopfmitte bei 0, Füße bei FEET (-3.775); vorn ist +z, +x ist rechts im Bild (Seite R).
//
//   hips ─ chest ─ head
//        │       ├ shoulderL ─ elbowL ─ (handL)      Arme liegen in der Ruhelage längs ±x
//        │       └ shoulderR ─ elbowR ─ (handR)
//        ├ thighL ─ shinL ─ (footL)                    Beine längs -y
//        └ thighR ─ shinR ─ (footR)
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** Gelenke in Figuren-Maßen (Ruhelage, T-Pose). */
export const JOINT = {
  hips: V(0, -2.3, 0.1), chest: V(0, -1.62, 0.1), neck: V(0, -1.15, 0.05),
  shoulder: V(0.675, -1.325, 0.125), elbowX: 1.075, wristX: 1.475, handX: 1.725,
  hip: V(0.3, -2.47, 0.1), knee: -2.97, ankle: -3.47, foot: V(0.395, -3.6, 0.385),
};
export const ARM_DOWN = THREE.MathUtils.degToRad(70);   // Ruhelage der Arme: so weit aus der Waagerechten nach unten

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Knochen-Nummern im Skelett
const B = { hips: 0, chest: 1, head: 2, shoulderL: 3, elbowL: 4, shoulderR: 5, elbowR: 6, thighL: 7, shinL: 8, thighR: 9, shinR: 10 };

/**
 * Gewichte für eine Form (einmal je Form; sie wird dabei verändert). neck: nur der Körper hat den Halsansatz,
 * der mit dem Kopf mitgehen soll.
 */
const skinned = new WeakSet();
export function skinGeometry(geo, { neck = false } = {}) {
  if (skinned.has(geo)) return geo;
  const pos = geo.attributes.position, n = pos.count;
  const index = new Uint16Array(n * 4), weight = new Float32Array(n * 4);
  const set = (i, list) => { list.forEach(([b, w], k) => { index[i * 4 + k] = b; weight[i * 4 + k] = w; }); };
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), ax = Math.abs(x), R = x > 0;
    const arm = Math.abs(y - JOINT.shoulder.y) < 0.6 ? smooth(0.575, 0.8, ax) : 0;
    if (arm > 0) {                                      // Arm: Brust → Schulter → Ellbogen
      const e = smooth(0.98, 1.17, ax);
      set(i, [[B.chest, 1 - arm], [R ? B.shoulderR : B.shoulderL, arm * (1 - e)], [R ? B.elbowR : B.elbowL, arm * e]]);
    } else if (y < -2.25) {                             // Bein: Hüfte → Oberschenkel → Unterschenkel (Schuh dazu)
      const leg = smooth(-2.25, -2.55, y), k = smooth(-2.85, -3.1, y);
      set(i, [[B.hips, 1 - leg], [R ? B.thighR : B.thighL, leg * (1 - k)], [R ? B.shinR : B.shinL, leg * k]]);
    } else {                                            // Rumpf: Hüfte → Brust (→ Kopf am Halsansatz)
      const c = smooth(-2.2, -1.75, y), h = neck && ax < 0.35 ? smooth(-1.25, -1.12, y) : 0;
      set(i, [[B.hips, 1 - c], [B.chest, c * (1 - h)], [B.head, c * h]]);
    }
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(index, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weight, 4));
  skinned.add(geo);
  return geo;
}

/**
 * Ein Skelett in der T-Pose. root (hips) gehört in dieselbe Gruppe wie die Formen; ends sind die Spitzen
 * (Hände, Füße, Kopfmitte) als Anker. rest(): Ruhelage mit hängenden Armen.
 */
export function createRig() {
  const bone = (parent, at, from) => { const b = new THREE.Bone(); b.position.copy(at).sub(from); if (parent) parent.add(b); return b; };
  const O = V(0, 0, 0);
  const hips = bone(null, JOINT.hips, O);
  const chest = bone(hips, JOINT.chest, JOINT.hips);
  const head = bone(chest, JOINT.neck, JOINT.chest);
  const sh = (s) => V(s * JOINT.shoulder.x, JOINT.shoulder.y, JOINT.shoulder.z);
  const shoulderL = bone(chest, sh(-1), JOINT.chest), shoulderR = bone(chest, sh(1), JOINT.chest);
  const elbowL = bone(shoulderL, V(-JOINT.elbowX, 0, 0), V(-JOINT.shoulder.x, 0, 0));
  const elbowR = bone(shoulderR, V(JOINT.elbowX, 0, 0), V(JOINT.shoulder.x, 0, 0));
  const hipAt = (s) => V(s * JOINT.hip.x, JOINT.hip.y, JOINT.hip.z);
  const thighL = bone(hips, hipAt(-1), JOINT.hips), thighR = bone(hips, hipAt(1), JOINT.hips);
  const shinL = bone(thighL, V(0, JOINT.knee, 0), V(0, JOINT.hip.y, 0));
  const shinR = bone(thighR, V(0, JOINT.knee, 0), V(0, JOINT.hip.y, 0));
  const anchor = (parent, at) => { const o = new THREE.Object3D(); o.position.copy(at); parent.add(o); return o; };
  const ends = {
    handL: anchor(elbowL, V(-(JOINT.handX - JOINT.elbowX), 0, 0)), handR: anchor(elbowR, V(JOINT.handX - JOINT.elbowX, 0, 0)),
    footL: anchor(shinL, V(-(JOINT.foot.x - JOINT.hip.x), JOINT.foot.y - JOINT.knee, JOINT.foot.z - JOINT.hip.z)),   // Mitte des Schuhs
    footR: anchor(shinR, V(JOINT.foot.x - JOINT.hip.x, JOINT.foot.y - JOINT.knee, JOINT.foot.z - JOINT.hip.z)),
    head: anchor(head, V(0, 0, 0).sub(JOINT.neck)),     // Kopfmitte
  };
  hips.updateMatrixWorld(true);                         // T-Pose merken, bevor das Skelett die Umkehrungen rechnet
  const bones = { hips, chest, head, shoulderL, elbowL, shoulderR, elbowR, thighL, shinL, thighR, shinR };
  const skeleton = new THREE.Skeleton(Object.keys(B).map((k) => bones[k]));
  const rig = { root: hips, bones, ends, skeleton, ragdoll: null };
  rig.restPose = new Map();
  rig.rest = () => {
    for (const b of Object.values(bones)) b.quaternion.identity();
    hips.position.copy(JOINT.hips);
    shoulderL.rotation.set(0, 0, ARM_DOWN); shoulderR.rotation.set(0, 0, -ARM_DOWN);
    for (const b of Object.values(bones)) rig.restPose.set(b, b.quaternion.clone());
  };
  rig.rest();
  return rig;
}

/** Eine Form ans Skelett binden (die Bind-Matrix ist fest: sonst rechnet three die Ruhelage aus der aktuellen Haltung neu). */
export function bindMesh(rig, geo, material) {
  const o = new THREE.SkinnedMesh(geo, material);
  o.castShadow = true; o.frustumCulled = false;         // die Hülle wird nur einmal gemessen; Arme und Ragdoll ragen hinaus
  o.userData.shared = true;
  o.bind(rig.skeleton, new THREE.Matrix4());
  return o;
}

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), tmp = new THREE.Vector3();
/** Arm (side 'L' oder 'R') so stellen, dass der Oberarm in Richtung upper und der Unterarm in Richtung fore zeigt (im Raum der Brust; weich: k je Bild). */
export function aimArm(rig, side, upper, fore, k = 1) {
  const shoulder = rig.bones['shoulder' + side], elbow = rig.bones['elbow' + side], rest = V(side === 'R' ? 1 : -1, 0, 0);
  qa.setFromUnitVectors(rest, tmp.copy(upper).normalize());
  shoulder.quaternion.slerp(qa, k);
  tmp.copy(fore).normalize().applyQuaternion(qb.copy(shoulder.quaternion).invert());
  qa.setFromUnitVectors(rest, tmp);
  elbow.quaternion.slerp(qa, k);
}
