<script lang="ts">
	import type { ProviderInfo, ProviderModelInfo } from '$shared/types'
	import SelectMenu, { type SelectOption } from '$lib/components/common/SelectMenu.svelte'
	import { getChatModels } from '$lib/utils/providers'

	interface Props {
		providers?: ProviderInfo[]
		selected?: {
			provider: string
			model: string
		} | null
		autoLabel?: string
		placeholder?: string
		modelFilter?: (model: ProviderModelInfo) => boolean
		onSelect?: (selection: { provider: string; model: string } | null) => void
		class?: string
	}

	let {
		providers = [],
		selected = null,
		autoLabel = 'Auto',
		placeholder = 'Choose a model',
		modelFilter,
		onSelect,
		class: className = '',
	}: Props = $props()

	const options = $derived.by(() => {
		const nextOptions: SelectOption[] = [{ value: '', label: autoLabel, hint: 'Use the existing default behavior' }]

		for (const provider of providers) {
			for (const model of getChatModels(provider)) {
				if (modelFilter && !modelFilter(model)) {
					continue
				}

				nextOptions.push({
					value: `${provider.id}::${model.modelId}`,
					label: model.nickname || model.modelId,
					hint: provider.name,
				})
			}
		}

		return nextOptions
	})

	const selectedValue = $derived(selected ? `${selected.provider}::${selected.model}` : '')

	function handleChange(value: string) {
		if (!value) {
			onSelect?.(null)
			return
		}

		const [provider, model] = value.split('::')
		if (!provider || !model) {
			onSelect?.(null)
			return
		}

		onSelect?.({ provider, model })
	}
</script>

<SelectMenu
	options={options}
	value={selectedValue}
	placeholder={placeholder}
	onChange={handleChange}
	class={className}
/>
