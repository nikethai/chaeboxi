<script lang="ts">
	import { goto } from '$app/navigation'
	import {
		ModelProviderEnum,
		ModelProviderType,
		type ProviderBaseInfo,
		type ProviderModelInfo,
		type ProviderSettings,
	} from '$shared/types'
	import {
		formatNumber,
		normalizeAzureEndpoint,
		normalizeClaudeHost,
		normalizeGeminiHost,
		normalizeOpenAIApiHostAndPath,
		normalizeOpenAIResponsesHostAndPath,
	} from '$shared/utils'
	import { providerCatalogStore } from '$lib/stores/provider-catalog.svelte'
	import {
		deleteCustomProvider,
		getProviderBaseInfo,
		getProviderModels,
		getProviderSettings,
		removeProviderModel,
		resetProviderModels,
		updateCustomProvider,
		updateProviderSettings,
		upsertProviderModel,
	} from '$lib/stores/provider-settings'
	import { settingsStore } from '$lib/stores/settings.svelte'
	import SelectMenu from '$lib/components/common/SelectMenu.svelte'

	interface Props {
		providerId: string
	}

	type ProviderCapability = 'vision' | 'reasoning' | 'tool_use' | 'web_search'

	type ModelDraft = {
		modelId: string
		nickname: string
		type: NonNullable<ProviderModelInfo['type']>
		apiStyle: ProviderModelInfo['apiStyle'] | ''
		labelsText: string
		contextWindow: string
		maxOutput: string
		capabilities: ProviderCapability[]
	}

	const hostConfigProviderIds = new Set<string>([
		ModelProviderEnum.OpenAI,
		ModelProviderEnum.OpenAIResponses,
		ModelProviderEnum.Claude,
		ModelProviderEnum.Gemini,
		ModelProviderEnum.Ollama,
		ModelProviderEnum.LMStudio,
	])

	const localProviderIds = new Set<string>([ModelProviderEnum.Ollama, ModelProviderEnum.LMStudio])

	const modelTypeOptions: Array<{ value: NonNullable<ProviderModelInfo['type']>; label: string }> = [
		{ value: 'chat', label: 'Chat' },
		{ value: 'embedding', label: 'Embedding' },
		{ value: 'rerank', label: 'Rerank' },
	]

	const apiStyleOptions: Array<{ value: NonNullable<ProviderModelInfo['apiStyle']> | ''; label: string }> = [
		{ value: '', label: 'Default' },
		{ value: 'openai', label: 'OpenAI' },
		{ value: 'anthropic', label: 'Anthropic' },
		{ value: 'google', label: 'Google' },
	]

	const capabilityOptions: Array<{ value: ProviderCapability; label: string }> = [
		{ value: 'vision', label: 'Vision' },
		{ value: 'reasoning', label: 'Reasoning' },
		{ value: 'tool_use', label: 'Tool Use' },
		{ value: 'web_search', label: 'Web Search' },
	]

	let { providerId }: Props = $props()

	let confirmDeleteProvider = $state(false)
	let modelEditorOpen = $state(false)
	let editingModelId = $state<string | null>(null)
	let modelEditorError = $state('')
	let modelDraft = $state<ModelDraft>(createEmptyModelDraft())

	const baseInfo = $derived(
		getProviderBaseInfo(settingsStore.settings, providerCatalogStore.systemProviders, providerId)
	)
	const providerSettings = $derived(getProviderSettings(settingsStore.settings, providerId))
	const models = $derived(baseInfo ? getProviderModels(baseInfo, providerSettings) : [])

	const requiresApiKey = $derived(baseInfo ? !localProviderIds.has(baseInfo.id) : false)
	const showsCloudflareFields = $derived(baseInfo ? !localProviderIds.has(baseInfo.id) : false)
	const showsGenericHost = $derived(baseInfo ? hostConfigProviderIds.has(baseInfo.id) : false)
	const showsCustomHostPath = $derived(Boolean(baseInfo?.isCustom))
	const allowsProxySwitch = $derived(baseInfo ? baseInfo.isCustom || baseInfo.id === ModelProviderEnum.Ollama : false)
	const isAzureProvider = $derived(baseInfo?.id === ModelProviderEnum.Azure)

	const resolvedEndpointPreview = $derived(baseInfo ? getResolvedEndpointPreview(baseInfo, providerSettings) : '')

	function createEmptyModelDraft(): ModelDraft {
		return {
			modelId: '',
			nickname: '',
			type: 'chat',
			apiStyle: '',
			labelsText: '',
			contextWindow: '',
			maxOutput: '',
			capabilities: [],
		}
	}

	function createModelDraft(model?: ProviderModelInfo): ModelDraft {
		return {
			modelId: model?.modelId ?? '',
			nickname: model?.nickname ?? '',
			type: model?.type ?? 'chat',
			apiStyle: model?.apiStyle ?? '',
			labelsText: model?.labels?.join(', ') ?? '',
			contextWindow: model?.contextWindow ? String(model.contextWindow) : '',
			maxOutput: model?.maxOutput ? String(model.maxOutput) : '',
			capabilities: (model?.capabilities?.filter(isProviderCapability) ?? []) as ProviderCapability[],
		}
	}

	function isProviderCapability(value: string): value is ProviderCapability {
		return ['vision', 'reasoning', 'tool_use', 'web_search'].includes(value)
	}

	function startNewModel() {
		modelEditorError = ''
		editingModelId = null
		modelDraft = createEmptyModelDraft()
		modelEditorOpen = true
	}

	function editModel(model: ProviderModelInfo) {
		modelEditorError = ''
		editingModelId = model.modelId
		modelDraft = createModelDraft(model)
		modelEditorOpen = true
	}

	function closeModelEditor() {
		modelEditorError = ''
		modelEditorOpen = false
		editingModelId = null
		modelDraft = createEmptyModelDraft()
	}

	function toggleCapability(capability: ProviderCapability, checked: boolean) {
		if (checked) {
			if (!modelDraft.capabilities.includes(capability)) {
				modelDraft.capabilities = [...modelDraft.capabilities, capability]
			}
			return
		}

		modelDraft.capabilities = modelDraft.capabilities.filter((value) => value !== capability)
	}

	function saveModel() {
		if (!baseInfo) {
			return
		}

		const trimmedModelId = modelDraft.modelId.trim()
		if (!trimmedModelId) {
			modelEditorError = 'Model ID is required.'
			return
		}

		const hasDuplicate = models.some(
			(model) => model.modelId === trimmedModelId && model.modelId !== editingModelId
		)

		if (hasDuplicate) {
			modelEditorError = 'That model already exists for this provider.'
			return
		}

		const currentModel = editingModelId
			? models.find((model) => model.modelId === editingModelId)
			: undefined

		const labels = modelDraft.labelsText
			.split(',')
			.map((label) => label.trim())
			.filter(Boolean)

		const nextModel: ProviderModelInfo = {
			...(currentModel ?? {}),
			modelId: trimmedModelId,
			type: modelDraft.type,
			nickname: modelDraft.nickname.trim() || undefined,
			apiStyle: modelDraft.apiStyle || currentModel?.apiStyle || undefined,
			labels: labels.length > 0 ? labels : undefined,
			capabilities: modelDraft.type === 'chat' && modelDraft.capabilities.length > 0 ? modelDraft.capabilities : undefined,
			contextWindow: parsePositiveInteger(modelDraft.contextWindow),
			maxOutput: parsePositiveInteger(modelDraft.maxOutput),
		}

		if (modelDraft.type !== 'chat') {
			nextModel.capabilities = undefined
		}

		upsertProviderModel(providerId, nextModel, models, {
			previousModelId: editingModelId,
		})
		closeModelEditor()
	}

	function parsePositiveInteger(value: string): number | undefined {
		const trimmed = value.trim()
		if (!trimmed) {
			return undefined
		}

		const parsed = Number.parseInt(trimmed, 10)
		return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
	}

	function handleDeleteProvider() {
		deleteCustomProvider(providerId)
		void goto('/settings/provider')
	}

	function getResolvedEndpointPreview(baseInfo: ProviderBaseInfo, settings?: ProviderSettings) {
		if (baseInfo.isCustom) {
			return getNormalizedCustomEndpoint(baseInfo.type, settings)
		}

		if (baseInfo.id === ModelProviderEnum.Azure) {
			const endpoint = String(settings?.endpoint ?? baseInfo.defaultSettings?.endpoint ?? '')
			const normalized = normalizeAzureEndpoint(endpoint)
			return `${normalized.endpoint}${normalized.apiPath}`
		}

		const apiHost = String(settings?.apiHost ?? baseInfo.defaultSettings?.apiHost ?? '')
		const apiPath = String(settings?.apiPath ?? baseInfo.defaultSettings?.apiPath ?? '')

		if (baseInfo.id === ModelProviderEnum.OpenAIResponses) {
			const normalized = normalizeOpenAIResponsesHostAndPath({ apiHost, apiPath })
			return `${normalized.apiHost}${normalized.apiPath}`
		}

		if (baseInfo.id === ModelProviderEnum.Claude) {
			const normalized = normalizeClaudeHost(apiHost)
			return `${normalized.apiHost}${normalized.apiPath}`
		}

		if (baseInfo.id === ModelProviderEnum.Gemini) {
			const normalized = normalizeGeminiHost(apiHost)
			return `${normalized.apiHost}${normalized.apiPath}`
		}

		const normalized = normalizeOpenAIApiHostAndPath({ apiHost, apiPath })
		return `${normalized.apiHost}${normalized.apiPath}`
	}

	function getNormalizedCustomEndpoint(type: ProviderBaseInfo['type'], settings?: ProviderSettings): string {
		const apiHost = settings?.apiHost ?? ''
		const apiPath = settings?.apiPath ?? ''

		switch (type) {
			case ModelProviderType.Claude: {
				const normalized = normalizeClaudeHost(apiHost)
				return `${normalized.apiHost}${apiPath || normalized.apiPath}`
			}
			case ModelProviderType.Gemini: {
				const normalized = normalizeGeminiHost(apiHost)
				return `${normalized.apiHost}${apiPath || normalized.apiPath}`
			}
			case ModelProviderType.OpenAIResponses: {
				const normalized = normalizeOpenAIResponsesHostAndPath({ apiHost, apiPath })
				return `${normalized.apiHost}${normalized.apiPath}`
			}
			case ModelProviderType.OpenAI:
			default: {
				const normalized = normalizeOpenAIApiHostAndPath({ apiHost, apiPath })
				return `${normalized.apiHost}${normalized.apiPath}`
			}
		}
	}
</script>

{#if baseInfo}
	<section class="provider-editor">
		<div class="hero">
			<div>
				<p class="eyebrow">Real Provider Flow</p>
				<div class="headline">
					<h1>{baseInfo.name}</h1>
					<span class="kind-badge">{baseInfo.isCustom ? 'Custom' : 'Built-in'}</span>
				</div>
				{#if baseInfo.description}
					<p class="lead">{baseInfo.description}</p>
				{/if}
			</div>

			<div class="hero-actions">
				{#if baseInfo.urls?.website}
					<a class="link-btn" href={baseInfo.urls.website} target="_blank" rel="noreferrer">Website</a>
				{/if}
				{#if baseInfo.urls?.docs}
					<a class="link-btn" href={baseInfo.urls.docs} target="_blank" rel="noreferrer">Docs</a>
				{/if}
				{#if baseInfo.isCustom}
					<button class="danger-btn" type="button" onclick={() => (confirmDeleteProvider = !confirmDeleteProvider)}>
						{confirmDeleteProvider ? 'Cancel delete' : 'Delete provider'}
					</button>
				{/if}
			</div>
		</div>

		{#if confirmDeleteProvider && baseInfo.isCustom}
			<div class="warning-card">
				<div>
					<strong>Delete this custom provider?</strong>
					<p>The provider will disappear from settings and the saved provider entry will be removed.</p>
				</div>
				<button class="danger-btn" type="button" onclick={handleDeleteProvider}>Confirm delete</button>
			</div>
		{/if}

		<div class="editor-grid">
			<div class="card">
				<div class="card-header">
					<div>
						<h2>Connection</h2>
						<p>Changes persist immediately to the shared settings store used by chat.</p>
					</div>
				</div>

				<div class="fields">
					{#if baseInfo.isCustom}
						<div class="field-row">
							<label class="field">
								<span>Name</span>
								<input
									value={baseInfo.name}
									oninput={(event) =>
										updateCustomProvider(providerId, {
											name: event.currentTarget.value.trimStart(),
										})}
								/>
							</label>

							<label class="field">
								<span>API Mode</span>
								<SelectMenu
									options={[
										{ value: ModelProviderType.OpenAI, label: 'OpenAI API Compatible' },
										{ value: ModelProviderType.OpenAIResponses, label: 'OpenAI Responses Compatible' },
										{ value: ModelProviderType.Claude, label: 'Claude API Compatible' },
										{ value: ModelProviderType.Gemini, label: 'Gemini API Compatible' },
									]}
									value={baseInfo.type}
									onChange={(value) =>
										updateCustomProvider(providerId, {
											type: value as ModelProviderType,
										})}
								/>
							</label>
						</div>
					{/if}

					{#if requiresApiKey}
						<label class="field">
							<span>API Key</span>
							<input
								type="password"
								placeholder="sk-..."
								value={providerSettings?.apiKey ?? ''}
								oninput={(event) =>
									updateProviderSettings(providerId, {
										apiKey: event.currentTarget.value,
									})}
							/>
						</label>
					{/if}

					{#if showsCloudflareFields}
						<div class="field-row">
							<label class="field">
								<span>Cloudflare Client ID</span>
								<input
									placeholder="Optional"
									value={providerSettings?.cloudflareClientId ?? ''}
									oninput={(event) =>
										updateProviderSettings(providerId, {
											cloudflareClientId: event.currentTarget.value,
										})}
								/>
							</label>

							<label class="field">
								<span>Cloudflare Client Secret</span>
								<input
									type="password"
									placeholder="Optional"
									value={providerSettings?.cloudflareClientSecret ?? ''}
									oninput={(event) =>
										updateProviderSettings(providerId, {
											cloudflareClientSecret: event.currentTarget.value,
										})}
								/>
							</label>
						</div>
					{/if}

					{#if showsGenericHost}
						<label class="field">
							<span>API Host</span>
							<input
								placeholder={baseInfo.defaultSettings?.apiHost ?? 'https://api.openai.com/v1'}
								value={providerSettings?.apiHost ?? ''}
								oninput={(event) =>
									updateProviderSettings(providerId, {
										apiHost: event.currentTarget.value,
									})}
							/>
						</label>
					{/if}

					{#if showsCustomHostPath}
						<div class="field-row">
							<label class="field">
								<span>API Host</span>
								<input
									placeholder="https://api.example.com/v1"
									value={providerSettings?.apiHost ?? ''}
									oninput={(event) =>
										updateProviderSettings(providerId, {
											apiHost: event.currentTarget.value,
										})}
								/>
							</label>

							<label class="field">
								<span>API Path</span>
								<input
									placeholder="/chat/completions"
									value={providerSettings?.apiPath ?? ''}
									oninput={(event) =>
										updateProviderSettings(providerId, {
											apiPath: event.currentTarget.value,
										})}
								/>
							</label>
						</div>
					{/if}

					{#if isAzureProvider}
						<div class="field-row">
							<label class="field">
								<span>Azure Endpoint</span>
								<input
									placeholder="https://resource-name.openai.azure.com"
									value={providerSettings?.endpoint ?? ''}
									oninput={(event) =>
										updateProviderSettings(providerId, {
											endpoint: event.currentTarget.value,
										})}
								/>
							</label>

							<label class="field">
								<span>API Version</span>
								<input
									placeholder={baseInfo.defaultSettings?.apiVersion ?? '2024-05-01-preview'}
									value={providerSettings?.apiVersion ?? ''}
									oninput={(event) =>
										updateProviderSettings(providerId, {
											apiVersion: event.currentTarget.value,
										})}
								/>
							</label>
						</div>
					{/if}

					{#if allowsProxySwitch}
						<label class="switch-field">
							<div>
								<strong>Improve Network Compatibility</strong>
								<p>Keep the existing proxy-compatible setting path without exposing fake testing controls.</p>
							</div>

							<input
								type="checkbox"
								checked={providerSettings?.useProxy ?? false}
								onchange={(event) =>
									updateProviderSettings(providerId, {
										useProxy: event.currentTarget.checked,
									})}
							/>
						</label>
					{/if}

					<div class="resolved-endpoint">
						<span>Resolved endpoint</span>
						<code>{resolvedEndpointPreview || 'Configure host details to see the final endpoint.'}</code>
					</div>
				</div>
			</div>

			<div class="card">
				<div class="card-header">
					<div>
						<h2>Models</h2>
						<p>Add, edit, remove, or reset the model list that the Svelte chat shell consumes.</p>
					</div>

					<div class="toolbar">
						<button class="ghost-btn" type="button" onclick={() => baseInfo && resetProviderModels(providerId, baseInfo)}>
							Reset
						</button>
						<button class="primary-btn" type="button" onclick={startNewModel}>Add model</button>
					</div>
				</div>

				<div class="model-list">
					{#if models.length > 0}
						{#each models as model (model.modelId)}
							<div class="model-row">
								<div class="model-copy">
									<div class="model-title-row">
										<strong title={model.nickname || model.modelId}>{model.nickname || model.modelId}</strong>
										<span class="model-id">{model.modelId}</span>
									</div>

									<div class="model-meta">
										<span class="meta-pill">{model.type ?? 'chat'}</span>
										{#if model.capabilities?.length}
											{#each model.capabilities as capability (capability)}
												<span class="meta-pill capability">{capability.replace('_', ' ')}</span>
											{/each}
										{/if}
										{#if model.contextWindow}
											<span class="meta-pill subtle">ctx {formatNumber(model.contextWindow)}</span>
										{/if}
										{#if model.maxOutput}
											<span class="meta-pill subtle">out {formatNumber(model.maxOutput)}</span>
										{/if}
									</div>
								</div>

								<div class="row-actions">
									<button class="ghost-btn compact" type="button" onclick={() => editModel(model)}>Edit</button>
									<button class="danger-ghost compact" type="button" onclick={() => removeProviderModel(providerId, model.modelId, models)}>
										Remove
									</button>
								</div>
							</div>
						{/each}
					{:else}
						<div class="empty-models">
							<strong>No models configured.</strong>
							<p>
								{#if baseInfo.isCustom || baseInfo.id === ModelProviderEnum.Ollama || baseInfo.id === ModelProviderEnum.LMStudio}
									Add at least one model before this provider becomes available in chat.
								{:else}
									Reset to defaults or add a custom model override for this provider.
								{/if}
							</p>
						</div>
					{/if}
				</div>

				{#if modelEditorOpen}
					<div class="model-editor">
						<div class="editor-header">
							<div>
								<h3>{editingModelId ? 'Edit model' : 'Add model'}</h3>
								<p>Only real stored fields are editable here. Capability testing remains explicitly out of scope.</p>
							</div>
							<button class="ghost-btn compact" type="button" onclick={closeModelEditor}>Close</button>
						</div>

						<div class="fields">
							<div class="field-row">
								<label class="field">
									<span>Model ID</span>
									<input bind:value={modelDraft.modelId} placeholder="gpt-4o-mini" />
								</label>

								<label class="field">
									<span>Nickname</span>
									<input bind:value={modelDraft.nickname} placeholder="Optional display name" />
								</label>
							</div>

							<div class="field-row">
								<label class="field">
									<span>Model Type</span>
									<SelectMenu
										options={modelTypeOptions}
										value={modelDraft.type}
										onChange={(value) => (modelDraft.type = value as ModelDraft['type'])}
									/>
								</label>

								<label class="field">
									<span>API Style</span>
									<SelectMenu
										options={apiStyleOptions}
										value={modelDraft.apiStyle}
										onChange={(value) => (modelDraft.apiStyle = value as ModelDraft['apiStyle'])}
									/>
								</label>
							</div>

							<label class="field">
								<span>Labels</span>
								<input bind:value={modelDraft.labelsText} placeholder="vision, fast, reasoning" />
							</label>

							{#if modelDraft.type === 'chat'}
								<div class="capability-grid">
									{#each capabilityOptions as option}
										<label class="capability-toggle">
											<input
												type="checkbox"
												checked={modelDraft.capabilities.includes(option.value)}
												onchange={(event) => toggleCapability(option.value, event.currentTarget.checked)}
											/>
											<span>{option.label}</span>
										</label>
									{/each}
								</div>
							{/if}

							<div class="field-row">
								<label class="field">
									<span>Context Window</span>
									<input bind:value={modelDraft.contextWindow} inputmode="numeric" placeholder="128000" />
								</label>

								<label class="field">
									<span>Max Output Tokens</span>
									<input bind:value={modelDraft.maxOutput} inputmode="numeric" placeholder="4096" />
								</label>
							</div>
						</div>

						{#if modelEditorError}
							<p class="form-error">{modelEditorError}</p>
						{/if}

						<div class="toolbar toolbar-end">
							<button class="ghost-btn" type="button" onclick={closeModelEditor}>Cancel</button>
							<button class="primary-btn" type="button" onclick={saveModel}>Save model</button>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<div class="scope-footnote">
			<span class="scope-badge">Out of scope</span>
			<p>Clipboard import, deep-link import, and model capability testing stay hidden until their Svelte paths are fully ported.</p>
		</div>
	</section>
{:else}
	<section class="provider-editor missing">
		<div class="card">
			<h2>Provider not found</h2>
			<p>This provider no longer exists in the current settings state.</p>
			<a class="primary-inline" href="/settings/provider">Back to provider list</a>
		</div>
	</section>
{/if}

<style>
	.provider-editor {
		height: 100%;
		overflow-y: auto;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: var(--chatbox-background-primary);
	}

	.hero,
	.warning-card,
	.card,
	.scope-footnote {
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 18px;
		background: color-mix(in srgb, var(--chatbox-background-secondary), transparent 12%);
	}

	.hero,
	.warning-card,
	.scope-footnote {
		padding: 0.76rem 0.84rem;
	}

	.hero {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
	}

	.eyebrow {
		margin: 0 0 0.25rem;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--chatbox-tint-tertiary);
	}

	.headline {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	h1,
	h2,
	h3 {
		margin: 0;
		color: var(--chatbox-tint-primary);
	}

	h1 {
		font-size: clamp(0.98rem, 1.4vw, 1.18rem);
		line-height: 1.15;
	}

	h2 {
		font-size: 0.9rem;
	}

	h3 {
		font-size: 0.88rem;
	}

	.lead,
	.card-header p,
	.warning-card p,
	.scope-footnote p,
	.editor-header p,
	.empty-models p {
		margin: 0.28rem 0 0;
		font-size: 0.72rem;
		line-height: 1.4;
		color: var(--chatbox-tint-secondary);
	}

	.kind-badge,
	.scope-badge,
	.meta-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.16rem 0.42rem;
		border-radius: 999px;
		font-size: 0.64rem;
		font-weight: 700;
		letter-spacing: 0.02em;
	}

	.kind-badge {
		background: var(--chatbox-background-brand-secondary);
		color: var(--chatbox-tint-brand);
	}

	.hero-actions,
	.toolbar,
	.row-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.warning-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		border-color: var(--chatbox-border-error);
		background: var(--chatbox-background-error-secondary);
	}

	.editor-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.75rem;
	}

	.card {
		padding: 0.78rem 0.84rem;
	}

	.card-header,
	.editor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		margin-top: 0.68rem;
	}

	.field-row {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.65rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.36rem;
		font-size: 0.74rem;
		font-weight: 700;
		color: var(--chatbox-tint-secondary);
	}

	.field input,
	.field :global(.select-menu),
	.field :global(.select-trigger) {
		width: 100%;
		min-height: 2.2rem;
	}

	.field input {
		padding: 0.48rem 0.72rem;
		border-radius: 12px;
		border: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-primary);
		color: var(--chatbox-tint-primary);
		font: inherit;
		box-sizing: border-box;
	}

	.switch-field {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.85rem;
		padding: 0.72rem 0.82rem;
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 14px;
		background: var(--chatbox-background-primary);
	}

	.switch-field strong {
		display: block;
		font-size: 0.8rem;
		color: var(--chatbox-tint-primary);
	}

	.switch-field p {
		margin: 0.2rem 0 0;
		font-size: 0.72rem;
		line-height: 1.45;
		color: var(--chatbox-tint-tertiary);
	}

	.switch-field input {
		width: 1.05rem;
		height: 1.05rem;
		flex-shrink: 0;
	}

	.resolved-endpoint {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.62rem 0.72rem;
		border-radius: 13px;
		background: var(--chatbox-background-primary);
		border: 1px dashed var(--chatbox-border-primary);
	}

	.resolved-endpoint span {
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--chatbox-tint-tertiary);
	}

	.resolved-endpoint code {
		font-size: 0.74rem;
		line-height: 1.45;
		color: var(--chatbox-tint-secondary);
		word-break: break-word;
	}

	.model-list {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		margin-top: 0.68rem;
	}

	.model-row,
	.empty-models,
	.model-editor {
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 14px;
		background: var(--chatbox-background-primary);
	}

	.model-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.65rem;
		padding: 0.64rem 0.72rem;
	}

	.model-copy {
		flex: 1;
		min-width: 0;
	}

	.model-title-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.model-title-row strong {
		font-size: 0.8rem;
		line-height: 1.25;
		color: var(--chatbox-tint-primary);
	}

	.model-id {
		font-size: 0.66rem;
		color: var(--chatbox-tint-tertiary);
		word-break: break-word;
	}

	.model-meta {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.45rem;
	}

	.meta-pill {
		background: var(--chatbox-background-secondary);
		color: var(--chatbox-tint-secondary);
	}

	.meta-pill.capability {
		background: var(--chatbox-background-brand-secondary);
		color: var(--chatbox-tint-brand);
	}

	.meta-pill.subtle {
		background: var(--chatbox-background-gray-secondary);
		color: var(--chatbox-tint-tertiary);
	}

	.empty-models {
		padding: 0.8rem;
	}

	.empty-models strong {
		display: block;
		font-size: 0.8rem;
		color: var(--chatbox-tint-primary);
	}

	.model-editor {
		padding: 0.8rem;
	}

	.capability-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.55rem;
	}

	.capability-toggle {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.54rem 0.66rem;
		border-radius: 12px;
		border: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-primary);
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--chatbox-tint-secondary);
	}

	.form-error {
		margin: 0.8rem 0 0;
		font-size: 0.74rem;
		font-weight: 700;
		color: var(--chatbox-tint-error);
	}

	.toolbar-end {
		justify-content: flex-end;
		margin-top: 0.75rem;
	}

	.primary-btn,
	.ghost-btn,
	.link-btn,
	.danger-btn,
	.danger-ghost,
	.primary-inline {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 1.95rem;
		padding: 0.34rem 0.72rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 700;
		text-decoration: none;
		cursor: pointer;
		transition:
			background 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}

	.primary-btn,
	.primary-inline {
		background: var(--chatbox-background-brand-primary);
		color: var(--chatbox-tint-white);
		border: 1px solid var(--chatbox-background-brand-primary);
	}

	.primary-btn:hover,
	.primary-inline:hover {
		background: var(--chatbox-background-brand-primary-hover);
		border-color: var(--chatbox-background-brand-primary-hover);
	}

	.ghost-btn,
	.link-btn {
		background: var(--chatbox-background-primary);
		color: var(--chatbox-tint-secondary);
		border: 1px solid var(--chatbox-border-primary);
	}

	.ghost-btn:hover,
	.link-btn:hover {
		background: var(--chatbox-background-secondary);
	}

	.ghost-btn.compact,
	.danger-ghost.compact {
		min-height: 1.72rem;
		padding-inline: 0.6rem;
	}

	.danger-btn,
	.danger-ghost {
		color: var(--chatbox-tint-error);
		border: 1px solid color-mix(in srgb, var(--chatbox-border-error), transparent 30%);
		background: var(--chatbox-background-error-secondary);
	}

	.danger-btn:hover,
	.danger-ghost:hover {
		background: color-mix(in srgb, var(--chatbox-background-error-secondary), white 10%);
	}

	.scope-footnote {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.scope-badge {
		width: fit-content;
		background: var(--chatbox-background-warning-secondary);
		color: var(--chatbox-tint-warning);
	}

	.provider-editor.missing {
		justify-content: center;
	}

	@media (max-width: 960px) {
		.provider-editor {
			padding: 0.8rem;
		}

		.hero,
		.warning-card,
		.card-header,
		.editor-header {
			flex-direction: column;
		}
	}

	@media (max-width: 720px) {
		.field-row,
		.capability-grid {
			grid-template-columns: minmax(0, 1fr);
		}

		.model-row {
			flex-direction: column;
			align-items: stretch;
		}

		.row-actions {
			justify-content: flex-end;
		}
	}
</style>
