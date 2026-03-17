import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: {
			$components: './src/lib/components',
			$stores: './src/lib/stores',
			$lib: './src/lib',
			$shared: '../src/shared'
		}
	},
	define: {
		'process.env': {},
		'process.type': JSON.stringify(process.env.NODE_ENV || 'renderer')
	},
	clearScreen: false,
	server: {
		port: 5173,
		strictPort: true
	}
});
