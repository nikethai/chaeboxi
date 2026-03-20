<script lang="ts">
	import { page } from '$app/stores'
	import { onMount } from 'svelte'
	import ProviderEditor from '$lib/components/settings/provider/ProviderEditor.svelte'
	import { providerCatalogStore } from '$lib/stores/provider-catalog.svelte'
	import { settingsStore } from '$lib/stores/settings.svelte'

	onMount(async () => {
		await Promise.all([settingsStore.init(), providerCatalogStore.init()])
	})
</script>

<ProviderEditor providerId={$page.params.providerId} />
