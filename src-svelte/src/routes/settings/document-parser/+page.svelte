<script lang="ts">
	import IncompleteState from '$lib/components/common/IncompleteState.svelte'

	const notes = [
		'Chat already links into settings when document parser configuration matters.',
		'Provider and core chat settings are real; document parser UI still needs a dedicated Svelte port.',
	]
</script>

<IncompleteState
	eyebrow="Document Parser"
	title="Document parser settings are still partial"
	description="The shared document parser config exists, but this route still needs a dedicated Svelte editor. It remains visible so the missing state is explicit rather than pretending the feature is done."
	{notes}
/>
