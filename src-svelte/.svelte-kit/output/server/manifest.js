export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.BAQBCldt.js",app:"_app/immutable/entry/app.U-l_m2h1.js",imports:["_app/immutable/entry/start.BAQBCldt.js","_app/immutable/chunks/C9BlSXQ_.js","_app/immutable/chunks/Dyr1KvZn.js","_app/immutable/chunks/CJRqNfJt.js","_app/immutable/entry/app.U-l_m2h1.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/Dyr1KvZn.js","_app/immutable/chunks/BN3vRYuL.js","_app/immutable/chunks/BrSQbglc.js","_app/immutable/chunks/CJRqNfJt.js","_app/immutable/chunks/E5YIsfnJ.js","_app/immutable/chunks/DyEsZ4jU.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js'))
		],
		remotes: {
			
		},
		routes: [
			
		],
		prerendered_routes: new Set(["/","/about","/image-creator","/settings","/settings/provider"]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
