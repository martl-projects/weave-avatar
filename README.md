# Weave avatar

A Mii-style 3D figure from a few small numbers, and scenes: the figure in a pose with things around it ("I had an
idea": pointing up, a light bulb above). Weave draws everyone's avatar with it and decorates posts with scenes; the
Gameshow (BAND AB!) draws its contestants with it.

## Where it lives

The figure lives only here. A tag builds a release (`weave-avatar.tar.gz`: `weave-avatar.js` and this README); Weave
ships one release, pinned by the archive's SHA-256 in its `packages/shipped/pinned.json`. A new
version: tag it here, then move the pin there.

## What it holds

- `src/avatar.js`: the figure as numbers (`PARTS`, `ADJUST`, `COLORS`), `clean()` (anything into a valid figure),
  `random()`, `fromSeed()`, `key()`. Runs in a browser and in Node (the Gameshow's server checks figures with it).
- `src/avatar3d.js`: the 3D figure (three.js): `buildAvatar()`, `snapshot()` (a picture of the head or bust),
  `mountViewer()` (a turnable figure, for editors).
- `src/rig3d.js`: its skeleton (11 bones, hands, feet and head as anchors), `aimArm()`. `src/ragdoll3d.js`: falling.
- `src/face-sprites.js`: eyes, brows and mouths from the sprite sheets; `thumb()` for editors.
- `src/scenes.js`: the scenes (`SCENES`: id, label, pose, face, props), `buildScene()`, `sceneSnapshot()`. A scene's id
  stays forever; new ones come at the end.
- `src/assets.js`: where the files come from (built in, or `avatar/` next to the modules).
- `src/avatar/`: `figure.glb` (head, face layer, body, hair styles) and the face sprite sheets.
- `art/` and `tools/`: their sources (`BaseBody.blend`, the sheets) and the scripts that make them
  (`tools/export-figure.py` in Blender, `tools/prepare-face-sprites.py` with Pillow and NumPy).

## Build

```bash
npm install
npm run build
```

`dist/weave-avatar.js` is one ES module with three.js and the files in `src/avatar/` built in: it needs nothing next
to it, and works from `file://` too (no fetch, no images that lock a canvas). The modules in `src/` also run as they
are, next to `avatar/`, with an import map for `three` (the Gameshow).

```js
const { Avatar, snapshot, sceneSnapshot, SCENES } = await import('./weave-avatar.js');
img.src = await sceneSnapshot(Avatar.random(), 'idea');
```
