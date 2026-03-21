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
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js')),
			__memo(() => import('./nodes/7.js')),
			__memo(() => import('./nodes/8.js')),
			__memo(() => import('./nodes/9.js')),
			__memo(() => import('./nodes/10.js')),
			__memo(() => import('./nodes/11.js')),
			__memo(() => import('./nodes/12.js')),
			__memo(() => import('./nodes/13.js')),
			__memo(() => import('./nodes/14.js')),
			__memo(() => import('./nodes/15.js')),
			__memo(() => import('./nodes/16.js')),
			__memo(() => import('./nodes/17.js')),
			__memo(() => import('./nodes/18.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/about",
				pattern: /^\/about\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/image-creator",
				pattern: /^\/image-creator\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/session/[id]",
				pattern: /^\/session\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/settings",
				pattern: /^\/settings\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/settings/chat",
				pattern: /^\/settings\/chat\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 9 },
				endpoint: null
			},
			{
				id: "/settings/default-models",
				pattern: /^\/settings\/default-models\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 10 },
				endpoint: null
			},
			{
				id: "/settings/document-parser",
				pattern: /^\/settings\/document-parser\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 11 },
				endpoint: null
			},
			{
				id: "/settings/general",
				pattern: /^\/settings\/general\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 12 },
				endpoint: null
			},
			{
				id: "/settings/hotkeys",
				pattern: /^\/settings\/hotkeys\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 13 },
				endpoint: null
			},
			{
				id: "/settings/knowledge-base",
				pattern: /^\/settings\/knowledge-base\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 14 },
				endpoint: null
			},
			{
				id: "/settings/mcp",
				pattern: /^\/settings\/mcp\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 15 },
				endpoint: null
			},
			{
				id: "/settings/provider",
				pattern: /^\/settings\/provider\/?$/,
				params: [],
				page: { layouts: [0,2,3,], errors: [1,,,], leaf: 16 },
				endpoint: null
			},
			{
				id: "/settings/provider/[providerId]",
				pattern: /^\/settings\/provider\/([^/]+?)\/?$/,
				params: [{"name":"providerId","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,3,], errors: [1,,,], leaf: 17 },
				endpoint: null
			},
			{
				id: "/settings/web-search",
				pattern: /^\/settings\/web-search\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 18 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
