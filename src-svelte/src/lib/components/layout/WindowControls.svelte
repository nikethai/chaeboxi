<script lang="ts">
	import { onMount } from 'svelte'
	import platform from '$lib/platform'

	interface Props {
		class?: string
	}

	let { class: className = '' }: Props = $props()

	let shouldShow = $state(false)
	let isMaximized = $state(false)

	onMount(() => {
		let unsubscribe: () => void = () => {}

		void (async () => {
			if (platform.type !== 'desktop') {
				return
			}

			const hostPlatform = await platform.getPlatform()
			shouldShow = hostPlatform === 'win32' || hostPlatform === 'linux'

			if (!shouldShow) {
				return
			}

			isMaximized = await platform.isMaximized()
			unsubscribe = platform.onMaximizedChange((nextValue) => {
				isMaximized = nextValue
			})
		})()

		return () => {
			unsubscribe()
		}
	})
</script>

{#if shouldShow}
	<div class={`window-controls controls ${className}`}>
		<button type="button" aria-label="Minimize" title="Minimize" onclick={() => platform.minimize()}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
				<path d="M6 12h12" />
			</svg>
		</button>
		<button
			type="button"
			aria-label={isMaximized ? 'Restore' : 'Maximize'}
			title={isMaximized ? 'Restore' : 'Maximize'}
			onclick={() => (isMaximized ? platform.unmaximize() : platform.maximize())}
		>
			{#if isMaximized}
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
					<path d="M9 9h10v10H9z" />
					<path d="M5 15V5h10" />
				</svg>
			{:else}
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
					<rect x="6" y="6" width="12" height="12" />
				</svg>
			{/if}
		</button>
		<button class="close-button" type="button" aria-label="Close" title="Close" onclick={() => platform.closeWindow()}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
				<path d="M6 6l12 12" />
				<path d="M18 6L6 18" />
			</svg>
		</button>
	</div>
{/if}

<style>
	.window-controls {
		display: inline-flex;
		align-items: stretch;
		margin-right: -0.75rem;
	}

	.window-controls button {
		width: 42px;
		height: 42px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 0;
		background: transparent;
		color: var(--chatbox-tint-secondary);
		cursor: pointer;
		transition: background 0.16s ease, color 0.16s ease;
	}

	.window-controls button:hover {
		background: var(--chatbox-background-secondary);
		color: var(--chatbox-tint-primary);
	}

	.window-controls .close-button:hover {
		background: var(--chatbox-background-error-primary);
		color: var(--chatbox-tint-white);
	}
</style>
