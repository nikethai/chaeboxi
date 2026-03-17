

export const index = 4;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/image-creator/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/4.D9b5i8hZ.js","_app/immutable/chunks/BrSQbglc.js","_app/immutable/chunks/Dyr1KvZn.js","_app/immutable/chunks/CH_GuIgk.js"];
export const stylesheets = ["_app/immutable/assets/4.oLWSeDtK.css"];
export const fonts = [];
