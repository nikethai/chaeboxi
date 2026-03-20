<script lang="ts">
	import { Theme, type Language } from '$shared/types'
	import SelectMenu from '$lib/components/common/SelectMenu.svelte'
	import { settingsStore } from '$lib/stores/settings.svelte'
	import { themeStore } from '$lib/stores/theme.svelte'
	import platform from '$lib/platform'

	const languageOptions: Array<{ value: Language; label: string }> = [
		{ value: 'en', label: 'English' },
		{ value: 'zh-Hans', label: 'Chinese (Simplified)' },
		{ value: 'zh-Hant', label: 'Chinese (Traditional)' },
		{ value: 'ja', label: 'Japanese' },
		{ value: 'ko', label: 'Korean' },
		{ value: 'ru', label: 'Russian' },
		{ value: 'de', label: 'German' },
		{ value: 'fr', label: 'French' },
		{ value: 'pt-PT', label: 'Portuguese' },
		{ value: 'es', label: 'Spanish' },
		{ value: 'ar', label: 'Arabic' },
		{ value: 'it-IT', label: 'Italian' },
		{ value: 'sv', label: 'Swedish' },
		{ value: 'nb-NO', label: 'Norwegian Bokmal' },
	]

	const themeOptions = [
		{ value: `${Theme.System}`, label: 'Follow system' },
		{ value: `${Theme.Light}`, label: 'Light mode' },
		{ value: `${Theme.Dark}`, label: 'Dark mode' },
	]

	const startupOptions = [
		{ value: 'home', label: 'Home page' },
		{ value: 'session', label: 'Last session' },
	]

	const fontSize = $derived(settingsStore.settings.fontSize ?? 14)
</script>

<section class="settings-page">
	<header class="page-header">
		<p class="eyebrow">General</p>
		<h1>General app behavior</h1>
		<p>Theme, language, startup, proxy, reporting, and desktop-safe toggles now live in the Svelte settings shell.</p>
	</header>

	<div class="settings-grid">
		<section class="card">
			<div class="card-header">
				<h2>Display</h2>
				<p>Keep the visual baseline aligned with the React app.</p>
			</div>

			<div class="field-grid">
				<label class="field">
					<span>Theme</span>
					<SelectMenu
						options={themeOptions}
						value={`${settingsStore.settings.theme}`}
						onChange={(value) => themeStore.setTheme(Number(value) as Theme)}
					/>
				</label>

				<label class="field">
					<span>Language</span>
					<SelectMenu
						options={languageOptions}
						value={settingsStore.settings.language}
						onChange={(value) => settingsStore.update({ language: value as Language })}
					/>
				</label>
			</div>

			<label class="field">
				<span>Font size</span>
				<div class="range-field">
					<input
						type="range"
						min="12"
						max="18"
						step="1"
						value={fontSize}
						oninput={(event) => settingsStore.update({ fontSize: Number(event.currentTarget.value) })}
					/>
					<div class="range-meta">
						<strong>{fontSize}px</strong>
						<span>Shared app scale</span>
					</div>
				</div>
			</label>

			<label class="field">
				<span>Startup page</span>
				<div class="segment-group">
					{#each startupOptions as option (option.value)}
						<button
							class:active={(settingsStore.settings.startupPage ?? 'home') === option.value}
							class="segment-btn"
							type="button"
							onclick={() => settingsStore.update({ startupPage: option.value as 'home' | 'session' })}
						>
							{option.label}
						</button>
					{/each}
				</div>
			</label>
		</section>

		<section class="card">
			<div class="card-header">
				<h2>Connectivity and privacy</h2>
				<p>Persist the real shared settings fields without placeholder connection tools.</p>
			</div>

			<label class="field">
				<span>Network proxy</span>
				<input
					type="text"
					placeholder="socks5://127.0.0.1:6153"
					value={settingsStore.settings.proxy ?? ''}
					oninput={(event) => settingsStore.update({ proxy: event.currentTarget.value })}
				/>
			</label>

			<label class="switch-row">
				<div class="switch-copy">
					<strong>Optional anonymous reporting</strong>
					<p>Allow anonymous crash and event reporting.</p>
				</div>
				<input
					type="checkbox"
					checked={settingsStore.settings.allowReportingAndTracking ?? true}
					onchange={(event) => settingsStore.update({ allowReportingAndTracking: event.currentTarget.checked })}
				/>
			</label>

			{#if platform.type === 'desktop'}
				<div class="switch-stack">
					<label class="switch-row">
						<div class="switch-copy">
							<strong>Launch at system startup</strong>
							<p>Use the existing desktop-backed startup flag.</p>
						</div>
						<input
							type="checkbox"
							checked={settingsStore.settings.autoLaunch ?? false}
							onchange={(event) => settingsStore.update({ autoLaunch: event.currentTarget.checked })}
						/>
					</label>

					<label class="switch-row">
						<div class="switch-copy">
							<strong>Automatic updates</strong>
							<p>Keep update checks enabled for the desktop shell.</p>
						</div>
						<input
							type="checkbox"
							checked={settingsStore.settings.autoUpdate ?? true}
							onchange={(event) => settingsStore.update({ autoUpdate: event.currentTarget.checked })}
						/>
					</label>

					<label class="switch-row">
						<div class="switch-copy">
							<strong>Beta updates</strong>
							<p>Stay on the existing beta update channel.</p>
						</div>
						<input
							type="checkbox"
							checked={settingsStore.settings.betaUpdate ?? false}
							onchange={(event) => settingsStore.update({ betaUpdate: event.currentTarget.checked })}
						/>
					</label>
				</div>
			{/if}
		</section>
	</div>
</section>

<style>
	.settings-page {
		height: 100%;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.page-header,
	.card {
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 18px;
		background: color-mix(in srgb, var(--chatbox-background-secondary), transparent 10%);
	}

	.page-header,
	.card {
		padding: 1rem;
	}

	.eyebrow {
		margin: 0 0 0.24rem;
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--chatbox-tint-tertiary);
	}

	h1,
	h2 {
		margin: 0;
		color: var(--chatbox-tint-primary);
	}

	h1 {
		font-size: 1.1rem;
		line-height: 1.16;
	}

	h2 {
		font-size: 0.95rem;
	}

	.page-header p:last-child,
	.card-header p,
	.switch-copy p {
		margin: 0.38rem 0 0;
		font-size: 0.8rem;
		line-height: 1.45;
		color: var(--chatbox-tint-secondary);
	}

	.settings-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.card-header {
		margin-bottom: 0.9rem;
	}

	.field-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.field,
	.switch-stack {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.field + .field,
	.field-grid + .field,
	.switch-row + .switch-row {
		margin-top: 0.8rem;
	}

	.field span {
		font-size: 0.76rem;
		font-weight: 700;
		color: var(--chatbox-tint-secondary);
	}

	.field input[type='text'] {
		width: 100%;
		min-height: 2.5rem;
		padding: 0.55rem 0.75rem;
		border-radius: 12px;
		border: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-primary);
		color: var(--chatbox-tint-primary);
		font: inherit;
		box-sizing: border-box;
	}

	.range-field,
	.switch-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.9rem;
		padding: 0.8rem 0.9rem;
		border-radius: 14px;
		border: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-primary);
	}

	.range-field input {
		flex: 1;
		margin: 0;
	}

	.range-meta {
		min-width: 4.5rem;
		text-align: right;
	}

	.range-meta strong {
		display: block;
		font-size: 0.84rem;
		color: var(--chatbox-tint-primary);
	}

	.range-meta span {
		display: block;
		margin-top: 0.1rem;
		font-size: 0.68rem;
		color: var(--chatbox-tint-tertiary);
	}

	.segment-group {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.segment-btn {
		min-height: 2.2rem;
		padding: 0.45rem 0.8rem;
		border-radius: 999px;
		border: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-primary);
		color: var(--chatbox-tint-secondary);
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
	}

	.segment-btn.active {
		background: var(--chatbox-background-brand-secondary);
		border-color: var(--chatbox-border-brand);
		color: var(--chatbox-tint-brand);
	}

	.switch-copy {
		flex: 1;
		min-width: 0;
	}

	.switch-copy strong {
		display: block;
		font-size: 0.84rem;
		color: var(--chatbox-tint-primary);
	}

	.switch-row input {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}

	@media (max-width: 960px) {
		.settings-grid,
		.field-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 720px) {
		.settings-page {
			padding: 0.85rem;
		}

		.range-field,
		.switch-row {
			align-items: flex-start;
			flex-direction: column;
		}

		.range-meta {
			text-align: left;
			min-width: 0;
		}
	}
</style>
