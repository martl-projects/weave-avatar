// BAND AB! – Kandidaten-Figuren (Mii-Stil): ein kleines Objekt aus Zahlen.
// Hier: welche Teile es gibt, Farben, Zufall, Prüfen – und Wangen und Bart als flache Zeichnung, die avatar3d.js
// mit Augen, Brauen und Mund (face-sprites.js) auf die Vorderseite des 3D-Kopfs legt, wie bei Miis.
// Läuft im Browser (window.Avatar) und auf dem Server (require), der damit Eingaben prüft.
(function (root) {
  'use strict';

  const SKIN = ['#ffe1c9', '#f7cba5', '#e9b28a', '#cd9267', '#a06a45', '#6e442b'];
  const HAIR = ['#2b1d16', '#5a3620', '#8f5c2c', '#d6a243', '#f2dc8f', '#b23a2c', '#a3a8ae', '#ff5fb6', '#3c8eea', '#3ddc84'];
  const EYES = ['#3b2a20', '#2f6fb3', '#3c8a4a', '#8a5f26', '#6b6b6b', '#8e4fd0'];
  const SHIRT = ['#ff3d6e', '#3ab7ff', '#ffd23f', '#3ddc84', '#9b5cff', '#ff8a3d', '#f4f4f4', '#2a2a3a', '#14b8a6', '#c4122f'];
  const PROPS = ['#ff3fd0', '#34e4ff', '#ffd23f', '#16161c', '#ffffff', '#ff8a3d'];

  // Teil → Anzahl der Varianten (Formen) bzw. Farben
  const PARTS = {
    face: 4, skin: SKIN.length, blush: 2,
    hair: 17, hairColor: HAIR.length,               // 0 Glatze, 1–16 die Frisuren aus figure.glb
    eyes: 32, eyeColor: EYES.length, brows: 32,   // Augen, Brauen, Münder: Sprites (face-sprites.js)
    nose: 4, mouth: 32, beard: 4,
    glasses: 5, hat: 5, propColor: PROPS.length,
    shirt: 4, shirtColor: SHIRT.length,
  };
  const COLORS = { skin: SKIN, hairColor: HAIR, eyeColor: EYES, shirtColor: SHIRT, propColor: PROPS };

  // Feinjustierung wie bei Miis: Anzahl der Stufen; die mittlere ist die gezeichnete Lage (Standard für alte Figuren).
  // Y: höher/tiefer, Gap: Abstand der beiden Hälften, Size: Größe, Rot: Drehung (bei Paaren gespiegelt).
  const ADJUST = {
    eyeY: 13, eyeGap: 13, eyeSize: 9, eyeRot: 9,
    browY: 13, browGap: 13, browSize: 9, browRot: 9,
    mouthY: 13, mouthSize: 9, mouthRot: 9,
    noseY: 13, noseSize: 9,
  };
  const mid = (n) => (n - 1) / 2;
  /** Stufen von der Mitte aus (0 = wie gezeichnet). */
  const offset = (a, k) => a[k] - mid(ADJUST[k]);

  /** Ein vollständiges, gültiges Objekt aus beliebiger Eingabe (unbekannte Felder fallen weg). */
  function clean(a) {
    const out = {};
    const src = a && typeof a === 'object' ? a : {};
    for (const [k, n] of Object.entries(PARTS)) {
      const v = Number(src[k]);
      out[k] = Number.isInteger(v) && v >= 0 && v < n ? v : 0;
    }
    for (const [k, n] of Object.entries(ADJUST)) {
      const v = Number(src[k]);
      out[k] = Number.isInteger(v) && v >= 0 && v < n ? v : mid(n);
    }
    return out;
  }

  /** Zufallsfigur; mit Zahlenquelle (0..1) reproduzierbar. */
  function random(rnd) {
    const r = rnd || Math.random;
    const pick = (n) => Math.floor(r() * n);
    const a = {};
    for (const [k, n] of Object.entries(PARTS)) a[k] = pick(n);
    // Seltenes seltener: meist ohne Bart, Brille, Hut, mit natürlicher Haarfarbe
    if (r() < 0.7) a.beard = 0;
    if (r() < 0.65) a.glasses = 0;
    if (r() < 0.7) a.hat = 0;
    if (r() < 0.75) a.hairColor = pick(7);
    return a;
  }

  /** Dieselbe Figur für denselben Text (z. B. ein Kandidat ohne eigene Figur). */
  function fromSeed(text) {
    let h = 2166136261;
    for (const c of String(text || '?')) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
    return random(() => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; });
  }

  const key = (a) => { const c = clean(a); return [...Object.keys(PARTS), ...Object.keys(ADJUST)].map((k) => c[k]).join('.'); };

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  // ── Wangen und Bart als Zeichnung (200 × 200): so breit und hoch wie der Teil des Kopfs, auf dem sie liegen.
  // Mitte x = 100. Augen, Brauen und Mund kommen als Sprites dazu (face-sprites.js); der Mund liegt über dem Bart.
  // Der Bart folgt dem Mund (m: seine Mitte, wie face-sprites.js ihn setzt: 342 px der 512er-Textur, 7 px je Stufe)
  // und lässt ihn frei; weiche Ränder, damit er wie Haar wirkt und nicht wie eine Maske.
  function beard(type, color, m) {
    const c = shade(color, 0.9), dark = shade(color, 0.72);
    // Breit und kräftig: auf dem Kopf wirkt die Zeichnung kleiner, als sie hier aussieht; zwischen Nase und Mund.
    const stache = `<path d="M100,${m - 11} C90,${m - 20} 62,${m - 21} 50,${m - 5} C62,${m - 8} 84,${m - 1} 100,${m - 5} C116,${m - 1} 138,${m - 8} 150,${m - 5} C138,${m - 21} 110,${m - 20} 100,${m - 11}Z" fill="${dark}"/>`;
    const soft = (d) => `<g filter="url(#soft)">${d}</g>`;
    return [
      '',
      soft(stache),
      // Vollbart: von den Wangen ums Kinn, der Mund ausgespart, darüber der Schnurrbart
      soft(`<path fill-rule="evenodd" fill="${c}" d="M10,${m - 40} C14,${m + 42} 54,199 100,199 C146,199 186,${m + 42} 190,${m - 40} C178,${m - 16} 158,${m - 12} 138,${m - 15} C124,${m - 17} 112,${m - 13} 100,${m - 13} C88,${m - 13} 76,${m - 17} 62,${m - 15} C42,${m - 12} 22,${m - 16} 10,${m - 40}Z M81,${m + 2} a19,12 0 1,0 38,0 a19,12 0 1,0 -38,0Z"/>${stache}`),
      // Kinnbart: Schnurrbart, an den Mundwinkeln hinunter bis ums Kinn
      soft(`${stache}<path fill="${c}" d="M56,${m - 7} C54,${m + 36} 80,${m + 54} 100,${m + 54} C120,${m + 54} 146,${m + 36} 144,${m - 7} C137,${m - 2} 135,${m + 15} 120,${m + 18} C112,${m + 20} 106,${m + 19} 100,${m + 19} C94,${m + 19} 88,${m + 20} 80,${m + 18} C65,${m + 15} 63,${m - 2} 56,${m - 7}Z"/>`),
    ][type];
  }

  /** Wangen und Bart als SVG, ohne Hintergrund. */
  function faceSvg(input, size) {
    const a = clean(input);
    const m = (342 + offset(a, 'mouthY') * 7) / 2.56;
    const parts = [
      '<defs><filter id="soft" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="0.9"/></filter></defs>',
      a.blush ? `<ellipse cx="46" cy="104" rx="13" ry="8" fill="#ff6b8a" opacity=".4"/><ellipse cx="154" cy="104" rx="13" ry="8" fill="#ff6b8a" opacity=".4"/>` : '',
      beard(a.beard, HAIR[a.hairColor], m),
    ];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size || 512}" height="${size || 512}">${parts.join('')}</svg>`;
  }

  const Avatar = { PARTS, ADJUST, COLORS, offset, clean, random, fromSeed, key, shade, faceSvg };
  if (typeof module !== 'undefined' && module.exports) module.exports = Avatar;
  else root.Avatar = Avatar;
})(typeof window !== 'undefined' ? window : globalThis);
