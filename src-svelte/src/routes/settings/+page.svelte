<script lang="ts">
	import { settingsStore } from '$lib/stores/settings.svelte'
	import { themeStore } from '$lib/stores/theme.svelte'
	import { supportedLanguages, changeLanguage } from '$lib/i18n'

	let settings = $derived(settingsStore.settings)
	const currentTheme = $derived(themeStore.theme)
	const resolvedTheme = $derived(themeStore.resolvedTheme)

	function updateTheme(theme: 'light' | 'dark' | 'system') {
		themeStore.setTheme(theme)
		settingsStore.update({ theme })
	}

	function updateLanguage(lang: string) {
		settingsStore.update({ language: lang })
		changeLanguage(lang)
	}

	function toggleSetting(key: keyof typeof settings, value: boolean) {
		settingsStore.update({ [key]: value })
	}
</script>

<div class="settings-page">
	<header class="settings-header">
		<h1>Settings</h1>
	</header>

	<div class="settings-content">
		<!-- Appearance Section -->
		<section class="settings-section">
			<h2>Appearance</h2>

			<div class="setting-item">
				<div class="setting-label">
					<span class="label">Theme</span>
					<span class="description">Choose your preferred color scheme</span>
				</div>
				<div class="setting-control">
					<select value={currentTheme} onchange={(e) => updateTheme(e.currentTarget.value as 'light' | 'dark' | 'system')}>
						<option value="system">System</option>
						<option value="light">Light</option>
						<option value="dark">Dark</option>
					</select>
				</div>
			</div>

			<div class="setting-item">
				<div class="setting-label">
					<span class="label">Language</span>
					<span class="description">Select your preferred language</span>
				</div>
				<div class="setting-control">
					<select value={settings.language} onchange={(e) => updateLanguage(e.currentTarget.value)}>
						{#each supportedLanguages as lang}
							<option value={lang.code}>{lang.name}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="setting-item">
				<div class="setting-label">
					<span class="label">Font Size</span>
					<span class="description">Adjust the message font size</span>
				</div>
				<div class="setting-control">
					<input
						type="number"
						min="12"
						max="24"
						value={settings.fontSize}
						onchange={(e) => settingsStore.update({ fontSize: parseInt(e.currentTarget.value) })}
					/>
				</div>
			</div>
		</section>

		<!-- Rendering Section -->
		<section class="settings-section">
			<h2>Rendering</h2>

			<div class="setting-item">
				<div class="setting-label">
					<span class="label">Markdown Rendering</span>
					<span class="description">Enable markdown formatting in messages</span>
				</div>
				<div class="setting-control">
					<input
						type="checkbox"
						checked={settings.enableMarkdownRendering}
						onchange={(e) => toggleSetting('enableMarkdownRendering', e.currentTarget.checked)}
					/>
				</div>
			</div>

			<div class="setting-item">
				<div class="setting-label">
					<span class="label">LaTeX Rendering</span>
					<span class="description">Render mathematical equations</span>
				</div>
				<div class="setting-control">
					<input
						type="checkbox"
						checked={settings.enableLaTeXRendering}
						onchange={(e) => toggleSetting('enableLaTeXRendering', e.currentTarget.checked)}
					/>
				</div>
			</div>

			<div class="setting-item">
				<div class="setting-label">
					<span class="label">Mermaid Diagrams</span>
					<span class="description">Render mermaid diagrams in messages</span>
				</div>
				<div class="setting-control">
					<input
						type="checkbox"
						checked={settings.enableMermaidRendering}
						onchange={(e) => toggleSetting('enableMermaidRendering', e.currentTarget.checked)}
					/>
				</div>
			</div>

			<div class="setting-item">
				<div class="setting-label">
					<span class="label">Auto-collapse Code Blocks</span>
					<span class="description">Collapse long code blocks by default</span>
				</div>
				<div class="setting-control">
					<input
						type="checkbox"
						checked={settings.autoCollapseCodeBlock}
						onchange={(e) => toggleSetting('autoCollapseCodeBlock', e.currentTarget.checked)}
					/>
				</div>
			</div>
		</section>

		<!-- Display Section -->
		<section class="settings-section">
			<h2>Display</h2>

			<div class="setting-item">
				<div class="setting-label">
					<span class="label">Show Model Name</span>
					<span class="description">Display the model name in messages</span>
				</div>
				<div class="setting-control">
					<input
						type="checkbox"
						checked={settings.showModelName}
						onchange={(e) => toggleSetting('showModelName', e.currentTarget.checked)}
					/>
				</div>
			</div>

			<div class="setting-item">
				<div class="setting-label">
					<span class="label">Show Message Timestamp</span>
					<span class="description">Display timestamp for each message</span>
				</div>
				<div class="setting-control">
					<input
						type="checkbox"
						checked={settings.showMessageTimestamp}
						onchange={(e) => toggleSetting('showMessageTimestamp', e.currentTarget.checked)}
					/>
				</div>
			</div>

			<div class="setting-item">
				<div class="setting-label">
					<span class="label">Show Token Count</span>
					<span class="description">Display token usage for messages</span>
				</div>
				<div class="setting-control">
					<input
						type="checkbox"
						checked={settings.showTokenCount}
						onchange={(e) => toggleSetting('showTokenCount', e.currentTarget.checked)}
					/>
				</div>
			</div>

			<div class="setting-item">
				<div class="setting-label">
					<span class="label">Show Token Used</span>
					<span class="description">Show total tokens used</span>
				</div>
				<div class="setting-control">
					<input
						type="checkbox"
						checked={settings.showTokenUsed}
						onchange={(e) => toggleSetting('showTokenUsed', e.currentTarget.checked)}
					/>
				</div>
			</div>
		</section>

		<!-- About Section -->
		<section class="settings-section">
			<h2>About</h2>
			<div class="about-info">
				<p><strong>Chaeboxi</strong></p>
				<p>Version 0.1.0</p>
				<p>Svelte 5 + Tauri</p>
			</div>
		</section>
	</div>
</div>

<style>
	.settings-page {
		min-height: 100vh;
		background: var(--chatbox-background-primary);
	}

	.settings-header {
		padding: 1.5rem;
		border-bottom: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-secondary);
	}

	.settings-header h1 {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0;
		color: var(--chatbox-tint-primary);
	}

	.settings-content {
		max-width: 800px;
		margin: 0 auto;
		padding: 1.5rem;
	}

	.settings-section {
		margin-bottom: 2rem;
	}

	.settings-section h2 {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--chatbox-tint-primary);
		margin: 0 0 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--chatbox-border-primary);
	}

	.setting-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		background: var(--chatbox-background-secondary);
		border-radius: var(--chatbox-radius-md);
		margin-bottom: 0.5rem;
	}

	.setting-label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.setting-label .label {
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--chatbox-tint-primary);
	}

	.setting-label .description {
		font-size: 0.8125rem;
		color: var(--chatbox-tint-secondary);
	}

	.setting-control select,
	.setting-control input[type="number"] {
		padding: 0.5rem 0.75rem;
		background: var(--chatbox-background-tertiary);
		border: 1px solid var(--chatbox-border-primary);
		border-radius: var(--chatbox-radius-md);
		color: var(--chatbox-tint-primary);
		font-size: 0.875rem;
		min-width: 150px;
	}

	.setting-control input[type="checkbox"] {
		width: 1.25rem;
		height: 1.25rem;
		cursor: pointer;
	}

	.about-info {
		padding: 1rem;
		background: var(--chatbox-background-secondary);
		border-radius: var(--chatbox-radius-md);
	}

	.about-info p {
		margin: 0.25rem 0;
		color: var(--chatbox-tint-secondary);
		font-size: 0.875rem;
	}
</style>
