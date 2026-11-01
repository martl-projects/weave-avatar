// BAND AB! – Ragdolls für die Figuren mit Skelett (rig3d.js): für besondere Momente umfallen und wieder aufstehen.
// Verlet-Punkte an den Gelenken, Stäbe dazwischen (Rumpf steif, Kopf etwas locker, Glieder fest lang, Knie und
// Ellbogen klappen nicht ganz zusammen), Schwerkraft, Boden auf Fußhöhe mit Reibung. Gerechnet wird im Raum des
// Skeletts (die Gruppe um die Knochen); die Figur wird dabei festgehalten, damit Wippen und Drehen des Studios
// den Fall nicht stören. Aus den Punkten werden jedes Bild die Knochen gestellt.
//
//   ragdoll(rig, { push, recoverAfter })   umfallen; push: Anfangsschwung in Skelett-Maßen pro Sekunde
//   recover(rig, sec)                      wieder aufstehen (weich in die Ruhelage)
//   stepRagdolls(dt)                        jedes Bild aufrufen, nach allen anderen Animationen
import * as THREE from 'three';
import { JOINT } from './rig3d.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const DT = 1 / 120, GRAVITY = -45, DAMP = 0.992, ITER = 12, FRICTION = 0.55;

// Punkte: Name, Ort im Skelett, Radius (Boden), Masse
const POINTS = [
  ['pelvis', (r) => r.bones.hips, 0.45, 3], ['chest', (r) => r.bones.chest, 0.5, 3],
  ['neck', (r) => r.bones.head, 0.25, 1], ['head', (r) => r.ends.head, 0.95, 2.5],
  ['shoulderL', (r) => r.bones.shoulderL, 0.25, 1], ['shoulderR', (r) => r.bones.shoulderR, 0.25, 1],
  ['elbowL', (r) => r.bones.elbowL, 0.15, 0.6], ['elbowR', (r) => r.bones.elbowR, 0.15, 0.6],
  ['handL', (r) => r.ends.handL, 0.2, 0.5], ['handR', (r) => r.ends.handR, 0.2, 0.5],
  ['hipL', (r) => r.bones.thighL, 0.25, 1.2], ['hipR', (r) => r.bones.thighR, 0.25, 1.2],
  ['kneeL', (r) => r.bones.shinL, 0.18, 0.8], ['kneeR', (r) => r.bones.shinR, 0.18, 0.8],
  ['footL', (r) => r.ends.footL, 0.2, 0.8], ['footR', (r) => r.ends.footR, 0.2, 0.8],
];
// Stäbe: zwei Punkte, Steifigkeit (1 = fest); min: nur auseinanderdrücken (gegen ganz zugeklappte Gelenke)
const STICKS = [
  ['pelvis', 'chest'], ['chest', 'neck'], ['neck', 'head'], ['chest', 'shoulderL'], ['chest', 'shoulderR'], ['shoulderL', 'shoulderR'],
  ['pelvis', 'shoulderL'], ['pelvis', 'shoulderR'], ['pelvis', 'hipL'], ['pelvis', 'hipR'], ['hipL', 'hipR'],
  ['chest', 'hipL'], ['chest', 'hipR'], ['neck', 'shoulderL'], ['neck', 'shoulderR'],
  ['head', 'shoulderL', 0.25], ['head', 'shoulderR', 0.25], ['head', 'chest', 0.4],
  ['shoulderL', 'elbowL'], ['elbowL', 'handL'], ['shoulderR', 'elbowR'], ['elbowR', 'handR'],
  ['hipL', 'kneeL'], ['kneeL', 'footL'], ['hipR', 'kneeR'], ['kneeR', 'footR'],
  ['shoulderL', 'handL', 1, 0.45], ['shoulderR', 'handR', 1, 0.45], ['hipL', 'footL', 1, 0.6], ['hipR', 'footR', 1, 0.6],
  ['head', 'pelvis', 1, 0.75],
];

const active = new Set();
const tmp = V(0, 0, 0);

/** Umfallen. push: Schwung (Standard: nach hinten und etwas hoch); recoverAfter: Sekunden bis zum Aufstehen (0 = liegen bleiben). */
export function ragdoll(rig, { push = V(0, 6, -9), recoverAfter = 4 } = {}) {
  if (!rig || !rig.root.parent) return false;
  push = V(push.x || 0, push.y || 0, push.z || 0);     // auch {x, y, z} aus der Regie oder vom Server
  if (rig.ragdoll) { rig.ragdoll.recovering = null; rig.ragdoll.downFor = 0; rig.ragdoll.recoverAfter = recoverAfter; kick(rig.ragdoll, push); return true; }
  const space = rig.root.parent, hold = space.parent || space;
  space.updateMatrixWorld(true);
  const pts = {}, list = [];
  for (const [name, at, radius, mass] of POINTS) {
    const p = at(rig).getWorldPosition(V(0, 0, 0)); space.worldToLocal(p);
    const pt = { name, p, prev: p.clone(), radius, inv: 1 / mass };
    pts[name] = pt; list.push(pt);
  }
  const floor = Math.min(pts.footL.p.y - pts.footL.radius, pts.footR.p.y - pts.footR.radius);
  const sticks = STICKS.map(([a, b, stiff = 1, min = 0]) => {
    const rest = pts[a].p.distanceTo(pts[b].p);
    return { a: pts[a], b: pts[b], stiff, len: min ? rest * min : rest, min: !!min };
  });
  const state = {
    rig, space, pts, list, sticks, floor, acc: 0, downFor: 0, recoverAfter, recovering: null,
    held: { obj: hold, pos: hold.position.clone(), quat: hold.quaternion.clone() },
  };
  kick(state, push);
  rig.ragdoll = state;
  active.add(state);
  return true;
}

/** Schwung geben: der Oberkörper bekommt ihn ganz, die Füße kaum (so kippt die Figur, statt zu fliegen). */
function kick(state, push) {
  const top = state.pts.head.p.y, bottom = state.floor;
  for (const pt of state.list) {
    const k = 0.15 + 0.85 * Math.min(1, Math.max(0, (pt.p.y - bottom) / (top - bottom)));
    pt.prev.copy(pt.p).addScaledVector(push, -k * DT);
  }
}

/** Wieder aufstehen: Knochen weich zurück in die Ruhelage. */
export function recover(rig, sec = 1) {
  const s = rig && rig.ragdoll; if (!s || s.recovering) return false;
  const from = new Map([...rig.restPose.keys()].map((b) => [b, b.quaternion.clone()]));
  s.recovering = { t: 0, sec, from, hips: rig.root.position.clone() };
  return true;
}

export function stepRagdolls(dt) {
  for (const s of active) {
    // Studio-Bewegungen der Figur (Wippen, Hüpfen, Drehen) während des Falls aufheben
    s.held.obj.position.copy(s.held.pos); s.held.obj.quaternion.copy(s.held.quat);
    if (s.recovering) { stepRecover(s, dt); continue; }
    s.acc = Math.min(s.acc + dt, 4 * DT);
    while (s.acc >= DT) { simulate(s); s.acc -= DT; }
    pose(s);
    s.downFor += dt;
    if (s.recoverAfter && s.downFor > s.recoverAfter) recover(s.rig);
  }
}

function simulate(s) {
  for (const pt of s.list) {
    tmp.subVectors(pt.p, pt.prev).multiplyScalar(DAMP);
    pt.prev.copy(pt.p);
    pt.p.add(tmp); pt.p.y += GRAVITY * DT * DT;
  }
  for (let it = 0; it < ITER; it++) {
    for (const st of s.sticks) {
      tmp.subVectors(st.b.p, st.a.p);
      const d = tmp.length() || 1e-6;
      if (st.min && d >= st.len) continue;
      const diff = ((d - st.len) / d) * st.stiff, w = st.a.inv + st.b.inv;
      st.a.p.addScaledVector(tmp, (diff * st.a.inv) / w);
      st.b.p.addScaledVector(tmp, (-diff * st.b.inv) / w);
    }
    for (const pt of s.list) {
      const ground = s.floor + pt.radius;
      if (pt.p.y < ground) {
        pt.p.y = ground;
        pt.prev.x = pt.p.x - (pt.p.x - pt.prev.x) * FRICTION;   // Reibung am Boden
        pt.prev.z = pt.p.z - (pt.p.z - pt.prev.z) * FRICTION;
      }
    }
  }
}

// ── Knochen aus den Punkten
const m = new THREE.Matrix4();
const ax = V(0, 0, 0), ay = V(0, 0, 0), az = V(0, 0, 0), dir = V(0, 0, 0), rest = V(0, 0, 0);
/** Lage aus „oben“ und „rechts“ (Ruhelage: y oben, x rechts). */
function basis(up, right, out) {
  ay.copy(up).normalize();
  ax.copy(right).addScaledVector(ay, -right.dot(ay)).normalize();
  az.crossVectors(ax, ay);
  return out.setFromRotationMatrix(m.makeBasis(ax, ay, az));
}
/** Welt-Drehung eines Knochens, dessen Kind von a nach b zeigen soll; parentQ: Welt-Drehung des Elternknochens. */
function aimBone(bone, child, a, b, parentQ, out) {
  rest.copy(child.position).normalize().applyQuaternion(parentQ);   // Ruhelage: Knochen ohne eigene Drehung
  dir.subVectors(b, a).normalize();
  out.setFromUnitVectors(rest, dir).multiply(parentQ);
  bone.quaternion.copy(parentQ).invert().multiply(out);
  return out;
}

const hipsQ = new THREE.Quaternion(), chestQ = new THREE.Quaternion(), upperQ = new THREE.Quaternion(), lowerQ = new THREE.Quaternion(), headQ = new THREE.Quaternion();
function pose(s) {
  const P = s.pts, B = s.rig.bones, E = s.rig.ends;
  basis(tmp.subVectors(P.chest.p, P.pelvis.p), V(0, 0, 0).subVectors(P.hipR.p, P.hipL.p), hipsQ);
  B.hips.position.copy(P.pelvis.p); B.hips.quaternion.copy(hipsQ);
  basis(tmp.subVectors(P.neck.p, P.chest.p), V(0, 0, 0).subVectors(P.shoulderR.p, P.shoulderL.p), chestQ);
  B.chest.quaternion.copy(hipsQ).invert().multiply(chestQ);
  aimBone(B.head, E.head, P.neck.p, P.head.p, chestQ, headQ);
  for (const side of ['L', 'R']) {
    aimBone(B['shoulder' + side], B['elbow' + side], P['shoulder' + side].p, P['elbow' + side].p, chestQ, upperQ);
    aimBone(B['elbow' + side], E['hand' + side], P['elbow' + side].p, P['hand' + side].p, upperQ, lowerQ);
    aimBone(B['thigh' + side], B['shin' + side], P['hip' + side].p, P['knee' + side].p, hipsQ, upperQ);
    aimBone(B['shin' + side], E['foot' + side], P['knee' + side].p, P['foot' + side].p, upperQ, lowerQ);
  }
}

function stepRecover(s, dt) {
  const r = s.recovering, rig = s.rig;
  r.t += dt;
  const k = Math.min(1, r.t / r.sec), e = k * k * (3 - 2 * k);
  for (const [bone, q] of rig.restPose) bone.quaternion.slerpQuaternions(r.from.get(bone), q, e);
  rig.root.position.lerpVectors(r.hips, JOINT.hips, e);
  if (k >= 1) { active.delete(s); rig.ragdoll = null; }
}
