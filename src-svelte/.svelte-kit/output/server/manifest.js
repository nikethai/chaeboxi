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
		client: {start:"_app/immutable/entry/start.067yJEhQ.js",app:"_app/immutable/entry/app.CfofuZzT.js",imports:["_app/immutable/entry/start.067yJEhQ.js","_app/immutable/chunks/CZAowopO.js","_app/immutable/chunks/BAH9MFau.js","_app/immutable/chunks/BKFnkm8H.js","_app/immutable/entry/app.CfofuZzT.js","_app/immutable/chunks/luBUAet7.js","_app/immutable/chunks/BAH9MFau.js","_app/immutable/chunks/BKFnkm8H.js","_app/immutable/chunks/COM226J_.js","_app/immutable/chunks/gMoNbJoq.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
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
