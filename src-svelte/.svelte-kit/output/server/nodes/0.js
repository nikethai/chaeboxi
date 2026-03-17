

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const universal = {
  "prerender": true,
  "ssr": false
};
export const universal_id = "src/routes/+layout.ts";
export const imports = ["_app/immutable/nodes/0.D-P6_Zb_.js","_app/immutable/chunks/BrSQbglc.js","_app/immutable/chunks/Dyr1KvZn.js","_app/immutable/chunks/CJRqNfJt.js","_app/immutable/chunks/E5YIsfnJ.js","_app/immutable/chunks/BpObh_2D.js","_app/immutable/chunks/ClTlcanv.js","_app/immutable/chunks/C9BlSXQ_.js","_app/immutable/chunks/BN3vRYuL.js","_app/immutable/chunks/CuVhFhlI.js","_app/immutable/chunks/DsatsG88.js"];
export const stylesheets = ["_app/immutable/assets/0.DcqwKYns.css"];
export const fonts = [];
