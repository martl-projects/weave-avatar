// Die Figur als Zahlen (avatar.js) für die Module, die sie als window.Avatar lesen: zuerst laden.
import Avatar from './avatar.js';

globalThis.Avatar ??= Avatar;
export default Avatar;
