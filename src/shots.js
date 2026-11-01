// Fertige Bilder, nach ihrem Schlüssel: die zuletzt gebrauchten bleiben, die ältesten gehen (höchstens MAX).
// Wer sie länger behält (auf der Platte, Weave), tut das selbst.
const MAX = 200;

export function shotCache() {
  const shots = new Map();
  return {
    get(k) {
      const p = shots.get(k);
      if (p) { shots.delete(k); shots.set(k, p); }    // zuletzt gebraucht: ans Ende
      return p;
    },
    set(k, p) {
      shots.set(k, p);
      while (shots.size > MAX) shots.delete(shots.keys().next().value);
    },
  };
}
