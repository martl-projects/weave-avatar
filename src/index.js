// Weave avatar: everything in one module (dist/weave-avatar.js, three.js bundled in). Its files (avatar/) sit next to it.
import Avatar from './global.js';

export { Avatar };
export { buildAvatar, snapshot, mountViewer, FEET } from './avatar3d.js';
export { loadFaceSprites, thumb, partNames } from './face-sprites.js';
export { SCENES, sceneOf, buildScene, sceneSnapshot } from './scenes.js';
