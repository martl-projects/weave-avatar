// Weave avatar: everything in one module (dist/weave-avatar.js): three.js and the files in avatar/ are built in, so it
// needs nothing next to it (and works from file://, where fetch doesn't).
import Avatar from './global.js';
import { provideAssets } from './assets.js';
import figure from './avatar/figure.glb';
import agent from './avatar/agent.glb';
import agentPng from './avatar/agent.png';
import eyes from './avatar/eyes.json';
import brows from './avatar/brows.json';
import mouths from './avatar/mouths.json';
import eyesLine from './avatar/eyes-line.png';
import eyesIris from './avatar/eyes-iris.png';
import browsPng from './avatar/brows.png';
import mouthsPng from './avatar/mouths.png';

provideAssets({
  'figure.glb': figure, 'agent.glb': agent, 'agent.png': agentPng,
  'eyes.json': eyes, 'brows.json': brows, 'mouths.json': mouths,
  'eyes-line.png': eyesLine, 'eyes-iris.png': eyesIris, 'brows.png': browsPng, 'mouths.png': mouthsPng,
});

export { Avatar };
export { buildAvatar, snapshot, mountViewer, FEET } from './avatar3d.js';
export { loadFaceSprites, thumb, partNames } from './face-sprites.js';
export { SCENES, sceneOf, buildScene, sceneSnapshot, groupSnapshot, GROUP_PHOTO_MAX, GROUP_PEEK_MAX, GROUP_POSES } from './scenes.js';
