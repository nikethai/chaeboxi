

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const universal = {
  "prerender": true,
  "ssr": false
};
export const universal_id = "src/routes/+layout.ts";
export const imports = ["_app/immutable/nodes/0.DpeZt3sr.js","_app/immutable/chunks/gMoNbJoq.js","_app/immutable/chunks/BAH9MFau.js","_app/immutable/chunks/BKFnkm8H.js","_app/immutable/chunks/luBUAet7.js","_app/immutable/chunks/CZAowopO.js","_app/immutable/chunks/DRgZSRp9.js","_app/immutable/chunks/COM226J_.js","_app/immutable/chunks/Bm9z-GZZ.js","_app/immutable/chunks/--EIz3bQ.js"];
export const stylesheets = ["_app/immutable/assets/0.C0sC-dqR.css"];
export const fonts = [];
