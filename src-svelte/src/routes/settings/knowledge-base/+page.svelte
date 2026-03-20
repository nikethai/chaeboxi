<script lang="ts">
	import IncompleteState from '$lib/components/common/IncompleteState.svelte'

	const notes = [
		'Knowledge-base management remains outside the current core-settings milestone.',
		'The route stays visible so users can distinguish missing UI from a broken link.',
	]
</script>

<IncompleteState
	eyebrow="Knowledge Base"
	title="Knowledge-base settings are still partial"
	description="Knowledge-base management and related settings remain out of scope for this Svelte pass."
	{notes}
/>
