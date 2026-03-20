export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10'),
	() => import('./nodes/11'),
	() => import('./nodes/12'),
	() => import('./nodes/13'),
	() => import('./nodes/14'),
	() => import('./nodes/15'),
	() => import('./nodes/16'),
	() => import('./nodes/17'),
	() => import('./nodes/18')
];

export const server_loads = [];

export const dictionary = {
		"/": [4],
		"/about": [5],
		"/image-creator": [6],
		"/session/[id]": [7],
		"/settings": [8,[2]],
		"/settings/chat": [9,[2]],
		"/settings/default-models": [10,[2]],
		"/settings/document-parser": [11,[2]],
		"/settings/general": [12,[2]],
		"/settings/hotkeys": [13,[2]],
		"/settings/knowledge-base": [14,[2]],
		"/settings/mcp": [15,[2]],
		"/settings/provider": [16,[2,3]],
		"/settings/provider/[providerId]": [17,[2,3]],
		"/settings/web-search": [18,[2]]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),
	
	reroute: (() => {}),
	transport: {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));
export const encoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.encode]));

export const hash = false;

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.js';