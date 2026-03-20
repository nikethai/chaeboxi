

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const universal = {
  "prerender": true,
  "ssr": false
};
export const universal_id = "src/routes/+layout.ts";
export const imports = ["_app/immutable/nodes/0.C59QRite.js","_app/immutable/chunks/C1yjhRwN.js","_app/immutable/chunks/JTSF1W6W.js","_app/immutable/chunks/GKo7AilM.js","_app/immutable/chunks/CUKW1qCq.js","_app/immutable/chunks/BcYhZUhK.js","_app/immutable/chunks/IN60cMu7.js","_app/immutable/chunks/BjaBc86b.js","_app/immutable/chunks/DXlRqR5d.js","_app/immutable/chunks/BH0MGmsN.js","_app/immutable/chunks/D4PSSM7d.js","_app/immutable/chunks/DFbbK_YD.js","_app/immutable/chunks/BksodykZ.js","_app/immutable/chunks/CJDmiZnI.js","_app/immutable/chunks/B3OaPhf_.js","_app/immutable/chunks/B7-huVXX.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DUvSReXQ.js","_app/immutable/chunks/CSNOGk7R.js","_app/immutable/chunks/CTmUGrdA.js","_app/immutable/chunks/BNZDu9xx.js","_app/immutable/chunks/DyVOqOlu.js","_app/immutable/chunks/Cabo3CgD.js","_app/immutable/chunks/BKQfUoBI.js"];
export const stylesheets = ["_app/immutable/assets/0.BI5wMfYO.css"];
export const fonts = [];
