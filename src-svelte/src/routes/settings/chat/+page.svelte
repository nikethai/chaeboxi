<script lang="ts">
	import { getDefaultPrompt } from '$shared/defaults'
	import type { Settings } from '$shared/types'
	import { settingsStore } from '$lib/stores/settings.svelte'

	function toggleSetting<K extends keyof Settings>(key: K, fallback = false) {
		const currentValue = settingsStore.settings[key]
		settingsStore.update({
			[key]: !(typeof currentValue === 'boolean' ? currentValue : fallback),
		} as Partial<Settings>)
	}

	const compactionThreshold = $derived(settingsStore.settings.compactionThreshold ?? 0.6)
</script>

<section class="settings-page">
	<header class="page-header">
		<p class="eyebrow">Chat</p>
		<h1>Conversation defaults and rendering</h1>
		<p>These controls stay limited to the real fields already consumed by the current Svelte chat path.</p>
	</header>

	<div class="stack">
		<section class="card">
			<div class="card-header">
				<h2>Defaults for new conversations</h2>
				<p>Persisted session defaults that feed the actual conversation flow.</p>
			</div>

			<label class="field">
				<span>Default prompt</span>
				<textarea
					rows="4"
					value={settingsStore.settings.defaultPrompt ?? ''}
					oninput={(event) => settingsStore.update({ defaultPrompt: event.currentTarget.value })}
				></textarea>
			</label>

			<div class="action-row">
				<button class="ghost-btn" type="button" onclick={() => settingsStore.update({ defaultPrompt: getDefaultPrompt() })}>
					Reset prompt
				</button>
			</div>

			<div class="range-grid">
				<label class="field">
					<span>Max context message count</span>
					<div class="range-field">
						<input
							type="range"
							min="4"
							max="64"
							step="1"
							value={settingsStore.settings.maxContextMessageCount ?? 20}
							oninput={(event) => settingsStore.update({ maxContextMessageCount: Number(event.currentTarget.value) })}
						/>
						<strong>{settingsStore.settings.maxContextMessageCount ?? 20}</strong>
					</div>
				</label>

				<label class="field">
					<span>Temperature</span>
					<div class="range-field">
						<input
							type="range"
							min="0"
							max="2"
							step="0.1"
							value={settingsStore.settings.temperature ?? 0.7}
							oninput={(event) => settingsStore.update({ temperature: Number(event.currentTarget.value) })}
						/>
						<strong>{(settingsStore.settings.temperature ?? 0.7).toFixed(1)}</strong>
					</div>
				</label>

				<label class="field">
					<span>Top P</span>
					<div class="range-field">
						<input
							type="range"
							min="0"
							max="1"
							step="0.05"
							value={settingsStore.settings.topP ?? 1}
							oninput={(event) => settingsStore.update({ topP: Number(event.currentTarget.value) })}
						/>
						<strong>{(settingsStore.settings.topP ?? 1).toFixed(2)}</strong>
					</div>
				</label>
			</div>

			<label class="switch-row">
				<div class="switch-copy">
					<strong>Stream output</strong>
					<p>Use the current shared stream flag for assistant generation.</p>
				</div>
				<input
					type="checkbox"
					checked={settingsStore.settings.stream ?? true}
					onchange={(event) => settingsStore.update({ stream: event.currentTarget.checked })}
				/>
			</label>
		</section>

		<section class="card">
			<div class="card-header">
				<h2>Display and rendering</h2>
				<p>Only settings already consumed by the Svelte message/markdown path are exposed here.</p>
			</div>

			<div class="switch-stack">
				<label class="switch-row"><div class="switch-copy"><strong>Show word count</strong><p>Show per-message word totals when available.</p></div><input type="checkbox" checked={settingsStore.settings.showWordCount ?? false} onchange={() => toggleSetting('showWordCount')} /></label>
				<label class="switch-row"><div class="switch-copy"><strong>Show token usage</strong><p>Show assistant token usage metadata.</p></div><input type="checkbox" checked={settingsStore.settings.showTokenUsed ?? true} onchange={() => toggleSetting('showTokenUsed', true)} /></label>
				<label class="switch-row"><div class="switch-copy"><strong>Show model name</strong><p>Show assistant model metadata when it exists.</p></div><input type="checkbox" checked={settingsStore.settings.showModelName ?? true} onchange={() => toggleSetting('showModelName', true)} /></label>
				<label class="switch-row"><div class="switch-copy"><strong>Show message timestamp</strong><p>Render timestamp metadata in the message header.</p></div><input type="checkbox" checked={settingsStore.settings.showMessageTimestamp ?? false} onchange={() => toggleSetting('showMessageTimestamp')} /></label>
				<label class="switch-row"><div class="switch-copy"><strong>Show first token latency</strong><p>Expose first-token latency if the runtime provides it.</p></div><input type="checkbox" checked={settingsStore.settings.showFirstTokenLatency ?? false} onchange={() => toggleSetting('showFirstTokenLatency')} /></label>
				<label class="switch-row"><div class="switch-copy"><strong>Spell check</strong><p>Keep textarea spell-check behavior aligned with shared settings.</p></div><input type="checkbox" checked={settingsStore.settings.spellCheck ?? true} onchange={() => toggleSetting('spellCheck', true)} /></label>
				<label class="switch-row"><div class="switch-copy"><strong>Markdown rendering</strong><p>Render markdown in assistant messages.</p></div><input type="checkbox" checked={settingsStore.settings.enableMarkdownRendering ?? true} onchange={() => toggleSetting('enableMarkdownRendering', true)} /></label>
				<label class="switch-row"><div class="switch-copy"><strong>LaTeX rendering</strong><p>Keep math rendering behind the real markdown path.</p></div><input type="checkbox" checked={settingsStore.settings.enableLaTeXRendering ?? true} onchange={() => toggleSetting('enableLaTeXRendering', true)} /></label>
				<label class="switch-row"><div class="switch-copy"><strong>Mermaid rendering</strong><p>Render Mermaid diagrams when markdown is enabled.</p></div><input type="checkbox" checked={settingsStore.settings.enableMermaidRendering ?? true} onchange={() => toggleSetting('enableMermaidRendering', true)} /></label>
				<label class="switch-row"><div class="switch-copy"><strong>Inject default metadata</strong><p>Preserve automatic metadata like model name and current date.</p></div><input type="checkbox" checked={settingsStore.settings.injectDefaultMetadata ?? true} onchange={() => toggleSetting('injectDefaultMetadata', true)} /></label>
				<label class="switch-row"><div class="switch-copy"><strong>Auto-preview artifacts</strong><p>Automatically expand artifact previews when supported.</p></div><input type="checkbox" checked={settingsStore.settings.autoPreviewArtifacts ?? false} onchange={() => toggleSetting('autoPreviewArtifacts')} /></label>
				<label class="switch-row"><div class="switch-copy"><strong>Auto-collapse code blocks</strong><p>Keep the current code-collapse default for long replies.</p></div><input type="checkbox" checked={settingsStore.settings.autoCollapseCodeBlock ?? true} onchange={() => toggleSetting('autoCollapseCodeBlock', true)} /></label>
				<label class="switch-row"><div class="switch-copy"><strong>Paste long text as a file</strong><p>Keep large pasted content out of the main message body.</p></div><input type="checkbox" checked={settingsStore.settings.pasteLongTextAsAFile ?? true} onchange={() => toggleSetting('pasteLongTextAsAFile', true)} /></label>
				<label class="switch-row"><div class="switch-copy"><strong>Auto-generate titles</strong><p>Allow automatic session renaming when supported by the runtime.</p></div><input type="checkbox" checked={settingsStore.settings.autoGenerateTitle ?? true} onchange={() => toggleSetting('autoGenerateTitle', true)} /></label>
			</div>
		</section>

		<section class="card">
			<div class="card-header">
				<h2>Context management</h2>
				<p>Use the existing compaction settings path without widening any shared contracts.</p>
			</div>

			<label class="switch-row">
				<div class="switch-copy">
					<strong>Auto compaction</strong>
					<p>Automatically summarize and compact history when context usage grows.</p>
				</div>
				<input
					type="checkbox"
					checked={settingsStore.settings.autoCompaction ?? true}
					onchange={() => toggleSetting('autoCompaction', true)}
				/>
			</label>

			<label class="field">
				<span>Compaction threshold</span>
				<div class="range-field">
					<input
						type="range"
						min="0.4"
						max="0.9"
						step="0.05"
						value={compactionThreshold}
						disabled={!(settingsStore.settings.autoCompaction ?? true)}
						oninput={(event) => settingsStore.update({ compactionThreshold: Number(event.currentTarget.value) })}
					/>
					<strong>{Math.round(compactionThreshold * 100)}%</strong>
				</div>
			</label>
		</section>
	</div>
</section>

<style>
	.settings-page {
		height: 100%;
		overflow-y: auto;
		width: min(100%, 920px);
		margin: 0 auto;
		padding: 0.85rem 0.9rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.page-header,
	.card {
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 16px;
		background: color-mix(in srgb, var(--chatbox-background-secondary), transparent 10%);
		padding: 0.85rem 0.9rem;
	}

	.eyebrow {
		margin: 0 0 0.22rem;
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
		font-size: 1rem;
		line-height: 1.16;
	}

	h2 {
		font-size: 0.9rem;
	}

	.page-header p:last-child,
	.card-header p,
	.switch-copy p {
		margin: 0.28rem 0 0;
		font-size: 0.74rem;
		line-height: 1.4;
		color: var(--chatbox-tint-secondary);
	}

	.stack {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.card-header {
		margin-bottom: 0.72rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.field + .field,
	.action-row + .range-grid,
	.range-grid + .switch-row {
		margin-top: 0.68rem;
	}

	.field span {
		font-size: 0.76rem;
		font-weight: 700;
		color: var(--chatbox-tint-secondary);
	}

	textarea {
		width: 100%;
		padding: 0.58rem 0.7rem;
		border-radius: 13px;
		border: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-primary);
		color: var(--chatbox-tint-primary);
		font: inherit;
		box-sizing: border-box;
		resize: vertical;
	}

	.action-row {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.62rem;
	}

	.range-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13.5rem, 1fr));
		gap: 0.68rem;
		margin-top: 0.68rem;
	}

	.range-field,
	.switch-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.62rem 0.74rem;
		border-radius: 13px;
		border: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-primary);
	}

	.range-field input {
		flex: 1;
		margin: 0;
	}

	.range-field strong,
	.switch-copy strong {
		font-size: 0.8rem;
		color: var(--chatbox-tint-primary);
	}

	.switch-stack {
		display: grid;
		gap: 0.58rem;
	}

	.switch-copy {
		flex: 1;
		min-width: 0;
	}

	.switch-row input {
		width: 1.05rem;
		height: 1.05rem;
		flex-shrink: 0;
		accent-color: var(--chatbox-background-brand-primary);
		align-self: center;
	}

	.ghost-btn {
		min-height: 1.95rem;
		padding: 0.34rem 0.72rem;
		border-radius: 999px;
		border: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-primary);
		color: var(--chatbox-tint-secondary);
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
	}

	.ghost-btn:hover {
		background: var(--chatbox-background-secondary);
	}

	@media (max-width: 720px) {
		.settings-page {
			padding: 0.8rem 0.78rem 0.95rem;
		}

		.range-field,
		.switch-row {
			grid-template-columns: minmax(0, 1fr);
			align-items: start;
		}

		.action-row {
			justify-content: stretch;
		}
	}
</style>
