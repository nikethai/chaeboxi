<script lang="ts">
	export type SelectOption = {
		value: string
		label: string
		hint?: string
		disabled?: boolean
	}

	interface Props {
		options?: ReadonlyArray<SelectOption>
		value?: string
		placeholder?: string
		disabled?: boolean
		fullWidth?: boolean
		align?: 'left' | 'right'
		onChange?: (value: string) => void
		class?: string
	}

	let {
		options = [],
		value = '',
		placeholder = 'Select an option',
		disabled = false,
		fullWidth = true,
		align = 'left',
		onChange,
		class: className = '',
	}: Props = $props()

	let rootElement = $state<HTMLDivElement | null>(null)
	let open = $state(false)

	const selectedOption = $derived(options.find((option) => option.value === value))

	function toggle() {
		if (disabled || options.length === 0) {
			return
		}

		open = !open
	}

	function handleSelect(option: SelectOption) {
		if (option.disabled) {
			return
		}

		onChange?.(option.value)
		open = false
	}

	function handleWindowClick(event: MouseEvent) {
		const target = event.target as Node | null
		if (rootElement && target && !rootElement.contains(target)) {
			open = false
		}
	}
</script>

<svelte:window onclick={handleWindowClick} />

<div bind:this={rootElement} class={`select-menu ${fullWidth ? 'full-width' : ''} ${className}`}>
	<button
		class="select-trigger"
		type="button"
		disabled={disabled || options.length === 0}
		aria-expanded={open}
		onclick={toggle}
	>
		<span class="trigger-copy">
			<span class:selected={Boolean(selectedOption)} class="trigger-label">
				{selectedOption?.label ?? placeholder}
			</span>
			{#if selectedOption?.hint}
				<span class="trigger-hint">{selectedOption.hint}</span>
			{/if}
		</span>

		<svg class:open width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M6 9l6 6 6-6" />
		</svg>
	</button>

	{#if open}
		<div class:right={align === 'right'} class="select-dropdown">
			{#each options as option (option.value || option.label)}
				<button
					class:selected={option.value === value}
					class="select-option"
					type="button"
					disabled={option.disabled}
					onclick={() => handleSelect(option)}
				>
					<span class="option-copy">
						<span class="option-label">{option.label}</span>
						{#if option.hint}
							<span class="option-hint">{option.hint}</span>
						{/if}
					</span>

					{#if option.value === value}
						<svg class="option-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M20 6 9 17l-5-5" />
						</svg>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.select-menu {
		position: relative;
		min-width: 0;
	}

	.select-menu.full-width,
	.select-menu.full-width .select-trigger {
		width: 100%;
	}

	.select-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		min-height: 2.2rem;
		padding: 0.44rem 0.7rem;
		border-radius: 12px;
		border: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-primary);
		color: var(--chatbox-tint-primary);
		font: inherit;
		text-align: left;
		box-sizing: border-box;
		cursor: pointer;
		transition:
			background 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}

	.select-trigger:hover:enabled,
	.select-trigger[aria-expanded='true'] {
		background: var(--chatbox-background-secondary);
		border-color: var(--chatbox-border-secondary);
	}

	.select-trigger:disabled {
		cursor: default;
		opacity: 0.62;
	}

	.trigger-copy,
	.option-copy {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.trigger-label,
	.option-label {
		font-size: 0.84rem;
		font-weight: 600;
		line-height: 1.2;
		color: var(--chatbox-tint-placeholder);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.trigger-label.selected,
	.option-label {
		color: var(--chatbox-tint-primary);
	}

	.trigger-hint,
	.option-hint {
		margin-top: 0.16rem;
		font-size: 0.72rem;
		line-height: 1.25;
		color: var(--chatbox-tint-tertiary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.select-trigger svg,
	.option-check {
		flex-shrink: 0;
		color: var(--chatbox-tint-tertiary);
		transition: transform 0.15s ease;
	}

	.select-trigger svg.open {
		transform: rotate(180deg);
	}

	.select-dropdown {
		position: absolute;
		top: calc(100% + 0.35rem);
		left: 0;
		min-width: 100%;
		max-width: min(26rem, calc(100vw - 2rem));
		padding: 0.4rem;
		border-radius: 14px;
		border: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-primary);
		box-shadow: 0 18px 40px rgba(15, 23, 42, 0.14);
		z-index: 40;
	}

	.select-dropdown.right {
		left: auto;
		right: 0;
	}

	.select-option {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.55rem 0.6rem;
		border: 0;
		border-radius: 10px;
		background: transparent;
		text-align: left;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
	}

	.select-option:hover:enabled,
	.select-option.selected {
		background: var(--chatbox-background-secondary);
	}

	.select-option.selected .option-label {
		color: var(--chatbox-tint-brand);
	}

	.select-option:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}
</style>
