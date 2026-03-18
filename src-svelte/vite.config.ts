import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

const fromRoot = (...segments: string[]) => resolve(projectRoot, ...segments)

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: {
			$components: fromRoot('src/lib/components'),
			$stores: fromRoot('src/lib/stores'),
			$lib: fromRoot('src/lib'),
			$shared: fromRoot('../src/shared'),
			src: fromRoot('../src'),
			'@': fromRoot('../src/renderer'),
			'@shared': fromRoot('../src/shared')
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
})
