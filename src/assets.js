// Die Dateien in avatar/ (figure.glb, die Sprites und ihre Namen): von dort geladen, neben den Modulen (Gameshow) –
// oder schon mitgegeben (dist/weave-avatar.js hat sie eingebaut: so geht es auch von file:// aus, wo fetch nicht
// geht und Bilder von dort jede Zeichenfläche sperren).
const given = new Map();

/** Dateien mitgeben, nach Namen: figure.glb als Bytes, *.json als Objekt, *.png als data:-Adresse. */
export function provideAssets(files) {
  for (const [name, value] of Object.entries(files)) given.set(name, value);
}

/** Eine mitgegebene Datei, oder keine. */
export const givenAsset = (name) => given.get(name);

/** Wo eine Datei liegt: mitgegeben als data:-Adresse, sonst in avatar/ neben den Modulen. */
export const assetUrl = (name) => given.get(name) ?? new URL(`./avatar/${name}`, import.meta.url).href;
