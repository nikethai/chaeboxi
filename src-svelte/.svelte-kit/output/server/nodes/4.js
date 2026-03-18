

export const index = 4;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/image-creator/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/4.CbkEA9yM.js","_app/immutable/chunks/gMoNbJoq.js","_app/immutable/chunks/BAH9MFau.js","_app/immutable/chunks/B4he-IIC.js"];
export const stylesheets = ["_app/immutable/assets/4.oLWSeDtK.css"];
export const fonts = [];
