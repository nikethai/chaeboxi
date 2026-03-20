<script lang="ts">
	import IncompleteState from '$lib/components/common/IncompleteState.svelte'

	const notes = [
		'MCP configuration and status management still come from the React app.',
		'This route stays visible only as an explicit partial surface on desktop.',
	]
</script>

<IncompleteState
	eyebrow="MCP"
	title="MCP settings are still partial"
	description="The advanced MCP management flow has not been ported to the Svelte shell yet."
	{notes}
/>
