<script lang="ts">
	import IncompleteState from '$lib/components/common/IncompleteState.svelte'

	const notes = [
		'Desktop-only shortcut editing exists in the React app but is not ported yet.',
		'This route stays visible on desktop so the gap is obvious instead of hidden behind dead navigation.',
	]
</script>

<IncompleteState
	eyebrow="Keyboard Shortcuts"
	title="Shortcut editing is still partial"
	description="Shortcut persistence exists in shared settings, but the dedicated Svelte shortcut editor is not ported in this milestone."
	{notes}
/>
