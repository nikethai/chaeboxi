<script lang="ts">
	type IncompleteLink = {
		href: string
		label: string
		external?: boolean
	}

	interface Props {
		eyebrow?: string
		badge?: string
		title: string
		description: string
		notes?: string[]
		links?: IncompleteLink[]
		class?: string
	}

	let {
		eyebrow = 'Incomplete route',
		badge = 'Partial',
		title,
		description,
		notes = [],
		links = [],
		class: className = '',
	}: Props = $props()
</script>

<section class={`incomplete-state ${className}`}>
	<div class="hero-card">
		<div class="hero-header">
			<div class="eyebrow-row">
				<span class="eyebrow">{eyebrow}</span>
				<span class="badge">{badge}</span>
			</div>
			<h1>{title}</h1>
			<p>{description}</p>
		</div>

		{#if notes.length > 0}
			<ul class="notes">
				{#each notes as note (`${title}:${note}`)}
					<li>{note}</li>
				{/each}
			</ul>
		{/if}

		{#if links.length > 0}
			<div class="actions">
				{#each links as link (`${link.href}:${link.label}`)}
					<a
						href={link.href}
						target={link.external ? '_blank' : undefined}
						rel={link.external ? 'noopener noreferrer' : undefined}
					>
						{link.label}
					</a>
				{/each}
			</div>
		{/if}
	</div>
</section>

<style>
	.incomplete-state {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background:
			radial-gradient(circle at top, color-mix(in srgb, var(--chatbox-background-brand-secondary), transparent 15%), transparent 40%),
			var(--chatbox-background-primary);
	}

	.hero-card {
		width: min(100%, 52rem);
		padding: 1.1rem;
		border: 1px solid var(--chatbox-border-primary);
		border-radius: 18px;
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--chatbox-background-secondary), var(--chatbox-background-primary) 12%) 0%,
				var(--chatbox-background-primary) 100%
			);
		box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08);
	}

	.hero-header h1 {
		margin: 0;
		font-size: clamp(1.25rem, 3vw, 1.8rem);
		line-height: 1.08;
		letter-spacing: -0.03em;
		color: var(--chatbox-tint-primary);
	}

	.hero-header p {
		margin: 0.65rem 0 0;
		max-width: 44rem;
		font-size: 0.86rem;
		line-height: 1.5;
		color: var(--chatbox-tint-secondary);
	}

	.eyebrow-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.8rem;
		flex-wrap: wrap;
	}

	.eyebrow,
	.badge {
		display: inline-flex;
		align-items: center;
		padding: 0.22rem 0.5rem;
		border-radius: 999px;
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.eyebrow {
		background: var(--chatbox-background-secondary);
		color: var(--chatbox-tint-secondary);
		border: 1px solid var(--chatbox-border-primary);
	}

	.badge {
		background: var(--chatbox-background-warning-secondary);
		color: var(--chatbox-tint-warning);
		border: 1px solid var(--chatbox-border-warning);
	}

	.notes {
		display: grid;
		gap: 0.6rem;
		margin: 1rem 0 0;
		padding: 0;
		list-style: none;
	}

	.notes li {
		padding: 0.72rem 0.84rem;
		border-radius: 12px;
		border: 1px solid var(--chatbox-border-primary);
		background: color-mix(in srgb, var(--chatbox-background-secondary), transparent 15%);
		color: var(--chatbox-tint-secondary);
		font-size: 0.82rem;
		line-height: 1.45;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: 1rem;
	}

	.actions a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.58rem 0.82rem;
		border-radius: 999px;
		border: 1px solid var(--chatbox-border-primary);
		background: var(--chatbox-background-secondary);
		color: var(--chatbox-tint-primary);
		text-decoration: none;
		font-size: 0.8rem;
		font-weight: 600;
		transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
	}

	.actions a:hover {
		background: var(--chatbox-background-brand-secondary);
		border-color: var(--chatbox-border-brand);
		color: var(--chatbox-tint-brand);
	}

	@media (max-width: 720px) {
		.incomplete-state {
			padding: 0.85rem;
		}

		.hero-card {
			padding: 1rem;
			border-radius: 16px;
		}
	}
</style>
