import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			fallback: 'index.html'
		}),
		alias: {
			$components: './src/lib/components',
			$stores: './src/lib/stores',
			$lib: './src/lib',
			$shared: '../src/shared'
		},
		prerender: {
			handleHttpError: 'warn',
			handleUnseenRoutes: 'ignore'
		}
	}
};

export default config;
