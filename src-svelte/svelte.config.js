import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const fromRoot = (...segments) => resolve(projectRoot, ...segments);

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			fallback: 'index.html'
		}),
		alias: {
			$components: fromRoot('src/lib/components'),
			$stores: fromRoot('src/lib/stores'),
			$lib: fromRoot('src/lib'),
			$shared: fromRoot('../src/shared'),
			src: fromRoot('../src'),
			'@': fromRoot('../src/renderer'),
			'@shared': fromRoot('../src/shared')
		},
		prerender: {
			handleHttpError: 'warn',
			handleUnseenRoutes: 'ignore'
		}
	}
};

export default config;
