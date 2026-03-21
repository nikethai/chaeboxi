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
		client: {start:"_app/immutable/entry/start.Cmfsa1tT.js",app:"_app/immutable/entry/app.DYhroHoZ.js",imports:["_app/immutable/entry/start.Cmfsa1tT.js","_app/immutable/chunks/BAvydVI2.js","_app/immutable/chunks/JTSF1W6W.js","_app/immutable/chunks/BcYhZUhK.js","_app/immutable/chunks/GKo7AilM.js","_app/immutable/entry/app.DYhroHoZ.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/JTSF1W6W.js","_app/immutable/chunks/BH0MGmsN.js","_app/immutable/chunks/C1yjhRwN.js","_app/immutable/chunks/GKo7AilM.js","_app/immutable/chunks/CUKW1qCq.js","_app/immutable/chunks/BcYhZUhK.js","_app/immutable/chunks/DUvSReXQ.js","_app/immutable/chunks/CJDmiZnI.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js'))
		],
		remotes: {
			
		},
		routes: [
			
		],
		prerendered_routes: new Set(["/","/about","/image-creator","/settings","/settings/chat","/settings/default-models","/settings/document-parser","/settings/general","/settings/hotkeys","/settings/knowledge-base","/settings/mcp","/settings/provider","/settings/web-search"]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
