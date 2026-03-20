<script lang="ts">
	import { goto } from '$app/navigation'
	import { onMount } from 'svelte'

	onMount(() => {
		if (!window.matchMedia('(max-width: 960px)').matches) {
			void goto('/settings/provider', { replaceState: true })
		}
	})
</script>

<section class="settings-entry" aria-hidden="true"></section>
